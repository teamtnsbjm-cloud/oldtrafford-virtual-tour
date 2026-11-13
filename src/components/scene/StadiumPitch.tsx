import { useMemo } from 'react'
import * as THREE from 'three'
import { AD_BOARDS, BOWL, DUGOUTS, PITCH_LENGTH, PITCH_WIDTH, SCOREBOARDS } from '../../world/layout'
import { grainTexture, ledBoardTexture, netTexture, pitchTexture } from '../../world/textures'
import { Scoreboard } from './Scoreboard'
import type { MatchData } from '../../data/matchData'

const GOAL_W = 7.32
const GOAL_H = 2.44
const GOAL_D = 2.0
const POST = 0.06

function Goal({ side }: { side: 1 | -1 }) {
  const net = useMemo(() => {
    const t = netTexture().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.needsUpdate = true
    return t
  }, [])
  const netMat = useMemo(() => {
    const back = net.clone()
    back.repeat.set(GOAL_W * 4, GOAL_H * 4)
    back.needsUpdate = true
    const top = net.clone()
    top.repeat.set(GOAL_D * 4, GOAL_W * 4)
    top.needsUpdate = true
    const sideT = net.clone()
    sideT.repeat.set(GOAL_D * 4, GOAL_H * 4)
    sideT.needsUpdate = true
    const m = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 })
    return { back: m(back), top: m(top), side: m(sideT) }
  }, [net])
  const x = (side * PITCH_LENGTH) / 2
  const white = <meshStandardMaterial color="#ffffff" roughness={0.3} />
  return (
    <group position={[x, 0, 0]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
      {/* posts & crossbar on the goal line, depth goes +X (outward) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, GOAL_H / 2, (s * GOAL_W) / 2]} castShadow>
          <cylinderGeometry args={[POST, POST, GOAL_H, 12]} />
          {white}
        </mesh>
      ))}
      <mesh position={[0, GOAL_H, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[POST, POST, GOAL_W + POST * 2, 12]} />
        {white}
      </mesh>
      {/* back frame */}
      {[-1, 1].map((s) => (
        <mesh key={`b${s}`} position={[GOAL_D, GOAL_H / 2, (s * GOAL_W) / 2]}>
          <cylinderGeometry args={[0.03, 0.03, GOAL_H, 8]} />
          <meshStandardMaterial color="#cfcfcf" />
        </mesh>
      ))}
      {/* top + ground stanchions from the posts to the back frame */}
      {[-1, 1].map((s) => (
        <group key={`f${s}`}>
          <mesh position={[GOAL_D / 2, GOAL_H, (s * GOAL_W) / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, GOAL_D, 8]} />
            <meshStandardMaterial color="#d9d9d9" />
          </mesh>
          <mesh position={[GOAL_D / 2, 0.03, (s * GOAL_W) / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, GOAL_D, 8]} />
            <meshStandardMaterial color="#d9d9d9" />
          </mesh>
        </group>
      ))}
      <mesh position={[GOAL_D, GOAL_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, GOAL_W, 8]} />
        <meshStandardMaterial color="#d9d9d9" />
      </mesh>
      <mesh position={[GOAL_D, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, GOAL_W, 8]} />
        <meshStandardMaterial color="#d9d9d9" />
      </mesh>
      {/* nets */}
      <mesh position={[GOAL_D, GOAL_H / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={netMat.back}>
        <planeGeometry args={[GOAL_W, GOAL_H]} />
      </mesh>
      <mesh position={[GOAL_D / 2, GOAL_H, 0]} rotation={[-Math.PI / 2, 0, 0]} material={netMat.top}>
        <planeGeometry args={[GOAL_D, GOAL_W]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`n${s}`} position={[GOAL_D / 2, GOAL_H / 2, (s * GOAL_W) / 2]} material={netMat.side}>
          <planeGeometry args={[GOAL_D, GOAL_H]} />
        </mesh>
      ))}
    </group>
  )
}

function CornerFlag({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.5, 8]} />
        <meshStandardMaterial color="#f2f2f2" />
      </mesh>
      <mesh position={[0, 1.32, -Math.sign(z) * 0.2]}>
        <planeGeometry args={[0.4, 0.3]} />
        <meshStandardMaterial color="#d6111f" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function AdBoards() {
  const mats = useMemo(
    () =>
      [0, 1].map((v) => {
        const t = ledBoardTexture(v)
        return new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
      }),
    [],
  )
  return (
    <group>
      {AD_BOARDS.map((b, i) => {
        const w = b.maxX - b.minX
        const d = b.maxZ - b.minZ
        const alongX = w > d
        const len = alongX ? w : d
        const cx = (b.minX + b.maxX) / 2
        const cz = (b.minZ + b.maxZ) / 2
        // face toward the pitch
        const rotY = alongX ? (cz < 0 ? 0 : Math.PI) : cx < 0 ? Math.PI / 2 : -Math.PI / 2
        const mat = mats[i % 2]
        const map = (mat.map as THREE.Texture).clone()
        map.wrapS = THREE.RepeatWrapping
        map.repeat.set(len / 20, 1)
        map.needsUpdate = true
        return (
          <group key={i} position={[cx, 0, cz]} rotation={[0, rotY, 0]}>
            <mesh position={[0, 0.45, -0.08]} castShadow>
              <boxGeometry args={[len, 0.9, 0.12]} />
              <meshStandardMaterial color="#121212" />
            </mesh>
            <mesh position={[0, 0.47, 0]}>
              <planeGeometry args={[len - 0.1, 0.8]} />
              <meshBasicMaterial map={map} toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Dugouts() {
  return (
    <group>
      {DUGOUTS.map((b, i) => {
        const w = b.maxX - b.minX
        const d = b.maxZ - b.minZ
        const cx = (b.minX + b.maxX) / 2
        const cz = (b.minZ + b.maxZ) / 2
        return (
          <group key={i} position={[cx, 0, cz]}>
            {/* back + sides */}
            <mesh position={[0, 1.2, d / 2 - 0.05]} castShadow receiveShadow>
              <boxGeometry args={[w, 2.4, 0.1]} />
              <meshStandardMaterial color="#1c1c1f" />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[(s * w) / 2, 1.2, 0]}>
                <boxGeometry args={[0.08, 2.4, d]} />
                <meshStandardMaterial color="#bfe3ec" transparent opacity={0.35} depthWrite={false} />
              </mesh>
            ))}
            {/* curved clear roof */}
            <mesh position={[0, 2.35, 0]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[w, 0.06, d + 0.3]} />
              <meshStandardMaterial color="#d8eef4" transparent opacity={0.4} depthWrite={false} />
            </mesh>
            {/* bucket seats */}
            {Array.from({ length: 12 }).map((_, k) => (
              <group key={k} position={[-w / 2 + 0.4 + k * ((w - 0.8) / 11), 0, 0.3]}>
                <mesh position={[0, 0.45, 0]} castShadow>
                  <boxGeometry args={[0.5, 0.12, 0.5]} />
                  <meshStandardMaterial color={i === 0 ? '#b5121b' : '#2a2a2e'} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.85, 0.24]} rotation={[-0.15, 0, 0]}>
                  <boxGeometry args={[0.5, 0.8, 0.08]} />
                  <meshStandardMaterial color={i === 0 ? '#b5121b' : '#2a2a2e'} roughness={0.5} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 0.02, 0]} receiveShadow>
              <boxGeometry args={[w, 0.04, d]} />
              <meshStandardMaterial color="#3a3a3a" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** The red extendable canopy just outside the tunnel mouth. */
function TunnelCanopy() {
  const ribs = 6
  return (
    <group position={[0, 0, 41.6]}>
      {Array.from({ length: ribs }).map((_, i) => (
        <mesh key={i} position={[0, 0, -i * 0.7 - 0.2]} rotation={[0, 0, 0]} castShadow>
          <torusGeometry args={[2.1, 0.06, 6, 24, Math.PI]} />
          <meshStandardMaterial color="#9a0d16" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0, -(ribs - 1) * 0.35 - 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.12, 2.12, (ribs - 1) * 0.7, 24, 1, true, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#c4141c" roughness={0.65} side={THREE.DoubleSide} transparent opacity={0.92} />
      </mesh>
    </group>
  )
}

export function StadiumPitch({ match }: { match: MatchData | null }) {
  const grass = useMemo(() => pitchTexture(), [])
  const blades = useMemo(() => {
    const t = grainTexture().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(BOWL.a * 2 * 1.6, BOWL.b * 2 * 1.6)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <group name="StadiumPitch">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[BOWL.a * 2, BOWL.b * 2]} />
        <meshStandardMaterial map={grass} bumpMap={blades} bumpScale={1.6} roughness={0.92} />
      </mesh>
      <Goal side={1} />
      <Goal side={-1} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <CornerFlag key={`${sx}${sz}`} x={(sx * PITCH_LENGTH) / 2} z={(sz * PITCH_WIDTH) / 2} />))}
      <AdBoards />
      <Dugouts />
      <TunnelCanopy />
      {SCOREBOARDS.map((s, i) => (
        <Scoreboard key={i} data={match} position={s.position} rotationY={s.rotY} />
      ))}
    </group>
  )
}
