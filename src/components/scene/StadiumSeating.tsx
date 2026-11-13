import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BOWL, BOWL_TOP, LOWER_TIER, OUTER_D, ROOF, UPPER_END, UPPER_TIER, VOM_ROWS, VOMITORIES, vomitoryBox,
} from '../../world/layout'
import { StadiumDetails } from './StadiumDetails'
import { useTour } from '../../state/tourStore'
import { at, beamMatrices, ringPoints, skeletonSamples, sweepProfile, type ProfileSeg, type Sample } from '../../world/bowlGeometry'
import { concreteTexture, ledBoardTexture, seatTextMask } from '../../world/textures'

/** Cross-section of the stands from the pitch-side wall to the roof-line cap. */
function standProfile(): ProfileSeg[] {
  const segs: ProfileSeg[] = []
  const L = LOWER_TIER
  const U = UPPER_TIER
  segs.push({ d0: 0, h0: 0, d1: 0, h1: L.base, mat: 'front' })
  segs.push({ d0: 0, h0: L.base, d1: L.start, h1: L.base, mat: 'tread' })
  segs.push({ d0: 0.04, h0: L.base, d1: 0.04, h1: L.base + 1.0, mat: 'rail' }) // pitch-side glass
  let d = L.start
  let hPrev = L.base
  for (let i = 0; i < L.rows; i++) {
    const h = L.base + i * L.rise
    if (i > 0) segs.push({ d0: d, h0: hPrev, d1: d, h1: h, mat: 'riser' })
    segs.push({ d0: d, h0: h, d1: d + L.depth, h1: h, mat: 'tread' })
    d += L.depth
    hPrev = h
  }
  segs.push({ d0: d, h0: hPrev, d1: U.start, h1: hPrev, mat: 'concourse' })
  segs.push({ d0: d, h0: hPrev, d1: d, h1: hPrev + 1.0, mat: 'rail' }) // concourse balustrade
  segs.push({ d0: U.start, h0: hPrev, d1: U.start, h1: 17.9, mat: 'boxes' })
  segs.push({ d0: U.start - 0.02, h0: 17.9, d1: U.start - 0.02, h1: 19.0, mat: 'led' })
  segs.push({ d0: U.start, h0: 19.0, d1: U.start, h1: U.base, mat: 'back' })
  segs.push({ d0: U.start + 0.05, h0: U.base, d1: U.start + 0.05, h1: U.base + 1.0, mat: 'rail' }) // upper tier front glass
  d = U.start
  hPrev = U.base
  for (let i = 0; i < U.rows; i++) {
    const h = U.base + i * U.rise
    if (i > 0) segs.push({ d0: d, h0: hPrev, d1: d, h1: h, mat: 'riser' })
    segs.push({ d0: d, h0: h, d1: d + U.depth, h1: h, mat: 'tread' })
    d += U.depth
    hPrev = h
  }
  segs.push({ d0: UPPER_END, h0: hPrev, d1: UPPER_END, h1: BOWL_TOP, mat: 'back' })
  segs.push({ d0: UPPER_END, h0: BOWL_TOP, d1: OUTER_D, h1: BOWL_TOP, mat: 'cap' })
  return segs
}

function roofProfile(): ProfileSeg[] {
  const { inner, outer, yInner, yOuter } = ROOF
  const y = (d: number) => yInner + ((d - inner) / (outer - inner)) * (yOuter - yInner)
  const split = 14
  const T = 1.1
  return [
    { d0: inner, h0: y(inner), d1: split, h1: y(split), mat: 'clear' },
    { d0: split, h0: y(split), d1: outer, h1: y(outer), mat: 'top' },
    { d0: split, h0: y(split) - T, d1: outer, h1: y(outer) - T, mat: 'under' },
    { d0: split, h0: y(split) - T, d1: split, h1: y(split), mat: 'under' },
    { d0: inner, h0: y(inner) - 0.5, d1: inner, h1: y(inner), mat: 'fascia' },
    { d0: outer, h0: y(outer) - T, d1: outer, h1: y(outer), mat: 'fascia' },
    { d0: inner + 1.2, h0: y(inner + 1.2) - 0.55, d1: inner + 2.2, h1: y(inner + 2.2) - 0.55, mat: 'lights' },
  ]
}

const isTunnelMouth = (s0: Sample, s1: Sample, seg: ProfileSeg) =>
  seg.mat === 'front' && s0.tag === 'S' && s1.tag === 'S' && s0.px >= -2.01 && s1.px <= 2.01

/** Seat model: pan + backrest, facing +Z. */
function seatGeometry() {
  const pan = new THREE.BoxGeometry(0.46, 0.06, 0.4).translate(0, 0.42, 0.04)
  const back = new THREE.BoxGeometry(0.46, 0.44, 0.05).rotateX(-0.12).translate(0, 0.66, -0.17)
  const post = new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, 0.2, 0)
  return mergeGeometries([pan, back, post])!
}

function isAisle(s: Sample, D: number) {
  const part = s.tag
  if (part === 'N' || part === 'S' || part === 'E' || part === 'W') {
    return ((s.along + 6) % 12) < 1.1
  }
  const arcLen = (Math.PI / 2) * D
  return [1 / 3, 2 / 3].some((k) => Math.abs(s.t - k) * arcLen < 0.55)
}

function buildSeats(simple: boolean) {
  const north = seatTextMask('north', ['MANCHESTER', 'UNITED'])
  const west = seatTextMask('west', ['STRETFORD', 'END'], 1120, 560)
  const red = new THREE.Color('#c20f22')
  const white = new THREE.Color('#f1f1ee')
  const vomBoxes = VOMITORIES.map(vomitoryBox)
  // one chunk per side & tier so off-screen chunks are frustum-culled
  const chunks = new Map<string, { m: THREE.Matrix4[]; c: THREE.Color[] }>()
  const tmpQ = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)

  const addTier = (tier: typeof LOWER_TIER, key: string, lettering: boolean) => {
    for (let i = 0; i < tier.rows; i++) {
      const d = tier.start + i * tier.depth + tier.depth * 0.6
      const y = tier.base + i * tier.rise
      const D = BOWL.r + d
      for (const s of ringPoints(D, 0.55)) {
        if (isAisle(s, D)) continue
        const p = at(s, d, y)
        if (key === 'L' && i >= VOM_ROWS.first - 1 && i < VOM_ROWS.first + VOM_ROWS.count &&
          vomBoxes.some((b) => p.x > b.minX - 0.25 && p.x < b.maxX + 0.25 && p.z > b.minZ - 0.6 && p.z < b.maxZ + 0.6)) continue
        tmpQ.setFromAxisAngle(up, Math.atan2(-s.nx, -s.nz))
        let c = red
        if (lettering) {
          const v = 1 - (i + 0.5) / tier.rows
          if (s.tag === 'N' && north((p.x + 46) / 92, v)) c = white
          if (s.tag === 'W' && west((-p.z + 28) / 56, v)) c = white
        }
        const ck = `${key}-${s.tag}`
        let chunk = chunks.get(ck)
        if (!chunk) chunks.set(ck, (chunk = { m: [], c: [] }))
        chunk.m.push(new THREE.Matrix4().compose(p, tmpQ, new THREE.Vector3(1, 1, 1)))
        chunk.c.push(c)
      }
    }
  }
  addTier(LOWER_TIER, 'L', true)
  addTier(UPPER_TIER, 'U', false)

  const geo = simple ? new THREE.BoxGeometry(0.46, 0.5, 0.42).translate(0, 0.42, -0.02) : seatGeometry()
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.05 })
  return [...chunks.values()].map(({ m, c }) => {
    const mesh = new THREE.InstancedMesh(geo, mat, m.length)
    m.forEach((mx, i) => {
      mesh.setMatrixAt(i, mx)
      mesh.setColorAt(i, c[i])
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.receiveShadow = !simple
    mesh.castShadow = false
    mesh.computeBoundingSphere()
    return mesh
  })
}

function buildRoofTrusses() {
  const beams: [THREE.Vector3, THREE.Vector3, number][] = []
  const arms = ringPoints(BOWL.r + 22, 11.5)
  const top = (s: Sample) => at(s, 22, 50.5)
  const mid = (s: Sample) => at(s, 35, 47.5)
  arms.forEach((s, i) => {
    const next = arms[(i + 1) % arms.length]
    beams.push([at(s, ROOF.outer, ROOF.yOuter), top(s), 0.55])
    beams.push([top(s), at(s, ROOF.inner + 0.5, ROOF.yInner + 0.2), 0.45])
    beams.push([top(s), at(s, 22, 42), 0.4])
    beams.push([mid(s), at(s, 30, 42.2), 0.3])
    beams.push([top(s), top(next), 0.45])
    beams.push([mid(s), mid(next), 0.35])
    beams.push([top(s), mid(next), 0.25])
  })
  const mats = beamMatrices(beams)
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#f2f3f5', roughness: 0.45, metalness: 0.3 }),
    mats.length,
  )
  mats.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = true
  mesh.frustumCulled = false
  return mesh
}

/** Terraces, seats, executive-box band and roof for the whole bowl. */
export function StadiumSeating() {
  const quality = useTour((s) => s.quality)
  const seats = useMemo(() => buildSeats(quality === 'low'), [quality])
  const { stands, roof, trusses, materials } = useMemo(() => {
    const samples = skeletonSamples()
    const concrete = concreteTexture().clone()
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping
    concrete.repeat.set(0.25, 0.25)
    concrete.needsUpdate = true
    const materials: Record<string, THREE.Material> = {
      front: new THREE.MeshStandardMaterial({ color: '#7d0c15', roughness: 0.7 }),
      tread: new THREE.MeshStandardMaterial({ color: '#8f8f8d', map: concrete, roughness: 0.95 }),
      riser: new THREE.MeshStandardMaterial({ color: '#7a7a79', roughness: 0.95 }),
      concourse: new THREE.MeshStandardMaterial({ color: '#6b6b6a', roughness: 0.9 }),
      boxes: new THREE.MeshStandardMaterial({ color: '#141a22', roughness: 0.15, metalness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 0.18 }),
      back: new THREE.MeshStandardMaterial({ color: '#6c6c6f', roughness: 0.9, emissive: '#2a2a2c', emissiveIntensity: 0.6 }),
      cap: new THREE.MeshStandardMaterial({ color: '#4a4a4c', roughness: 0.9 }),
      clear: new THREE.MeshStandardMaterial({ color: '#dfe9ee', roughness: 0.3, transparent: true, opacity: 0.35, depthWrite: false }),
      top: new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.6, metalness: 0.4 }),
      under: new THREE.MeshStandardMaterial({ color: '#8a8e95', roughness: 0.8, emissive: '#3b3e44', emissiveIntensity: 0.7 }),
      fascia: new THREE.MeshStandardMaterial({ color: '#e9eaec', roughness: 0.5 }),
      lights: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 2.2 }),
      rail: new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false }),
      led: (() => {
        const t = ledBoardTexture(0).clone()
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.repeat.set(1 / 23, 1 / 1.1)
        t.offset.set(0, -17.9 / 1.1)
        t.needsUpdate = true
        return new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
      })(),
    }
    for (const m of Object.values(materials)) (m as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    return {
      stands: sweepProfile(samples, standProfile(), isTunnelMouth),
      roof: sweepProfile(samples, roofProfile()),
      trusses: buildRoofTrusses(),
      materials,
    }
  }, [])

  return (
    <group name="StadiumSeating">
      {Object.entries(stands).map(([k, g]) => (
        <mesh key={k} geometry={g} material={materials[k]} castShadow={!['boxes', 'rail', 'led'].includes(k)} receiveShadow={k !== 'rail'} />
      ))}
      {Object.entries(roof).map(([k, g]) => (
        <mesh key={`roof-${k}`} geometry={g} material={materials[k]} castShadow={k === 'top'} receiveShadow={k !== 'lights'} />
      ))}
      {seats.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <StadiumDetails />
      <primitive object={trusses} />
    </group>
  )
}
