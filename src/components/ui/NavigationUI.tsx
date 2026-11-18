import { useEffect, useState } from 'react'
import { SPAWNS, ZONE_LABELS } from '../../world/layout'
import { INTERACTABLE_BY_ID } from '../../data/interactables'
import { useTour } from '../../state/tourStore'
import { Minimap } from './Minimap'
import { CustomizePanel } from './CustomizePanel'
import { useIsTouch } from './useIsTouch'
import { NicknameField, validateNickname } from './NicknameField'
import { useAvatar } from '../../state/avatarStore'
import { connect, useNet } from '../../net/netClient'
import { ChatPanel } from './ChatPanel'
import { audio } from '../../audio/audioEngine'

/** Small UI preference kept in this browser only (falls back silently when storage is blocked). */
function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('tod.ui.' + key)
      return raw === null ? initial : raw === '1'
    } catch {
      return initial
    }
  })
  const set = (nv: boolean) => {
    setV(nv)
    try {
      localStorage.setItem('tod.ui.' + key, nv ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  return [v, set]
}

function requestLock() {
  const canvas = document.querySelector('canvas[data-engine]') ?? document.querySelector('.scene canvas')
  ;(canvas as HTMLCanvasElement | null)?.requestPointerLock?.()?.catch?.(() => {})
}

function Welcome() {
  const start = useTour((s) => s.start)
  const ready = useTour((s) => s.ready)
  const touch = useIsTouch()
  const nickname = useAvatar((s) => s.config.nickname)
  const [draftOk, setDraftOk] = useState(true)
  const nickOk = !validateNickname(nickname) && draftOk
  const begin = () => {
    start()
    audio.start()
    connect()
    if (!touch) requestLock()
  }
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-kicker">UNOFFICIAL FAN PROJECT · PROTOTYPE</div>
        <h1 id="welcome-title">Theatre of Dreams<br />Virtual Tour</h1>
        <p className="welcome-lead">
          해외에 가지 못하는 팬들을 위한 온라인 스타디움 성지순례. 경기장 외부 광장에서 출발해 로비, 라커룸,
          선수 입장 터널을 지나 피치에 서 보세요.
        </p>
        {touch ? (
          <ul className="welcome-keys">
            <li>왼쪽 조이스틱: 이동</li>
            <li>화면 드래그: 카메라 회전</li>
            <li>두 손가락 벌리기: 확대/축소</li>
            <li>달리기 버튼: 누르고 있는 동안 달리기</li>
            <li>점프 · 태클 버튼, 축구공은 몸으로 몰고 가기</li>
          </ul>
        ) : (
          <ul className="welcome-keys">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동</li>
            <li><kbd>Space</kbd> 점프</li>
            <li><kbd>F</kbd> 슬라이딩 태클</li>
            <li><kbd>Shift</kbd> 달리기 (누르는 동안)</li>
            <li><kbd>마우스</kbd> 카메라 회전</li>
            <li><kbd>휠</kbd> 카메라 거리</li>
            <li><kbd>E</kbd> 살펴보기</li>
            <li><kbd>C</kbd> 캐릭터 꾸미기</li>
            <li><kbd>M</kbd> 소리 켜기/끄기</li>
            <li><kbd>1</kbd>~<kbd>7</kbd> 빠른 이동</li>
            <li><kbd>ESC</kbd> 마우스 해제</li>
          </ul>
        )}
        <div className="welcome-nick">
          <NicknameField autoFocus={!touch} onValidity={setDraftOk} onSubmit={() => ready && nickOk && begin()} />
        </div>
        <button className="btn-primary" disabled={!ready || !nickOk} onClick={begin}>
          {ready ? '투어 시작하기' : '경기장 짓는 중…'}
        </button>
        <p className="welcome-legal">
          이 프로젝트는 구단·경기장 운영사와 무관한 비공식 팬 콘셉트입니다. 공식 로고·유니폼 이미지·영상·음원을
          사용하지 않으며, 모든 모델과 텍스처는 코드로 직접 생성되었습니다. 전광판 점수는 DEMO 데이터입니다.
        </p>
      </div>
    </div>
  )
}

function QuickTravel() {
  const zone = useTour((s) => s.zone)
  const requestTeleport = useTour((s) => s.requestTeleport)
  const [open, setOpen] = usePref('quick', false)
  return (
    <nav className={`panel quick ${open ? '' : 'collapsed'}`} aria-label="빠른 이동">
      <button className="panel-title quick-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        빠른 이동 {open ? '▴' : '▾'}
      </button>
      {open && SPAWNS.map((s) => (
        <button
          key={s.id}
          className={`quick-btn ${zone === s.zone ? 'active' : ''}`}
          onClick={(e) => {
            requestTeleport(s.id)
            ;(e.currentTarget as HTMLButtonElement).blur()
          }}
        >
          <span className="hk">{s.hotkey}</span>
          {s.label}
        </button>
      ))}
    </nav>
  )
}

function MapPanel() {
  const [open, setOpen] = usePref('map', true)
  return (
    <div className={`panel map-panel ${open ? '' : 'collapsed'}`}>
      <button className="panel-title quick-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        지도 {open ? '▴' : '▾'}
      </button>
      {open && <Minimap />}
    </div>
  )
}

function InfoPanel() {
  const infoId = useTour((s) => s.infoId)
  const close = useTour((s) => s.closeInfo)
  if (!infoId) return null
  const it = INTERACTABLE_BY_ID[infoId]
  if (!it) return null
  return (
    <div className="info-backdrop" onClick={close}>
      <div className="info" role="dialog" aria-modal="true" aria-labelledby="info-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="info-title">{it.title}</h2>
        {it.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <button
          className="btn-primary small"
          onClick={() => {
            close()
            requestLock()
          }}
          autoFocus
        >
          닫기 <span className="muted">(E)</span>
        </button>
      </div>
    </div>
  )
}

function Banner() {
  const banner = useTour((s) => s.banner)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!banner) return
    setVisible(true)
    const id = window.setTimeout(() => setVisible(false), 3600)
    return () => window.clearTimeout(id)
  }, [banner])
  if (!banner) return null
  return (
    <div className={`banner ${visible ? 'show' : ''}`} key={banner.key} aria-live="polite">
      <div className="banner-main">{banner.text}</div>
      {banner.sub && <div className="banner-sub">{banner.sub}</div>}
    </div>
  )
}

function OnlineChip() {
  const status = useNet((s) => s.status)
  const count = useNet((s) => s.count)
  const room = useNet((s) => s.room)
  const label =
    status === 'online' ? `온라인 · 채널 ${room} · ${count}명` : status === 'connecting' ? '서버 연결 중…' : '오프라인 (혼자 둘러보기)'
  return (
    <button className={`panel hud-btn net-chip ${status}`} onClick={() => status !== 'online' && connect()} title={status === 'online' ? '같은 채널의 팬들과 함께 있습니다' : '눌러서 다시 연결'}>
      <span className="net-dot" /> {label}
    </button>
  )
}

/** All 2D overlay UI on top of the 3D canvas. */
export function NavigationUI() {
  const started = useTour((s) => s.started)
  const zone = useTour((s) => s.zone)
  const locked = useTour((s) => s.pointerLocked)
  const focusedId = useTour((s) => s.focusedId)
  const infoId = useTour((s) => s.infoId)
  const customizing = useTour((s) => s.customizing)
  const muted = useTour((s) => s.muted)
  const setMuted = useTour((s) => s.setMuted)
  const quality = useTour((s) => s.quality)
  const setQuality = useTour((s) => s.setQuality)
  const touch = useIsTouch()
  const localNick = useAvatar((s) => s.config.nickname)
  const netName = useNet((s) => (s.status === 'online' ? s.myName : null))
  const nickname = netName ?? localNick
  const focused = focusedId ? INTERACTABLE_BY_ID[focusedId] : null
  // controls help: shown for the first moments of the tour, then folds into a small "? 조작법" button
  const [helpOpen, setHelpOpen] = useState(true)
  useEffect(() => {
    if (!started) return
    const t = window.setTimeout(() => setHelpOpen(false), 15000)
    return () => window.clearTimeout(t)
  }, [started])
  // the "click to look around" hint disappears for good once the mouse has been captured
  const [everLocked, setEverLocked] = useState(false)
  useEffect(() => {
    if (locked) setEverLocked(true)
  }, [locked])

  if (!started) return <Welcome />

  return (
    <>
      <header className="panel hud-title">
        <div className="brand">Theatre of Dreams <span>Virtual Tour</span></div>
        <div className="where">
          <span className="dot" /> 현재 위치 · <strong>{ZONE_LABELS[zone]}</strong>
        </div>
      </header>

      <aside className="hud-right">
        <MapPanel />
        <QuickTravel />
      </aside>

      <div className="hud-actions">
        <OnlineChip />
        <button
          className="panel hud-btn nick-chip"
          title="닉네임 변경"
          onClick={() => {
            useTour.getState().setCustomizing(true)
            if (document.pointerLockElement) document.exitPointerLock()
          }}
        >
          <span className="nick-dot" /> {nickname}
        </button>
        <button
          className="panel hud-btn"
          onClick={() => {
            useTour.getState().setCustomizing(!useTour.getState().customizing)
            if (document.pointerLockElement) document.exitPointerLock()
          }}
        >
          {!touch && <kbd>C</kbd>} 캐릭터 꾸미기
        </button>
        <button
          className="panel hud-btn"
          aria-pressed={!muted}
          onClick={() => {
            audio.start()
            setMuted(!muted)
          }}
        >
          {!touch && <kbd>M</kbd>} {muted ? '소리 꺼짐' : '소리 켜짐'}
        </button>
        <button className="panel hud-btn" onClick={() => setQuality(quality === 'high' ? 'low' : 'high')}>
          그래픽 {quality === 'high' ? '높음' : '낮음'}
        </button>
      </div>
      <CustomizePanel />

      {focused && !infoId && !touch && (
        <div className="prompt">
          <kbd>E</kbd> 살펴보기 · {focused.title}
        </div>
      )}

      {!touch && !locked && !infoId && !customizing && !everLocked && (
        <button className="unlock-hint" onClick={requestLock}>
          화면을 클릭하면 마우스로 카메라를 돌릴 수 있습니다 (또는 드래그)
        </button>
      )}

      {!touch && !helpOpen && (
        <button className="panel help-mini" onClick={() => setHelpOpen(true)}>
          <kbd>?</kbd> 조작법
        </button>
      )}
      {!touch && helpOpen && (
        <footer className="panel help" onClick={() => setHelpOpen(false)} title="눌러서 접기">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동</span>
          <span><kbd>Shift</kbd> 달리기</span>
          <span><kbd>Space</kbd> 점프</span>
          <span><kbd>F</kbd> 태클</span>
          <span><kbd>마우스</kbd> 카메라 회전</span>
          <span><kbd>휠</kbd> 줌</span>
          <span><kbd>E</kbd> 상호작용</span>
          <span><kbd>1-7</kbd> 빠른 이동</span>
          <span><kbd>ESC</kbd> 마우스 해제</span>
          <span className="help-close">접기 ✕</span>
        </footer>
      )}
      {!touch && <div className="legal">비공식 팬 프로젝트 · 구단과 무관 · 전광판 점수는 DEMO</div>}

      <ChatPanel />
      <Banner />
      <InfoPanel />
    </>
  )
}
