import { create } from 'zustand'
import type { AvatarConfig } from '../state/avatarStore'
import { useAvatar } from '../state/avatarStore'
import { playerState } from '../state/playerState'

/*
 * Multiplayer client.
 * - Connects to the relay in server/index.mjs (URL from VITE_MP_URL, or
 *   ws://<host>:8787 in development).
 * - Sends our state ~10x/s; receives snapshots of nearby players.
 * - Remote motion is rendered ~150 ms in the past and interpolated between
 *   snapshots so movement looks smooth despite network jitter.
 * - Without a server the tour keeps working in single-player mode.
 */

export type NetStatus = 'off' | 'connecting' | 'online' | 'error'

export interface RemotePlayer {
  id: number
  name: string
  cfg: Partial<AvatarConfig>
  /** snapshot buffer: [timeMs, x, y, z, facing, speed, airborne] */
  buf: number[][]
  lastSeen: number
  /** interpolated render state (read by RemoteAvatar every frame) */
  render: { x: number; y: number; z: number; facing: number; speed: number; airborne: boolean; visible: boolean }
  bubble: { text: string; until: number } | null
}

export interface ChatLine {
  id: number
  name: string
  text: string
  ts: number
  self?: boolean
  system?: boolean
}

interface NetState {
  status: NetStatus
  room: string | null
  count: number
  myId: number | null
  myName: string | null
  /** ids of players currently known (re-rendered on join/leave only) */
  ids: number[]
  chat: ChatLine[]
  chatOpen: boolean
  setChatOpen: (v: boolean) => void
}

export const useNet = create<NetState>((set) => ({
  status: 'off',
  room: null,
  count: 0,
  myId: null,
  myName: null,
  ids: [],
  chat: [],
  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
}))

/** Mutable remote-player table (not React state; read in render loops). */
export const remotes = new Map<number, RemotePlayer>()

const INTERP_DELAY = 150
let ws: WebSocket | null = null
let sendTimer = 0
let retry = 0
let retryTimer = 0
let lastSent = ''
let lastSentAt = 0
let wanted = false

function serverUrl() {
  const env = import.meta.env.VITE_MP_URL as string | undefined
  if (env) return env
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  // dev: Vite on :5173 + relay on :8787. Production: one server serves both, same origin.
  if (import.meta.env.DEV) return `${proto}://${location.hostname || '127.0.0.1'}:8787`
  return `${proto}://${location.host}`
}

function pushChat(line: ChatLine) {
  useNet.setState((s) => ({ chat: [...s.chat.slice(-59), line] }))
}

function publicCfg(c: AvatarConfig) {
  const { shirtColor, trimColor, shortsColor, sockColor, skinTone, hairColor, modelId, topStyle, number } = c
  return { shirtColor, trimColor, shortsColor, sockColor, skinTone, hairColor, modelId, topStyle, number }
}

function addRemote(id: number, name: string, cfg: Partial<AvatarConfig>) {
  if (id === useNet.getState().myId) return
  const existing = remotes.get(id)
  if (existing) {
    existing.name = name
    existing.cfg = cfg
  } else {
    remotes.set(id, {
      id, name, cfg, buf: [], lastSeen: performance.now(), bubble: null,
      render: { x: 0, y: 0, z: 0, facing: 0, speed: 0, airborne: false, visible: false },
    })
  }
  useNet.setState({ ids: [...remotes.keys()] })
}

function handle(msg: Record<string, unknown>) {
  switch (msg.t) {
    case 'welcome':
      retry = 0
      useNet.setState({ status: 'online', myId: msg.id as number, room: msg.room as string, myName: msg.name as string })
      pushChat({ id: 0, name: '', text: `채널 ${msg.room}에 접속했습니다. 다른 팬들과 함께 둘러보세요!`, ts: Date.now(), system: true })
      if (msg.name !== useAvatar.getState().config.nickname.trim())
        pushChat({ id: 0, name: '', text: `같은 닉네임이 있어 '${msg.name}'(으)로 표시됩니다.`, ts: Date.now(), system: true })
      break
    case 'join':
      addRemote(msg.id as number, msg.name as string, (msg.cfg as Partial<AvatarConfig>) ?? {})
      break
    case 'cfg':
      addRemote(msg.id as number, msg.name as string, (msg.cfg as Partial<AvatarConfig>) ?? {})
      break
    case 'leave':
      remotes.delete(msg.id as number)
      useNet.setState({ ids: [...remotes.keys()] })
      break
    case 'renamed':
      useNet.setState({ myName: msg.name as string })
      break
    case 'count':
      useNet.setState({ count: msg.n as number, room: msg.room as string })
      break
    case 'snap': {
      const now = performance.now()
      const seen = new Set<number>()
      for (const row of msg.ps as number[][]) {
        const r = remotes.get(row[0])
        if (!r) continue
        r.buf.push([now, row[1], row[2], row[3], row[4], row[5], row[6]])
        if (r.buf.length > 12) r.buf.shift()
        r.lastSeen = now
        seen.add(row[0])
      }
      break
    }
    case 'chat': {
      const id = msg.id as number
      const self = id === useNet.getState().myId
      pushChat({ id, name: msg.name as string, text: msg.m as string, ts: msg.ts as number, self })
      const r = remotes.get(id)
      if (r) r.bubble = { text: msg.m as string, until: performance.now() + 6000 }
      if (self) selfBubble.current = { text: msg.m as string, until: performance.now() + 6000 }
      break
    }
  }
}

/** Our own chat bubble (shown above the local avatar). */
export const selfBubble: { current: { text: string; until: number } | null } = { current: null }

function sendState() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  const p = playerState.position
  const payload = JSON.stringify({
    t: 's',
    p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
    f: +playerState.facing.toFixed(2),
    v: +playerState.speed.toFixed(2),
    a: playerState.airborne ? 1 : 0,
    z: playerState.zone,
  })
  const now = performance.now()
  // skip duplicates while standing still, but send a keep-alive every second
  if (payload === lastSent && now - lastSentAt < 1000) return
  lastSent = payload
  lastSentAt = now
  ws.send(payload)
}

export function connect() {
  wanted = true
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  useNet.setState({ status: 'connecting' })
  let sock: WebSocket
  try {
    sock = new WebSocket(serverUrl())
  } catch {
    useNet.setState({ status: 'error' })
    return
  }
  ws = sock
  sock.onopen = () => {
    const c = useAvatar.getState().config
    sock.send(JSON.stringify({ t: 'hello', name: c.nickname, cfg: publicCfg(c) }))
    window.clearInterval(sendTimer)
    sendTimer = window.setInterval(sendState, 100)
  }
  sock.onmessage = (e) => {
    try {
      handle(JSON.parse(e.data as string))
    } catch {
      /* ignore malformed */
    }
  }
  sock.onclose = () => {
    window.clearInterval(sendTimer)
    remotes.clear()
    useNet.setState({ ids: [], count: 0, status: wanted ? 'error' : 'off', myId: null })
    if (wanted) {
      retry = Math.min(retry + 1, 6)
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(connect, 1000 * 2 ** retry)
    }
  }
  sock.onerror = () => {
    /* onclose handles retry */
  }
}

export function disconnect() {
  wanted = false
  window.clearTimeout(retryTimer)
  ws?.close()
  ws = null
}

export function sendChat(text: string) {
  const t = text.trim().slice(0, 80)
  if (!t || !ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify({ t: 'chat', m: t }))
  return true
}

// keep the server in sync with nickname / outfit changes
let cfgTimer = 0
useAvatar.subscribe((s, prev) => {
  if (s.config === prev.config) return
  window.clearTimeout(cfgTimer)
  cfgTimer = window.setTimeout(() => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'cfg', name: s.config.nickname, cfg: publicCfg(s.config) }))
  }, 400)
})

/** Interpolates every remote player for the current frame. Call once per frame. */
export function updateRemotes() {
  const now = performance.now()
  const t = now - INTERP_DELAY
  for (const r of remotes.values()) {
    const b = r.buf
    const out = r.render
    if (now - r.lastSeen > 1500 || b.length === 0) {
      out.visible = false // out of interest range or stale
      continue
    }
    out.visible = true
    let a = b[0]
    let c = b[b.length - 1]
    for (let i = 0; i < b.length - 1; i++) {
      if (b[i][0] <= t && b[i + 1][0] >= t) {
        a = b[i]
        c = b[i + 1]
        break
      }
    }
    const span = c[0] - a[0]
    const k = span > 0 ? Math.min(1, Math.max(0, (t - a[0]) / span)) : 1
    out.x = a[1] + (c[1] - a[1]) * k
    out.y = a[2] + (c[2] - a[2]) * k
    out.z = a[3] + (c[3] - a[3]) * k
    let df = c[4] - a[4]
    df = Math.atan2(Math.sin(df), Math.cos(df))
    out.facing = a[4] + df * k
    out.speed = a[5] + (c[5] - a[5]) * k
    out.airborne = (k < 0.5 ? a[6] : c[6]) === 1
    if (r.bubble && r.bubble.until < now) r.bubble = null
  }
}
