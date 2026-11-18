/**
 * World layout — the single source of truth for where everything is.
 *
 * Units are metres. +Y is up. The pitch is centred on the origin with its long
 * axis on X. "South" = +Z (the side with the tunnel, lobby and outer plaza),
 * "North" = -Z (the opposite main stand).
 *
 * Geometry components AND the physics (ground height + colliders) both read
 * from this file, so walls you see are walls you bump into.
 *
 * NOTE: This is a fan-made approximation. Dimensions are chosen to *feel*
 * like a large English stadium; they are not surveyed measurements.
 */

// ---------------------------------------------------------------- pitch ----
export const PITCH_LENGTH = 105 // FIFA-recommended size, used as reference
export const PITCH_WIDTH = 68

// ------------------------------------------------------------ the bowl -----
/** Inner edge of the stands: a rounded rectangle (half extents + corner radius). */
export const BOWL = { a: 60, b: 42, r: 14 }

export const LOWER_TIER = { start: 0.5, rows: 28, depth: 0.8, rise: 0.45, base: 3.2 }
export const LOWER_END = LOWER_TIER.start + LOWER_TIER.rows * LOWER_TIER.depth // 22.9
export const LOWER_TOP = LOWER_TIER.base + (LOWER_TIER.rows - 1) * LOWER_TIER.rise

export const UPPER_TIER = { start: 25, rows: 22, depth: 0.85, rise: 0.6, base: 19.5 }
export const UPPER_END = UPPER_TIER.start + UPPER_TIER.rows * UPPER_TIER.depth // 43.7
export const UPPER_TOP = UPPER_TIER.base + (UPPER_TIER.rows - 1) * UPPER_TIER.rise

/** Offset of the outer facade from the inner bowl edge. */
export const OUTER_D = 47
export const BOWL_TOP = 40
export const ROOF = { inner: 6, outer: 48.5, yInner: 41, yOuter: 43 }

/** Signed distance from the inner edge of the stands (negative = pitch side). */
export function bowlDistance(x: number, z: number): number {
  const qx = Math.abs(x) - (BOWL.a - BOWL.r)
  const qz = Math.abs(z) - (BOWL.b - BOWL.r)
  const ox = Math.max(qx, 0)
  const oz = Math.max(qz, 0)
  return Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0) - BOWL.r
}

const WALL = 999

/** Height of the walkable stand surface at a given bowl distance. */
export function bowlHeight(d: number): number {
  if (d < 0) return 0
  if (d < LOWER_END) {
    const i = Math.max(0, Math.floor((d - LOWER_TIER.start) / LOWER_TIER.depth))
    return LOWER_TIER.base + Math.min(i, LOWER_TIER.rows - 1) * LOWER_TIER.rise
  }
  if (d < UPPER_TIER.start) return LOWER_TOP // concourse walkway behind the lower tier
  if (d < UPPER_END) {
    const i = Math.max(0, Math.floor((d - UPPER_TIER.start) / UPPER_TIER.depth))
    return UPPER_TIER.base + Math.min(i, UPPER_TIER.rows - 1) * UPPER_TIER.rise
  }
  if (d < OUTER_D) return WALL
  return 0
}

// ------------------------------------------------------------- rooms -------
export type Side = 'minX' | 'maxX' | 'minZ' | 'maxZ'
export interface Opening {
  side: Side
  center: number
  width: number
  height: number
}
export interface Room {
  id: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  height: number
  openings: Opening[]
  /** Sides that have no wall at all (corridor ends). */
  openSides?: Side[]
}

export const WALL_T = 0.3

export const ROOMS: Record<string, Room> = {
  lobby: {
    id: 'lobby',
    minX: -15, maxX: 15, minZ: 71, maxZ: 89, height: 7,
    openings: [
      { side: 'maxZ', center: 0, width: 6, height: 4 },
      { side: 'minZ', center: -10.5, width: 3, height: 3 },
    ],
  },
  corridor: {
    id: 'corridor',
    minX: -12, maxX: -9, minZ: 66, maxZ: 71, height: 3,
    openings: [],
    openSides: ['minZ', 'maxZ'],
  },
  locker: {
    id: 'locker',
    minX: -26, maxX: -6, minZ: 50, maxZ: 66, height: 4.2,
    openings: [
      { side: 'maxZ', center: -10.5, width: 3, height: 3 },
      { side: 'maxX', center: 56, width: 4, height: 3 },
    ],
  },
  tunnelA: {
    id: 'tunnelA',
    minX: -6, maxX: -2, minZ: 54, maxZ: 58, height: 3,
    openings: [],
    openSides: ['minX', 'maxX'],
  },
  tunnelB: {
    id: 'tunnelB',
    minX: -2, maxX: 2, minZ: 41.6, maxZ: 58, height: 3,
    openings: [{ side: 'minX', center: 56, width: 4, height: 3 }],
    openSides: ['minZ'],
  },
  store: {
    id: 'store',
    minX: 52, maxX: 88, minZ: 105, maxZ: 130, height: 6,
    openings: [{ side: 'minX', center: 117.5, width: 5, height: 3.5 }],
  },
}

export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY: number
  maxY: number
}

export interface WallSegment {
  box: Box
  /** true for the solid part above a door opening (rendered, not collided) */
  lintel?: boolean
}

/** Splits each side of a room into wall boxes, leaving gaps for openings. */
export function roomWalls(room: Room): WallSegment[] {
  const out: WallSegment[] = []
  const sides: Side[] = ['minX', 'maxX', 'minZ', 'maxZ']
  for (const side of sides) {
    if (room.openSides?.includes(side)) continue
    const alongX = side === 'minZ' || side === 'maxZ'
    const start = alongX ? room.minX - WALL_T / 2 : room.minZ - WALL_T / 2
    const end = alongX ? room.maxX + WALL_T / 2 : room.maxZ + WALL_T / 2
    const fixed = room[side]
    const gaps = room.openings
      .filter((o) => o.side === side)
      .map((o) => ({ a: o.center - o.width / 2, b: o.center + o.width / 2, h: o.height }))
      .sort((p, q) => p.a - q.a)
    let cursor = start
    const make = (a: number, b: number, y0: number, y1: number, lintel = false) => {
      if (b - a < 0.01) return
      const box: Box = alongX
        ? { minX: a, maxX: b, minZ: fixed - WALL_T / 2, maxZ: fixed + WALL_T / 2, minY: y0, maxY: y1 }
        : { minX: fixed - WALL_T / 2, maxX: fixed + WALL_T / 2, minZ: a, maxZ: b, minY: y0, maxY: y1 }
      out.push({ box, lintel })
    }
    for (const g of gaps) {
      make(cursor, g.a, 0, room.height)
      make(g.a, g.b, g.h, room.height, true)
      cursor = g.b
    }
    make(cursor, end, 0, room.height)
  }
  return out
}

// -------------------------------------------------------- prop layouts -----
const box = (cx: number, cz: number, w: number, d: number, h: number, y0 = 0): Box => ({
  minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: y0, maxY: y0 + h,
})

export interface LockerSlot {
  x: number
  z: number
  rotY: number
  number: number
  name: string
}

/** Locker positions: three runs of lockers in a U shape. */
export const LOCKERS: LockerSlot[] = (() => {
  const out: LockerSlot[] = []
  const r = ROOMS.locker
  let n = 1
  // north wall (minZ), facing +Z
  const north = 16
  const nw = (r.maxX - r.minX - 1.0) / north
  for (let i = 0; i < north; i++) out.push({ x: r.minX + 0.75 + nw * (i + 0.5), z: r.minZ + 0.38, rotY: 0, number: n++, name: '' })
  // west wall (minX), facing +X
  const west = 12
  const ww = (r.maxZ - r.minZ - 1.4) / west
  for (let i = 0; i < west; i++) out.push({ x: r.minX + 0.38, z: r.minZ + 1.0 + ww * (i + 0.5), rotY: Math.PI / 2, number: n++, name: '' })
  // south wall (maxZ), facing -Z, stops before the corridor door
  const south = 9
  const sw = (-12.4 - (r.minX + 0.9)) / south
  for (let i = 0; i < south; i++) out.push({ x: r.minX + 0.9 + sw * (i + 0.5), z: r.maxZ - 0.38, rotY: Math.PI, number: n++, name: '' })
  // A visitor locker: the tour guest's own spot.
  out[7].name = 'YOU'
  out[7].number = 26
  return out
})()

export const LOCKER_BENCHES: Box[] = [
  box((ROOMS.locker.minX + ROOMS.locker.maxX) / 2 + 0.25, ROOMS.locker.minZ + 1.1, 18.5, 0.5, 0.45),
  box(ROOMS.locker.minX + 1.1, (ROOMS.locker.minZ + ROOMS.locker.maxZ) / 2, 0.5, 14, 0.45),
  box(-19.4, ROOMS.locker.maxZ - 1.1, 12.2, 0.5, 0.45),
]
export const LOCKER_UNITS: Box[] = [
  box((ROOMS.locker.minX + ROOMS.locker.maxX) / 2, ROOMS.locker.minZ + 0.38, 20, 0.75, 2.6),
  box(ROOMS.locker.minX + 0.38, (ROOMS.locker.minZ + ROOMS.locker.maxZ) / 2, 0.75, 16, 2.6),
  box(-19.2, ROOMS.locker.maxZ - 0.38, 13.6, 0.75, 2.6),
]
export const TACTICS_BOARD = { x: -6.2, z: 62.2, rotY: -Math.PI / 2 }

export const LOBBY_DESK = box(8, 77, 6, 1.2, 1.1)
export const LOBBY_PILLARS: Box[] = [box(-8, 80, 0.9, 0.9, 7), box(8, 82, 0.9, 0.9, 7), box(-8, 85.5, 0.9, 0.9, 7), box(8, 86.5, 0.9, 0.9, 7)]

export const DUGOUTS: Box[] = [box(-10, 40.3, 8, 2.4, 2.4), box(10, 40.3, 8, 2.4, 2.4)]

/** Advertising boards around the pitch (with walking gaps). */
export const AD_BOARDS: Box[] = (() => {
  const out: Box[] = []
  const h = 0.9
  // north side
  for (const [a, b] of [[-46, -22], [-19, -1], [1, 22], [24, 26], [29, 46]]) out.push({ minX: a, maxX: b, minZ: -38.6, maxZ: -38.4, minY: 0, maxY: h })
  // south side (gap for tunnel at x∈[-3,3] and between dugouts)
  for (const [a, b] of [[-46, -29], [-26, -15], [-5, -3], [3, 5], [15, 31], [34, 46]]) out.push({ minX: a, maxX: b, minZ: 37.4, maxZ: 37.6, minY: 0, maxY: h })
  // ends (behind the goals)
  for (const sx of [-1, 1]) {
    for (const [a, b] of [[-28, -16], [-13, -6], [6, 13], [16, 28]]) out.push({ minX: sx * 56.6 - 0.1, maxX: sx * 56.6 + 0.1, minZ: a, maxZ: b, minY: 0, maxY: h })
  }
  return out
})()

const GOAL_W = 7.32
const GOAL_D = 2.0
export const GOAL_COLLIDERS: Box[] = [-1, 1].flatMap((s) => {
  const x = s * PITCH_LENGTH / 2
  return [
    box(x + s * GOAL_D / 2, -GOAL_W / 2, GOAL_D, 0.2, 2.44),
    box(x + s * GOAL_D / 2, GOAL_W / 2, GOAL_D, 0.2, 2.44),
    box(x + s * GOAL_D, 0, 0.2, GOAL_W, 2.44),
  ]
})

// Plaza props
export const PLAZA_BENCHES: { x: number; z: number; rotY: number }[] = [
  { x: -20, z: 112, rotY: 0 }, { x: -12, z: 112, rotY: 0 }, { x: 12, z: 112, rotY: 0 }, { x: 20, z: 112, rotY: 0 },
  { x: -34, z: 128, rotY: Math.PI / 2 }, { x: -34, z: 136, rotY: Math.PI / 2 },
  { x: 34, z: 140, rotY: -Math.PI / 2 }, { x: 44, z: 100, rotY: Math.PI },
]
export const PLAZA_BENCH_COLLIDERS: Box[] = PLAZA_BENCHES.map((b) =>
  Math.abs(Math.sin(b.rotY)) > 0.5 ? box(b.x, b.z, 0.6, 2, 0.5) : box(b.x, b.z, 2, 0.6, 0.5),
)
export const SCULPTURE = { x: -26, z: 104 }
export const PLAZA_SIGNS = [
  { x: -9, z: 99, rotY: 0, kind: 'tour' as const },
  { x: 46, z: 109, rotY: -Math.PI / 2, kind: 'store' as const },
]
export const PLAZA_FENCES: Box[] = [
  { minX: -100, maxX: -40, minZ: 151.8, maxZ: 152.2, minY: 0, maxY: 1.1 },
  { minX: -30, maxX: 30, minZ: 151.8, maxZ: 152.2, minY: 0, maxY: 1.1 },
  { minX: 40, maxX: 100, minZ: 151.8, maxZ: 152.2, minY: 0, maxY: 1.1 },
]

// Megastore fittings
const S = ROOMS.store
export const STORE_WALL_SHELVES: Box[] = [
  box((S.minX + S.maxX) / 2 + 2, S.minZ + 0.5, 28, 0.8, 2.4),
  box((S.minX + S.maxX) / 2 + 2, S.maxZ - 0.5, 28, 0.8, 2.4),
]
export const STORE_SCARF_WALL = box(S.maxX - 0.4, (S.minZ + S.maxZ) / 2, 0.6, 16, 2.6)
export const STORE_TABLES: Box[] = [box(63, 113, 4, 2, 0.9), box(63, 122, 4, 2, 0.9), box(73, 113, 4, 2, 0.9), box(73, 122, 4, 2, 0.9)]
export const STORE_MANNEQUINS: { x: number; z: number; rotY: number }[] = [
  { x: 68, z: 117.5, rotY: -Math.PI / 2 }, { x: 78, z: 115, rotY: -Math.PI / 2 }, { x: 78, z: 120, rotY: -Math.PI / 2 },
]
export const STORE_BALL_DISPLAY = { x: 82, z: 108.6 }
export const STORE_COUNTER = box(56, 127.2, 5, 1.1, 1.1)

// Phase 3 interior props (rendered in InteriorProps.tsx)
export const PROP_COLLIDERS_INFO = {
  storeBins: [[68, 108.4], [68, 126.6]] as [number, number][],
  capRack: [60, 108.6] as [number, number],
  gondola: [83, 126] as [number, number],
}
export const PROP_COLLIDERS: Box[] = [
  // lobby: queue posts, display case, plants, benches
  ...[[-12.7, 71.6], [-12.7, 73.4], [-12.7, 75.2], [-8.3, 71.6], [-8.3, 73.4], [-8.3, 75.2]].map(([x, z]) => box(x, z, 0.3, 0.3, 1)),
  box(1.5, 74, 1.6, 0.9, 1.8),
  ...[[-14, 88], [14, 88], [14, 72], [-14.1, 77.5]].map(([x, z]) => box(x, z, 0.7, 0.7, 1.4)),
  box(13.9, 80.5, 0.6, 2.2, 0.46),
  box(13.9, 84, 0.6, 2.2, 0.46),
  // store
  ...PROP_COLLIDERS_INFO.storeBins.map(([x, z]) => box(x, z, 1.1, 1.1, 0.85)),
  box(PROP_COLLIDERS_INFO.capRack[0], PROP_COLLIDERS_INFO.capRack[1], 0.8, 0.8, 1.9),
  box(PROP_COLLIDERS_INFO.gondola[0], PROP_COLLIDERS_INFO.gondola[1], 3, 0.9, 1.4),
  box(52.9, 110.5, 0.7, 0.7, 1.4),
  box(52.9, 124.5, 0.7, 0.7, 1.4),
]

// ------------------------------------------------------------ physics ------
export const COLLIDERS: Box[] = [
  ...Object.values(ROOMS).flatMap((r) => roomWalls(r).filter((w) => !w.lintel).map((w) => w.box)),
  ...LOCKER_UNITS,
  ...LOCKER_BENCHES,
  { minX: TACTICS_BOARD.x - 0.25, maxX: TACTICS_BOARD.x + 0.05, minZ: TACTICS_BOARD.z - 1.6, maxZ: TACTICS_BOARD.z + 1.6, minY: 0, maxY: 2 },
  LOBBY_DESK,
  ...LOBBY_PILLARS,
  ...DUGOUTS,
  ...AD_BOARDS,
  ...GOAL_COLLIDERS,
  ...PLAZA_BENCH_COLLIDERS,
  box(SCULPTURE.x, SCULPTURE.z, 3.2, 3.2, 1.5),
  ...PLAZA_SIGNS.map((s) => box(s.x, s.z, 3.2, 3.2, 3)),
  ...PLAZA_FENCES,
  ...STORE_WALL_SHELVES,
  STORE_SCARF_WALL,
  ...STORE_TABLES,
  ...STORE_MANNEQUINS.map((m) => box(m.x, m.z, 0.8, 0.8, 2)),
  box(STORE_BALL_DISPLAY.x, STORE_BALL_DISPLAY.z, 2.2, 2.2, 1.2),
  STORE_COUNTER,
  ...PROP_COLLIDERS,
]

export const WORLD_BOUNDS = { minX: -145, maxX: 145, minZ: -150, maxZ: 158 }

/**
 * Pitch-side staircases up the 3.2 m front wall into the lower tier.
 * Each one sits on the pitch side of an aisle so you can climb straight on.
 */
export const STAIR_STEPS = 8
export const STAIR_W = 1.3
export const PITCH_STAIRS: { side: 'N' | 'S' | 'E' | 'W'; along: number }[] = [
  { side: 'N', along: -20.55 }, { side: 'N', along: 27.45 },
  { side: 'S', along: -27.45 }, { side: 'S', along: 32.55 },
  { side: 'E', along: -14.55 }, { side: 'W', along: 14.55 },
]
/** Returns stair height at (x,z) or -1 when not on a staircase. */
export function stairHeight(x: number, z: number): number {
  const run = LOWER_TIER.base // 3.2 m long, 0.4 m per step
  for (const st of PITCH_STAIRS) {
    let across: number, out: number
    if (st.side === 'N' || st.side === 'S') {
      across = x - st.along
      out = st.side === 'S' ? z - (BOWL.b - run) : -(z + (BOWL.b - run))
    } else {
      across = z - st.along
      out = st.side === 'E' ? x - (BOWL.a - run) : -(x + (BOWL.a - run))
    }
    if (Math.abs(across) <= STAIR_W / 2 && out >= 0 && out <= run + 0.05) {
      return Math.min(STAIR_STEPS, Math.floor((out / run) * STAIR_STEPS) + 1) * (LOWER_TIER.base / STAIR_STEPS)
    }
  }
  return -1
}

/** Walkable ground height under (x, z) for a body whose feet are at `feetY`. */
export function groundAt(x: number, z: number, feetY: number): number {
  for (const r of Object.values(ROOMS)) {
    if (x > r.minX - 0.45 && x < r.maxX + 0.45 && z > r.minZ - 0.45 && z < r.maxZ + 0.45 && feetY < r.height - 0.5) {
      return 0
    }
  }
  if (x < WORLD_BOUNDS.minX || x > WORLD_BOUNDS.maxX || z < WORLD_BOUNDS.minZ || z > WORLD_BOUNDS.maxZ) return WALL
  const st = stairHeight(x, z)
  if (st >= 0) return st
  return bowlHeight(bowlDistance(x, z))
}

// --------------------------------------------------------------- zones -----
export type ZoneId = 'plaza' | 'lobby' | 'locker' | 'tunnel' | 'pitch' | 'stands' | 'store'

export const ZONE_LABELS: Record<ZoneId, string> = {
  plaza: '경기장 외부 광장',
  lobby: '내부 로비',
  locker: '선수 라커룸',
  tunnel: '선수 입장 터널',
  pitch: '메인 경기장 · 피치',
  stands: '메인 경기장 · 관중석',
  store: '메가스토어',
}

const inside = (r: Room, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ

export function zoneAt(x: number, y: number, z: number): ZoneId {
  if (y < 4) {
    if (inside(ROOMS.lobby, x, z)) return 'lobby'
    if (inside(ROOMS.corridor, x, z)) return 'locker'
    if (inside(ROOMS.locker, x, z)) return 'locker'
    if (inside(ROOMS.tunnelA, x, z) || inside(ROOMS.tunnelB, x, z)) return 'tunnel'
  }
  if (inside(ROOMS.store, x, z)) return 'store'
  const d = bowlDistance(x, z)
  if (d < 0) return 'pitch'
  if (d < OUTER_D) return 'stands'
  return 'plaza'
}

// ------------------------------------------------------- spawn points -----
export interface SpawnPoint {
  id: string
  label: string
  zone: ZoneId
  position: [number, number, number]
  /** yaw 0 looks toward -Z (north). */
  yaw: number
  hotkey: string
}

const lowerRowD = (i: number) => LOWER_TIER.start + i * LOWER_TIER.depth + LOWER_TIER.depth * 0.5
export const SPAWNS: SpawnPoint[] = [
  { id: 'plaza', label: '외부 광장', zone: 'plaza', position: [0, 0, 128], yaw: 0, hotkey: '1' },
  { id: 'lobby', label: '로비', zone: 'lobby', position: [0, 0, 86.5], yaw: 0, hotkey: '2' },
  { id: 'locker', label: '라커룸', zone: 'locker', position: [-16, 0, 62.5], yaw: 0, hotkey: '3' },
  { id: 'tunnel', label: '선수 터널', zone: 'tunnel', position: [-4.5, 0, 56], yaw: -Math.PI / 2, hotkey: '4' },
  { id: 'pitch', label: '경기장', zone: 'pitch', position: [0, 0, 30], yaw: 0, hotkey: '5' },
  {
    id: 'stands', label: '관중석', zone: 'stands',
    position: [0, LOWER_TIER.base + 12 * LOWER_TIER.rise, -(BOWL.b + lowerRowD(12))], yaw: Math.PI, hotkey: '6',
  },
  { id: 'store', label: '메가스토어', zone: 'store', position: [55, 0, 117.5], yaw: -Math.PI / 2, hotkey: '7' },
]

// --------------------------------------------------------- scoreboards -----
/** Two big screens hung from the roof edge in the north corners. */
export const SCOREBOARDS = [1, -1].map((sx) => {
  const A = BOWL.a - BOWL.r
  const B = BOWL.b - BOWL.r
  const n = [sx * Math.SQRT1_2, -Math.SQRT1_2]
  const D = BOWL.r + 7
  return {
    position: [sx * A + n[0] * D, 36, -B + n[1] * D] as [number, number, number],
    rotY: Math.atan2(-n[0], -n[1]),
  }
})

// ------------------------------------------------- phase 2b additions -----
/** Corner stair/lift cores outside the bowl (fan approximation). */
export const CORNER_TOWERS = [1, -1].flatMap((sx) =>
  [1, -1].map((sz) => {
    const A = BOWL.a - BOWL.r
    const B = BOWL.b - BOWL.r
    const D = BOWL.r + OUTER_D + 4.2
    return { x: sx * (A + Math.SQRT1_2 * D), z: sz * (B + Math.SQRT1_2 * D), r: 5 }
  }),
)

/** Raised planters with hedges on the south plaza. */
export const PLANTERS: Box[] = [
  box(-14, 104, 7, 2.2, 0.6), box(14, 104, 7, 2.2, 0.6),
  box(-14, 124, 7, 2.2, 0.6), box(14, 124, 7, 2.2, 0.6),
  box(-40, 118, 2.2, 14, 0.6), box(40, 132, 2.2, 10, 0.6),
]
export const FLAGPOLES: [number, number][] = [[-8, 145], [-4, 145], [0, 145], [4, 145], [8, 145]]

/**
 * Vomitories (stand access tunnels) on the straight sides of the lower tier.
 * `along` is the position along the side (x on N/S, z on E/W).
 */
export const VOM_ROWS = { first: 12, count: 4 }
export const VOMITORIES: { side: 'N' | 'S' | 'E' | 'W'; along: number }[] = [
  ...[-33, -11, 11, 33].map((x) => ({ side: 'N' as const, along: x })),
  ...[-33, -15, 15, 33].map((x) => ({ side: 'S' as const, along: x })),
  ...[-12, 12].flatMap((z) => [{ side: 'E' as const, along: z }, { side: 'W' as const, along: z }]),
]
export const VOM_WIDTH = 2.4

/** Axis-aligned box occupied by a vomitory block (top is walkable). */
export function vomitoryBox(v: { side: 'N' | 'S' | 'E' | 'W'; along: number }): Box {
  const d0 = LOWER_TIER.start + VOM_ROWS.first * LOWER_TIER.depth
  const d1 = d0 + VOM_ROWS.count * LOWER_TIER.depth
  const top = LOWER_TIER.base + (VOM_ROWS.first + VOM_ROWS.count - 1) * LOWER_TIER.rise + 0.02
  const w = VOM_WIDTH / 2
  if (v.side === 'N' || v.side === 'S') {
    const s = v.side === 'S' ? 1 : -1
    const za = s * (BOWL.b + d0)
    const zb = s * (BOWL.b + d1)
    return { minX: v.along - w, maxX: v.along + w, minZ: Math.min(za, zb), maxZ: Math.max(za, zb), minY: 0, maxY: top }
  }
  const s = v.side === 'E' ? 1 : -1
  const xa = s * (BOWL.a + d0)
  const xb = s * (BOWL.a + d1)
  return { minX: Math.min(xa, xb), maxX: Math.max(xa, xb), minZ: v.along - w, maxZ: v.along + w, minY: 0, maxY: top }
}

export const PHYSIO_TABLE = box(-9.6, 61.6, 0.8, 2.0, 0.85)

COLLIDERS.push(
  ...CORNER_TOWERS.map((t) => box(t.x, t.z, t.r * 1.8, t.r * 1.8, 40)),
  ...PLANTERS,
  ...FLAGPOLES.map(([x, z]) => box(x, z, 0.3, 0.3, 12)),
  ...VOMITORIES.map(vomitoryBox),
  PHYSIO_TABLE,
)

/** Tops of colliders you can stand on (benches, vomitory blocks, planters...). */
export function colliderTop(x: number, z: number, feetY: number, maxStep: number): number {
  let g = -Infinity
  for (const b of COLLIDERS) {
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && b.maxY <= feetY + maxStep && b.maxY > g) g = b.maxY
  }
  return g
}
