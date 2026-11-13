import { useMemo } from 'react'
import * as THREE from 'three'
import { BOWL, OUTER_D, PLAZA_BENCHES, PLAZA_FENCES, PLAZA_SIGNS, ROOF, SCULPTURE } from '../../world/layout'
import { beamMatrices, skeletonSamples, sweepProfile } from '../../world/bowlGeometry'
import { asphaltTexture, ballTexture, brickTexture, pavingTexture, signTexture, woodTexture } from '../../world/textures'
import { Sign } from './props/common'
import { ExteriorDetails } from './ExteriorDetails'

const FACADE_Z = BOWL.b + OUTER_D // 89 — outer face of the south stand
const GLASS_HALF = 40
const BOW = 3 // how far the glass curtain bulges out at its centre
const GLASS_Y0 = 5
const GLASS_Y1 = 34
const bowZ = (x: number) => FACADE_Z + 0.25 + BOW * (1 - (x / GLASS_HALF) ** 2)

/** A plane spanning x∈[-GLASS_HALF, GLASS_HALF], y∈[y0,y1], bowed outward. */
function bowedPlane(y0: number, y1: number, offset = 0, segs = 40) {
  const g = new THREE.PlaneGeometry(GLASS_HALF * 2, y1 - y0, segs, 1)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    p.setXYZ(i, x, p.getY(i) + (y0 + y1) / 2, bowZ(x) + offset)
  }
  g.computeVertexNormals()
  return g
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, matrices.length)
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx))
  m.instanceMatrix.needsUpdate = true
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

/** Brick facade ring around the whole bowl (the south glass section is separate). */
function FacadeRing() {
  const { geos, mats } = useMemo(() => {
    const brick = brickTexture().clone()
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping
    brick.repeat.set(0.25, 0.25)
    brick.needsUpdate = true
    const geos = sweepProfile(
      skeletonSamples(),
      [
        { d0: OUTER_D, h0: 0, d1: OUTER_D, h1: 30, mat: 'brick' },
        { d0: OUTER_D, h0: 30, d1: OUTER_D, h1: ROOF.yOuter - 1.1, mat: 'clad' },
        { d0: OUTER_D, h0: 29.6, d1: OUTER_D + 0.4, h1: 29.6, mat: 'band' },
      ],
      (s0, s1) => s0.tag === 'S' && s1.tag === 'S' && s0.px >= -GLASS_HALF - 0.01 && s1.px <= GLASS_HALF + 0.01,
    )
    const mats: Record<string, THREE.Material> = {
      brick: new THREE.MeshStandardMaterial({ map: brick, color: '#c7a198', roughness: 0.9, side: THREE.DoubleSide }),
      clad: new THREE.MeshStandardMaterial({ color: '#3d4046', roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }),
      band: new THREE.MeshStandardMaterial({ color: '#b3121c', roughness: 0.5, side: THREE.DoubleSide }),
    }
    return { geos, mats }
  }, [])
  return (
    <>
      {Object.entries(geos).map(([k, g]) => (
        <mesh key={k} geometry={g} material={mats[k]} castShadow receiveShadow />
      ))}
    </>
  )
}

/** The south entrance: dark base, glass curtain wall, lettering band and roof trusses. */
function SouthFacade() {
  const parts = useMemo(() => {
    const glass = new THREE.MeshStandardMaterial({
      color: '#5fa9ad', roughness: 0.08, metalness: 0.65, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
      emissive: '#0b2a2c', emissiveIntensity: 0.6,
    })
    const mullionMat = new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.4, metalness: 0.6 })
    const white = new THREE.MeshStandardMaterial({ color: '#f1f2f4', roughness: 0.4, metalness: 0.3 })
    // mullions
    const beams: [THREE.Vector3, THREE.Vector3, number][] = []
    for (let x = -GLASS_HALF; x <= GLASS_HALF + 0.01; x += 2.5) {
      beams.push([new THREE.Vector3(x, GLASS_Y0, bowZ(x) + 0.05), new THREE.Vector3(x, GLASS_Y1, bowZ(x) + 0.05), 0.12])
    }
    for (let y = GLASS_Y0; y <= GLASS_Y1 + 0.01; y += 3.625) {
      for (let x = -GLASS_HALF; x < GLASS_HALF - 0.01; x += 2.5) {
        beams.push([new THREE.Vector3(x, y, bowZ(x) + 0.05), new THREE.Vector3(x + 2.5, y, bowZ(x + 2.5) + 0.05), 0.12])
      }
    }
    const mullions = instanced(new THREE.BoxGeometry(1, 1, 1), mullionMat, beamMatrices(beams), false)

    // three truss towers on the roof line above the entrance
    const tb: [THREE.Vector3, THREE.Vector3, number][] = []
    for (const cx of [-24, 0, 24]) {
      const z0 = FACADE_Z - 4
      const base = [[-5, -3], [5, -3], [5, 3], [-5, 3]].map(([dx, dz]) => new THREE.Vector3(cx + dx, ROOF.yOuter, z0 + dz))
      const top = [[-3.2, -1.6], [3.2, -1.6], [3.2, 1.6], [-3.2, 1.6]].map(([dx, dz]) => new THREE.Vector3(cx + dx, ROOF.yOuter + 13, z0 + dz))
      const mid = base.map((b, i) => b.clone().lerp(top[i], 0.5))
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4
        tb.push([base[i], top[i], 0.45])
        tb.push([base[i], base[j], 0.35], [top[i], top[j], 0.35], [mid[i], mid[j], 0.25])
        tb.push([base[i], mid[j], 0.2], [mid[i], top[j], 0.2], [base[j], mid[i], 0.2], [mid[j], top[i], 0.2])
      }
      // diagonal stay toward the stadium interior
      tb.push([top[0], new THREE.Vector3(cx, ROOF.yInner + 1, FACADE_Z - 30), 0.35])
      tb.push([top[1], new THREE.Vector3(cx, ROOF.yInner + 1, FACADE_Z - 30), 0.35])
    }
    // horizontal lattice bridges linking the three towers (as in the public facade photos)
    {
      const z0 = FACADE_Z - 4
      const yb = ROOF.yOuter + 6
      const yt = ROOF.yOuter + 11
      for (const [a, b] of [[-24 + 4.1, -4.1], [4.1, 24 - 4.1]]) {
        const steps = 8
        for (const zz of [z0 - 1.4, z0 + 1.4]) {
          tb.push([new THREE.Vector3(a, yt, zz), new THREE.Vector3(b, yt, zz), 0.32])
          tb.push([new THREE.Vector3(a, yb, zz), new THREE.Vector3(b, yb, zz), 0.32])
          for (let i = 0; i < steps; i++) {
            const x0 = a + ((b - a) * i) / steps
            const x1 = a + ((b - a) * (i + 1)) / steps
            tb.push([new THREE.Vector3(x0, i % 2 ? yt : yb, zz), new THREE.Vector3(x1, i % 2 ? yb : yt, zz), 0.18])
            tb.push([new THREE.Vector3(x0, yb, zz), new THREE.Vector3(x0, yt, zz), 0.14])
          }
        }
        for (let i = 0; i <= steps; i++) {
          const x = a + ((b - a) * i) / steps
          tb.push([new THREE.Vector3(x, yt, z0 - 1.4), new THREE.Vector3(x, yt, z0 + 1.4), 0.14])
        }
      }
    }
    const towers = instanced(new THREE.BoxGeometry(1, 1, 1), white, beamMatrices(tb))

    const letters = signTexture(
      'facade-letters',
      [{ text: 'THEATRE OF DREAMS', size: 0.62, color: '#ff1f2d', font: "'Arial Black',sans-serif", weight: '900' }],
      { w: 4096, h: 300 },
    )
    return {
      glass,
      glassGeo: bowedPlane(GLASS_Y0, GLASS_Y1),
      bandGeo: bowedPlane(GLASS_Y1, ROOF.yOuter - 1.1, 0),
      letterGeo: bowedPlane(GLASS_Y1 + 1.2, ROOF.yOuter - 2.2, 0.08),
      letters,
      mullions,
      towers,
    }
  }, [])

  const floors = [12, 19.5, 27]
  return (
    <group name="SouthFacade">
      <mesh geometry={parts.glassGeo} material={parts.glass} />
      <primitive object={parts.mullions} />
      <primitive object={parts.towers} />
      <mesh geometry={parts.bandGeo} receiveShadow castShadow>
        <meshStandardMaterial color="#2c2f34" roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.letterGeo}>
        <meshBasicMaterial map={parts.letters} transparent toneMapped={false} />
      </mesh>

      {/* interior floors visible through the glass */}
      {floors.map((y) => (
        <group key={y}>
          <mesh position={[0, y, FACADE_Z - 2]}>
            <boxGeometry args={[GLASS_HALF * 2, 0.5, 4.5]} />
            <meshStandardMaterial color="#d6d6d4" />
          </mesh>
          <mesh position={[0, y - 0.27, FACADE_Z - 2]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[GLASS_HALF * 2 - 2, 0.25]} />
            <meshBasicMaterial color="#fff2d6" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, (7.4 + GLASS_Y1) / 2, FACADE_Z - 4.3]}>
        <boxGeometry args={[GLASS_HALF * 2, GLASS_Y1 - 7.4, 0.2]} />
        <meshStandardMaterial color="#4a4d52" roughness={0.9} />
      </mesh>

      {/* ground floor base with entrances */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (3 + (GLASS_HALF - 3) / 2), GLASS_Y0 / 2, FACADE_Z + 0.25]} castShadow receiveShadow>
          <boxGeometry args={[GLASS_HALF - 3, GLASS_Y0, 0.5]} />
          <meshStandardMaterial color="#1d1f22" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, FACADE_Z + 0.25]} castShadow>
        <boxGeometry args={[6.2, 0.8, 0.5]} />
        <meshStandardMaterial color="#1d1f22" roughness={0.6} />
      </mesh>
      {/* entrance canopy */}
      <mesh position={[0, 4.3, FACADE_Z + 2.4]} castShadow receiveShadow>
        <boxGeometry args={[12, 0.3, 4.2]} />
        <meshStandardMaterial color="#e9e9ea" roughness={0.4} />
      </mesh>
      <Sign id="ent-main" lines={[{ text: 'STADIUM TOUR ENTRANCE', size: 0.55, font: "'Arial Black',sans-serif", weight: '900' }]} width={5.6} height={0.6} position={[0, 4.6, FACADE_Z + 0.52]} glow />
      <Sign id="ent-e1" lines={[{ text: 'ENTRANCE  E1', size: 0.6, font: "'Arial Black',sans-serif", weight: '900' }]} width={6} height={1} position={[-17, 3.4, FACADE_Z + 0.52]} glow />
      <Sign id="ent-e2" lines={[{ text: 'ENTRANCE  E2', size: 0.6, font: "'Arial Black',sans-serif", weight: '900' }]} width={6} height={1} position={[-30, 3.4, FACADE_Z + 0.52]} glow />
      <Sign id="ent-store" lines={[{ text: 'MEGASTORE  →', size: 0.6, font: "'Arial Black',sans-serif", weight: '900' }]} width={6} height={1} position={[17, 3.4, FACADE_Z + 0.52]} glow />
      <Sign id="ent-fan" lines={[{ text: 'UNOFFICIAL FAN CONCEPT', size: 0.5, color: '#f3c623' }]} width={6} height={0.8} position={[30, 3.4, FACADE_Z + 0.52]} glow />
    </group>
  )
}

function Lampposts() {
  const objs = useMemo(() => {
    const spots: [number, number][] = []
    for (let z = 96; z <= 148; z += 13) spots.push([-14, z], [14, z])
    for (let x = 26; x <= 46; x += 10) spots.push([x, 100])
    for (let x = -60; x <= -30; x += 15) spots.push([x, 98])
    const pole = new THREE.MeshStandardMaterial({ color: '#222428', metalness: 0.6, roughness: 0.4 })
    const head = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3d6').multiplyScalar(1.4), toneMapped: false })
    const banner = new THREE.MeshStandardMaterial({ color: '#c4141c', side: THREE.DoubleSide, roughness: 0.7 })
    const m = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))
    return [
      instanced(new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8), pole, spots.map(([x, z]) => m(x, 3.25, z))),
      instanced(new THREE.BoxGeometry(0.9, 0.18, 0.4), head, spots.map(([x, z]) => m(x, 6.55, z)), false),
      instanced(new THREE.PlaneGeometry(0.7, 1.8), banner, spots.map(([x, z]) => m(x + 0.4, 4.4, z)), false),
    ]
  }, [])
  return (
    <>
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  )
}

function Benches() {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ map: woodTexture(), color: '#a07850', roughness: 0.7 }), [])
  return (
    <>
      {PLAZA_BENCHES.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rotY, 0]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, 0.45, -0.18 + k * 0.18]} material={wood} castShadow>
              <boxGeometry args={[2, 0.05, 0.14]} />
            </mesh>
          ))}
          <mesh position={[0, 0.75, -0.3]} rotation={[0.2, 0, 0]} material={wood} castShadow>
            <boxGeometry args={[2, 0.4, 0.05]} />
          </mesh>
          {[-0.85, 0.85].map((x) => (
            <mesh key={x} position={[x, 0.22, -0.05]}>
              <boxGeometry args={[0.08, 0.44, 0.55]} />
              <meshStandardMaterial color="#222" metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

function Fences() {
  return (
    <>
      {PLAZA_FENCES.map((f, i) => {
        const len = f.maxX - f.minX
        const cx = (f.minX + f.maxX) / 2
        const cz = (f.minZ + f.maxZ) / 2
        const posts = Math.floor(len / 2.5)
        return (
          <group key={i} position={[cx, 0, cz]}>
            {[0.5, 1.05].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <boxGeometry args={[len, 0.06, 0.06]} />
                <meshStandardMaterial color="#1e1f22" metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
            {Array.from({ length: posts + 1 }).map((_, k) => (
              <mesh key={k} position={[-len / 2 + (k * len) / posts, 0.55, 0]}>
                <boxGeometry args={[0.08, 1.1, 0.08]} />
                <meshStandardMaterial color="#1e1f22" metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}

function Trees() {
  const objs = useMemo(() => {
    const spots: [number, number][] = []
    for (let x = -100; x <= 100; x += 12) if (Math.abs(x) > 34) spots.push([x, 147])
    for (let z = 100; z <= 140; z += 12) spots.push([-70, z], [-95, z])
    const m = (x: number, y: number, z: number, s: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))
    return [
      instanced(new THREE.CylinderGeometry(0.18, 0.25, 3, 6), new THREE.MeshStandardMaterial({ color: '#5a4030' }), spots.map(([x, z]) => m(x, 1.5, z, 1))),
      instanced(new THREE.IcosahedronGeometry(2.4, 1), new THREE.MeshStandardMaterial({ color: '#3d6b35', roughness: 0.9, flatShading: true }), spots.map(([x, z], i) => m(x, 4.6, z, 0.9 + (i % 3) * 0.15))),
    ]
  }, [])
  return (
    <>
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  )
}

function Sculpture() {
  const ball = useMemo(() => ballTexture(), [])
  return (
    <group position={[SCULPTURE.x, 0, SCULPTURE.z]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 1.5, 3]} />
        <meshStandardMaterial color="#5a5c60" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 3.0, 0]} castShadow>
        <sphereGeometry args={[1.5, 40, 24]} />
        <meshStandardMaterial map={ball} roughness={0.35} metalness={0.1} />
      </mesh>
      <Sign id="sculpture-plaque" lines={[{ text: 'FOR THE FANS WHO CAN’T BE HERE', size: 0.32 }, { text: '팬 트리뷰트 조형물', size: 0.26, color: '#ddd' }]} width={2.6} height={0.7} position={[0, 0.85, 1.52]} bg="#2a2b2e" />
    </group>
  )
}

function PlazaSigns() {
  return (
    <>
      {PLAZA_SIGNS.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.rotY, 0]}>
          {[-1.3, 1.3].map((x) => (
            <mesh key={x} position={[x, 1.5, 0]} castShadow>
              <boxGeometry args={[0.12, 3, 0.12]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          ))}
          <mesh position={[0, 2.1, -0.03]}>
            <boxGeometry args={[3, 1.8, 0.05]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {s.kind === 'tour' ? (
            <Sign
              id="plaza-tour"
              lines={[
                { text: 'STADIUM TOUR', size: 0.22, color: '#ff3b47', font: "'Arial Black',sans-serif", weight: '900' },
                { text: '투어 입구  ↑  (정면 출입문)', size: 0.15 },
                { text: '메가스토어  →  광장 동쪽', size: 0.13 },
                { text: '비공식 팬 콘셉트 · Unofficial', size: 0.1, color: '#bbb' },
              ]}
              width={2.9}
              height={1.7}
              position={[0, 2.1, 0.01]}
              bg="#151517"
            />
          ) : (
            <Sign
              id="plaza-store"
              lines={[
                { text: 'MEGASTORE', size: 0.3, font: "'Arial Black',sans-serif", weight: '900' },
                { text: '→  입구는 건물 서쪽', size: 0.16 },
              ]}
              width={2.9}
              height={1.7}
              position={[0, 2.1, 0.01]}
              bg="#a50e18"
            />
          )}
        </group>
      ))}
    </>
  )
}

/** Outer plaza, ground, roads, facade and street furniture. */
export function StadiumExterior() {
  const ground = useMemo(() => {
    const pave = pavingTexture().clone()
    pave.wrapS = pave.wrapT = THREE.RepeatWrapping
    pave.repeat.set(80, 80)
    pave.needsUpdate = true
    const asphalt = asphaltTexture().clone()
    asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping
    asphalt.repeat.set(60, 3)
    asphalt.needsUpdate = true
    return { pave, asphalt }
  }, [])
  return (
    <group name="StadiumExterior">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial map={ground.pave} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 162]} receiveShadow>
        <planeGeometry args={[320, 14]} />
        <meshStandardMaterial map={ground.asphalt} roughness={0.95} />
      </mesh>
      {/* road markings */}
      {Array.from({ length: 30 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-150 + i * 10.5, 0.0, 162]}>
          <planeGeometry args={[4, 0.18]} />
          <meshBasicMaterial color="#e6e6e6" />
        </mesh>
      ))}
      {/* main walkway toward the entrance */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 120]} receiveShadow>
        <planeGeometry args={[10, 62]} />
        <meshStandardMaterial color="#6e6a66" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[32, 0.003, 117.5]} receiveShadow>
        <planeGeometry args={[40, 6]} />
        <meshStandardMaterial color="#6e6a66" roughness={0.9} />
      </mesh>
      <FacadeRing />
      <ExteriorDetails />
      <SouthFacade />
      <Lampposts />
      <Benches />
      <Fences />
      <Trees />
      <Sculpture />
      <PlazaSigns />
    </group>
  )
}
