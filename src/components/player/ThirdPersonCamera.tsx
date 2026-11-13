import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bowlDistance, COLLIDERS, groundAt, OUTER_D, ROOMS, type ZoneId } from '../../world/layout'
import { playerState } from '../../state/playerState'
import { useTour } from '../../state/tourStore'
import { audio } from '../../audio/audioEngine'
import { detectTouch } from '../ui/useIsTouch'

const LOOK_SENS = 0.0024
const DRAG_SENS = 0.006
const MIN_DIST = 1.4
const MAX_DIST = 9
const PITCH_MIN = -0.2
const PITCH_MAX = 1.15
/** orbit pivot above the feet (upper chest) */
const PIVOT_H = 1.5
/** aim point is above the pivot so the avatar sits a little below screen centre */
const AIM_UP = 0.42
const CAM_RADIUS = 0.22

/** Indoor spaces pull the camera in automatically. */
const ZONE_MAX_DIST: Partial<Record<ZoneId, number>> = {
  tunnel: 2.6,
  locker: 3.3,
  lobby: 5,
  store: 4.2,
}

/** Is a camera sphere at (x,y,z) inside solid world geometry? */
function cameraBlocked(x: number, y: number, z: number) {
  for (const r of Object.values(ROOMS)) {
    if (x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ) {
      if (y > r.height - CAM_RADIUS || y < CAM_RADIUS) return true
      return hitsBox(x, y, z)
    }
  }
  // on the terraces keep the lens above the seat backs
  const d = bowlDistance(x, z)
  const clearance = d > 0.3 && d < OUTER_D ? 1.05 : CAM_RADIUS
  if (y < groundAt(x, z, y) + clearance) return true
  // red tunnel canopy (half-cylinder r≈2.1 along Z just outside the tunnel mouth)
  if (z > 37.8 && z < 41.8 && Math.abs(Math.hypot(x, y) - 2.12) < 0.3) return true
  return hitsBox(x, y, z)
}

function hitsBox(x: number, y: number, z: number) {
  const R = CAM_RADIUS
  for (const b of COLLIDERS) {
    if (x > b.minX - R && x < b.maxX + R && z > b.minZ - R && z < b.maxZ + R && y > b.minY - R && y < b.maxY + R) return true
  }
  return false
}

/**
 * Orbit follow camera: mouse (pointer-lock or drag) orbits around the avatar,
 * wheel zooms, a short ray-march keeps the lens out of walls/terraces, and
 * interiors cap the distance. Also runs the tunnel → pitch reveal effect.
 */
export function ThirdPersonCamera() {
  const { camera, gl } = useThree()
  const persp = camera as THREE.PerspectiveCamera
  const pivot = useRef(new THREE.Vector3().copy(playerState.position).setY(playerState.position.y + PIVOT_H))
  const dist = useRef(playerState.camDist)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const lastZone = useRef<ZoneId>('plaza')
  const revealT = useRef(0)
  const exposure = useRef(1)
  const snap = useRef(true)

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    const el = gl.domElement
    const onMouseMove = (e: MouseEvent) => {
      if (detectTouch() && !document.pointerLockElement) return
      if (document.pointerLockElement === el) {
        playerState.yaw -= e.movementX * LOOK_SENS
        playerState.pitch += e.movementY * LOOK_SENS
      } else if (drag.current) {
        playerState.yaw -= (e.clientX - drag.current.x) * DRAG_SENS
        playerState.pitch += (e.clientY - drag.current.y) * DRAG_SENS
        drag.current = { x: e.clientX, y: e.clientY }
      }
      playerState.pitch = THREE.MathUtils.clamp(playerState.pitch, PITCH_MIN, PITCH_MAX)
    }
    // ---- touch: one finger orbits, two fingers pinch-zoom (Pointer Events) ----
    const touch = detectTouch()
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const onPointerDown = (e: PointerEvent) => {
      if (!touch || !useTour.getState().started) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try {
        el.setPointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!touch || !prev) return
      const cur = { x: e.clientX, y: e.clientY }
      pointers.set(e.pointerId, cur)
      if (pointers.size === 1) {
        playerState.yaw -= (cur.x - prev.x) * DRAG_SENS
        playerState.pitch = THREE.MathUtils.clamp(playerState.pitch + (cur.y - prev.y) * DRAG_SENS, PITCH_MIN, PITCH_MAX)
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0) playerState.camDist = THREE.MathUtils.clamp(playerState.camDist * (pinch / d), MIN_DIST, MAX_DIST)
        pinch = d
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    const onMouseDown = (e: MouseEvent) => {
      const st = useTour.getState()
      if (touch || !st.started || st.infoId || st.customizing) return
      if (document.pointerLockElement !== el) {
        drag.current = { x: e.clientX, y: e.clientY }
        const p = el.requestPointerLock?.() as unknown as Promise<void> | undefined
        p?.catch?.(() => {})
      }
    }
    const onMouseUp = () => {
      drag.current = null
    }
    const onWheel = (e: WheelEvent) => {
      if (!useTour.getState().started) return
      e.preventDefault()
      playerState.camDist = THREE.MathUtils.clamp(playerState.camDist * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST)
    }
    const onLockChange = () => {
      useTour.getState().setPointerLocked(document.pointerLockElement === el)
      if (document.pointerLockElement === el) drag.current = null
    }
    const onTeleport = () => {
      snap.current = true
    }
    window.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('pointerlockchange', onLockChange)
    window.addEventListener('tod:teleport', onTeleport)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('wheel', onWheel)
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('tod:teleport', onTeleport)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [camera, gl])

  const target = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const aim = new THREE.Vector3()

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = playerState.position
    const st = useTour.getState()

    // pivot follows the avatar smoothly (absorbs stair steps)
    target.set(p.x, p.y + PIVOT_H, p.z)
    if (snap.current) {
      pivot.current.copy(target)
    } else {
      const k = 1 - Math.exp(-dt * 14)
      pivot.current.x += (target.x - pivot.current.x) * Math.max(k, 0.6)
      pivot.current.z += (target.z - pivot.current.z) * Math.max(k, 0.6)
      pivot.current.y += (target.y - pivot.current.y) * k
    }

    // desired orbit direction (from pivot toward camera)
    const yaw = playerState.yaw
    // on the stands look down over the rows instead of skimming through them
    // walk-out cinematic: pull back and rise to reveal the bowl, then settle (bell curve over ~3.3 s)
    const cine = revealT.current > 0 ? Math.sin(Math.PI * (1 - revealT.current)) : 0
    const pitch = (playerState.zone === 'stands' ? Math.max(playerState.pitch, 0.42) : playerState.pitch) + cine * 0.2
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))

    const zone = playerState.zone
    const wanted = Math.min(playerState.camDist + cine * 6, ZONE_MAX_DIST[zone] ?? MAX_DIST + 6)

    // ray-march from the pivot outward; stop before the first solid sample
    let allowed = wanted
    const step = 0.08
    for (let s = 0.25; s <= wanted; s += step) {
      if (cameraBlocked(pivot.current.x + dir.x * s, pivot.current.y + dir.y * s, pivot.current.z + dir.z * s)) {
        allowed = Math.max(0.3, s - step)
        break
      }
    }
    // pull in fast, ease back out slowly
    if (snap.current) dist.current = allowed
    else if (allowed < dist.current) dist.current += (allowed - dist.current) * (1 - Math.exp(-dt * 30))
    else dist.current += (allowed - dist.current) * (1 - Math.exp(-dt * 3.5))
    playerState.camActualDist = dist.current
    snap.current = false

    camera.position.copy(pivot.current).addScaledVector(dir, dist.current)
    // aim slightly above the pivot (less when very close, so we don't stare at the ceiling)
    aim.copy(pivot.current)
    aim.y += AIM_UP * THREE.MathUtils.clamp(dist.current / 3, 0.3, 1)
    camera.lookAt(aim)

    // ---- zone effects (tunnel walk-out reveal) ----
    if (zone !== lastZone.current) {
      if (lastZone.current === 'tunnel' && zone === 'pitch') {
        revealT.current = 1
        audio.cheer()
        st.showBanner('THE THEATRE OF DREAMS', '메인 경기장에 입장했습니다')
      }
      lastZone.current = zone
      st.setZone(zone)
    }
    revealT.current = Math.max(0, revealT.current - dt * 0.3)
    let targetFov = 60
    let targetExp = 1
    if (zone === 'tunnel') {
      const prog = THREE.MathUtils.clamp((58 - p.z) / 16, 0, 1)
      targetFov = 56 + prog * 4
      targetExp = 0.85 + prog * 0.3
    }
    targetFov += cine * 10
    targetExp += revealT.current * revealT.current * 0.6
    persp.fov += (targetFov - persp.fov) * (1 - Math.exp(-dt * 3))
    persp.updateProjectionMatrix()
    exposure.current += (targetExp - exposure.current) * (1 - Math.exp(-dt * 4))
    gl.toneMappingExposure = exposure.current
  })

  return null
}
