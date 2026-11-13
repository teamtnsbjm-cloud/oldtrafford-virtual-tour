import { useMemo } from 'react'
import * as THREE from 'three'
import { LOBBY_DESK, LOBBY_PILLARS, ROOMS } from '../../world/layout'
import { floorTileTexture } from '../../world/textures'
import { CeilingLight, LightPanel, RoomShell, Sign, SlidingDoor } from './props/common'

const R = ROOMS.lobby

/** Entrance lobby: tour information, directions and the way to the locker room. */
export function Lobby() {
  const mats = useMemo(() => {
    const tile = floorTileTexture('#6a6a70', '#55555b').clone()
    tile.wrapS = tile.wrapT = THREE.RepeatWrapping
    tile.needsUpdate = true
    return {
      wall: new THREE.MeshStandardMaterial({ color: '#e7e3dc', roughness: 0.85 }),
      floor: new THREE.MeshStandardMaterial({ map: tile, roughness: 0.25, metalness: 0.1 }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.9 }),
      red: new THREE.MeshStandardMaterial({ color: '#a50e18', roughness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.5 }),
    }
  }, [])
  const cx = (R.minX + R.maxX) / 2

  return (
    <group name="Lobby">
      <RoomShell room={R} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} floorRepeat={1.5} />
      <SlidingDoor position={[0, 0, R.maxZ]} width={6} height={4} />

      {/* Red feature wall with lettering on the north side */}
      <mesh position={[3, 3.6, R.minZ + 0.17]} material={mats.red} receiveShadow>
        <boxGeometry args={[23, 6.6, 0.05]} />
      </mesh>
      <Sign
        id="lobby-feature"
        lines={[
          { text: 'THEATRE OF DREAMS', size: 0.42, font: "'Arial Black',sans-serif", weight: '900' },
          { text: 'VIRTUAL STADIUM TOUR · UNOFFICIAL FAN CONCEPT', size: 0.14, color: '#ffd9dc' },
        ]}
        width={18}
        height={3.2}
        position={[cx + 3.5, 4.4, R.minZ + 0.21]}
      />

      {/* Tour board (west wall) */}
      <mesh position={[R.minX + 0.2, 2.6, 80]} material={mats.dark}>
        <boxGeometry args={[0.1, 3.4, 6.4]} />
      </mesh>
      <Sign
        id="lobby-tour-board"
        lines={[
          { text: 'STADIUM TOUR', size: 0.13, color: '#ff3b47', font: "'Arial Black',sans-serif", weight: '900' },
          { text: '① 로비  →  ② 라커룸 복도', size: 0.085 },
          { text: '③ 선수 라커룸  →  ④ 선수 입장 터널', size: 0.085 },
          { text: '⑤ 메인 경기장 · 관중석', size: 0.085 },
          { text: '메가스토어는 광장 동쪽 건물  ·  빠른 이동: 숫자키 1~7', size: 0.06, color: '#bbbbbb' },
        ]}
        width={6}
        height={3.1}
        position={[R.minX + 0.27, 2.6, 80]}
        rotationY={Math.PI / 2}
        bg="#18181b"
      />

      {/* History wall (east) */}
      <mesh position={[R.maxX - 0.2, 2.8, 84.5]} material={mats.red}>
        <boxGeometry args={[0.1, 3.6, 7]} />
      </mesh>
      <Sign
        id="lobby-history"
        lines={[
          { text: 'HISTORY WALL', size: 0.14, font: "'Arial Black',sans-serif", weight: '900' },
          { text: '1910 · 경기장 개장', size: 0.1 },
          { text: '“THEATRE OF DREAMS”', size: 0.1, color: '#ffd9dc' },
          { text: '연표 콘텐츠는 박물관 업데이트와 함께 확장 예정', size: 0.06, color: '#ffd9dc' },
        ]}
        width={6.6}
        height={3.3}
        position={[R.maxX - 0.27, 2.8, 84.5]}
        rotationY={-Math.PI / 2}
      />

      {/* Museum door (closed — coming in a later phase) */}
      <mesh position={[R.maxX - 0.2, 1.5, 76]} material={mats.dark}>
        <boxGeometry args={[0.12, 3, 2.6]} />
      </mesh>
      <Sign
        id="lobby-museum"
        lines={[
          { text: 'MUSEUM & TROPHY ROOM', size: 0.2, font: "'Arial Black',sans-serif", weight: '900' },
          { text: '박물관 · 트로피룸 — 준비 중 (COMING SOON)', size: 0.14, color: '#f3c623' },
        ]}
        width={3.6}
        height={0.9}
        position={[R.maxX - 0.28, 3.6, 76]}
        rotationY={-Math.PI / 2}
        bg="#111"
        glow
      />

      {/* Reception desk */}
      <group position={[(LOBBY_DESK.minX + LOBBY_DESK.maxX) / 2, 0, (LOBBY_DESK.minZ + LOBBY_DESK.maxZ) / 2]}>
        <mesh position={[0, 0.55, 0]} material={mats.red} castShadow receiveShadow>
          <boxGeometry args={[6, 1.1, 1.2]} />
        </mesh>
        <mesh position={[0, 1.13, 0]} material={mats.dark}>
          <boxGeometry args={[6.2, 0.06, 1.4]} />
        </mesh>
        <Sign id="lobby-desk" lines={[{ text: 'WELCOME · 투어 안내 데스크', size: 0.45 }]} width={4.5} height={0.5} position={[0, 0.6, 0.61]} />
      </group>

      {LOBBY_PILLARS.map((p, i) => (
        <mesh key={i} position={[(p.minX + p.maxX) / 2, 3.5, (p.minZ + p.maxZ) / 2]} material={mats.dark} castShadow receiveShadow>
          <boxGeometry args={[0.9, 7, 0.9]} />
        </mesh>
      ))}

      {/* Hanging direction sign, visible from the entrance */}
      <Sign
        id="lobby-direction"
        lines={[{ text: '←  라커룸 · 선수 터널          박물관 (준비 중)  →', size: 0.5 }]}
        width={11}
        height={0.9}
        position={[0, 5.2, 78]}
        bg="#a50e18"
        glow
      />
      <mesh position={[0, 5.2, 77.97]} material={mats.dark}>
        <boxGeometry args={[11.1, 1, 0.04]} />
      </mesh>
      {[-4.5, 4.5].map((x) => (
        <mesh key={x} position={[x, 6.2, 77.97]} material={mats.dark}>
          <cylinderGeometry args={[0.02, 0.02, 1.2]} />
        </mesh>
      ))}
      {/* doorway sign above the corridor */}
      <Sign
        id="lobby-corridor"
        lines={[{ text: 'PLAYERS’ AREA · 라커룸', size: 0.5 }]}
        width={3}
        height={0.5}
        position={[-10.5, 3.4, R.minZ + 0.2]}
        bg="#111"
        glow
      />

      <CeilingLight position={[-6, R.height, 79]} intensity={90} distance={30} />
      <CeilingLight position={[6, R.height, 83]} intensity={90} distance={30} />
      {[-10, -3, 4, 11].map((x) => (
        <LightPanel key={x} position={[x, R.height - 0.01, 86]} size={[3, 0.4]} intensity={1.2} />
      ))}

      {/* Corridor to the locker room */}
      <RoomShell room={ROOMS.corridor} wall={mats.wall} floor={mats.floor} ceiling={mats.ceiling} />
      <LightPanel position={[-10.5, ROOMS.corridor.height - 0.01, 68.5]} size={[1.2, 3]} intensity={1.3} />
      <pointLight position={[-10.5, 2.6, 68.5]} intensity={8} distance={8} decay={2} color="#fff1dc" />
    </group>
  )
}
