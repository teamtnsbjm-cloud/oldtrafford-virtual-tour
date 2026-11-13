import * as THREE from 'three'
import { PITCH_LENGTH } from './layout'

/*
 * Footballs on the pitch.
 * Simple, deterministic physics (gravity, bounce, rolling friction, board
 * rebounds, goal nets). Whoever touches a ball sends its new position and
 * velocity to everyone else in the channel; each client then simulates the
 * same motion locally.
 */

export const BALL_R = 0.11
const G = 9.81
const HALF_L = PITCH_LENGTH / 2
const GOAL_HALF_W = 7.32 / 2
const GOAL_H = 2.44
const GOAL_DEPTH = 1.9
// advertising boards roughly enclose this area (see AD_BOARDS in layout.ts)
const BOUND_X = 56.3
const BOUND_Z_N = -38.2
const BOUND_Z_S = 37.2

export interface Ball {
  p: THREE.Vector3
  v: THREE.Vector3
  q: THREE.Quaternion
  home: [number, number]
  /** seconds until the ball can be kicked again by the local player */
  cool: number
  /** >0 while sitting in the net after a goal; counts down to a respawn */
  goalT: number
}

export const BALL_HOMES: [number, number][] = [
  [0, 0], [-41.5, 0], [41.5, 0], [-12, 9], [14, -7], [24, 16],
]

export const balls: Ball[] = BALL_HOMES.map((h) => ({
  p: new THREE.Vector3(h[0], BALL_R, h[1]),
  v: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  home: h,
  cool: 0,
  goalT: 0,
}))

const axis = new THREE.Vector3()
const dq = new THREE.Quaternion()

/** Advances one ball. Returns 'goal' on the frame the ball crosses a goal line. */
export function stepBall(b: Ball, dt: number): 'goal' | null {
  let event: 'goal' | null = null
  b.cool = Math.max(0, b.cool - dt)
  if (b.goalT > 0) {
    b.goalT -= dt
    if (b.goalT <= 0) resetBall(b)
  }

  const wasInside = Math.abs(b.p.x) < HALF_L
  b.v.y -= G * dt
  b.p.addScaledVector(b.v, dt)

  // ground: bounce, then roll with friction
  if (b.p.y <= BALL_R) {
    b.p.y = BALL_R
    if (b.v.y < -0.6) b.v.y = -b.v.y * 0.55
    else b.v.y = 0
    const damp = Math.exp(-dt * 0.55)
    b.v.x *= damp
    b.v.z *= damp
    const sp = Math.hypot(b.v.x, b.v.z)
    if (sp > 0) {
      const ns = Math.max(0, sp - 0.35 * dt)
      b.v.x *= ns / sp
      b.v.z *= ns / sp
    }
  } else {
    b.v.multiplyScalar(Math.exp(-dt * 0.05))
  }

  // goal: crossed the line between the posts, under the bar
  const inMouth = Math.abs(b.p.z) < GOAL_HALF_W - BALL_R && b.p.y < GOAL_H
  if (wasInside && Math.abs(b.p.x) >= HALF_L && inMouth && b.goalT <= 0) {
    event = 'goal'
    b.goalT = 3
  }
  // inside a goal: the net catches it
  if (Math.abs(b.p.x) > HALF_L && Math.abs(b.p.z) < GOAL_HALF_W + 0.3 && b.p.y < GOAL_H) {
    const back = HALF_L + GOAL_DEPTH - BALL_R
    if (Math.abs(b.p.x) > back) {
      b.p.x = Math.sign(b.p.x) * back
      b.v.x *= -0.15
      b.v.z *= 0.4
    }
    if (Math.abs(b.p.z) > GOAL_HALF_W - BALL_R) {
      b.p.z = Math.sign(b.p.z) * (GOAL_HALF_W - BALL_R)
      b.v.z *= -0.2
    }
  } else {
    // rebound off the advertising boards
    if (Math.abs(b.p.x) > BOUND_X) {
      b.p.x = Math.sign(b.p.x) * BOUND_X
      b.v.x *= -0.55
    }
    if (b.p.z < BOUND_Z_N) {
      b.p.z = BOUND_Z_N
      b.v.z *= -0.55
    } else if (b.p.z > BOUND_Z_S) {
      b.p.z = BOUND_Z_S
      b.v.z *= -0.55
    }
  }

  // rolling rotation
  const sp = Math.hypot(b.v.x, b.v.z)
  if (sp > 0.01) {
    axis.set(b.v.z, 0, -b.v.x).normalize()
    dq.setFromAxisAngle(axis, (sp * dt) / BALL_R)
    b.q.premultiply(dq)
  }
  return event
}

export function resetBall(b: Ball) {
  b.p.set(b.home[0], BALL_R + 0.4, b.home[1])
  b.v.set(0, 0, 0)
  b.goalT = 0
}

/** Apply a state received from the network, fast-forwarding by `ageSec`. */
export function applyBallState(i: number, p: number[], v: number[], ageSec = 0) {
  const b = balls[i]
  if (!b) return
  b.p.set(p[0], p[1], p[2])
  b.v.set(v[0], v[1], v[2])
  b.goalT = 0
  const steps = Math.min(Math.round(Math.max(0, ageSec) * 60), 60 * 20)
  for (let k = 0; k < steps; k++) stepBall(b, 1 / 60)
}
