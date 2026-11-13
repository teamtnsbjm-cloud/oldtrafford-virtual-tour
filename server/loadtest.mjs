/**
 * Load test: N fake visitors walk around the plaza/pitch and send state at 10 Hz.
 * Usage: node server/loadtest.mjs [N=100] [seconds=12] [url=ws://127.0.0.1:8787]
 */
import WebSocket from 'ws'

const N = Number(process.argv[2] ?? 100)
const SECS = Number(process.argv[3] ?? 12)
const URL = process.argv[4] ?? 'ws://127.0.0.1:8787'
let bytesIn = 0
let snaps = 0
let maxVisible = 0
let welcomed = 0
const rooms = new Map()
const clients = []

for (let i = 0; i < N; i++) {
  const ws = new WebSocket(URL)
  const s = { x: (Math.random() - 0.5) * 80, z: (Math.random() - 0.5) * 50, h: Math.random() * 6.28 }
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', name: `bot${i}`, cfg: { shirtColor: '#c8102e', number: (i % 99) + 1 } }))
    const iv = setInterval(() => {
      s.h += (Math.random() - 0.5) * 0.4
      s.x = Math.max(-50, Math.min(50, s.x + Math.sin(s.h) * 0.34))
      s.z = Math.max(-32, Math.min(32, s.z + Math.cos(s.h) * 0.34))
      if (ws.readyState === 1) ws.send(JSON.stringify({ t: 's', p: [s.x, 0, s.z], f: s.h, v: 3.4, a: 0, z: 'pitch' }))
    }, 100)
    ws.on('close', () => clearInterval(iv))
  })
  ws.on('message', (d) => {
    bytesIn += d.length
    const m = JSON.parse(String(d))
    if (m.t === 'snap') {
      snaps++
      maxVisible = Math.max(maxVisible, m.ps.length)
    } else if (m.t === 'welcome') {
      welcomed++
      rooms.set(m.room, (rooms.get(m.room) ?? 0) + 1)
    }
  })
  ws.on('error', (e) => console.error('client error', e.message))
  clients.push(ws)
}

const t0 = Date.now()
setTimeout(() => {
  const secs = (Date.now() - t0) / 1000
  console.log(JSON.stringify({
    clients: N, welcomed, rooms: Object.fromEntries(rooms),
    snapshotsPerClientPerSec: +(snaps / N / secs).toFixed(1),
    maxPlayersInOneSnapshot: maxVisible,
    serverOutKBps: +((bytesIn / 1024) / secs).toFixed(0),
    perClientKBps: +((bytesIn / 1024) / secs / N).toFixed(1),
  }))
  for (const c of clients) c.close()
  setTimeout(() => process.exit(0), 300)
}, SECS * 1000)
