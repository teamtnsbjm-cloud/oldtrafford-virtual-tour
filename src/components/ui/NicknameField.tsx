import { useEffect, useState } from 'react'
import { useAvatar } from '../../state/avatarStore'

export const NICK_MIN = 2
export const NICK_MAX = 14
const ALLOWED = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ _\-.]+$/

/** Returns an error message, or null when the nickname is valid. */
export function validateNickname(raw: string): string | null {
  const v = raw.trim()
  if (v.length < NICK_MIN) return `닉네임은 ${NICK_MIN}자 이상이어야 합니다.`
  if (v.length > NICK_MAX) return `닉네임은 ${NICK_MAX}자 이하로 입력해 주세요.`
  if (!ALLOWED.test(v)) return '한글, 영문, 숫자, 공백, _ - . 만 사용할 수 있습니다.'
  return null
}

export function normalizeNickname(raw: string) {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Nickname input with live validation. The avatar's name tag and shirt
 * print update as soon as the value is valid (saved in this browser).
 */
export function NicknameField({ autoFocus, onSubmit, compact, onValidity }: { autoFocus?: boolean; onSubmit?: () => void; compact?: boolean; onValidity?: (ok: boolean) => void }) {
  const saved = useAvatar((s) => s.config.nickname)
  const update = useAvatar((s) => s.update)
  const [draft, setDraft] = useState(saved)
  useEffect(() => setDraft(saved), [saved])
  const error = validateNickname(draft)
  useEffect(() => onValidity?.(!error), [error, onValidity])

  const commit = (v: string) => {
    setDraft(v)
    if (!validateNickname(v)) update({ nickname: normalizeNickname(v) })
  }

  return (
    <label className={`nick-field ${compact ? 'compact' : ''}`}>
      <span className="cz-label">닉네임</span>
      <div className="nick-row">
        <input
          className={`cz-input ${error ? 'invalid' : ''}`}
          value={draft}
          maxLength={NICK_MAX + 4}
          autoFocus={autoFocus}
          placeholder="경기장에서 보일 이름"
          aria-invalid={!!error}
          aria-describedby="nick-help"
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && !error) onSubmit?.()
          }}
        />
        <span className="nick-count">{draft.trim().length}/{NICK_MAX}</span>
      </div>
      <span id="nick-help" className={`nick-help ${error ? 'err' : ''}`}>
        {error ?? '캐릭터 머리 위와 유니폼 등에 표시됩니다.'}
      </span>
    </label>
  )
}
