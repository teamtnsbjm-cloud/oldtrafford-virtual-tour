import { useMemo } from 'react'
import * as THREE from 'three'
import { ROOMS } from '../../world/layout'
import { grainTexture } from '../../world/textures'
import { LightPanel, RoomShell, Sign } from './props/common'

const A = ROOMS.tunnelA
const B = ROOMS.tunnelB
const H = B.height

/**
 * Players' tunnel (fan interpretation, no club marks): glossy red walls with
 * black door portals, a black ceiling with zig-zag LED strips, an artificial
 * turf runner, and an open mouth at the pitch end so the real 3D bowl is
 * visible all the way down the corridor. Daylight spills in from the pitch end
 * and gets stronger as you approach it.
 */
export function PlayerTunnel() {
  const mats = useMemo(() => {
    const turfBump = grainTexture().clone()
    turfBump.wrapS = turfBump.wrapT = THREE.RepeatWrapping
    turfBump.repeat.set(6, 6)
    turfBump.needsUpdate = true
    return {
      wall: new THREE.MeshStandardMaterial({ color: '#b30d19', roughness: 0.28, metalness: 0.08 }),
      floor: new THREE.MeshStandardMaterial({ color: '#3d6b2c', roughness: 0.95, bumpMap: turfBump, bumpScale: 2 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.9 }),
      black: new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.45, metalness: 0.2 }),
      door: new THREE.MeshStandardMaterial({ color: '#7d0a12', roughness: 0.4 }),
    }
  }, [])

  // zig-zag LED strips on the black ceiling; segments get brighter toward the pitch (−Z)
  const zig = useMemo(() => {
    const out: { x: number; z: number; rot: number; len: number; k: number }[] = []
    const amp = 1.25
    const seg = 2.4
    let left = true
    for (let z = 57.2; z > 43.2; z -= seg) {
      const z1 = z - seg
      const x0 = left ? -amp : amp
      const x1 = -x0
      const len = Math.hypot(x1 - x0, seg)
      const k = 0.6 + ((57 - z) / 14) * 0.9
      out.push({ x: (x0 + x1) / 2, z: (z + z1) / 2, rot: Math.atan2(x1 - x0, -seg), len, k })
      left = !left
    }
    return out
  }, [])
  const glow = (z: number) => 0.5 + ((57 - z) / 14) * 0.8

  return (
    <group name="PlayerTunnel">
      <RoomShell room={A} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} />
      <RoomShell room={B} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} />

      {/* black skirting + black cornice along both walls of the main run */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.83, 0.09, 49.8]} material={mats.black}>
            <boxGeometry args={[0.06, 0.18, 16.4]} />
          </mesh>
          <mesh position={[s * 1.78, H - 0.22, 49.8]} material={mats.black}>
            <boxGeometry args={[0.18, 0.44, 16.4]} />
          </mesh>
          {/* thin white edge light where the wall meets the cornice */}
          <LightPanel position={[s * 1.82, H - 0.47, 49.8]} size={[16.4, 0.03]} rotation={[0, Math.PI / 2, 0]} intensity={0.8} />
        </group>
      ))}

      {zig.map((s, i) => (
        <LightPanel key={i} position={[s.x, H - 0.03, s.z]} size={[0.09, s.len]} rotation={[-Math.PI / 2, 0, s.rot]} intensity={s.k * 1.6} />
      ))}
      {/* connector (dressing-room side) light strip */}
      <LightPanel position={[-4, A.height - 0.03, 56]} size={[3.2, 0.09]} intensity={0.9} />

      {/* side doors, framed in black: dressing rooms (decorative, the real exit is straight ahead) */}
      <DoorPortal x={1.83} z={55.2} facing={-1} label="VISITING TEAM" mats={mats} />
      <PortalFrame x={-1.83} z={56} facing={1} width={4.2} label="HOME" mats={mats} open />

      {/* wall graphics: large black outlined lettering (no club marks) */}
      <Sign
        id="tunnel-wall-l"
        lines={[{ text: 'THIS IS', size: 0.34, color: '#111', font: "'Arial Black',sans-serif", weight: '900' }, { text: 'THE TUNNEL', size: 0.42, color: '#111', font: "'Arial Black',sans-serif", weight: '900' }]}
        width={4.4}
        height={1.6}
        position={[-1.795, 1.45, 48.8]}
        rotationY={Math.PI / 2}
      />
      <Sign
        id="tunnel-wall-r"
        lines={[{ text: 'WALK OUT', size: 0.5, color: '#111', font: "'Arial Black',sans-serif", weight: '900' }, { text: 'THIS WAY TO THE PITCH →', size: 0.16, color: '#2a0003' }]}
        width={4.2}
        height={1.4}
        position={[1.795, 1.45, 49.2]}
        rotationY={-Math.PI / 2}
      />

      {/* red glow on the walls that brightens toward the exit */}
      {[56, 52.5, 49, 45.5].map((z) => (
        <pointLight key={z} position={[0, 2.5, z]} intensity={4 + glow(z) * 6} distance={6} decay={2} color="#ffd9d0" />
      ))}
      <pointLight position={[-4, 2.5, 56]} intensity={5} distance={6} decay={2} color="#ffe6d0" />

      {/* daylight pouring in from the pitch end */}
      <Daylight />
      <LightShaft />

      {/* LED sign hung under the ceiling at the mouth (does not block the view below it) */}
      <mesh position={[0, H - 0.3, 42.2]} material={mats.black}>
        <boxGeometry args={[3.2, 0.42, 0.12]} />
      </mesh>
      <Sign
        id="tunnel-exit"
        lines={[{ text: 'THE THEATRE OF DREAMS', size: 0.6, color: '#ff2a36', font: "'Arial Black',sans-serif", weight: '900' }]}
        width={3.05}
        height={0.36}
        position={[0, H - 0.3, 42.27]}
        glow
      />
    </group>
  )
}

type Mats = { black: THREE.Material; door: THREE.Material }

/** A black portal frame around an opening (with an optional label above). */
function PortalFrame({ x, z, facing, width, label, mats, open }: { x: number; z: number; facing: 1 | -1; width: number; label: string; mats: Mats; open?: boolean }) {
  const h = 3
  const d = 0.12
  const px = x + facing * 0.03
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[px, h / 2 - 0.06, z + s * (width / 2 - 0.08)]} material={mats.black}>
          <boxGeometry args={[d, h - 0.12, 0.16]} />
        </mesh>
      ))}
      <Sign
        id={`portal-${label}`}
        lines={[{ text: label, size: 0.5, color: '#e8e8ea', font: "'Arial',sans-serif", weight: '700' }]}
        width={Math.min(width - 0.4, 2.2)}
        height={0.32}
        position={[px + facing * 0.07, open ? h - 0.4 : 2.62, z]}
        rotationY={facing > 0 ? Math.PI / 2 : -Math.PI / 2}
        bg="#0b0b0d"
      />
      {/* white edge light on the frame */}
      <LightPanel position={[px + facing * 0.065, h / 2, z + (width / 2 + 0.02)]} size={[0.03, h - 0.3]} rotation={[0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} intensity={1.2} />
    </group>
  )
}

/** A closed, recessed side door in a black frame. */
function DoorPortal({ x, z, facing, label, mats }: { x: number; z: number; facing: 1 | -1; label: string; mats: Mats }) {
  return (
    <group>
      <mesh position={[x + facing * 0.02, 1.45, z]} material={mats.black}>
        <boxGeometry args={[0.06, 2.9, 2.3]} />
      </mesh>
      {[-0.48, 0.48].map((o) => (
        <mesh key={o} position={[x + facing * 0.06, 1.1, z + o]} material={mats.door}>
          <boxGeometry args={[0.04, 2.1, 0.92]} />
        </mesh>
      ))}
      <Sign
        id={`door-${label}`}
        lines={[{ text: label, size: 0.42, color: '#e8e8ea', font: "'Arial',sans-serif", weight: '700' }]}
        width={2}
        height={0.3}
        position={[x + facing * 0.06, 2.55, z]}
        rotationY={facing > 0 ? Math.PI / 2 : -Math.PI / 2}
        bg="#0b0b0d"
      />
      <LightPanel position={[x + facing * 0.055, 1.45, z - 1.16]} size={[0.03, 2.8]} rotation={[0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} intensity={1.2} />
    </group>
  )
}

/** A spot light at the mouth aimed back up the corridor (its target must live in the scene graph). */
function Daylight() {
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(0, 0.4, 52)
    return o
  }, [])
  return (
    <>
      <primitive object={target} />
      <spotLight position={[0, 2.3, 37]} target={target} angle={0.42} penumbra={0.9} intensity={70} distance={20} decay={1.6} color="#fff4dc" />
    </>
  )
}

/** Soft additive daylight haze near the mouth (fades toward the dressing rooms). */
function LightShaft() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 128
    const g = c.getContext('2d')!
    const grd = g.createLinearGradient(0, 0, 0, 128)
    grd.addColorStop(0, 'rgba(255,250,235,0.55)')
    grd.addColorStop(0.45, 'rgba(255,245,225,0.16)')
    grd.addColorStop(1, 'rgba(255,240,220,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 4, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <group>
      {/* floor pool of light */}
      <mesh position={[0, 0.02, 45.6]} rotation={[-Math.PI / 2, 0, Math.PI]}>
        <planeGeometry args={[3.9, 8]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
      </mesh>
      {/* faint glow on both walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.82, 1.5, 45.6]} rotation={[0, -s * Math.PI / 2, s * Math.PI / 2]}>
          <planeGeometry args={[3, 8]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.18} />
        </mesh>
      ))}
    </group>
  )
}
