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
/** below the orbit floor the camera stays put and the lens tilts up instead (look at the sky) */
const PITCH_MIN = -1.15
const ORBIT_FLOOR = -0.12
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
  /** 1 while the walk-out cinematic plays; drops to 0 quickly once the visitor takes control */
  const cineGain = useRef(1)
  const skipCine = useRef(false)
  const shoulder = useRef(0)

  useEffect(() => {
    camera.rotation.order = 'YXZ'
    const el = gl.domElement
    const onMouseMove = (e: MouseEvent) => {
      if (detectTouch() && !document.pointerLockElement) return
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 4 && (document.pointerLockElement === el || drag.current)) skipCine.current = true
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
        if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 4) skipCine.current = true
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
      skipCine.current = true
      playerState.camDist = THREE.MathUtils.clamp(playerState.camDist * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST)
    }
    const onLockChange = () => {
      useTour.getState().setPointerLocked(document.pointerLockElement === el)
      if (document.pointerLockElement === el) drag.current = null
    }
    const onTeleport = () => {
      snap.current = true
      skipCine.current = true
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') skipCine.current = true
    }
    window.addEventListener('keydown', onKey)
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
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [camera, gl])

  const target = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const aim = new THREE.Vector3()
  const right = new THREE.Vector3()

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
    let yaw = playerState.yaw
    // on the stands look down over the rows instead of skimming through them
    // walk-out cinematic: pull back and rise to reveal the bowl, then settle (bell curve over ~3.3 s)
    if (skipCine.current && revealT.current > 0) cineGain.current = Math.max(0, cineGain.current - dt * 3)
    if (revealT.current > 0 && cineGain.current <= 0) revealT.current = 0
    const cine = revealT.current > 0 ? Math.sin(Math.PI * (1 - revealT.current)) * cineGain.current : 0
    // …and orbit once around the avatar (behind → side → front → behind), rising as it goes
    if (revealT.current > 0) {
      const u = 1 - revealT.current
      const sweep = Math.PI * 2 * (u * u * (3 - 2 * u))
      yaw += Math.atan2(Math.sin(sweep), Math.cos(sweep)) * cineGain.current
    }
    // the orbit itself never dips under the floor (would push the lens into the ground or seats);
    // pulling further "down" tilts the view upward toward the sky
    const floor = playerState.zone === 'stands' ? 0.42 : ORBIT_FLOOR
    const lookUp = Math.max(0, floor - playerState.pitch)
    const pitch = Math.max(playerState.pitch, floor) + cine * 0.32
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))

    const zone = playerState.zone
    const wanted = Math.min(Math.max(playerState.camDist, 3.2) * (revealT.current > 0 ? 1 : 0) + playerState.camDist * (revealT.current > 0 ? 0 : 1) + cine * 5, ZONE_MAX_DIST[zone] ?? MAX_DIST + 6)

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
    // over-the-shoulder offset when the camera is close (tunnel, dressing room…), so the
    // avatar sits left of centre and what lies ahead (e.g. the tunnel mouth) stays visible
    right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    let wantShoulder = 0.55 * THREE.MathUtils.clamp((3.8 - dist.current) / 1.6, 0, 1)
    for (let k = 0; k < 3 && wantShoulder > 0.02; k++) {
      const cx = camera.position.x + right.x * wantShoulder
      const cz = camera.position.z + right.z * wantShoulder
      if (!cameraBlocked(cx, camera.position.y, cz)) break
      wantShoulder *= 0.5
    }
    shoulder.current += (wantShoulder - shoulder.current) * (1 - Math.exp(-dt * 6))
    camera.position.addScaledVector(right, shoulder.current)
    // aim slightly above the pivot (less when very close, so we don't stare at the ceiling)
    aim.copy(pivot.current).addScaledVector(right, shoulder.current)
    aim.y += AIM_UP * THREE.MathUtils.clamp(dist.current / 3, 0.3, 1)
    camera.lookAt(aim)
    if (lookUp > 0) camera.rotateX(lookUp)

    // ---- zone effects (tunnel walk-out reveal) ----
    if (zone !== lastZone.current) {
      if (lastZone.current === 'tunnel' && zone === 'pitch') {
        revealT.current = 1
        cineGain.current = 1
        skipCine.current = false
        audio.cheer()
        st.showBanner('THE THEATRE OF DREAMS', '메인 경기장에 입장했습니다 · 시점을 움직이면 연출이 바로 끝납니다')
      }
      lastZone.current = zone
      st.setZone(zone)
    }
    revealT.current = Math.max(0, revealT.current - dt * 0.22)
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
