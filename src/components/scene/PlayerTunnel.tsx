import { useMemo } from 'react'
import * as THREE from 'three'
import { ROOMS } from '../../world/layout'
import { LightPanel, RoomShell, Sign } from './props/common'

const A = ROOMS.tunnelA
const B = ROOMS.tunnelB

/**
 * Players' tunnel. Lighting ramps up from the dark dressing-room end to the
 * bright pitch end; the exposure/FOV "reveal" is handled in PlayerController.
 */
export function PlayerTunnel() {
  const mats = useMemo(
    () => ({
      wall: new THREE.MeshStandardMaterial({ color: '#2a0b0e', roughness: 0.6 }),
      floor: new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.8 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#0c0c0e', roughness: 0.9 }),
    }),
    [],
  )
  // ceiling strips: brightness grows toward the pitch (z decreasing)
  const strips = useMemo(() => {
    const out: { z: number; k: number }[] = []
    for (let z = 57; z >= 43; z -= 1.75) out.push({ z, k: 0.35 + ((57 - z) / 14) * 1.6 })
    return out
  }, [])

  return (
    <group name="PlayerTunnel">
      <RoomShell room={A} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} />
      <RoomShell room={B} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} />

      {/* red walkway stripe */}
      <mesh position={[0, 0.012, 50]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 16.6]} />
        <meshStandardMaterial color="#8d0c14" roughness={0.7} />
      </mesh>

      {strips.map(({ z, k }) => (
        <LightPanel key={z} position={[0, B.height - 0.02, z]} size={[2.6, 0.18]} intensity={k} />
      ))}
      {/* vertical red wall light strips */}
      {strips.map(({ z, k }) =>
        [-1, 1].filter((s) => !(s < 0 && z > 53.9) && !(s > 0 && Math.abs(z - 53.5) < 1.5)).map((s) => (
          <LightPanel key={`${z}${s}`} position={[s * 1.83, 1.5, z]} size={[0.08, 2.2]} rotation={[0, Math.PI / 2, 0]} color="#ff2333" intensity={k * 0.9} />
        )),
      )}
      <LightPanel position={[-4, A.height - 0.02, 56]} size={[3, 0.18]} intensity={0.4} />

      <pointLight position={[-4, 2.6, 56]} intensity={5} distance={7} decay={2} color="#ffe6d0" />
      <pointLight position={[0, 2.6, 51]} intensity={12} distance={9} decay={2} color="#fff0e0" />
      <pointLight position={[0, 2.6, 45]} intensity={26} distance={10} decay={2} color="#ffffff" />

      {/* padded wall panels with vertical fins + handrails on both walls */}
      {Array.from({ length: 9 }).map((_, i) => {
        const z = 43.2 + i * 1.75
        return [-1, 1].map((sx) =>
          sx < 0 && z > 53.6 ? null : (
            <mesh key={`fin${i}${sx}`} position={[sx * 1.8, 1.5, z]}>
              <boxGeometry args={[0.12, 3, 0.1]} />
              <meshStandardMaterial color="#1a0507" roughness={0.5} />
            </mesh>
          ),
        )
      })}
      {[-1, 1].map((sx) => (
        <mesh key={`rail${sx}`} position={[sx * 1.76, 1.0, sx < 0 ? 47.8 : 49.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, sx < 0 ? 12.2 : 16.2, 8]} />
          <meshStandardMaterial color="#c9ccd1" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
      {/* light spilling in from the pitch end */}
      <mesh position={[0, 1.4, 42.3]}>
        <planeGeometry args={[3.9, 2.8]} />
        <meshBasicMaterial color="#fffbe8" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.013, 44.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.9, 5]} />
        <meshBasicMaterial color="#fff6d8" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* sign above the exit to the pitch */}
      <mesh position={[0, 2.72, 41.95]}>
        <boxGeometry args={[4, 0.56, 0.1]} />
        <meshStandardMaterial color="#0b0b0c" />
      </mesh>
      <Sign
        id="tunnel-exit"
        lines={[{ text: 'THE THEATRE OF DREAMS', size: 0.62, color: '#ff2a36', font: "'Arial Black',sans-serif", weight: '900' }]}
        width={3.8}
        height={0.5}
        position={[0, 2.72, 42.01]}
        glow
      />
      <Sign
        id="tunnel-wall"
        lines={[
          { text: 'WALK OUT', size: 0.36, font: "'Arial Black',sans-serif", weight: '900' },
          { text: 'THIS WAY TO THE PITCH', size: 0.2, color: '#ffb3b8' },
        ]}
        width={1.9}
        height={0.85}
        position={[1.83, 1.75, 53.5]}
        rotationY={-Math.PI / 2}
        glow
      />
    </group>
  )
}
