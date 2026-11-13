import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { THREE_CLAMP } from './clamp'
import { audio } from './audioEngine'
import { playerState } from '../state/playerState'
import { useTour } from '../state/tourStore'

/** Drives the synthesised crowd ambience from the visitor's location. */
export function AudioDirector() {
  const muted = useTour((s) => s.muted)
  useEffect(() => audio.setMuted(muted), [muted])
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.15) return
    acc.current = 0
    const p = playerState.position
    let level = 0.06
    let open = 0.3
    let echo = 0
    switch (playerState.zone) {
      case 'plaza': level = 0.08; open = 0.3; break
      case 'lobby': level = 0.04; open = 0.12; echo = 0.3; break
      case 'locker': level = 0.03; open = 0.08; echo = 0.4; break
      case 'store': level = 0.02; open = 0.1; echo = 0.15; break
      case 'tunnel': {
        // the roar grows as you walk toward the light
        const prog = THREE_CLAMP((58 - p.z) / 16, 0, 1)
        level = 0.05 + prog * prog * 0.45
        open = 0.12 + prog * 0.5
        echo = 0.9
        break
      }
      case 'pitch': level = 0.55; open = 1; break
      case 'stands': level = 0.6; open = 1; break
    }
    audio.setAmbience(level, open, echo)
  })
  return null
}
