import { useEffect } from 'react'
import { useTour } from '../../state/tourStore'
import { useMatchData } from '../../data/matchData'
import { Avatar } from '../player/Avatar'
import { RemotePlayers } from '../player/RemotePlayers'
import { AudioDirector } from '../../audio/AudioDirector'
import { PlayerController } from '../player/PlayerController'
import { ThirdPersonCamera } from '../player/ThirdPersonCamera'
import { LightingSystem } from './LightingSystem'
import { MegaStore } from './MegaStore'
import { StadiumExterior } from './StadiumExterior'
import { StadiumInterior } from './StadiumInterior'
import { StadiumPitch } from './StadiumPitch'
import { Balls } from './Balls'
import { StadiumSeating } from './StadiumSeating'

/**
 * Scene root. Each area is an independent component so later phases
 * (museum, fan lounge, live data, multiplayer avatars) can be added here.
 */
export function Experience() {
  const match = useMatchData()
  useEffect(() => {
    // effects run after the (heavy) procedural geometry has been built and committed
    const id = requestAnimationFrame(() => useTour.getState().setReady())
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <>
      <LightingSystem />
      <StadiumExterior />
      <StadiumSeating />
      <StadiumPitch match={match} />
      <Balls />
      <StadiumInterior />
      <MegaStore />
      {/* order matters: physics → camera → avatar pose */}
      <PlayerController />
      <ThirdPersonCamera />
      <Avatar />
      <RemotePlayers />
      <AudioDirector />
    </>
  )
}
