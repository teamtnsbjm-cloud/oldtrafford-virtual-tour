import { useRef } from 'react'
import * as THREE from 'three'
import { Lobby } from './Lobby'
import { useIndoorEnv } from './props/useIndoorEnv'
import { LockerRoom } from './LockerRoom'
import { PlayerTunnel } from './PlayerTunnel'

/**
 * Everything inside the stadium shell at ground level.
 * Future interior spaces (museum, trophy room, fan lounge) plug in here.
 */
export function StadiumInterior() {
  const ref = useRef<THREE.Group>(null)
  useIndoorEnv(ref)
  return (
    <group name="StadiumInterior" ref={ref}>
      <Lobby />
      <LockerRoom />
      <PlayerTunnel />
    </group>
  )
}
