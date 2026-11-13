import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { colliderTop, COLLIDERS, groundAt, SPAWNS, zoneAt } from '../../world/layout'
import { inputState } from '../../state/inputState'
import { INTERACTABLES } from '../../data/interactables'
import { playerState } from '../../state/playerState'
import { useTour } from '../../state/tourStore'

const RADIUS = 0.3
const MAX_STEP = 0.55
const WALK = 3.4
const RUN = 7.2
const GRAVITY = 22
const JUMP_V = 6.2
const HEAD = 1.6

function hitsCollider(x: number, z: number, feet: number) {
  for (const b of COLLIDERS) {
    if (feet + 1.7 < b.minY || feet + MAX_STEP * 0.6 > b.maxY) continue
    const cx = Math.max(b.minX, Math.min(x, b.maxX))
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ))
    const dx = x - cx
    const dz = z - cz
    if (dx * dx + dz * dz < RADIUS * RADIUS) return true
  }
  return false
}

/** Highest ground under the body footprint (centre + 4 points on the rim). */
function footprintGround(x: number, z: number, feet: number) {
  const r = RADIUS * 0.9
  return Math.max(
    colliderTop(x, z, feet, MAX_STEP),
    groundAt(x, z, feet),
    groundAt(x + r, z, feet),
    groundAt(x - r, z, feet),
    groundAt(x, z + r, feet),
    groundAt(x, z - r, feet),
  )
}

function blocked(x: number, z: number, feet: number, stuck = false) {
  // if we're already overlapping a box (e.g. landed beside one), let the body walk out of it
  if (!stuck && hitsCollider(x, z, feet)) return true
  return footprintGround(x, z, feet) > feet + MAX_STEP
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

/**
 * Third-person character controller: camera-relative WASD (+Shift run),
 * gravity and terrace steps, box colliders, body turning toward the travel
 * direction, E to interact, number keys / menu for quick travel.
 * Camera orbit lives in ThirdPersonCamera; visuals/animation in Avatar.
 */
export function PlayerController() {
  const keys = useRef<Record<string, boolean>>({})
  const vel = useRef(new THREE.Vector2())
  const vy = useRef(0)
  const lastSafe = useRef(new THREE.Vector3(0, 0, 128))
  const safeTimer = useRef(0)

  const teleportTo = (spawnId: string) => {
    const s = SPAWNS.find((p) => p.id === spawnId)
    if (!s) return
    playerState.position.set(...s.position)
    playerState.yaw = s.yaw
    playerState.facing = s.yaw
    playerState.pitch = 0.28
    vel.current.set(0, 0)
    vy.current = 0
    playerState.zone = zoneAt(s.position[0], s.position[1], s.position[2])
    window.dispatchEvent(new Event('tod:teleport'))
  }

  useEffect(() => {
    teleportTo('plaza')
    ;(window as unknown as { __tour: unknown }).__tour = {
      teleport: teleportTo,
      state: playerState,
      look: (yaw: number, pitch = 0.28) => {
        playerState.yaw = yaw
        playerState.pitch = pitch
      },
    }
    return useTour.subscribe((s, prev) => {
      if (s.teleport && s.teleport !== prev.teleport) teleportTo(s.teleport.spawnId)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = useTour.getState()
      if (!st.started || isTyping(e)) return
      keys.current[e.code] = true
      if (e.code === 'KeyE' && !st.customizing) {
        if (st.infoId) st.closeInfo()
        else if (st.focusedId) {
          st.openInfo(st.focusedId)
          if (document.pointerLockElement) document.exitPointerLock()
        }
      }
      if (e.code === 'Space' && !st.infoId && !st.customizing) inputState.jumpQueued = true
      if (e.code === 'KeyM') st.setMuted(!st.muted)
      if (e.code === 'KeyC' && !st.infoId) {
        st.setCustomizing(!st.customizing)
        if (document.pointerLockElement) document.exitPointerLock()
      }
      if (e.code === 'Escape') {
        if (st.infoId) st.closeInfo()
        if (st.customizing) st.setCustomizing(false)
      }
      const spawn = SPAWNS.find((s) => s.hotkey === e.key)
      if (spawn && !st.infoId && !st.customizing) st.requestTeleport(spawn.id)
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false
    }
    const onBlur = () => {
      keys.current = {}
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const st = useTour.getState()
    const p = playerState.position
    const k = keys.current
    const canMove = st.started && !st.infoId && !st.customizing

    let ix = 0
    let iz = 0
    if (canMove) {
      if (k.KeyW || k.ArrowUp) iz -= 1
      if (k.KeyS || k.ArrowDown) iz += 1
      if (k.KeyA || k.ArrowLeft) ix -= 1
      if (k.KeyD || k.ArrowRight) ix += 1
    }
    // touch joystick (analog: a light push walks slowly)
    let analog = 1
    if (canMove && (inputState.joyX !== 0 || inputState.joyY !== 0)) {
      ix += inputState.joyX
      iz += inputState.joyY
      analog = Math.min(1, Math.hypot(inputState.joyX, inputState.joyY))
    }
    const hasInput = Math.hypot(ix, iz) > 0.08
    const len = Math.hypot(ix, iz) || 1
    const run = !!(k.ShiftLeft || k.ShiftRight) || inputState.run
    const speed = (run ? RUN : WALK) * Math.max(0.35, analog)
    // camera-relative: rotate input by the camera yaw (yaw 0 looks toward -Z)
    const sin = Math.sin(playerState.yaw)
    const cos = Math.cos(playerState.yaw)
    const tx = hasInput ? ((ix * cos + iz * sin) / len) * speed : 0
    const tz = hasInput ? ((-ix * sin + iz * cos) / len) * speed : 0
    const accel = 1 - Math.exp(-dt * (hasInput ? 9 : 11))
    vel.current.x += (tx - vel.current.x) * accel
    vel.current.y += (tz - vel.current.y) * accel

    const stuck = hitsCollider(p.x, p.z, p.y)
    const nx = p.x + vel.current.x * dt
    if (!blocked(nx, p.z, p.y, stuck)) p.x = nx
    else vel.current.x = 0
    const nz = p.z + vel.current.y * dt
    if (!blocked(p.x, nz, p.y, stuck)) p.z = nz
    else vel.current.y = 0

    // body faces the direction of travel (desired direction, so it turns even against a wall)
    if (hasInput) playerState.facing = Math.atan2(-tx, -tz)

    // vertical: jump, gravity, step-up and landing
    const g = footprintGround(p.x, p.z, p.y)
    const grounded = p.y <= g + 0.02 && vy.current <= 0
    if (inputState.jumpQueued) {
      if (grounded && canMove) vy.current = JUMP_V
      inputState.jumpQueued = false
    }
    if (vy.current > 0 || p.y > g + 0.001) {
      vy.current -= GRAVITY * dt
      p.y += vy.current * dt
      if (p.y <= g) {
        p.y = g
        vy.current = 0
      }
    } else if (g > p.y && g <= p.y + MAX_STEP) {
      p.y = g
      vy.current = 0
    }
    playerState.airborne = p.y > g + 0.05
    playerState.vy = vy.current

    // safety net: never fall out of the world
    if (!Number.isFinite(p.x + p.y + p.z) || p.y < -3) {
      p.copy(lastSafe.current)
      vy.current = 0
    } else if (grounded) {
      safeTimer.current += dt
      if (safeTimer.current > 0.5) {
        lastSafe.current.copy(p)
        safeTimer.current = 0
      }
    }

    playerState.speed = vel.current.length()
    playerState.running = run && hasInput
    playerState.zone = zoneAt(p.x, p.y, p.z)

    // interaction focus: things near the avatar, roughly in the camera's view direction (XZ)
    const fx = -Math.sin(playerState.yaw)
    const fz = -Math.cos(playerState.yaw)
    let best: string | null = null
    let bestScore = -Infinity
    for (const it of INTERACTABLES) {
      const dx = it.position[0] - p.x
      const dy = it.position[1] - (p.y + HEAD)
      const dz = it.position[2] - p.z
      const dist = Math.hypot(dx, dy, dz)
      if (dist > it.range) continue
      const flat = Math.hypot(dx, dz) || 1
      const dot = (dx * fx + dz * fz) / flat
      const minDot = it.minDot ?? (dist < 2.5 ? 0.3 : 0.75)
      if (dot < minDot) continue
      const score = dot - dist * 0.01
      if (score > bestScore) {
        bestScore = score
        best = it.id
      }
    }
    if (best !== st.focusedId) st.setFocused(best)
  })

  return null
}
