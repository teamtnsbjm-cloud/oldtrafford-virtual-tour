import { useMemo } from 'react'
import * as THREE from 'three'
import { LOCKER_BENCHES, LOCKERS, PHYSIO_TABLE, ROOMS, TACTICS_BOARD, type LockerSlot } from '../../world/layout'
import { emblemTexture, floorTileTexture, tacticsBoardTexture, woodTexture } from '../../world/textures'
import { CeilingLight, Jersey, LightPanel, RoomShell, Sign } from './props/common'

const R = ROOMS.locker
const LOCKER_H = 2.6
const LOCKER_D = 0.75

function useLockerMaterials() {
  return useMemo(() => {
    const wood = woodTexture()
    return {
      wood: new THREE.MeshStandardMaterial({ map: wood, color: '#d9b07a', roughness: 0.55 }),
      recess: new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.5 }),
      lightbox: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.15), toneMapped: false }),
      cushion: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.45 }),
      led: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff1a2a').multiplyScalar(2), toneMapped: false }),
    }
  }, [])
}

function Locker({ slot, width, mats }: { slot: LockerSlot; width: number; mats: ReturnType<typeof useLockerMaterials> }) {
  const w = width - 0.06
  return (
    <group position={[slot.x, 0, slot.z]} rotation={[0, slot.rotY, 0]}>
      {/* carcass */}
      <mesh position={[0, LOCKER_H / 2, -LOCKER_D / 2 + 0.03]} material={mats.recess}>
        <boxGeometry args={[w, LOCKER_H, 0.05]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * width) / 2, LOCKER_H / 2, 0]} material={mats.wood} castShadow>
          <boxGeometry args={[0.06, LOCKER_H, LOCKER_D]} />
        </mesh>
      ))}
      {/* white light box on top */}
      <mesh position={[0, LOCKER_H - 0.28, 0.02]} material={mats.lightbox}>
        <boxGeometry args={[w, 0.52, LOCKER_D - 0.04]} />
      </mesh>
      {/* lower cabinet + name plate */}
      <mesh position={[0, 0.72, -0.02]} material={mats.white} castShadow>
        <boxGeometry args={[w, 0.5, LOCKER_D - 0.08]} />
      </mesh>
      <mesh position={[0, 0.88, LOCKER_D / 2 - 0.05]}>
        <boxGeometry args={[0.22, 0.05, 0.01]} />
        <meshStandardMaterial color="#c9a347" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* shirt */}
      <Jersey position={[0, 1.52, -0.05]} number={slot.number} name={slot.name} />
    </group>
  )
}

function Benches({ mats }: { mats: ReturnType<typeof useLockerMaterials> }) {
  return (
    <>
      {LOCKER_BENCHES.map((b, i) => {
        const w = b.maxX - b.minX
        const d = b.maxZ - b.minZ
        const cx = (b.minX + b.maxX) / 2
        const cz = (b.minZ + b.maxZ) / 2
        return (
          <group key={i} position={[cx, 0, cz]}>
            <mesh position={[0, 0.22, 0]} material={mats.wood} castShadow receiveShadow>
              <boxGeometry args={[w, 0.3, d]} />
            </mesh>
            <mesh position={[0, 0.42, 0]} material={mats.cushion} castShadow>
              <boxGeometry args={[w - 0.05, 0.12, d - 0.04]} />
            </mesh>
            {/* red LED strip under the bench */}
            <mesh position={[0, 0.04, 0]} material={mats.led}>
              <boxGeometry args={[w + 0.02, 0.03, d + 0.06]} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

/** Players' dressing room: lockers in a U, benches, tactics board, emblem floor. */
export function LockerRoom() {
  const mats = useLockerMaterials()
  const shell = useMemo(() => {
    const tile = floorTileTexture('#2e2e31', '#28282b').clone()
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping
    tile.needsUpdate = true
    return {
      wall: new THREE.MeshStandardMaterial({ color: '#d8d5cf', roughness: 0.85 }),
      floor: new THREE.MeshStandardMaterial({ map: tile, color: '#888', roughness: 0.35, metalness: 0.1 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#3a3a3d', roughness: 0.9 }),
    }
  }, [])
  const emblem = useMemo(() => emblemTexture(), [])
  const tactics = useMemo(() => tacticsBoardTexture(), [])

  // width of each locker run
  const widths = [
    (R.maxX - R.minX - 1.0) / 16,
    (R.maxZ - R.minZ - 1.4) / 12,
    (-12.4 - (R.minX + 0.9)) / 9,
  ]
  const widthFor = (i: number) => (i < 16 ? widths[0] : i < 28 ? widths[1] : widths[2])
  const cx = (R.minX + R.maxX) / 2
  const cz = (R.minZ + R.maxZ) / 2

  return (
    <group name="LockerRoom">
      <RoomShell room={R} wall={shell.wall} floor={shell.floor} ceiling={shell.ceiling} floorRepeat={2} />
      {LOCKERS.map((slot, i) => (
        <Locker key={i} slot={slot} width={widthFor(i)} mats={mats} />
      ))}
      <Benches mats={mats} />

      {/* fan-made floor emblem (not a club crest) */}
      <mesh position={[cx, 0.02, cz + 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.5, 6.5]} />
        <meshStandardMaterial map={emblem} transparent roughness={0.4} depthWrite={false} />
      </mesh>

      {/* tactics board on the east wall */}
      <group position={[TACTICS_BOARD.x, 1.65, TACTICS_BOARD.z]} rotation={[0, TACTICS_BOARD.rotY, 0]}>
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[3.3, 2.1, 0.08]} />
          <meshStandardMaterial color="#c8c8c8" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[3.1, 1.94]} />
          <meshStandardMaterial map={tactics} roughness={0.35} />
        </mesh>
      </group>

      {/* recessed ceiling light frame like a modern dressing room */}
      <LightPanel position={[cx, R.height - 0.02, cz]} size={[14, 0.3]} intensity={1.4} />
      <LightPanel position={[cx, R.height - 0.02, cz + 4]} size={[14, 0.3]} intensity={1.4} />
      <LightPanel position={[cx, R.height - 0.02, cz - 4]} size={[14, 0.3]} intensity={1.4} />
      <CeilingLight position={[-20, R.height, 58]} intensity={45} distance={20} size={[0.01, 0.01]} />
      <CeilingLight position={[-11, R.height, 58]} intensity={45} distance={20} size={[0.01, 0.01]} />

      <LockerDetails />
      <Sign id="locker-exit" lines={[{ text: 'TUNNEL  →  PITCH', size: 0.5 }]} width={3.2} height={0.45} position={[R.maxX - 0.18, 3.4, 56]} rotationY={-Math.PI / 2} bg="#a50e18" glow />
      <Sign id="locker-title" lines={[{ text: 'HOME DRESSING ROOM · FAN CONCEPT', size: 0.5 }]} width={7} height={0.5} position={[cx, 3.55, R.minZ + 0.2]} bg="#111" glow />
    </group>
  )
}

/** Boots, wall panelling, downlights and a matchday prep corner (imagined reconstruction). */
function LockerDetails() {
  const objs = useMemo(() => {
    const Y = new THREE.Vector3(0, 1, 0)
    // boots: a pair under each bench, in front of every locker
    const upper = new THREE.BoxGeometry(0.1, 0.09, 0.24).translate(0, 0.075, 0.02)
    const sole = new THREE.BoxGeometry(0.105, 0.03, 0.26).translate(0, 0.015, 0.02)
    const bootMs: THREE.Matrix4[] = []
    const soleMs: THREE.Matrix4[] = []
    for (const l of LOCKERS) {
      const q = new THREE.Quaternion().setFromAxisAngle(Y, l.rotY + 0.12)
      const fwd = new THREE.Vector3(Math.sin(l.rotY), 0, Math.cos(l.rotY))
      const side = new THREE.Vector3(Math.cos(l.rotY), 0, -Math.sin(l.rotY))
      for (const k of [-0.08, 0.08]) {
        const p = new THREE.Vector3(l.x, 0.01, l.z).addScaledVector(fwd, 0.62).addScaledVector(side, k)
        const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1))
        bootMs.push(m)
        soleMs.push(m)
      }
    }
    const mk = (g: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[]) => {
      const m = new THREE.InstancedMesh(g, mat, ms.length)
      ms.forEach((x, i) => m.setMatrixAt(i, x))
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
      return m
    }
    // ceiling downlights grid
    const dl: THREE.Matrix4[] = []
    for (let x = R.minX + 2; x < R.maxX - 1; x += 3) for (const z of [R.minZ + 2.2, R.maxZ - 2.2]) dl.push(new THREE.Matrix4().makeTranslation(x, R.height - 0.02, z))
    return [
      mk(upper, new THREE.MeshStandardMaterial({ color: '#101012', roughness: 0.35 }), bootMs),
      mk(sole, new THREE.MeshStandardMaterial({ color: '#d61f2c', roughness: 0.5 }), soleMs),
      mk(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff7ea').multiplyScalar(1.6), toneMapped: false }), dl),
    ]
  }, [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ map: woodTexture(), color: '#8a6440', roughness: 0.6 }), [])
  const t = PHYSIO_TABLE
  return (
    <group name="LockerDetails">
      {objs.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
      {/* timber slat band above the lockers on three walls */}
      {[
        { p: [(R.minX + R.maxX) / 2, 3.35, R.minZ + 0.16] as const, s: [R.maxX - R.minX, 1.2, 0.04] as const },
        { p: [R.minX + 0.17, 3.35, (R.minZ + R.maxZ) / 2] as const, s: [0.06, 1.2, R.maxZ - R.minZ] as const },
      ].map((b, i) => (
        <mesh key={i} position={b.p as unknown as [number, number, number]} material={wood}>
          <boxGeometry args={b.s as unknown as [number, number, number]} />
        </mesh>
      ))}
      {/* physio table */}
      <group position={[(t.minX + t.maxX) / 2, 0, (t.minZ + t.maxZ) / 2]}>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.75, 0.14, 1.95]} />
          <meshStandardMaterial color="#202024" roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.81, 0.75]}>
          <boxGeometry args={[0.6, 0.06, 0.35]} />
          <meshStandardMaterial color="#f2f2f0" roughness={0.9} />
        </mesh>
        {[-0.3, 0.3].flatMap((x) => [-0.85, 0.85].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.33, z]}>
            <cylinderGeometry args={[0.025, 0.025, 0.66]} />
            <meshStandardMaterial color="#b9bcc1" metalness={0.8} roughness={0.3} />
          </mesh>
        )))}
      </group>
      {/* bottle crate + towels next to the table */}
      <group position={[-8.6, 0, 59.6]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.5, 0.4, 0.35]} />
          <meshStandardMaterial color="#1e1e22" />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[-0.17 + (i % 3) * 0.17, 0.52, -0.08 + Math.floor(i / 3) * 0.16]}>
            <cylinderGeometry args={[0.035, 0.035, 0.24, 10]} />
            <meshStandardMaterial color={i % 2 ? '#c4141c' : '#f2f2f2'} roughness={0.4} />
          </mesh>
        ))}
      </group>
      <Sign
        id="locker-disclaimer"
        lines={[{ text: '상상 재현 (FAN RECONSTRUCTION) · 실제 라커룸 배치와 다를 수 있습니다', size: 0.42, color: '#f3c623' }]}
        width={4.6}
        height={0.32}
        position={[R.maxX - 0.18, 3.0, 62.2]}
        rotationY={-Math.PI / 2}
        bg="#111"
        glow
      />
    </group>
  )
}
