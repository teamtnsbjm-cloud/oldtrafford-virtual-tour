import * as THREE from 'three'
import { PITCH_LENGTH, PITCH_WIDTH, BOWL } from './layout'

/**
 * All textures are drawn procedurally on <canvas> at runtime.
 * No external images, logos or photos are used anywhere in the project.
 */

const cache = new Map<string, THREE.Texture>()

export const UI_FONT = "'Pretendard','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif"
export const DISPLAY_FONT = "'Arial Black','Segoe UI Black','Helvetica Neue',Arial,sans-serif"

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function finish(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = opts.aniso ?? 8
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(opts.repeat[0], opts.repeat[1])
  }
  t.needsUpdate = true
  return t
}

function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  const hit = cache.get(key)
  if (hit) return hit as T
  const t = make()
  cache.set(key, t)
  return t
}

// Small deterministic PRNG so textures look identical on every load.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h)
  const r = rng(seed)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

// ------------------------------------------------------------- pitch -------
/** Grass with mowing stripes and full FIFA-style line markings. Covers the bowl floor (2a × 2b). */
export function pitchTexture() {
  return cached('pitch', () => {
    const W = BOWL.a * 2
    const H = BOWL.b * 2
    const ppm = 34 // pixels per metre
    const [c, ctx] = canvas(Math.round(W * ppm), Math.round(H * ppm))
    const X = (x: number) => (x + BOWL.a) * ppm
    const Z = (z: number) => (z + BOWL.b) * ppm

    ctx.fillStyle = '#2f7a2a'
    ctx.fillRect(0, 0, c.width, c.height)
    // mowing stripes across the full pitch length
    const stripes = 18
    const sw = PITCH_LENGTH / stripes
    for (let i = -3; i < stripes + 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#3b8f31' : '#2d7a28'
      ctx.fillRect(X(-PITCH_LENGTH / 2 + i * sw), 0, sw * ppm + 1, c.height)
    }
    // subtle cross-stripes for a checker feel
    ctx.globalAlpha = 0.07
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#000' : '#fff'
      ctx.fillRect(0, Z(-PITCH_WIDTH / 2 + (i * PITCH_WIDTH) / 12), c.width, (PITCH_WIDTH / 12) * ppm)
    }
    ctx.globalAlpha = 1
    noise(ctx, c.width, c.height, 22, 7)

    // line markings
    ctx.strokeStyle = 'rgba(245,245,240,0.95)'
    ctx.fillStyle = 'rgba(245,245,240,0.95)'
    ctx.lineWidth = 0.12 * ppm
    const L = PITCH_LENGTH / 2
    const Wd = PITCH_WIDTH / 2
    ctx.strokeRect(X(-L), Z(-Wd), PITCH_LENGTH * ppm, PITCH_WIDTH * ppm)
    ctx.beginPath()
    ctx.moveTo(X(0), Z(-Wd))
    ctx.lineTo(X(0), Z(Wd))
    ctx.stroke()
    const circle = (x: number, z: number, r: number, a0 = 0, a1 = Math.PI * 2, fill = false) => {
      ctx.beginPath()
      ctx.arc(X(x), Z(z), r * ppm, a0, a1)
      if (fill) ctx.fill()
      else ctx.stroke()
    }
    circle(0, 0, 9.15)
    circle(0, 0, 0.22, 0, Math.PI * 2, true)
    for (const s of [-1, 1]) {
      const gx = s * L
      // penalty area 16.5 x 40.32, goal area 5.5 x 18.32
      const pa = 16.5, pw = 20.16, ga = 5.5, gw = 9.16
      ctx.strokeRect(Math.min(X(gx), X(gx - s * pa)), Z(-pw), pa * ppm, pw * 2 * ppm)
      ctx.strokeRect(Math.min(X(gx), X(gx - s * ga)), Z(-gw), ga * ppm, gw * 2 * ppm)
      const spot = gx - s * 11
      circle(spot, 0, 0.22, 0, Math.PI * 2, true)
      // penalty arc: part of r=9.15 circle outside the box
      const ang = Math.acos((pa - 11) / 9.15)
      if (s > 0) circle(spot, 0, 9.15, Math.PI - ang, Math.PI + ang)
      else circle(spot, 0, 9.15, -ang, ang)
      // corner arcs
      circle(gx, -Wd, 1, s > 0 ? Math.PI / 2 : 0, s > 0 ? Math.PI : Math.PI / 2)
      circle(gx, Wd, 1, s > 0 ? Math.PI : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : 0)
    }
    return finish(c, { aniso: 16 })
  })
}

// ---------------------------------------------------------- materials ------
export function brickTexture() {
  return cached('brick', () => {
    const [c, ctx] = canvas(512, 512)
    ctx.fillStyle = '#5a2a22'
    ctx.fillRect(0, 0, 512, 512)
    const r = rng(3)
    const rows = 32
    const bh = 512 / rows
    const bw = 40
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? bw / 2 : 0
      for (let x = -bw; x < 512 + bw; x += bw) {
        const t = r()
        ctx.fillStyle = `rgb(${120 + t * 40},${40 + t * 18},${32 + t * 10})`
        ctx.fillRect(x + off + 1, y * bh + 1, bw - 2, bh - 2)
      }
    }
    noise(ctx, 512, 512, 18, 4)
    return finish(c)
  })
}

export function concreteTexture() {
  return cached('concrete', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#9a9a98'
    ctx.fillRect(0, 0, 256, 256)
    noise(ctx, 256, 256, 28, 5)
    return finish(c)
  })
}

export function pavingTexture() {
  return cached('paving', () => {
    const [c, ctx] = canvas(512, 512)
    ctx.fillStyle = '#8d8a84'
    ctx.fillRect(0, 0, 512, 512)
    const r = rng(9)
    const n = 8
    const s = 512 / n
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const t = r()
        ctx.fillStyle = `rgb(${150 + t * 25},${146 + t * 22},${138 + t * 20})`
        const off = y % 2 ? s / 2 : 0
        ctx.fillRect(x * s + off + 2, y * s + 2, s - 4, s - 4)
        ctx.fillRect(x * s + off + 2 - 512, y * s + 2, s - 4, s - 4)
      }
    noise(ctx, 512, 512, 16, 10)
    return finish(c)
  })
}

export function asphaltTexture() {
  return cached('asphalt', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#3b3d40'
    ctx.fillRect(0, 0, 256, 256)
    noise(ctx, 256, 256, 30, 11)
    return finish(c)
  })
}

export function woodTexture() {
  return cached('wood', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#b98a55'
    ctx.fillRect(0, 0, 256, 256)
    const r = rng(12)
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${90 + r() * 40},${55 + r() * 20},${25},${0.15 + r() * 0.2})`
      ctx.lineWidth = 1 + r() * 2
      const x = r() * 256
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.bezierCurveTo(x + r() * 10 - 5, 80, x + r() * 10 - 5, 170, x + r() * 6 - 3, 256)
      ctx.stroke()
    }
    return finish(c)
  })
}

export function floorTileTexture(base = '#2b2b2e', line = '#1d1d20') {
  return cached(`tile-${base}-${line}`, () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 256, 256)
    noise(ctx, 256, 256, 10, 2)
    ctx.strokeStyle = line
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, 256, 256)
    return finish(c)
  })
}

/** Goal net: white grid with transparent holes. */
export function netTexture() {
  return cached('net', () => {
    const [c, ctx] = canvas(128, 128)
    ctx.clearRect(0, 0, 128, 128)
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 3
    for (let i = 0; i <= 128; i += 16) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, 128)
      ctx.moveTo(0, i)
      ctx.lineTo(128, i)
      ctx.stroke()
    }
    return finish(c, { aniso: 4 })
  })
}

// ------------------------------------------------------------- signage -----
export interface SignLine {
  text: string
  size: number // fraction of canvas height
  color?: string
  font?: string
  weight?: string
  y?: number // 0..1 vertical centre; auto if omitted
}

export function signTexture(key: string, lines: SignLine[], opts: { w?: number; h?: number; bg?: string; border?: string } = {}) {
  return cached(`sign-${key}`, () => {
    const w = opts.w ?? 1024
    const h = opts.h ?? 512
    const [c, ctx] = canvas(w, h)
    if (opts.bg) {
      ctx.fillStyle = opts.bg
      ctx.fillRect(0, 0, w, h)
    } else ctx.clearRect(0, 0, w, h)
    if (opts.border) {
      ctx.strokeStyle = opts.border
      ctx.lineWidth = h * 0.03
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    lines.forEach((l, i) => {
      ctx.fillStyle = l.color ?? '#ffffff'
      ctx.font = `${l.weight ?? '800'} ${Math.round(l.size * h)}px ${l.font ?? UI_FONT}`
      const y = (l.y ?? (i + 0.5) / lines.length) * h
      const maxW = w * 0.92
      const m = ctx.measureText(l.text).width
      if (m > maxW) {
        ctx.save()
        ctx.translate(w / 2, y)
        ctx.scale(maxW / m, 1)
        ctx.fillText(l.text, 0, 0)
        ctx.restore()
      } else ctx.fillText(l.text, w / 2, y)
    })
    return finish(c)
  })
}

/** LED advertising board strip (fan-project messages only, no sponsors). */
export function ledBoardTexture(variant = 0) {
  return cached(`led-${variant}`, () => {
    const [c, ctx] = canvas(2048, 96)
    const grd = ctx.createLinearGradient(0, 0, 0, 96)
    grd.addColorStop(0, variant ? '#111' : '#b3000c')
    grd.addColorStop(1, variant ? '#000' : '#7a0008')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 2048, 96)
    ctx.fillStyle = variant ? '#e8202a' : '#ffffff'
    ctx.font = `900 54px ${DISPLAY_FONT}`
    ctx.textBaseline = 'middle'
    const msg = variant ? '  VIRTUAL STADIUM TOUR  ·  UNOFFICIAL FAN CONCEPT  · ' : '  THEATRE OF DREAMS  ·  GLORY GLORY  ·  FAN MADE  · '
    let x = 0
    while (x < 2048) {
      ctx.fillText(msg, x, 50)
      x += ctx.measureText(msg).width
    }
    return finish(c, { repeat: [1, 1] })
  })
}

/** Shirt back print: number (and optional short name). */
export function shirtNumberTexture(num: number, name: string) {
  return cached(`shirt-${num}-${name}`, () => {
    const [c, ctx] = canvas(256, 256)
    ctx.clearRect(0, 0, 256, 256)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    if (name) {
      ctx.font = `800 34px ${DISPLAY_FONT}`
      ctx.fillText(name, 128, 50)
    }
    ctx.font = `900 ${name ? 130 : 150}px ${DISPLAY_FONT}`
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.strokeText(String(num), 128, name ? 150 : 135)
    ctx.fillText(String(num), 128, name ? 150 : 135)
    return finish(c)
  })
}

/** Fan-made emblem (NOT a club crest): ring text + ball + initials. */
export function emblemTexture() {
  return cached('emblem', () => {
    const S = 1024
    const [c, ctx] = canvas(S, S)
    ctx.clearRect(0, 0, S, S)
    ctx.translate(S / 2, S / 2)
    ctx.strokeStyle = 'rgba(225,225,225,0.85)'
    ctx.fillStyle = 'rgba(225,225,225,0.85)'
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(0, 0, 470, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, 330, 0, Math.PI * 2)
    ctx.stroke()
    const text = 'THEATRE OF DREAMS · VIRTUAL TOUR · FAN MADE · '
    ctx.font = `900 74px ${DISPLAY_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const chars = text.split('')
    chars.forEach((ch, i) => {
      const a = (i / chars.length) * Math.PI * 2
      ctx.save()
      ctx.rotate(a)
      ctx.translate(0, -400)
      ctx.fillText(ch, 0, 0)
      ctx.restore()
    })
    ctx.font = `900 230px ${DISPLAY_FONT}`
    ctx.fillText('TOD', 0, 10)
    ctx.font = `800 60px ${DISPLAY_FONT}`
    ctx.fillText('EST. 2026', 0, 190)
    return finish(c, { aniso: 16 })
  })
}

export function tacticsBoardTexture() {
  return cached('tactics', () => {
    const [c, ctx] = canvas(1024, 640)
    ctx.fillStyle = '#f4f4f0'
    ctx.fillRect(0, 0, 1024, 640)
    ctx.strokeStyle = '#1d6b2c'
    ctx.lineWidth = 6
    ctx.strokeRect(60, 70, 904, 520)
    ctx.beginPath()
    ctx.moveTo(512, 70)
    ctx.lineTo(512, 590)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(512, 330, 70, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeRect(60, 210, 120, 240)
    ctx.strokeRect(844, 210, 120, 240)
    ctx.fillStyle = '#c4141c'
    ctx.font = `800 34px ${UI_FONT}`
    ctx.fillText('4-2-3-1  (DEMO 전술)', 70, 48)
    const dots: [number, number][] = [
      [100, 330], [220, 160], [220, 270], [220, 390], [220, 500], [330, 270], [330, 390], [420, 160], [420, 330], [420, 500], [480, 330],
    ]
    for (const [x, y] of dots) {
      ctx.beginPath()
      ctx.arc(x, y, 20, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#1b3a8c'
    ctx.font = `900 40px ${DISPLAY_FONT}`
    for (const [x, y] of [[700, 200], [760, 330], [700, 460], [620, 300]]) ctx.fillText('X', x - 12, y + 14)
    ctx.strokeStyle = '#c4141c'
    ctx.lineWidth = 4
    ctx.setLineDash([14, 10])
    ctx.beginPath()
    ctx.moveTo(420, 160)
    ctx.quadraticCurveTo(600, 120, 760, 250)
    ctx.stroke()
    return finish(c)
  })
}

export function scarfTexture(variant: number) {
  return cached(`scarf-${variant}`, () => {
    const [c, ctx] = canvas(64, 512)
    const palette = variant % 2 ? ['#c4141c', '#ffffff', '#111111'] : ['#c4141c', '#111111', '#f3c623']
    const band = 512 / 12
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = palette[i % 3]
      ctx.fillRect(0, i * band, 64, band)
    }
    noise(ctx, 64, 512, 10, variant + 20)
    return finish(c)
  })
}

export function ballTexture() {
  return cached('ball', () => {
    const [c, ctx] = canvas(512, 256)
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = '#c4141c'
    const r = rng(33)
    for (let i = 0; i < 14; i++) {
      const x = r() * 512
      const y = 30 + r() * 196
      ctx.beginPath()
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        ctx.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26)
      }
      ctx.fill()
    }
    return finish(c)
  })
}

/** Seat-lettering mask for a stand: returns a sampler (u,v in 0..1) → true where white seats go. */
export function seatTextMask(key: string, lines: string[], w = 1840, h = 560): (u: number, v: number) => boolean {
  const [, ctx] = canvas(w, h)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = h / lines.length
  lines.forEach((line, i) => {
    ctx.font = `900 ${Math.round(lh * 0.82)}px ${DISPLAY_FONT}`
    const m = ctx.measureText(line).width
    const maxW = w * 0.94
    ctx.save()
    ctx.translate(w / 2, lh * (i + 0.5))
    if (m > maxW) ctx.scale(maxW / m, 1)
    ctx.fillText(line, 0, 0)
    ctx.restore()
  })
  const data = ctx.getImageData(0, 0, w, h).data
  void key
  return (u, v) => {
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false
    const x = Math.floor(u * w)
    const y = Math.floor(v * h)
    return data[(y * w + x) * 4] > 128
  }
}

/** Granite plaza slabs with a red brick band, ~6 m per tile. */
export function plazaTexture() {
  return cached('plaza', () => {
    const [c, ctx] = canvas(1024, 1024)
    const r = rng(41)
    const s = 1024 / 4 // 1.5 m slabs
    ctx.fillStyle = '#8a8681'
    ctx.fillRect(0, 0, 1024, 1024)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const t = r()
        ctx.fillStyle = `rgb(${168 + t * 22},${164 + t * 20},${158 + t * 18})`
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6)
      }
    // red brick border band along one edge (repeats into a grid of bands)
    ctx.fillStyle = '#7e5048'
    ctx.fillRect(0, 0, 1024, 46)
    ctx.fillRect(0, 0, 46, 1024)
    ctx.strokeStyle = 'rgba(40,10,8,0.6)'
    ctx.lineWidth = 2
    for (let x = 0; x < 1024; x += 23) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 46); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(46, x); ctx.stroke()
    }
    noise(ctx, 1024, 1024, 14, 42)
    return finish(c, { aniso: 16 })
  })
}

/** Fine tileable noise used as a bump map (grass blades, concrete grain). */
export function grainTexture() {
  return cached('grain', () => {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, 256, 256)
    noise(ctx, 256, 256, 120, 77)
    return finish(c, { srgb: false })
  })
}

/** Small entrance number sign, e.g. "E3". */
export function gateSignTexture(label: string) {
  return cached(`gate-${label}`, () => {
    const [c, ctx] = canvas(256, 128)
    ctx.fillStyle = '#c4141c'
    ctx.fillRect(0, 0, 256, 128)
    ctx.fillStyle = '#fff'
    ctx.font = `900 76px ${DISPLAY_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, 128, 68)
    return finish(c)
  })
}
