import { useMemo } from 'react'
import * as THREE from 'three'
import { LOCKER_BENCHES, PROP_COLLIDERS_INFO, ROOMS } from '../../world/layout'
import { ballTexture } from '../../world/textures'
import { CeilingLight, LightPanel, Sign } from './props/common'

/*
 * Phase 3 dressing for the indoor spaces: queue barriers, plants, a display
 * case and floor wayfinding in the lobby; ball bins, a cap rack, a souvenir
 * gondola and an entrance mat in the store; boots, bottles and kit bags in the
 * dressing room. Everything is generic (no club marks or real products).
 * Solid pieces are registered as colliders in layout.ts (PROP_COLLIDERS).
 */

type V3 = [number, number, number]

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[], cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, ms.length))
  ms.forEach((x, i) => m.setMatrixAt(i, x))
  m.count = ms.length
  m.instanceMatrix.needsUpdate = true
  m.castShadow = cast
  m.receiveShadow = true
  m.computeBoundingSphere()
  return m
}
const mtx = (p: V3, s: V3 = [1, 1, 1], rotY = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(...s))

function Plant({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.6, 16]} />
        <meshStandardMaterial color="#26272b" roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.3) * 0.12, 1.0 + (i % 3) * 0.22, Math.sin(i * 1.3) * 0.12]} castShadow>
          <icosahedronGeometry args={[0.36 - (i % 3) * 0.05, 0]} />
          <meshStandardMaterial color={i % 2 ? '#2f6b34' : '#3d7d3f'} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Posts with red ropes (queue lane). */
function Stanchions({ posts }: { posts: [number, number][][] }) {
  const objs = useMemo(() => {
    const post: THREE.Matrix4[] = []
    const base: THREE.Matrix4[] = []
    const rope: THREE.Matrix4[] = []
    for (const line of posts) {
      line.forEach(([x, z], i) => {
        post.push(mtx([x, 0.5, z]))
        base.push(mtx([x, 0.02, z]))
        const n = line[i + 1]
        if (n) {
          const len = Math.hypot(n[0] - x, n[1] - z)
          rope.push(mtx([(x + n[0]) / 2, 0.88, (z + n[1]) / 2], [1, 1, len], Math.atan2(n[0] - x, n[1] - z)))
        }
      })
    }
    const chrome = new THREE.MeshStandardMaterial({ color: '#d5d8dc', metalness: 0.9, roughness: 0.2 })
    return [
      instanced(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), chrome, post),
      instanced(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 16), chrome, base),
      instanced(new THREE.BoxGeometry(0.04, 0.04, 1), new THREE.MeshStandardMaterial({ color: '#b50f1b', roughness: 0.6 }), rope, false),
    ]
  }, [posts])
  return (
    <>
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </>
  )
}

function Ball({ p, r = 0.11 }: { p: V3; r?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.4 }), [])
  return (
    <mesh position={p} material={mat} castShadow>
      <sphereGeometry args={[r, 20, 14]} />
    </mesh>
  )
}

function Boot({ p, rotY = 0, color = '#151515' }: { p: V3; rotY?: number; color?: string }) {
  return (
    <group position={p} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.1, 0.09, 0.27]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[0.1, 0.012, 0.27]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.07, -0.08]} castShadow>
        <boxGeometry args={[0.095, 0.05, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  )
}

// ------------------------------------------------------------------ lobby --
function LobbyExtras() {
  const L = ROOMS.lobby
  const floorArrows = useMemo(() => {
    // dashed red line from the entrance to the corridor door (west side of the desk)
    const out: { p: V3; rot: number }[] = []
    const a = new THREE.Vector2(-1.5, 87.5)
    const b = new THREE.Vector2(-10.5, 72.6)
    const n = 11
    const rot = Math.atan2(b.x - a.x, b.y - a.y)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      out.push({ p: [a.x + (b.x - a.x) * t, 0.012, a.y + (b.y - a.y) * t], rot })
    }
    return out
  }, [])
  return (
    <group name="LobbyExtras">
      <Stanchions posts={[
        [[-12.7, 71.6], [-12.7, 73.4], [-12.7, 75.2]],
        [[-8.3, 71.6], [-8.3, 73.4], [-8.3, 75.2]],
      ]} />
      {floorArrows.map((a, i) => (
        <mesh key={i} position={a.p} rotation={[-Math.PI / 2, 0, -a.rot]}>
          <planeGeometry args={[0.35, 0.9]} />
          <meshStandardMaterial color="#c4141c" roughness={0.7} />
        </mesh>
      ))}
      <Sign
        id="lobby-floor-route"
        lines={[{ text: 'TOUR ROUTE ↑ 라커룸 · 터널', size: 0.42, color: '#ffffff' }]}
        width={2.4}
        height={0.32}
        position={[-2.2, 0.014, 85.6]}
        rotationY={0}
      />
      <Plant x={-14} z={88} />
      <Plant x={14} z={88} />
      <Plant x={14} z={72} />
      <Plant x={-14.1} z={77.5} s={0.85} />

      {/* glass display case: match ball + boots (generic replicas) */}
      <group position={[1.5, 0, 74]}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.9, 0.9]} />
          <meshStandardMaterial color="#1a1a1d" roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.35, 0]}>
          <boxGeometry args={[1.56, 0.9, 0.86]} />
          <meshStandardMaterial color="#bfe3ea" transparent opacity={0.18} roughness={0.05} metalness={0.3} depthWrite={false} />
        </mesh>
        <Ball p={[-0.35, 1.02, 0]} />
        <Boot p={[0.25, 0.9, -0.05]} rotY={0.4} color="#c4141c" />
        <Boot p={[0.45, 0.9, 0.08]} rotY={0.6} color="#c4141c" />
        <LightPanel position={[0, 1.79, 0]} size={[1.4, 0.7]} intensity={1.4} />
        <Sign id="lobby-case" lines={[{ text: 'MATCH-DAY KIT · 전시 소품', size: 0.4 }]} width={1.4} height={0.22} position={[0, 0.62, 0.456]} bg="#0d0d0f" glow />
      </group>

      {/* benches along the east wall */}
      {[80.5, 84].map((z) => (
        <group key={z} position={[13.9, 0, z]}>
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.08, 2.2]} />
            <meshStandardMaterial color="#8a5a35" roughness={0.6} />
          </mesh>
          {[-0.9, 0.9].map((o) => (
            <mesh key={o} position={[0, 0.2, o]}>
              <boxGeometry args={[0.5, 0.4, 0.08]} />
              <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* pendant lights over the hall */}
      {[[-4, 80], [4, 80], [-4, 86], [4, 86], [0, 75]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, L.height, z]}>
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1.2, 4]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, -1.25, 0]}>
            <cylinderGeometry args={[0.12, 0.42, 0.3, 20, 1, true]} />
            <meshStandardMaterial color="#141416" side={THREE.DoubleSide} roughness={0.5} />
          </mesh>
          <LightPanel position={[0, -1.38, 0]} size={[0.7, 0.7]} color="#fff1d6" intensity={1.6} />
        </group>
      ))}
      <CeilingLight position={[0, L.height - 1.4, 80]} intensity={28} distance={16} color="#ffe9c8" size={[0.01, 0.01]} />
    </group>
  )
}

// ------------------------------------------------------------------ store --
function StoreExtras() {
  const S = ROOMS.store
  return (
    <group name="StoreExtras">
      {/* entrance mat */}
      <mesh position={[S.minX + 1.6, 0.012, 117.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.6, 4.4]} />
        <meshStandardMaterial color="#7d0a12" roughness={0.95} />
      </mesh>
      {/* ball bins */}
      {PROP_COLLIDERS_INFO.storeBins.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.5, 0.8, 20, 1, true]} />
            <meshStandardMaterial color="#1b1b1e" side={THREE.DoubleSide} wireframe />
          </mesh>
          <mesh position={[0, 0.81, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.02, 6, 24]} />
            <meshStandardMaterial color="#c4141c" />
          </mesh>
          {Array.from({ length: 9 }).map((_, i) => (
            <Ball key={i} p={[Math.cos(i * 2.1) * (i < 6 ? 0.28 : 0.1), 0.62 + (i >= 6 ? 0.18 : 0), Math.sin(i * 2.1) * (i < 6 ? 0.28 : 0.1)]} r={0.11} />
          ))}
          <Sign id={`bin-${x}`} lines={[{ text: 'BALLS', size: 0.5 }]} width={0.8} height={0.24} position={[0, 1.15, 0]} bg="#c4141c" doubleSided />
        </group>
      ))}
      {/* cap rack */}
      {(() => {
        const [x, z] = PROP_COLLIDERS_INFO.capRack
        return (
          <group position={[x, 0, z]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
              <meshStandardMaterial color="#ccc" metalness={0.8} roughness={0.3} />
            </mesh>
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i % 6) * (Math.PI / 3)
              const y = i < 6 ? 1.25 : 1.6
              return (
                <mesh key={i} position={[Math.cos(a) * 0.3, y, Math.sin(a) * 0.3]} rotation={[0, -a, 0.3]} castShadow>
                  <sphereGeometry args={[0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color={i % 3 === 0 ? '#111' : i % 3 === 1 ? '#c4141c' : '#f1f1f1'} roughness={0.8} />
                </mesh>
              )
            })}
            <Sign id="cap-rack" lines={[{ text: 'CAPS', size: 0.5 }]} width={0.7} height={0.22} position={[0, 1.95, 0]} bg="#111" doubleSided glow />
          </group>
        )
      })()}
      {/* souvenir gondola: mugs + boxed gifts */}
      {(() => {
        const [x, z] = PROP_COLLIDERS_INFO.gondola
        return (
          <group position={[x, 0, z]}>
            <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
              <boxGeometry args={[3, 1.4, 0.9]} />
              <meshStandardMaterial color="#e9e6e1" roughness={0.6} />
            </mesh>
            {[0.95, 1.42].map((y) =>
              Array.from({ length: 8 }).map((_, i) => (
                <mesh key={`${y}${i}`} position={[-1.3 + i * 0.37, y, 0.3]} castShadow>
                  {y < 1 ? <cylinderGeometry args={[0.055, 0.05, 0.12, 12]} /> : <boxGeometry args={[0.22, 0.16, 0.16]} />}
                  <meshStandardMaterial color={(i + (y < 1 ? 0 : 1)) % 2 ? '#c4141c' : '#f5f5f5'} roughness={0.5} />
                </mesh>
              )),
            )}
            <Sign id="gondola" lines={[{ text: 'SOUVENIRS · 기념품 (DEMO)', size: 0.42 }]} width={2.8} height={0.28} position={[0, 1.65, 0.46]} bg="#111" glow />
          </group>
        )
      })()}
      <Plant x={S.minX + 0.9} z={110.5} />
      <Plant x={S.minX + 0.9} z={124.5} />
    </group>
  )
}

// ----------------------------------------------------------------- locker --
function LockerExtras() {
  const north = LOCKER_BENCHES[0]
  const west = LOCKER_BENCHES[1]
  const boots = useMemo(() => {
    const out: { p: V3; rotY: number }[] = []
    for (let x = north.minX + 1; x < north.maxX - 0.5; x += 2.3) out.push({ p: [x, 0, north.maxZ + 0.22], rotY: 0.15 }, { p: [x + 0.16, 0, north.maxZ + 0.25], rotY: -0.1 })
    for (let z = west.minZ + 1.2; z < west.maxZ - 0.5; z += 2.6) out.push({ p: [west.maxX + 0.22, 0, z], rotY: Math.PI / 2 }, { p: [west.maxX + 0.25, 0, z + 0.16], rotY: Math.PI / 2 - 0.2 })
    return out
  }, [north, west])
  const bottles = useMemo(() => {
    const out: V3[] = []
    for (let x = north.minX + 2; x < north.maxX - 0.5; x += 4.6) out.push([x, 0.45 + 0.1, (north.minZ + north.maxZ) / 2])
    return out
  }, [north])
  return (
    <group name="LockerExtras">
      {boots.map((b, i) => (
        <Boot key={i} p={b.p} rotY={b.rotY} />
      ))}
      {bottles.map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.2, 10]} />
            <meshStandardMaterial color="#f2f2f2" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.018, 0.025, 0.05, 8]} />
            <meshStandardMaterial color="#c4141c" />
          </mesh>
        </group>
      ))}
      {/* kit bags on the floor by a few lockers */}
      {[[-21.5, 51.9], [-11.8, 51.9], [-24.6, 61.2]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.17, z]} rotation={[0, i * 0.7, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.17, 0.42, 6, 12]} />
          <meshStandardMaterial color={i % 2 ? '#141414' : '#7d0a12'} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export function InteriorProps() {
  return (
    <>
      <LobbyExtras />
      <StoreExtras />
      <LockerExtras />
    </>
  )
}
