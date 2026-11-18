/*
 * Headless walk test of the main tour route using the same colliders, ground
 * heights and stepping rules as PlayerController. Run with:
 *   node server/routetest.ts
 * Prints each waypoint reached (with zone) or where the walker got stuck.
 */
import { colliderTop, COLLIDERS, groundAt, zoneAt } from '../src/world/layout.ts'

const RADIUS = 0.3
const MAX_STEP = 0.55
const SPEED = 7.2
const GRAVITY = 22

function hitsCollider(x: number, z: number, feet: number) {
  for (const b of COLLIDERS) {
    if (feet + 1.7 < b.minY || feet + MAX_STEP * 0.6 > b.maxY) continue
    const cx = Math.max(b.minX, Math.min(x, b.maxX))
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ))
    if ((x - cx) ** 2 + (z - cz) ** 2 < RADIUS * RADIUS) return true
  }
  return false
}
function footprintGround(x: number, z: number, feet: number) {
  const r = RADIUS * 0.9
  return Math.max(colliderTop(x, z, feet, MAX_STEP), groundAt(x, z, feet), groundAt(x + r, z, feet), groundAt(x - r, z, feet), groundAt(x, z + r, feet), groundAt(x, z - r, feet))
}
function blocked(x: number, z: number, feet: number, stuck: boolean) {
  if (!stuck && hitsCollider(x, z, feet)) return true
  return footprintGround(x, z, feet) > feet + MAX_STEP
}

const route: [string, number, number][] = [
  ['plaza start', 0, 128],
  ['lobby entrance', 0, 90],
  ['lobby', 0, 86.5],
  ['lobby west of desk', -3, 80],
  ['queue lane', -10.5, 75.5],
  ['corridor door', -10.5, 71.5],
  ['corridor', -10.5, 67.5],
  ['locker room', -10.5, 62],
  ['locker → tunnel door', -7, 56],
  ['tunnel bend', 0, 56],
  ['tunnel mouth', 0, 41.2],
  ['pitch', 0, 30],
  ['pitch-side stairs (foot)', -27.45, 38.4],
  ['top of stairs', -27.45, 42.6],
  ['stands (row ~10)', -27.45, 50],
]

let x = route[0][1]
let z = route[0][2]
let y = 0
let vy = 0
const dt = 1 / 60
let ok = true
const zones: string[] = []
for (const [label, tx, tz] of route.slice(1)) {
  let best = Infinity
  let lastImp = 0
  let t = 0
  for (;;) {
    const dx = tx - x
    const dz = tz - z
    const d = Math.hypot(dx, dz)
    if (d < 0.35) break
    if (d < best - 0.01) {
      best = d
      lastImp = t
    }
    if (t - lastImp > 4) {
      console.log(`STUCK before "${label}" at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`)
      ok = false
      break
    }
    const sp = Math.min(SPEED, d / dt)
    const stuck = hitsCollider(x, z, y)
    const nx = x + (dx / d) * sp * dt
    if (!blocked(nx, z, y, stuck)) x = nx
    const nz = z + (dz / d) * sp * dt
    if (!blocked(x, nz, y, stuck)) z = nz
    const g = footprintGround(x, z, y)
    if (vy > 0 || y > g + 0.001) {
      vy -= GRAVITY * dt
      y += vy * dt
      if (y <= g) {
        y = g
        vy = 0
      }
    } else if (g > y && g <= y + MAX_STEP) y = g
    if (y < -1) {
      console.log(`FELL THROUGH near "${label}"`)
      ok = false
      break
    }
    const zn = zoneAt(x, y, z)
    if (zones[zones.length - 1] !== zn) zones.push(zn)
    t += dt
  }
  if (!ok) break
  console.log(`ok  ${label.padEnd(26)} (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})  zone=${zoneAt(x, y, z)}`)
}
console.log('zones visited:', zones.join(' → '))
console.log(ok ? 'ROUTE PASS' : 'ROUTE FAIL')
process.exit(ok ? 0 : 1)
