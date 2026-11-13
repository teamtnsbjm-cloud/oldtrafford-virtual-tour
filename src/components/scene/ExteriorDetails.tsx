import { useMemo } from 'react'
import * as THREE from 'three'
import { BOWL, CORNER_TOWERS, FLAGPOLES, OUTER_D, PLANTERS } from '../../world/layout'
import { at, ringPoints, skeletonSamples, sweepProfile, type Sample } from '../../world/bowlGeometry'
import { brickTexture, gateSignTexture, grainTexture, plazaTexture } from '../../world/textures'

/*
 * Architectural detail for the stadium shell and plaza:
 *  - brick piers, concrete ledges and window strips that break up the facade
 *  - numbered turnstile gates around the ground floor
 *  - corner stair cores
 *  - patterned plaza paving, planters, flagpoles, lawns, bollards
 * Proportions are a fan approximation based on public photos supplied with the
 * brief — not surveyed drawings.
 */

const GLASS_HALF = 40
const isGlassFront = (s: Sample) => s.tag === 'S' && Math.abs(s.px) <= GLASS_HALF + 1

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], ms: THREE.Matrix4[], cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, ms.length)
  ms.forEach((x, i) => m.setMatrixAt(i, x))
  m.instanceMatrix.needsUpdate = true
  m.castShadow = cast
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}

const Y = new THREE.Vector3(0, 1, 0)
function place(p: THREE.Vector3, rotY: number, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(Y, rotY), new THREE.Vector3(sx, sy, sz))
}

function FacadeArticulation() {
  const objs = useMemo(() => {
    const brick = brickTexture().clone()
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping
    brick.repeat.set(0.25, 0.25)
    brick.needsUpdate = true
    const pierMat = new THREE.MeshStandardMaterial({ map: brick, color: '#d8b0a4', roughness: 0.92 })
    const concrete = new THREE.MeshStandardMaterial({ color: '#b9b6b0', roughness: 0.85 })
    const doorMat = new THREE.MeshStandardMaterial({ color: '#1a1c1f', roughness: 0.5, metalness: 0.5 })
    const grille = new THREE.MeshStandardMaterial({ color: '#5b5f66', roughness: 0.4, metalness: 0.8 })

    // ---- piers every ~8 m
    const piers = ringPoints(BOWL.r + OUTER_D, 8).filter((s) => !isGlassFront(s))
    const pierMs = piers.map((s) => place(at(s, OUTER_D + 0.32, 15), Math.atan2(s.nx, s.nz), 1.1, 30, 0.64))

    // ---- gates in every third bay
    const gateMs: THREE.Matrix4[] = []
    const canopyMs: THREE.Matrix4[] = []
    const barMs: THREE.Matrix4[] = []
    const signs: { pos: THREE.Vector3; rotY: number; label: string }[] = []
    const counters: Record<string, number> = {}
    piers.forEach((s, i) => {
      const n = piers[(i + 1) % piers.length]
      if (i % 3 !== 1 || n.tag !== s.tag) return
      const mid = { px: (s.px + n.px) / 2, pz: (s.pz + n.pz) / 2, nx: (s.nx + n.nx) / 2, nz: (s.nz + n.nz) / 2 }
      const len = Math.hypot(mid.nx, mid.nz)
      mid.nx /= len
      mid.nz /= len
      const rotY = Math.atan2(mid.nx, mid.nz)
      gateMs.push(place(at(mid, OUTER_D + 0.08, 1.7), rotY, 4, 3.4, 0.25))
      canopyMs.push(place(at(mid, OUTER_D + 0.9, 3.65), rotY, 5, 0.16, 1.8))
      for (let k = -6; k <= 6; k++) {
        const side = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY)).multiplyScalar(k * 0.3)
        barMs.push(place(at(mid, OUTER_D + 0.24, 1.6).add(side), rotY, 0.05, 3.1, 0.05))
      }
      const letter = s.tag[0]
      counters[letter] = (counters[letter] ?? 0) + 1
      signs.push({ pos: at(mid, OUTER_D + 0.3, 4.3), rotY, label: `${letter}${counters[letter]}` })
    })

    // ---- ledges + window strips (swept around the ring)
    const strip = sweepProfile(
      skeletonSamples(),
      [
        { d0: OUTER_D, h0: 10, d1: OUTER_D + 0.45, h1: 10, mat: 'ledge' },
        { d0: OUTER_D + 0.45, h0: 9.7, d1: OUTER_D + 0.45, h1: 10, mat: 'ledge' },
        { d0: OUTER_D, h0: 20, d1: OUTER_D + 0.45, h1: 20, mat: 'ledge' },
        { d0: OUTER_D + 0.45, h0: 19.7, d1: OUTER_D + 0.45, h1: 20, mat: 'ledge' },
        { d0: OUTER_D + 0.03, h0: 11.2, d1: OUTER_D + 0.03, h1: 13.4, mat: 'win' },
        { d0: OUTER_D + 0.03, h0: 21.4, d1: OUTER_D + 0.03, h1: 24.6, mat: 'win' },
      ],
      (s0, s1) => isGlassFront(s0) || isGlassFront(s1),
    )
    const stripMats: Record<string, THREE.Material> = {
      ledge: concrete,
      win: new THREE.MeshStandardMaterial({ color: '#1d2e35', roughness: 0.06, metalness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0.03, side: THREE.DoubleSide }),
    }

    const box = new THREE.BoxGeometry(1, 1, 1)
    return {
      meshes: [
        instanced(box, pierMat, pierMs),
        instanced(box, doorMat, gateMs, false),
        instanced(box, concrete, canopyMs),
        instanced(box, grille, barMs, false),
      ],
      strip,
      stripMats,
      signs,
    }
  }, [])

  return (
    <group name="FacadeArticulation">
      {objs.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {Object.entries(objs.strip).map(([k, g]) => (
        <mesh key={k} geometry={g} material={objs.stripMats[k]} receiveShadow castShadow={k === 'ledge'} />
      ))}
      {objs.signs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation={[0, s.rotY, 0]}>
          <planeGeometry args={[1.4, 0.7]} />
          <meshBasicMaterial map={gateSignTexture(s.label)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function CornerTowers() {
  const mats = useMemo(() => {
    const brick = brickTexture().clone()
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping
    brick.repeat.set(3, 6)
    brick.needsUpdate = true
    return {
      brick: new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 }),
      cap: new THREE.MeshStandardMaterial({ color: '#3d4046', roughness: 0.5, metalness: 0.4 }),
      slit: new THREE.MeshStandardMaterial({ color: '#10181c', roughness: 0.1, metalness: 0.8, emissive: '#ffd9a0', emissiveIntensity: 0.15 }),
    }
  }, [])
  return (
    <group name="CornerTowers">
      {CORNER_TOWERS.map((t, i) => {
        const out = Math.atan2(Math.sign(t.x), Math.sign(t.z))
        return (
          <group key={i} position={[t.x, 0, t.z]}>
            <mesh position={[0, 17, 0]} material={mats.brick} castShadow receiveShadow>
              <cylinderGeometry args={[t.r, t.r, 34, 32]} />
            </mesh>
            <mesh position={[0, 35.2, 0]} material={mats.cap} castShadow>
              <cylinderGeometry args={[t.r + 0.4, t.r + 0.4, 2.4, 32]} />
            </mesh>
            <group rotation={[0, out, 0]}>
              <mesh position={[0, 17, t.r - 0.05]} material={mats.slit}>
                <boxGeometry args={[1.2, 26, 0.3]} />
              </mesh>
              <mesh position={[0, 1.5, t.r + 0.1]} material={mats.cap}>
                <boxGeometry args={[3, 3, 0.4]} />
              </mesh>
            </group>
          </group>
        )
      })}
    </group>
  )
}

function Landscaping() {
  const objs = useMemo(() => {
    const plaza = plazaTexture().clone()
    plaza.wrapS = plaza.wrapT = THREE.RepeatWrapping
    plaza.repeat.set(120 / 6, 60 / 6)
    plaza.needsUpdate = true
    const grain = grainTexture().clone()
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping
    grain.repeat.set(40, 40)
    grain.needsUpdate = true
    const stone = new THREE.MeshStandardMaterial({ color: '#9d9890', roughness: 0.8, bumpMap: grain, bumpScale: 0.6 })
    const hedge = new THREE.MeshStandardMaterial({ color: '#3f6b33', roughness: 0.95, bumpMap: grain, bumpScale: 3 })
    const metal = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.35, metalness: 0.8 })
    const box = new THREE.BoxGeometry(1, 1, 1)
    const bollards: THREE.Matrix4[] = []
    for (const [a, b] of [[-40, -30], [30, 40]]) for (let x = a + 1; x < b; x += 1.6) bollards.push(place(new THREE.Vector3(x, 0.45, 152), 0, 0.18, 0.9, 0.18))
    return {
      plaza: new THREE.MeshStandardMaterial({ map: plaza, roughness: 0.85, bumpMap: grain, bumpScale: 0.4 }),
      lawn: new THREE.MeshStandardMaterial({ color: '#4c7d3a', roughness: 1, bumpMap: grain, bumpScale: 2 }),
      stone,
      hedge,
      metal,
      bollards: instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), metal, bollards),
      box,
    }
  }, [])
  return (
    <group name="Landscaping">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 120.5]} material={objs.plaza} receiveShadow>
        <planeGeometry args={[120, 61]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-86, 0.004, 120]} material={objs.lawn} receiveShadow>
        <planeGeometry args={[48, 56]} />
      </mesh>
      {PLANTERS.map((p, i) => {
        const w = p.maxX - p.minX
        const d = p.maxZ - p.minZ
        return (
          <group key={i} position={[(p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2]}>
            <mesh position={[0, 0.3, 0]} material={objs.stone} castShadow receiveShadow>
              <boxGeometry args={[w, 0.6, d]} />
            </mesh>
            <mesh position={[0, 0.85, 0]} material={objs.hedge} castShadow>
              <boxGeometry args={[w - 0.4, 0.6, d - 0.4]} />
            </mesh>
          </group>
        )
      })}
      {FLAGPOLES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 6, 0]} material={objs.metal} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 12, 8]} />
          </mesh>
          <mesh position={[0.95, 10.9, 0]} rotation={[0, 0, 0.04]} castShadow>
            <planeGeometry args={[1.8, 1.2, 6, 1]} />
            <meshStandardMaterial color={i % 2 ? '#111' : '#c4141c'} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      ))}
      <primitive object={objs.bollards} />
    </group>
  )
}

/** Extra exterior detail layered on top of StadiumExterior. */
export function ExteriorDetails() {
  return (
    <>
      <FacadeArticulation />
      <CornerTowers />
      <Landscaping />
    </>
  )
}
