import { useEffect, useState } from 'react'

/**
 * Match data contract for the stadium scoreboard.
 *
 * Phase 1 only ships a DEMO provider. A future provider (e.g. a football
 * data API proxied through our own backend) only needs to implement
 * `MatchDataProvider` — the Scoreboard component does not change.
 */
export interface MatchData {
  home: string
  away: string
  homeScore: number
  awayScore: number
  /** e.g. "67'" or "FT" */
  clock: string
  competition: string
  /** true for placeholder data. The scoreboard always shows a DEMO badge when set. */
  isDemo: boolean
  source: string
}

export interface MatchDataProvider {
  id: string
  getCurrentMatch(): Promise<MatchData | null>
}

export const demoMatchProvider: MatchDataProvider = {
  id: 'demo',
  async getCurrentMatch() {
    return {
      home: 'MANCHESTER UNITED',
      away: 'OPPONENT',
      homeScore: 2,
      awayScore: 1,
      clock: "67'",
      competition: 'DEMO MATCH',
      isDemo: true,
      source: 'Static demo data — not a real fixture',
    }
  },
}

/** Polls a provider. Phase 1 uses the demo provider only. */
export function useMatchData(provider: MatchDataProvider = demoMatchProvider, pollMs = 60_000): MatchData | null {
  const [data, setData] = useState<MatchData | null>(null)
  useEffect(() => {
    let alive = true
    const load = () =>
      provider
        .getCurrentMatch()
        .then((d) => alive && setData(d))
        .catch(() => alive && setData(null))
    load()
    const id = window.setInterval(load, pollMs)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [provider, pollMs])
  return data
}
