import { useEffect, useRef, useState } from 'react'
import { sendChat, useNet } from '../../net/netClient'
import { useTour } from '../../state/tourStore'
import { useIsTouch } from './useIsTouch'

/** Channel chat: recent messages + an input opened with Enter (or the 채팅 button on touch). */
export function ChatPanel() {
  const status = useNet((s) => s.status)
  const chat = useNet((s) => s.chat)
  const open = useNet((s) => s.chatOpen)
  const setOpen = useNet((s) => s.setChatOpen)
  const touch = useIsTouch()
  const [text, setText] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const st = useTour.getState()
      if (e.code === 'Enter' && st.started && !st.infoId && !st.customizing && useNet.getState().status === 'online') {
        e.preventDefault()
        setOpen(true)
        if (document.pointerLockElement) document.exitPointerLock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [chat, open])

  if (status !== 'online') return null
  // when closed only show the last few lines for ~12 s
  const lines = open ? chat.slice(-30) : chat.filter((l) => now - l.ts < 12000).slice(-5)

  return (
    <div className={`chat ${open ? 'open' : ''}`}>
      {lines.length > 0 && (
        <div className="chat-lines" ref={list} aria-live="polite">
          {lines.map((l, i) => (
            <div key={`${l.ts}-${i}`} className={`chat-line ${l.system ? 'sys' : ''} ${l.self ? 'me' : ''}`}>
              {!l.system && <b>{l.name}</b>} {l.text}
            </div>
          ))}
        </div>
      )}
      {open ? (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (sendChat(text)) setText('')
            setOpen(false)
            input.current?.blur()
          }}
        >
          <input
            ref={input}
            className="cz-input"
            value={text}
            maxLength={80}
            placeholder="메시지 입력 후 Enter (ESC 닫기)"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') {
                setOpen(false)
                input.current?.blur()
              }
            }}
          />
          <button className="btn-primary small" type="submit">보내기</button>
        </form>
      ) : (
        touch && (
          <button className="panel hud-btn chat-open-btn" onClick={() => setOpen(true)}>
            채팅
          </button>
        )
      )}
      {!open && !touch && <div className="chat-hint">Enter 채팅</div>}
    </div>
  )
}
