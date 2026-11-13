import { useEffect, useState } from 'react'

/** True on touch-first devices (phones/tablets, or a browser emulating one). */
export function detectTouch() {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 0
  } catch {
    return false
  }
}

export function useIsTouch() {
  const [touch, setTouch] = useState(detectTouch)
  useEffect(() => {
    const on = () => setTouch(detectTouch())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return touch
}
