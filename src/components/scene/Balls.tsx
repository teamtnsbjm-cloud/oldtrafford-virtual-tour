import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { balls, BALL_R, stepBall } from '../../world/balls'
import { ballTexture } from '../../world/textures'
import { playerState } from '../../state/playerState'
import { useTour } from '../../state/tourStore'
import { audio } from '../../audio/audioEngine'
import { sendBall } from '../../net/netClient'

const REACH = 0.3 + BALL_R + 0.18 // body radius + ball + a little toe reach

/**
 * Renders the match balls and lets the local visitor play with them:
 * walk into a ball to dribble, run for a longer touch, slide-tackle to blast it.
 */
export function Balls() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.38, metalness: 0.02 }), [])
  const geo = useMemo(() => new THREE.SphereGeometry(BALL_R, 28, 18), [])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const fwd = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => () => {
    mat.dispose()
    geo.dispose()
  }, [mat, geo])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const me = playerState.position
    const started = useTour.getState().started
    balls.forEach((b, i) => {
      // ---- local touches ----
      if (started && b.goalT <= 0 && b.cool <= 0 && me.y < 0.6) {
        const dx = b.p.x - me.x
        const dz = b.p.z - me.z
        const dist = Math.hypot(dx, dz)
        const reach = playerState.sliding ? REACH + 0.45 : REACH
        if (dist < reach && b.p.y < 0.8) {
          fwd.set(-Math.sin(playerState.facing), 0, -Math.cos(playerState.facing))
          const sp = playerState.speed
          if (playerState.sliding) {
            b.v.set(fwd.x * 14, 2.6, fwd.z * 14)
            b.cool = 0.4
          } else if (sp > 0.35) {
            // dribble: push the ball ahead in the travel direction (blend with contact normal)
            const nx = dx / (dist || 1)
            const nz = dz / (dist || 1)
            const dirx = fwd.x * 0.75 + nx * 0.25
            const dirz = fwd.z * 0.75 + nz * 0.25
            const len = Math.hypot(dirx, dirz) || 1
            const power = sp * 1.3 + (playerState.running ? 2.2 : 0.9)
            b.v.set((dirx / len) * power, playerState.running ? 1.1 : 0.15, (dirz / len) * power)
            b.cool = 0.22
          } else {
            // standing still: just nudge it out of the feet
            b.p.x = me.x + (dx / (dist || 1)) * reach
            b.p.z = me.z + (dz / (dist || 1)) * reach
          }
          if (b.cool > 0) {
            audio.footstep('grass', playerState.sliding ? 1.8 : 1.1)
            sendBall(i, b.p, b.v)
          }
        }
      }

      // ---- physics ----
      if (stepBall(b, dt) === 'goal') {
        useTour.getState().showBanner('GOAL!', '골망을 흔들었습니다 ⚽')
        audio.cheer()
      }

      const m = meshes.current[i]
      if (m) {
        m.position.copy(b.p)
        m.quaternion.copy(b.q)
      }
    })
  })

  return (
    <group name="Balls">
      {balls.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          geometry={geo}
          material={mat}
          castShadow
        />
      ))}
    </group>
  )
}
