import { useMemo } from 'react'
import * as THREE from 'three'
import {
  ROOMS, STORE_BALL_DISPLAY, STORE_COUNTER, STORE_MANNEQUINS, STORE_SCARF_WALL, STORE_TABLES, STORE_WALL_SHELVES, type Box,
} from '../../world/layout'
import { ballTexture, floorTileTexture, scarfTexture } from '../../world/textures'
import { CeilingLight, Jersey, LightPanel, RoomShell, Sign, SlidingDoor } from './props/common'
import { useIndoorEnv } from './props/useIndoorEnv'
import { useRef } from 'react'

const R = ROOMS.store
const cx = (R.minX + R.maxX) / 2
const cz = (R.minZ + R.maxZ) / 2
const center = (b: Box) => [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] as const

const SHIRT_COLORS = ['#c8102e', '#f2f2f2', '#111111', '#c8102e', '#1d2a4a']

/** Folded shirts as one instanced mesh. */
function FoldedShirts({ spots }: { spots: [number, number, number, number][] }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.06, 0.32), new THREE.MeshStandardMaterial({ roughness: 0.8 }), spots.length)
    const c = new THREE.Color()
    spots.forEach(([x, y, z, k], i) => {
      m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z))
      m.setColorAt(i, c.set(SHIRT_COLORS[k % SHIRT_COLORS.length]))
    })
    m.instanceMatrix.needsUpdate = true
    m.castShadow = true
    return m
  }, [spots])
  return <primitive object={mesh} />
}

function WallShelf({ b, facing }: { b: Box; facing: 1 | -1 }) {
  const [x, z] = center(b)
  const w = b.maxX - b.minX
  const shirts = useMemo(() => {
    const out: [number, number, number, number][] = []
    for (let level = 0; level < 4; level++)
      for (let i = 0; i < Math.floor(w / 0.55); i++)
        for (let s = 0; s < 3; s++) out.push([x - w / 2 + 0.35 + i * 0.55, 0.42 + level * 0.55 + s * 0.065, z, level + Math.floor(i / 6)])
    return out
  }, [x, z, w])
  return (
    <group>
      <mesh position={[x, 1.2, z - facing * 0.35]} receiveShadow>
        <boxGeometry args={[w, 2.4, 0.06]} />
        <meshStandardMaterial color="#2a2b2f" />
      </mesh>
      {[0, 1, 2, 3].map((l) => (
        <mesh key={l} position={[x, 0.38 + l * 0.55, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.04, 0.7]} />
          <meshStandardMaterial color="#e8e8e6" />
        </mesh>
      ))}
      <FoldedShirts spots={shirts} />
      <mesh position={[x, 2.32, z + facing * 0.33]}>
        <boxGeometry args={[w, 0.12, 0.04]} />
        <meshBasicMaterial color={new THREE.Color('#ff2433').multiplyScalar(1.5)} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Table({ b }: { b: Box }) {
  const [x, z] = center(b)
  const shirts = useMemo(() => {
    const out: [number, number, number, number][] = []
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) for (let s = 0; s < 4; s++) out.push([x - 1.5 + i * 0.6, 0.93 + s * 0.065, z - 0.45 + j * 0.9, i])
    return out
  }, [x, z])
  return (
    <group>
      <mesh position={[x, 0.45, z]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.9, 2]} />
        <meshStandardMaterial color="#d7c3a3" roughness={0.6} />
      </mesh>
      <FoldedShirts spots={shirts} />
    </group>
  )
}

function Mannequin({ x, z, rotY, number }: { x: number; z: number; rotY: number; number: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.38, 0.1, 24]} />
        <meshStandardMaterial color="#222" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.1]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.55, 0]} scale={[1, 1, 0.55]}>
        <capsuleGeometry args={[0.2, 0.4, 6, 12]} />
        <meshStandardMaterial color="#efe9e1" />
      </mesh>
      <Jersey position={[0, 1.5, 0.12]} number={number} hanger={false} scale={0.95} />
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color="#efe9e1" />
      </mesh>
    </group>
  )
}

function ScarfWall() {
  const b = STORE_SCARF_WALL
  const [x, z] = center(b)
  const len = b.maxZ - b.minZ
  const mats = useMemo(() => [0, 1].map((v) => new THREE.MeshStandardMaterial({ map: scarfTexture(v), roughness: 0.9 })), [])
  const n = Math.floor(len / 0.32)
  return (
    <group>
      <mesh position={[x + 0.2, 1.4, z]}>
        <boxGeometry args={[0.08, 2.8, len]} />
        <meshStandardMaterial color="#1a1a1c" />
      </mesh>
      {[0, 1].map((row) => (
        <group key={row}>
          <mesh position={[x - 0.05, 2.5 - row * 1.25, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, len]} />
            <meshStandardMaterial color="#bbb" metalness={0.8} />
          </mesh>
          {Array.from({ length: n }).map((_, i) => (
            <mesh key={i} position={[x - 0.08, 2.0 - row * 1.25, b.minZ + 0.2 + i * 0.32]} rotation={[0, Math.PI / 2, 0]} material={mats[(i + row) % 2]}>
              <boxGeometry args={[0.2, 1.0, 0.02]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function BallDisplay() {
  const ball = useMemo(() => new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.4 }), [])
  const balls: [number, number, number][] = []
  const r = 0.11
  for (let layer = 0; layer < 4; layer++) {
    const n = 4 - layer
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) balls.push([(i - (n - 1) / 2) * r * 2.05, 1.0 + r + layer * r * 1.5, (j - (n - 1) / 2) * r * 2.05])
  }
  return (
    <group position={[STORE_BALL_DISPLAY.x, 0, STORE_BALL_DISPLAY.z]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.05, 0.9, 32]} />
        <meshStandardMaterial color="#b3121c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.92, 0]}>
        <cylinderGeometry args={[1.02, 1.02, 0.04, 32]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {balls.map((p, i) => (
        <mesh key={i} position={p} material={ball} castShadow>
          <sphereGeometry args={[r, 20, 14]} />
        </mesh>
      ))}
    </group>
  )
}

/** Fan-concept merchandise store on the east side of the plaza. */
export function MegaStore() {
  const mats = useMemo(() => {
    const tile = floorTileTexture('#d9d6d0', '#c9c5be').clone()
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping
    tile.needsUpdate = true
    return {
      wall: new THREE.MeshStandardMaterial({ color: '#f1efeb', roughness: 0.85 }),
      floor: new THREE.MeshStandardMaterial({ map: tile, roughness: 0.3 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#2d2f33', roughness: 0.9 }),
      skin: new THREE.MeshStandardMaterial({ color: '#33363b', roughness: 0.55, metalness: 0.4 }),
      window: new THREE.MeshStandardMaterial({ color: '#203236', roughness: 0.05, metalness: 0.7, emissive: '#ffe2b0', emissiveIntensity: 0.25 }),
    }
  }, [])
  const W = R.maxX - R.minX
  const D = R.maxZ - R.minZ
  const doorZ = 117.5
  const ref = useRef<THREE.Group>(null)
  useIndoorEnv(ref, 0.2)

  return (
    <group name="MegaStore" ref={ref}>
      <RoomShell room={R} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} floorRepeat={1.5} />

      {/* exterior skin on N/S/E + glazed shopfront on the west */}
      <mesh position={[cx, R.height / 2, R.minZ - 0.2]} material={mats.skin} castShadow>
        <boxGeometry args={[W + 0.7, R.height + 0.4, 0.08]} />
      </mesh>
      <mesh position={[cx, R.height / 2, R.maxZ + 0.2]} material={mats.skin} castShadow>
        <boxGeometry args={[W + 0.7, R.height + 0.4, 0.08]} />
      </mesh>
      <mesh position={[R.maxX + 0.2, R.height / 2, cz]} material={mats.skin} castShadow>
        <boxGeometry args={[0.08, R.height + 0.4, D + 0.4]} />
      </mesh>
      {[
        [R.minZ - 0.15, doorZ - 2.5],
        [doorZ + 2.5, R.maxZ + 0.15],
      ].map(([a, b], i) => (
        <mesh key={i} position={[R.minX - 0.2, R.height / 2 - 0.4, (a + b) / 2]} material={mats.window}>
          <boxGeometry args={[0.06, R.height - 1.2, b - a]} />
        </mesh>
      ))}
      <mesh position={[R.minX - 0.25, R.height - 0.3, cz]} material={mats.skin}>
        <boxGeometry args={[0.1, 1.2, D + 0.4]} />
      </mesh>
      <Sign
        id="store-front"
        lines={[{ text: 'MEGASTORE', size: 0.62, color: '#ff2433', font: "'Arial Black',sans-serif", weight: '900' }, { text: 'FAN CONCEPT STORE · 비공식', size: 0.24, color: '#ffffff' }]}
        width={10}
        height={1.6}
        position={[R.minX - 0.32, R.height + 1.2, cz]}
        rotationY={-Math.PI / 2}
        bg="#16171a"
        glow
      />
      <SlidingDoor position={[R.minX, 0, doorZ]} rotationY={Math.PI / 2} width={5} height={3.5} />

      {/* fittings */}
      <WallShelf b={STORE_WALL_SHELVES[0]} facing={1} />
      <WallShelf b={STORE_WALL_SHELVES[1]} facing={-1} />
      {STORE_TABLES.map((t, i) => (
        <Table key={i} b={t} />
      ))}
      {STORE_MANNEQUINS.map((m, i) => (
        <Mannequin key={i} {...m} number={[7, 10, 18][i]} />
      ))}
      <ScarfWall />
      <BallDisplay />
      <group position={[center(STORE_COUNTER)[0], 0, center(STORE_COUNTER)[1]]}>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[5, 1.1, 1.1]} />
          <meshStandardMaterial color="#1b1c1f" />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <boxGeometry args={[5.1, 0.05, 1.2]} />
          <meshStandardMaterial color="#e9e6e1" />
        </mesh>
        <Sign id="store-counter" lines={[{ text: 'CHECKOUT · DEMO', size: 0.55 }]} width={3} height={0.4} position={[0, 0.65, -0.56]} rotationY={Math.PI} glow />
      </group>

      {/* hanging category signs */}
      <Sign id="store-cat-shirts" lines={[{ text: 'HOME SHIRTS (CONCEPT)', size: 0.5 }]} width={4} height={0.6} position={[68, 4.2, 112]} bg="#c4141c" glow />
      <Sign id="store-cat-scarves" lines={[{ text: 'SCARVES  →', size: 0.5 }]} width={3} height={0.6} position={[80, 4.2, 117.5]} rotationY={-Math.PI / 2} bg="#111" glow />
      <Sign id="store-hours" lines={[{ text: '온라인 구매 기능은 아직 없습니다 · DEMO STORE', size: 0.42, color: '#f3c623' }]} width={6} height={0.5} position={[cx + 2, 3.4, R.maxZ - 0.92]} rotationY={Math.PI} glow />

      {/* lighting */}
      {[60, 70, 80].flatMap((x) => [110, 117.5, 125].map((z) => <LightPanel key={`${x}-${z}`} position={[x, R.height - 0.01, z]} size={[2.4, 2.4]} intensity={1.15} />))}
      <CeilingLight position={[63, R.height, 117.5]} intensity={70} distance={26} size={[0.01, 0.01]} />
      <CeilingLight position={[79, R.height, 117.5]} intensity={70} distance={26} size={[0.01, 0.01]} />
    </group>
  )
}
