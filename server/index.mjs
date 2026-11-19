/**
 * Theatre of Dreams — realtime multiplayer relay.
 *
 * - Plain WebSocket server (package `ws`), no database.
 * - Visitors are grouped into channels of up to MAX_PER_ROOM (default 100);
 *   when a channel is full a new one opens automatically.
 * - Clients send their own state ~10x/s; the server broadcasts a snapshot
 *   8x/s containing only nearby players (interest management) to keep
 *   bandwidth sane with 100 people.
 * - Every inbound message is size-limited, validated and rate-limited.
 *
 * Run:  node server/index.mjs        (PORT env, default 8787)
 */
import { WebSocketServer } from 'ws'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// built client (npm run build) served from the same origin as the WebSocket
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp',
}
function serveStatic(req, res) {
  let rel = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (rel === '/' || rel === '') rel = '/index.html'
  const file = path.resolve(DIST, '.' + rel)
  if (!file.startsWith(DIST + path.sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(DIST, 'index.html')
    fs.readFile(target, (e2, buf) => {
      if (e2) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('Not built yet — run `npm run build`.')
        return
      }
      const ext = path.extname(target)
      res.writeHead(200, {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
      })
      res.end(buf)
    })
  })
}

const PORT = Number(process.env.PORT ?? 8787)
const MAX_PER_ROOM = Number(process.env.MAX_PER_ROOM ?? 100)
const TICK_HZ = 8
const INTEREST_RADIUS = 75 // metres
const MAX_VISIBLE = 40 // players per snapshot
const MAX_MSG_BYTES = 2048
const CHAT_MAX = 80
const NAME_MAX = 14
const ZONES = new Set(['plaza', 'lobby', 'locker', 'tunnel', 'pitch', 'stands', 'store'])
const COLOR = /^#[0-9a-fA-F]{6}$/
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

/** @type {Map<string, Map<number, Player>>} */
const rooms = new Map()
let nextId = 1
/** last touch of every ball per room: roomId -> Map<ballIndex, {i,p,v,ts}> */
const roomBalls = new Map()
const MAX_BALLS = 12

/**
 * @typedef {{ id:number, ws:import('ws').WebSocket, room:string, name:string, cfg:object,
 *   x:number, y:number, z:number, f:number, v:number, a:number, zone:string,
 *   msgTimes:number[], lastChat:number, joined:boolean }} Player
 */

const clean = (s, max) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null)

function sanitizeCfg(c) {
  const out = {}
  if (!c || typeof c !== 'object') return out
  for (const k of ['shirtColor', 'trimColor', 'shortsColor', 'sockColor', 'skinTone', 'hairColor']) {
    if (typeof c[k] === 'string' && COLOR.test(c[k])) out[k] = c[k]
  }
  if (c.modelId === 'athlete' || c.modelId === 'slim') out.modelId = c.modelId
  if (['jersey', 'longsleeve', 'training', 'cardigan'].includes(c.topStyle)) out.topStyle = c.topStyle
  const n = num(c.number, 1, 99)
  if (n !== null) out.number = Math.round(n)
  return out
}

function pickRoom() {
  for (const [id, r] of rooms) if (r.size < MAX_PER_ROOM) return id
  const id = String(rooms.size + 1)
  rooms.set(id, new Map())
  return id
}

function uniqueName(room, wanted, selfId) {
  const taken = new Set([...room.values()].filter((p) => p.id !== selfId && p.joined).map((p) => p.name))
  if (!taken.has(wanted)) return wanted
  for (let i = 2; i < 999; i++) {
    const n = `${wanted.slice(0, NAME_MAX - 3)}#${i}`
    if (!taken.has(n)) return n
  }
  return `${wanted.slice(0, 8)}#${Math.floor(Math.random() * 999)}`
}

const send = (ws, obj) => {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj))
}
const broadcast = (room, obj, exceptId) => {
  const data = JSON.stringify(obj)
  for (const p of room.values()) if (p.id !== exceptId && p.joined && p.ws.readyState === 1) p.ws.send(data)
}

function rateOk(p, limitPerSec) {
  const now = Date.now()
  p.msgTimes = p.msgTimes.filter((t) => now - t < 1000)
  if (p.msgTimes.length >= limitPerSec) return false
  p.msgTimes.push(now)
  return true
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const total = [...rooms.values()].reduce((s, r) => s + r.size, 0)
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
    res.end(JSON.stringify({ ok: true, players: total, rooms: rooms.size }))
    return
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res)
  res.writeHead(405)
  res.end()
})

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_MSG_BYTES,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin),
})

wss.on('connection', (ws) => {
  const roomId = pickRoom()
  const room = rooms.get(roomId)
  /** @type {Player} */
  const p = {
    id: nextId++, ws, room: roomId, name: 'VISITOR', cfg: {},
    x: 0, y: 0, z: 128, f: 0, v: 0, a: 0, zone: 'plaza', msgTimes: [], lastChat: 0, joined: false,
  }
  room.set(p.id, p)
  ws.isAlive = true
  ws.on('pong', () => (ws.isAlive = true))

  ws.on('message', (raw) => {
    if (!rateOk(p, 30)) return
    let m
    try {
      m = JSON.parse(String(raw))
    } catch {
      return
    }
    if (!m || typeof m !== 'object') return

    if (m.t === 'hello' && !p.joined) {
      p.name = uniqueName(room, clean(m.name, NAME_MAX) || 'VISITOR', p.id)
      p.cfg = sanitizeCfg(m.cfg)
      p.joined = true
      send(ws, { t: 'welcome', id: p.id, room: roomId, name: p.name, max: MAX_PER_ROOM })
      for (const o of room.values()) if (o.id !== p.id && o.joined) send(ws, { t: 'join', id: o.id, name: o.name, cfg: o.cfg })
      broadcast(room, { t: 'join', id: p.id, name: p.name, cfg: p.cfg }, p.id)
      broadcast(room, { t: 'count', n: [...room.values()].filter((o) => o.joined).length, room: roomId })
      const rb = roomBalls.get(roomId)
      if (rb && rb.size) send(ws, { t: 'balls', b: [...rb.values()] })
      return
    }
    if (!p.joined) return

    if (m.t === 's' && Array.isArray(m.p)) {
      const x = num(m.p[0], -200, 200), y = num(m.p[1], -5, 60), z = num(m.p[2], -200, 220)
      if (x === null || y === null || z === null) return
      p.x = x; p.y = y; p.z = z
      p.f = num(m.f, -1000, 1000) ?? p.f
      p.v = num(m.v, 0, 12) ?? 0
      p.a = m.a === 2 ? 2 : m.a ? 1 : 0
      if (ZONES.has(m.z)) p.zone = m.z
    } else if (m.t === 'ball') {
      const i = Number.isInteger(m.i) && m.i >= 0 && m.i < MAX_BALLS ? m.i : -1
      if (i < 0 || !Array.isArray(m.p) || !Array.isArray(m.v)) return
      const pp = [num(m.p[0], -70, 70), num(m.p[1], 0, 30), num(m.p[2], -50, 50)]
      const vv = [num(m.v[0], -40, 40), num(m.v[1], -40, 40), num(m.v[2], -40, 40)]
      if (pp.includes(null) || vv.includes(null)) return
      // only players standing near the ball may touch it
      if (Math.hypot(pp[0] - p.x, pp[2] - p.z) > 4) return
      const entry = { i, p: pp, v: vv, ts: Date.now() }
      if (!roomBalls.has(roomId)) roomBalls.set(roomId, new Map())
      roomBalls.get(roomId).set(i, entry)
      broadcast(room, { t: 'ball', ...entry }, p.id)
    } else if (m.t === 'chat') {
      const now = Date.now()
      if (now - p.lastChat < 1200) return
      const text = clean(m.m, CHAT_MAX)
      if (!text) return
      p.lastChat = now
      broadcast(room, { t: 'chat', id: p.id, name: p.name, m: text, ts: now })
    } else if (m.t === 'cfg') {
      p.cfg = sanitizeCfg(m.cfg)
      const wanted = clean(m.name, NAME_MAX)
      if (wanted) p.name = uniqueName(room, wanted, p.id)
      broadcast(room, { t: 'cfg', id: p.id, name: p.name, cfg: p.cfg })
      send(ws, { t: 'renamed', name: p.name })
    } else if (m.t === 'emote' && typeof m.e === 'string' && ['wave', 'cheer', 'clap'].includes(m.e)) {
      broadcast(room, { t: 'emote', id: p.id, e: m.e }, p.id)
    }
  })

  ws.on('close', () => {
    room.delete(p.id)
    if (p.joined) {
      broadcast(room, { t: 'leave', id: p.id })
      broadcast(room, { t: 'count', n: [...room.values()].filter((o) => o.joined).length, room: roomId })
    }
    if (room.size === 0) roomBalls.delete(roomId)
    if (room.size === 0 && rooms.size > 1) rooms.delete(roomId)
  })
})

// snapshots: each player receives the nearest players within the interest radius
const r2 = (n) => Math.round(n * 100) / 100
setInterval(() => {
  const ts = Date.now()
  for (const room of rooms.values()) {
    const list = [...room.values()].filter((p) => p.joined)
    for (const me of list) {
      if (me.ws.readyState !== 1 || me.ws.bufferedAmount > 256 * 1024) continue // skip slow clients
      const near = []
      for (const o of list) {
        if (o.id === me.id) continue
        const d2 = (o.x - me.x) ** 2 + (o.z - me.z) ** 2
        if (d2 <= INTEREST_RADIUS * INTEREST_RADIUS) near.push([d2, o])
      }
      near.sort((a, b) => a[0] - b[0])
      const ps = near.slice(0, MAX_VISIBLE).map(([, o]) => [o.id, r2(o.x), r2(o.y), r2(o.z), r2(o.f), r2(o.v), o.a])
      me.ws.send(JSON.stringify({ t: 'snap', ts, ps }))
    }
  }
}, 1000 / TICK_HZ)

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    ws.ping()
  }
}, 15000)

server.listen(PORT, () => console.log(`[tod-mp] listening on :${PORT} (max ${MAX_PER_ROOM}/channel)`))
