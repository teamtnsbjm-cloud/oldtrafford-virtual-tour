import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AvatarModelId, TopStyle } from '../components/player/avatarModels'

/**
 * Avatar customisation. Persisted per browser so a returning visitor keeps
 * their look. Later phases can sync this to an account / multiplayer server.
 */
export interface AvatarConfig {
  nickname: string
  modelId: AvatarModelId
  topStyle: TopStyle
  shirtColor: string
  trimColor: string
  shortsColor: string
  sockColor: string
  skinTone: string
  hairColor: string
  number: number
}

/** Pink fluffy cardigan over a white tee, pearl necklace and heart accessories (fan styling, no real person). */
export const CARDIGAN_LOOK: Partial<AvatarConfig> = {
  topStyle: 'cardigan',
  shirtColor: '#f3a9c6',
  trimColor: '#ffffff',
  shortsColor: '#ece6df',
  sockColor: '#ffffff',
  skinTone: '#c9906b',
  hairColor: '#1b1612',
}

export const DEFAULT_AVATAR: AvatarConfig = {
  nickname: 'UNITED FAN',
  modelId: 'athlete',
  topStyle: 'cardigan',
  shirtColor: '#f3a9c6',
  trimColor: '#ffffff',
  shortsColor: '#ece6df',
  sockColor: '#ffffff',
  skinTone: '#c9906b',
  hairColor: '#1b1612',
  number: 26,
}

/** The look every visitor had before the cardigan became the default (used to migrate untouched saves). */
const OLD_DEFAULT_LOOK = { topStyle: 'jersey', shirtColor: '#c8102e', shortsColor: '#ffffff', sockColor: '#111111', skinTone: '#d9a77f', hairColor: '#2b1d14' }

interface AvatarState {
  config: AvatarConfig
  update: (patch: Partial<AvatarConfig>) => void
  reset: () => void
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = '__tod_probe'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return window.localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (n: string) => mem.get(n) ?? null,
      setItem: (n: string, v: string) => void mem.set(n, v),
      removeItem: (n: string) => void mem.delete(n),
    }
  }
})

export const useAvatar = create<AvatarState>()(
  persist(
    (set) => ({
      config: DEFAULT_AVATAR,
      update: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      reset: () => set({ config: DEFAULT_AVATAR }),
    }),
    {
      name: 'tod-avatar-v1',
      storage: safeStorage,
      version: 2,
      // visitors who never changed the old default outfit get the new look (nickname + number kept)
      migrate: (persisted, version) => {
        const st = persisted as { config?: Partial<AvatarConfig> } | undefined
        const c = st?.config
        if (version < 2 && c && Object.entries(OLD_DEFAULT_LOOK).every(([k, v]) => (c as Record<string, unknown>)[k] === v)) {
          return { ...st, config: { ...c, ...CARDIGAN_LOOK } }
        }
        return st as object
      },
      merge: (p, c) => ({ ...c, config: { ...DEFAULT_AVATAR, ...((p as { config?: Partial<AvatarConfig> })?.config ?? {}) } }) },
  ),
)
