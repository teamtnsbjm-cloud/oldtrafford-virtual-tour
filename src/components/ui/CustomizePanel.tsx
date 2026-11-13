import { useAvatar, type AvatarConfig } from '../../state/avatarStore'
import { useTour } from '../../state/tourStore'
import { AVATAR_MODELS, TOP_STYLES, type AvatarModelId, type TopStyle } from '../player/avatarModels'
import { NicknameField } from './NicknameField'

const SHIRTS = ['#c8102e', '#ffffff', '#111111', '#1d2a4a', '#f3c623', '#2e7d32']
const TRIMS = ['#ffffff', '#111111', '#f3c623', '#c8102e']
const SHORTS = ['#ffffff', '#111111', '#c8102e', '#1d2a4a']
const SOCKS = ['#111111', '#ffffff', '#c8102e']
const SKINS = ['#f1c9a5', '#d9a77f', '#a8714a', '#6b4128']
const HAIRS = ['#2b1d14', '#111111', '#7a4a22', '#d8b46a']

function Swatches({ label, field, options }: { label: string; field: keyof AvatarConfig; options: string[] }) {
  const value = useAvatar((s) => s.config[field])
  const update = useAvatar((s) => s.update)
  return (
    <div className="cz-row">
      <div className="cz-label">{label}</div>
      <div className="cz-swatches" role="radiogroup" aria-label={label}>
        {options.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            className={`swatch ${value === c ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => update({ [field]: c } as Partial<AvatarConfig>)}
          />
        ))}
      </div>
    </div>
  )
}

/** Basic avatar customisation. Settings persist in this browser. */
export function CustomizePanel() {
  const open = useTour((s) => s.customizing)
  const setOpen = useTour((s) => s.setCustomizing)
  const cfg = useAvatar((s) => s.config)
  const update = useAvatar((s) => s.update)
  const reset = useAvatar((s) => s.reset)
  if (!open) return null
  return (
    <aside className="customize panel" aria-label="캐릭터 꾸미기">
      <div className="cz-head">
        <strong>캐릭터 꾸미기</strong>
        <button className="cz-close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
      </div>

      <NicknameField compact />

      <div className="cz-row two">
        <label>
          <div className="cz-label">체형 (모델)</div>
          <select className="cz-input" value={cfg.modelId} onChange={(e) => update({ modelId: e.target.value as AvatarModelId })}>
            {Object.entries(AVATAR_MODELS).map(([id, m]) => (
              <option key={id} value={id}>{m.label}</option>
            ))}
          </select>
        </label>
        <label>
          <div className="cz-label">등 번호</div>
          <input
            className="cz-input"
            type="number"
            min={1}
            max={99}
            value={cfg.number}
            onChange={(e) => update({ number: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
          />
        </label>
      </div>

      <div className="cz-row">
        <div className="cz-label">상의 스타일</div>
        <div className="cz-seg">
          {Object.entries(TOP_STYLES).map(([id, label]) => (
            <button key={id} className={cfg.topStyle === id ? 'on' : ''} onClick={() => update({ topStyle: id as TopStyle })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Swatches label="상의 색상" field="shirtColor" options={SHIRTS} />
      <Swatches label="포인트 색상" field="trimColor" options={TRIMS} />
      <Swatches label="하의 색상" field="shortsColor" options={SHORTS} />
      <Swatches label="양말 색상" field="sockColor" options={SOCKS} />
      <Swatches label="피부 톤" field="skinTone" options={SKINS} />
      <Swatches label="머리 색" field="hairColor" options={HAIRS} />

      <div className="cz-foot">
        <button className="cz-link" onClick={reset}>기본값으로</button>
        <span className="muted">C 키로 열고 닫기 · 공식 엠블럼 없음</span>
      </div>
    </aside>
  )
}
