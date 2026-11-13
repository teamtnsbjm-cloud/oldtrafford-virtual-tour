import { create } from 'zustand'
import type { ZoneId } from '../world/layout'

export type Quality = 'high' | 'low'

/** Low preset on phones / touch-first devices; user can override in the HUD. */
export const DEFAULT_QUALITY: Quality = (() => {
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    return coarse || Math.min(window.innerWidth, window.innerHeight) < 600 ? 'low' : 'high'
  } catch {
    return 'high'
  }
})()

interface TourState {
  quality: Quality
  setQuality: (q: Quality) => void
  muted: boolean
  setMuted: (m: boolean) => void
  started: boolean
  /** true once the procedural world has been built and mounted */
  ready: boolean
  setReady: () => void
  pointerLocked: boolean
  zone: ZoneId
  focusedId: string | null
  infoId: string | null
  customizing: boolean
  banner: { text: string; sub?: string; key: number } | null
  teleport: { spawnId: string; nonce: number } | null
  start: () => void
  setPointerLocked: (v: boolean) => void
  setZone: (z: ZoneId) => void
  setFocused: (id: string | null) => void
  openInfo: (id: string) => void
  closeInfo: () => void
  setCustomizing: (v: boolean) => void
  showBanner: (text: string, sub?: string) => void
  requestTeleport: (spawnId: string) => void
}

export const useTour = create<TourState>((set) => ({
  quality: DEFAULT_QUALITY,
  setQuality: (quality) => set({ quality }),
  muted: false,
  setMuted: (muted) => set({ muted }),
  started: false,
  ready: false,
  setReady: () => set({ ready: true }),
  pointerLocked: false,
  zone: 'plaza',
  focusedId: null,
  infoId: null,
  customizing: false,
  banner: null,
  teleport: null,
  start: () => set({ started: true }),
  setPointerLocked: (v) => set({ pointerLocked: v }),
  setZone: (zone) => set({ zone }),
  setFocused: (focusedId) => set({ focusedId }),
  openInfo: (infoId) => set({ infoId }),
  closeInfo: () => set({ infoId: null }),
  setCustomizing: (customizing) => set({ customizing }),
  showBanner: (text, sub) => set({ banner: { text, sub, key: Date.now() } }),
  requestTeleport: (spawnId) => set({ teleport: { spawnId, nonce: Date.now() + Math.random() } }),
}))
