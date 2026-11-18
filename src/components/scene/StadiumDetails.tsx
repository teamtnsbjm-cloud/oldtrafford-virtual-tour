import { useMemo } from 'react'
import * as THREE from 'three'
import { BOWL, LOWER_TIER, PITCH_STAIRS, ROOF, STAIR_STEPS, STAIR_W, UPPER_TIER, VOM_ROWS, VOMITORIES, vomitoryBox, type Box } from '../../world/layout'
import { Sign } from './props/common'
import { at, beamMatrices, PARTS, partPoint, ringPoints, type Sample } from '../../world/bowlGeometry'

/*
 * Bowl detail layer: aisle stairs with yellow nosings, vomitory openings with
 * railings, roof rafters/purlins and the floodlight strip under the roof edge.
 * Everything repeated is an InstancedMesh with a computed bounding sphere so
 * off-screen parts are frustum-culled.
 */

const Y = new THREE.Vector3(0, 1, 0)
function inst(geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], cast = false) {
  const m = new THREE.InstancedMesh(geo, mat, ms.length)
  ms.forEach((x, i) => m.setMatrixAt(i, x))
  m.instanceMatrix.needsUpdate = true
  m.castShadow = cast
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}

/** Aisle centre positions on the skeleton (matches the seat gaps in StadiumSeating). */
export function aisleSamples(): Sample[] {
  const out: Sample[] = []
  PARTS.forEach((p, partIndex) => {
    if (p.kind === 'line') {
      const len = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1])
      for (let a = 6.55; a < len; a += 12) {
        const t = a / len
        out.push({ ...partPoint(p, t), tag: p.tag, along: a, partIndex, t })
      }
    } else {
      for (const t of [1 / 3, 2 / 3]) out.push({ ...partPoint(p, t), tag: p.tag, along: t, partIndex, t })
    }
  })
  return out
}

const insideAny = (boxes: Box[], x: number, z: number) => boxes.some((b) => x > b.minX - 0.2 && x < b.maxX + 0.2 && z > b.minZ - 0.2 && z < b.maxZ + 0.2)

function buildStairs(vomBoxes: Box[]) {
  const steps: THREE.Matrix4[] = []
  const noses: THREE.Matrix4[] = []
  const q = new THREE.Quaternion()
  const tiers = [LOWER_TIER, UPPER_TIER]
  for (const s of aisleSamples()) {
    const rotY = Math.atan2(s.nx, s.nz)
    q.setFromAxisAngle(Y, rotY)
    for (const T of tiers) {
      for (let i = 0; i < T.rows; i++) {
        const d0 = T.start + i * T.depth
        const h = T.base + i * T.rise
        const p = at(s, d0 + T.depth * 0.25, h + T.rise * 0.25)
        if (insideAny(vomBoxes, p.x, p.z)) continue
        // half step on the front half of every row
        steps.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1.05, T.rise * 0.5, T.depth * 0.5)))
        const n1 = at(s, d0 + 0.03, h + 0.012)
        const n2 = at(s, d0 + T.depth * 0.5 + 0.03, h + T.rise * 0.5 + 0.012)
        noses.push(new THREE.Matrix4().compose(n1, q, new THREE.Vector3(1.05, 0.025, 0.06)))
        noses.push(new THREE.Matrix4().compose(n2, q, new THREE.Vector3(1.05, 0.025, 0.06)))
      }
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1)
  return [
    inst(box, new THREE.MeshStandardMaterial({ color: '#9c9c9a', roughness: 0.9 }), steps),
    inst(box, new THREE.MeshStandardMaterial({ color: '#f2c200', roughness: 0.6, emissive: '#f2c200', emissiveIntensity: 0.15 }), noses),
  ]
}

function buildRoofStructure() {
  const { inner, outer, yInner, yOuter } = ROOF
  const y = (d: number) => yInner + ((d - inner) / (outer - inner)) * (yOuter - yInner)
  const rafters = ringPoints(BOWL.r + 28, 6.5)
  const beams: [THREE.Vector3, THREE.Vector3, number][] = []
  rafters.forEach((s, i) => {
    const n = rafters[(i + 1) % rafters.length]
    beams.push([at(s, inner + 0.6, y(inner + 0.6) - 0.7), at(s, outer, y(outer) - 1.3), 0.32])
    for (const d of [12, 22, 32, 42]) beams.push([at(s, d, y(d) - 1.22), at(n, d, y(d) - 1.22), 0.18])
  })
  const lights = ringPoints(BOWL.r + inner + 0.9, 3.2).map((s) => {
    const p = at(s, inner + 0.9, y(inner + 0.9) - 0.85)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, Math.atan2(-s.nx, -s.nz), 0, 'YXZ'))
    return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1.1, 0.45, 0.35))
  })
  // white lattice girder running round the leading edge of the roof (visible from inside the bowl)
  const edge = ringPoints(BOWL.r + inner + 1.6, 4)
  edge.forEach((s, i) => {
    const n = edge[(i + 1) % edge.length]
    const d = inner + 1.6
    const top = (q: Sample) => at(q, d, y(d) - 0.75)
    const bot = (q: Sample) => at(q, d, y(d) - 3.4)
    beams.push([top(s), top(n), 0.28], [bot(s), bot(n), 0.28], [top(s), bot(s), 0.16], [i % 2 ? top(s) : bot(s), i % 2 ? bot(n) : top(n), 0.16])
  })
  // exposed lattice trusses sitting ON TOP of the roof (the cantilever structure seen in photos of the
  // bowl): a longitudinal girder running round the stand plus transverse trusses every other rafter
  const RIDGE = 20
  const RISE = 4.2
  const onRoof = (q: Sample, d: number, h: number) => at(q, d, y(d) + h)
  const ridge = ringPoints(BOWL.r + RIDGE, 5)
  ridge.forEach((s, i) => {
    const n = ridge[(i + 1) % ridge.length]
    beams.push([onRoof(s, RIDGE, RISE), onRoof(n, RIDGE, RISE), 0.22], [onRoof(s, RIDGE, 0.3), onRoof(n, RIDGE, 0.3), 0.2])
    beams.push([onRoof(s, RIDGE, 0.3), onRoof(s, RIDGE, RISE), 0.12], [i % 2 ? onRoof(s, RIDGE, 0.3) : onRoof(s, RIDGE, RISE), i % 2 ? onRoof(n, RIDGE, RISE) : onRoof(n, RIDGE, 0.3), 0.12])
  })
  rafters.forEach((s, i) => {
    if (i % 2) return
    const d0 = inner + 1
    const d1 = outer - 1
    const topH = (d: number) => (d <= RIDGE ? 0.3 + ((d - d0) / (RIDGE - d0)) * (RISE - 0.3) : RISE - ((d - RIDGE) / (d1 - RIDGE)) * (RISE - 0.3))
    beams.push([onRoof(s, d0, 0.3), onRoof(s, RIDGE, RISE), 0.2], [onRoof(s, RIDGE, RISE), onRoof(s, d1, 0.3), 0.2], [onRoof(s, d0, 0.3), onRoof(s, d1, 0.3), 0.18])
    let flip = false
    for (let d = d0 + 3; d < d1 - 0.5; d += 3) {
      beams.push([onRoof(s, d, 0.3), onRoof(s, d, topH(d)), 0.1])
      const dn = Math.min(d + 3, d1)
      beams.push(flip ? [onRoof(s, d, 0.3), onRoof(s, dn, topH(dn)), 0.1] : [onRoof(s, d, topH(d)), onRoof(s, dn, 0.3), 0.1])
      flip = !flip
    }
  })
  const steel = new THREE.MeshStandardMaterial({ color: '#eceef1', roughness: 0.45, metalness: 0.35 })
  return [
    inst(new THREE.BoxGeometry(1, 1, 1), steel, beamMatrices(beams)),
    inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fffaf0').multiplyScalar(2.2), toneMapped: false }), lights),
  ]
}

function Vomitory({ v }: { v: (typeof VOMITORIES)[number] }) {
  const b = vomitoryBox(v)
  const yLow = LOWER_TIER.base + (VOM_ROWS.first - 1) * LOWER_TIER.rise
  const h = b.maxY - yLow
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const mats = useMemo(() => {
    const concrete = new THREE.MeshStandardMaterial({ color: '#8e8e8c', roughness: 0.9 })
    const dark = new THREE.MeshStandardMaterial({ color: '#070708', roughness: 1 })
    // face order: +x, -x, +y, -y, +z, -z — the pitch-facing face is the dark opening
    const open = { N: 4, S: 5, E: 1, W: 0 }[v.side]
    return Array.from({ length: 6 }, (_, i) => (i === open ? dark : concrete))
  }, [v.side])
  const rail = <meshStandardMaterial color="#d7d9dc" metalness={0.8} roughness={0.3} />
  const alongX = v.side === 'N' || v.side === 'S'
  const lenSide = alongX ? d : w
  const front = { N: b.maxZ, S: b.minZ, E: b.minX, W: b.maxX }[v.side]
  return (
    <group>
      <mesh position={[(b.minX + b.maxX) / 2, yLow + h / 2, (b.minZ + b.maxZ) / 2]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* side rails */}
      {[-1, 1].map((s) => {
        const off = (alongX ? w : d) / 2 - 0.05
        const cx = alongX ? (b.minX + b.maxX) / 2 + s * off : (b.minX + b.maxX) / 2
        const cz = alongX ? (b.minZ + b.maxZ) / 2 : (b.minZ + b.maxZ) / 2 + s * off
        return (
          <group key={s}>
            <mesh position={[cx, b.maxY + 1.0, cz]}>
              <boxGeometry args={alongX ? [0.05, 0.05, lenSide] : [lenSide, 0.05, 0.05]} />
              {rail}
            </mesh>
            <mesh position={[cx, b.maxY + 0.5, cz]}>
              <boxGeometry args={alongX ? [0.03, 1, lenSide] : [lenSide, 1, 0.03]} />
              <meshStandardMaterial color="#cfe6ee" transparent opacity={0.25} depthWrite={false} />
            </mesh>
          </group>
        )
      })}
      {/* front rail across the opening */}
      <mesh position={alongX ? [(b.minX + b.maxX) / 2, b.maxY + 1.0, front] : [front, b.maxY + 1.0, (b.minZ + b.maxZ) / 2]}>
        <boxGeometry args={alongX ? [w, 0.05, 0.05] : [0.05, 0.05, d]} />
        {rail}
      </mesh>
    </group>
  )
}

/** Concrete stairs from the pitch surround up to the front row, with handrails. */
function buildPitchStairs() {
  const run = LOWER_TIER.base
  const stepH = LOWER_TIER.base / STAIR_STEPS
  const stepD = run / STAIR_STEPS
  const steps: THREE.Matrix4[] = []
  const noses: THREE.Matrix4[] = []
  const rails: [THREE.Vector3, THREE.Vector3, number][] = []
  const q = new THREE.Quaternion()
  for (const st of PITCH_STAIRS) {
    // local frame: u = across (tangent), o = outward (toward the stand)
    const ns = st.side === 'N' || st.side === 'S'
    const sign = st.side === 'S' || st.side === 'E' ? 1 : -1
    const base = (ns ? BOWL.b : BOWL.a) - run
    const pt = (across: number, out: number, y: number) =>
      ns ? new THREE.Vector3(st.along + across, y, sign * (base + out)) : new THREE.Vector3(sign * (base + out), y, st.along + across)
    for (let k = 1; k <= STAIR_STEPS; k++) {
      const h = k * stepH
      const c = pt(0, (k - 0.5) * stepD, h / 2)
      steps.push(new THREE.Matrix4().compose(c, q, ns ? new THREE.Vector3(STAIR_W, h, stepD) : new THREE.Vector3(stepD, h, STAIR_W)))
      const n = pt(0, (k - 1) * stepD + 0.03, h + 0.012)
      noses.push(new THREE.Matrix4().compose(n, q, ns ? new THREE.Vector3(STAIR_W, 0.025, 0.06) : new THREE.Vector3(0.06, 0.025, STAIR_W)))
    }
    for (const a of [-STAIR_W / 2, STAIR_W / 2]) {
      rails.push([pt(a, 0, 1.0), pt(a, run, LOWER_TIER.base + 1.0), 0.05])
      for (let k = 0; k <= 4; k++) {
        const o = (k / 4) * run
        const y = (o / run) * LOWER_TIER.base
        rails.push([pt(a, o, y), pt(a, o, y + 1.0), 0.04])
      }
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1)
  return [
    inst(box, new THREE.MeshStandardMaterial({ color: '#8d8c89', roughness: 0.9 }), steps, true),
    inst(box, new THREE.MeshStandardMaterial({ color: '#f2c200', roughness: 0.6 }), noses),
    inst(box, new THREE.MeshStandardMaterial({ color: '#d7d9dc', metalness: 0.8, roughness: 0.3 }), beamMatrices(rails)),
  ]
}

/** Stand names on the white fascia under the roof edge (publicly known names; fan rendering, not official signage). */
const FASCIA: { side: 'N' | 'S' | 'E' | 'W'; text: string; width: number }[] = [
  { side: 'N', text: 'SIR ALEX FERGUSON STAND', width: 30 },
  { side: 'W', text: 'STRETFORD END', width: 20 },
  { side: 'E', text: 'EAST STAND', width: 16 },
  { side: 'S', text: 'SIR BOBBY CHARLTON STAND', width: 30 },
]
function StandFascia() {
  const d = ROOF.inner + 1.3
  const yAt = ROOF.yInner + ((d - ROOF.inner) / (ROOF.outer - ROOF.inner)) * (ROOF.yOuter - ROOF.yInner) - 2.1
  return (
    <>
      {FASCIA.map((f) => {
        const ns = f.side === 'N' || f.side === 'S'
        const sign = f.side === 'S' || f.side === 'E' ? 1 : -1
        const off = (ns ? BOWL.b : BOWL.a) + d
        const pos: [number, number, number] = ns ? [0, yAt, sign * off] : [sign * off, yAt, 0]
        const rotY = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[f.side]
        return (
          <group key={f.side}>
            <mesh position={[pos[0] + (ns ? 0 : sign * 0.06), pos[1], pos[2] + (ns ? sign * 0.06 : 0)]} rotation={[0, rotY, 0]}>
              <planeGeometry args={[f.width + 6, 1.5]} />
              <meshStandardMaterial color="#f1f1f1" roughness={0.6} />
            </mesh>
            <Sign
              id={'fascia-' + f.side}
              lines={[{ text: f.text, size: 0.62, color: '#c4141c', font: "'Arial Black',sans-serif", weight: '900' }]}
              width={f.width}
              height={1.1}
              position={pos}
              rotationY={rotY}
            />
          </group>
        )
      })}
    </>
  )
}

export function StadiumDetails() {
  const objs = useMemo(() => {
    const vomBoxes = VOMITORIES.map(vomitoryBox)
    return [...buildStairs(vomBoxes), ...buildRoofStructure(), ...buildPitchStairs()]
  }, [])
  return (
    <group name="StadiumDetails">
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      {VOMITORIES.map((v, i) => (
        <Vomitory key={i} v={v} />
      ))}
      <StandFascia />
    </group>
  )
}
