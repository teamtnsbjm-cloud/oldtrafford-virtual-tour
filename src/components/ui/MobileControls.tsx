import { useRef, useState } from 'react'
import { inputState } from '../../state/inputState'
import { useTour } from '../../state/tourStore'
import { INTERACTABLE_BY_ID } from '../../data/interactables'
import { useIsTouch } from './useIsTouch'

const RADIUS = 52

/**
 * Touch controls: a virtual joystick (left), jump / run / look-at buttons
 * (right). Camera orbit + pinch zoom are handled on the canvas itself by
 * ThirdPersonCamera. Built on Pointer Events so mouse emulation also works.
 */
export function MobileControls() {
  const touch = useIsTouch()
  const started = useTour((s) => s.started)
  const blocked = useTour((s) => !!s.infoId || s.customizing)
  const focusedId = useTour((s) => s.focusedId)
  const openInfo = useTour((s) => s.openInfo)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [run, setRun] = useState(false)
  const active = useRef<number | null>(null)
  const center = useRef({ x: 0, y: 0 })

  if (!touch || !started || blocked) return null

  const move = (cx: number, cy: number) => {
    let dx = cx - center.current.x
    let dy = cy - center.current.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob({ x: dx, y: dy })
    inputState.joyX = dx / RADIUS
    inputState.joyY = dy / RADIUS
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    inputState.joyX = 0
    inputState.joyY = 0
  }
  const focused = focusedId ? INTERACTABLE_BY_ID[focusedId] : null

  return (
    <div className="mobile-controls">
      <div
        className="joystick"
        aria-label="이동 조이스틱"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
          active.current = e.pointerId
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* capture unsupported for synthetic pointers — tracking still works */
          }
          move(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (active.current === e.pointerId) move(e.clientX, e.clientY)
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        {focused && (
          <button className="tbtn look" onClick={() => openInfo(focused.id)}>
            살펴보기
          </button>
        )}
        <button
          className={`tbtn ${run ? 'on' : ''}`}
          onClick={() => {
            inputState.run = !run
            setRun(!run)
          }}
          aria-pressed={run}
        >
          {run ? '달리기 ON' : '달리기'}
        </button>
        <button
          className="tbtn jump"
          onPointerDown={() => {
            inputState.jumpQueued = true
          }}
        >
          점프
        </button>
      </div>
    </div>
  )
}
