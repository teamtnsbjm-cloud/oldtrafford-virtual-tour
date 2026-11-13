import * as THREE from 'three'
import type { ZoneId } from '../world/layout'

/**
 * Mutable, per-frame player state. Deliberately NOT React state so the
 * render loop can update it 60x/second without re-rendering the UI.
 */
export const playerState = {
  /** feet position of the avatar */
  position: new THREE.Vector3(0, 0, 128),
  /** camera orbit yaw (0 = camera looks toward -Z / north) */
  yaw: 0,
  /** camera orbit elevation in radians (positive = camera above, looking down) */
  pitch: 0.28,
  /** desired camera distance (mouse wheel) */
  camDist: typeof window !== 'undefined' && window.innerWidth < 760 ? 6 : 4.4,
  /** actual camera distance after collision */
  camActualDist: 4.4,
  /** direction the avatar body faces (radians, 0 = facing -Z) */
  facing: 0,
  /** horizontal speed m/s */
  speed: 0,
  /** true while Shift is held and the avatar is moving */
  running: false,
  /** feet off the ground (jumping / falling) */
  airborne: false,
  /** in a slide tackle */
  sliding: false,
  vy: 0,
  zone: 'plaza' as ZoneId,
}
