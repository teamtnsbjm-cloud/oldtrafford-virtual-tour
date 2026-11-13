import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { roomWalls, type Room } from '../../../world/layout'
import { signTexture, shirtNumberTexture, type SignLine } from '../../../world/textures'
import { playerState } from '../../../state/playerState'

type V3 = [number, number, number]

// ------------------------------------------------------------------ Sign ---
interface SignProps {
  id: string
  lines: SignLine[]
  width: number
  height: number
  position: V3
  rotationY?: number
  bg?: string
  border?: string
  glow?: boolean
  /** Draw on both faces (free-standing signs). */
  doubleSided?: boolean
}

/** Flat text panel rendered from a canvas texture (no web fonts or images needed). */
export function Sign({ id, lines, width, height, position, rotationY = 0, bg, border, glow, doubleSided }: SignProps) {
  const tex = useMemo(() => {
    const aspect = width / height
    const h = 512
    return signTexture(id, lines, { w: Math.min(4096, Math.round(h * aspect)), h, bg, border })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      {glow ? (
        <meshBasicMaterial map={tex} transparent={!bg} toneMapped={false} side={doubleSided ? THREE.DoubleSide : THREE.FrontSide} />
      ) : (
        <meshStandardMaterial map={tex} transparent={!bg} roughness={0.6} side={doubleSided ? THREE.DoubleSide : THREE.FrontSide} />
      )}
    </mesh>
  )
}

// ------------------------------------------------------------- RoomShell ---
interface RoomShellProps {
  room: Room
  wall: THREE.Material
  floor: THREE.Material
  ceiling: THREE.Material
  /** Do not render these sides' wall meshes (e.g. when a custom facade replaces them). */
  hideSides?: string[]
  floorRepeat?: number
}

/** Floor, ceiling and walls (with door gaps) for a room defined in layout.ts. */
export function RoomShell({ room, wall, floor, ceiling, floorRepeat = 1 }: RoomShellProps) {
  const walls = useMemo(() => roomWalls(room), [room])
  const w = room.maxX - room.minX
  const d = room.maxZ - room.minZ
  const cx = (room.minX + room.maxX) / 2
  const cz = (room.minZ + room.maxZ) / 2
  const floorGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 4) * floorRepeat, uv.getY(i) * (d / 4) * floorRepeat)
    return g
  }, [w, d, floorRepeat])
  return (
    <group name={`room-${room.id}`}>
      <mesh geometry={floorGeo} material={floor} position={[cx, 0.005, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      <mesh material={ceiling} position={[cx, room.height + 0.1, cz]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.6, 0.2, d + 0.6]} />
      </mesh>
      {walls.map(({ box }, i) => (
        <mesh
          key={i}
          material={wall}
          position={[(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[box.maxX - box.minX, box.maxY - box.minY, box.maxZ - box.minZ]} />
        </mesh>
      ))}
    </group>
  )
}

// --------------------------------------------------------- SlidingDoor -----
interface SlidingDoorProps {
  position: V3
  rotationY?: number
  width: number
  height: number
  frameColor?: string
}

/** Automatic glass doors that slide open when the visitor approaches. */
export function SlidingDoor({ position, rotationY = 0, width, height, frameColor = '#1b1b1d' }: SlidingDoorProps) {
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const open = useRef(0)
  const center = useMemo(() => new THREE.Vector3(...position), [position])
  useFrame((_, dt) => {
    const p = playerState.position
    const dist = Math.hypot(p.x - center.x, p.z - center.z)
    const target = dist < 5 && Math.abs(p.y - center.y) < 3 ? 1 : 0
    open.current += (target - open.current) * Math.min(1, dt * 4)
    const off = (width / 4) + open.current * (width / 2 - 0.05)
    if (left.current) left.current.position.x = -off
    if (right.current) right.current.position.x = off
  })
  const panelW = width / 2
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[left, right].map((ref, i) => (
        <mesh key={i} ref={ref} position={[i ? width / 4 : -width / 4, height / 2, 0]}>
          <boxGeometry args={[panelW, height, 0.06]} />
          <meshStandardMaterial color="#9fd3dc" transparent opacity={0.35} roughness={0.05} metalness={0.2} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.12, 0]}>
        <boxGeometry args={[width + 0.4, 0.24, 0.3]} />
        <meshStandardMaterial color={frameColor} metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

// -------------------------------------------------------------- Jersey -----
let shirtGeo: THREE.ExtrudeGeometry | null = null
/** Simple flat T-shirt silhouette (no logos, no sponsor). Centred, ~0.75 m tall. */
export function getShirtGeometry() {
  if (shirtGeo) return shirtGeo
  const s = new THREE.Shape()
  s.moveTo(-0.26, -0.38)
  s.lineTo(0.26, -0.38)
  s.lineTo(0.26, 0.12)
  s.lineTo(0.4, 0.04)
  s.lineTo(0.48, 0.2)
  s.lineTo(0.27, 0.36)
  s.lineTo(0.09, 0.38)
  s.quadraticCurveTo(0, 0.3, -0.09, 0.38)
  s.lineTo(-0.27, 0.36)
  s.lineTo(-0.48, 0.2)
  s.lineTo(-0.4, 0.04)
  s.lineTo(-0.26, 0.12)
  s.closePath()
  shirtGeo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 })
  shirtGeo.translate(0, 0, -0.025)
  return shirtGeo
}

const shirtMat = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.75 })
const trimMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.7 })

interface JerseyProps {
  position: V3
  rotationY?: number
  number?: number
  name?: string
  /** true: show the back (number side) toward +Z */
  showBack?: boolean
  hanger?: boolean
  scale?: number
}

export function Jersey({ position, rotationY = 0, number, name = '', showBack = true, hanger = true, scale = 1 }: JerseyProps) {
  const tex = useMemo(() => (number !== undefined ? shirtNumberTexture(number, name) : null), [number, name])
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh geometry={getShirtGeometry()} material={shirtMat} castShadow />
      <mesh position={[0, -0.36, 0]} material={trimMat}>
        <boxGeometry args={[0.53, 0.04, 0.1]} />
      </mesh>
      {tex && showBack && (
        <mesh position={[0, -0.02, 0.055]}>
          <planeGeometry args={[0.46, 0.46]} />
          <meshStandardMaterial map={tex} transparent roughness={0.7} />
        </mesh>
      )}
      {hanger && (
        <mesh position={[0, 0.42, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.05, 0.01, 6, 12, Math.PI * 1.4]} />
          <meshStandardMaterial color="#ddd" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
    </group>
  )
}

// --------------------------------------------------------- PointLamp -------
/** A visible ceiling fixture + an actual point light. */
export function CeilingLight({ position, intensity = 30, distance = 22, color = '#fff4e2', size = [1.6, 0.6] as [number, number] }: {
  position: V3
  intensity?: number
  distance?: number
  color?: string
  size?: [number, number]
}) {
  return (
    <group position={position}>
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshBasicMaterial color={color} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, -0.4, 0]} intensity={intensity} distance={distance} decay={2} color={color} />
    </group>
  )
}

/** Emissive-only light panel (no real light; cheap). */
export function LightPanel({ position, size, rotation = [Math.PI / 2, 0, 0], color = '#fff6e8', intensity = 1 }: {
  position: V3
  size: [number, number]
  rotation?: V3
  color?: string
  intensity?: number
}) {
  const c = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={c} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}
