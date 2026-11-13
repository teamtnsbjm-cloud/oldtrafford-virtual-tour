import * as THREE from 'three'
import { BOWL } from './layout'

/**
 * Procedural stadium bowl.
 *
 * The bowl follows a rounded-rectangle "skeleton" (half extents a-r, b-r).
 * Any point on a stand is   skeletonPoint + outwardNormal * (r + d)
 * where d is the distance from the inner edge of the stands. A cross-section
 * profile (d, h) is swept along the skeleton to produce the stepped terraces,
 * facade and roof as one continuous ring with rounded corners.
 */

export type SideTag = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW'

interface LinePart { kind: 'line'; from: [number, number]; to: [number, number]; n: [number, number]; tag: SideTag }
interface ArcPart { kind: 'arc'; c: [number, number]; a0: number; a1: number; tag: SideTag }
type Part = LinePart | ArcPart

const A = BOWL.a - BOWL.r
const B = BOWL.b - BOWL.r

export const PARTS: Part[] = [
  { kind: 'line', from: [-A, B], to: [A, B], n: [0, 1], tag: 'S' },
  { kind: 'arc', c: [A, B], a0: Math.PI / 2, a1: 0, tag: 'SE' },
  { kind: 'line', from: [A, B], to: [A, -B], n: [1, 0], tag: 'E' },
  { kind: 'arc', c: [A, -B], a0: 0, a1: -Math.PI / 2, tag: 'NE' },
  { kind: 'line', from: [A, -B], to: [-A, -B], n: [0, -1], tag: 'N' },
  { kind: 'arc', c: [-A, -B], a0: -Math.PI / 2, a1: -Math.PI, tag: 'NW' },
  { kind: 'line', from: [-A, -B], to: [-A, B], n: [-1, 0], tag: 'W' },
  { kind: 'arc', c: [-A, B], a0: -Math.PI, a1: -1.5 * Math.PI, tag: 'SW' },
]

export interface Sample {
  px: number
  pz: number
  nx: number
  nz: number
  tag: SideTag
  /** position along the skeleton part in metres (straights) or radians fraction (arcs) */
  along: number
  partIndex: number
  t: number
}

export function partPoint(p: Part, t: number): { px: number; pz: number; nx: number; nz: number } {
  if (p.kind === 'line') {
    return { px: p.from[0] + (p.to[0] - p.from[0]) * t, pz: p.from[1] + (p.to[1] - p.from[1]) * t, nx: p.n[0], nz: p.n[1] }
  }
  const a = p.a0 + (p.a1 - p.a0) * t
  return { px: p.c[0], pz: p.c[1], nx: Math.cos(a), nz: Math.sin(a) }
}

function partLength(p: Part, D: number) {
  return p.kind === 'line' ? Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]) : Math.abs(p.a1 - p.a0) * D
}

/** Fixed skeleton samples (1 m on straights, 16 steps per corner). Closed loop. */
export function skeletonSamples(lineStep = 1, arcSteps = 16): Sample[] {
  const out: Sample[] = []
  PARTS.forEach((p, partIndex) => {
    const steps = p.kind === 'line' ? Math.round(partLength(p, 0) / lineStep) : arcSteps
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const pt = partPoint(p, t)
      out.push({ ...pt, tag: p.tag, along: p.kind === 'line' ? t * partLength(p, 0) : t, partIndex, t })
    }
  })
  return out
}

/** Evenly spaced points along the ring at offset D (= r + d) from the skeleton. */
export function ringPoints(D: number, spacing: number): Sample[] {
  const lens = PARTS.map((p) => partLength(p, D))
  const total = lens.reduce((s, l) => s + l, 0)
  const n = Math.floor(total / spacing)
  const out: Sample[] = []
  let partIndex = 0
  let partStart = 0
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) * total) / n
    while (s > partStart + lens[partIndex]) {
      partStart += lens[partIndex]
      partIndex++
    }
    const p = PARTS[partIndex]
    const t = (s - partStart) / lens[partIndex]
    const pt = partPoint(p, t)
    out.push({ ...pt, tag: p.tag, along: p.kind === 'line' ? t * partLength(p, 0) : t, partIndex, t })
  }
  return out
}

export interface ProfileSeg {
  d0: number
  h0: number
  d1: number
  h1: number
  mat: string
}

/**
 * Sweeps a cross-section along the skeleton.
 * Returns one non-indexed BufferGeometry per material key.
 * `skip(sample, nextSample, seg)` can cut holes (tunnel mouth, glass facade...).
 */
export function sweepProfile(
  samples: Sample[],
  profile: ProfileSeg[],
  skip?: (s0: Sample, s1: Sample, seg: ProfileSeg) => boolean,
): Record<string, THREE.BufferGeometry> {
  const buckets: Record<string, { pos: number[]; uv: number[] }> = {}
  const R = BOWL.r
  // cumulative arc length per sample at a given offset (for UVs)
  const cumCache = new Map<number, number[]>()
  const cum = (D: number) => {
    let arr = cumCache.get(D)
    if (arr) return arr
    arr = [0]
    for (let i = 1; i <= samples.length; i++) {
      const a = samples[i - 1]
      const b = samples[i % samples.length]
      const ax = a.px + a.nx * D, az = a.pz + a.nz * D
      const bx = b.px + b.nx * D, bz = b.pz + b.nz * D
      arr.push(arr[i - 1] + Math.hypot(bx - ax, bz - az))
    }
    cumCache.set(D, arr)
    return arr
  }
  for (let i = 0; i < samples.length; i++) {
    const s0 = samples[i]
    const s1 = samples[(i + 1) % samples.length]
    for (const seg of profile) {
      if (skip && skip(s0, s1, seg)) continue
      const b = (buckets[seg.mat] ??= { pos: [], uv: [] })
      const D0 = R + seg.d0
      const D1 = R + seg.d1
      const c0 = cum(D0)
      const c1 = cum(D1)
      const p = (s: Sample, D: number, h: number) => [s.px + s.nx * D, h, s.pz + s.nz * D]
      const a = p(s0, D0, seg.h0)
      const bq = p(s1, D0, seg.h0)
      const c = p(s1, D1, seg.h1)
      const d = p(s0, D1, seg.h1)
      const vertical = Math.abs(seg.h1 - seg.h0) > Math.abs(seg.d1 - seg.d0)
      const v0 = vertical ? seg.h0 : seg.d0
      const v1 = vertical ? seg.h1 : seg.d1
      const ua0 = c0[i], ub0 = c0[i + 1], ua1 = c1[i], ub1 = c1[i + 1]
      b.pos.push(...a, ...bq, ...c, ...a, ...c, ...d)
      b.uv.push(ua0, v0, ub0, v0, ub1, v1, ua0, v0, ub1, v1, ua1, v1)
    }
  }
  const out: Record<string, THREE.BufferGeometry> = {}
  for (const [k, v] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v.pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(v.uv, 2))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    out[k] = g
  }
  return out
}

/** World position for a skeleton sample at bowl distance d. */
export function at(s: { px: number; pz: number; nx: number; nz: number }, d: number, y: number): THREE.Vector3 {
  const D = BOWL.r + d
  return new THREE.Vector3(s.px + s.nx * D, y, s.pz + s.nz * D)
}

/** Build instance matrices for thin beams between point pairs (unit box scaled along Z). */
export function beamMatrices(beams: [THREE.Vector3, THREE.Vector3, number][]): THREE.Matrix4[] {
  const zAxis = new THREE.Vector3(0, 0, 1)
  return beams.map(([p0, p1, thick]) => {
    const dir = new THREE.Vector3().subVectors(p1, p0)
    const len = dir.length()
    const q = new THREE.Quaternion().setFromUnitVectors(zAxis, dir.normalize())
    const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5)
    return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(thick, thick, len))
  })
}
