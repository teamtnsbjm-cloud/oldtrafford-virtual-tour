import { useEffect, useRef } from 'react'
import { BOWL, OUTER_D, PITCH_LENGTH, PITCH_WIDTH, ROOMS, SPAWNS } from '../../world/layout'
import { playerState } from '../../state/playerState'

const SIZE = 220
// world window shown on the map
const MIN_X = -110
const MAX_X = 110
const MIN_Z = -100
const MAX_Z = 150
const scale = Math.min(SIZE / (MAX_X - MIN_X), SIZE / (MAX_Z - MIN_Z))
const ox = (SIZE - (MAX_X - MIN_X) * scale) / 2
const oz = (SIZE - (MAX_Z - MIN_Z) * scale) / 2
const mx = (x: number) => ox + (x - MIN_X) * scale
const mz = (z: number) => oz + (z - MIN_Z) * scale

function roundRect(ctx: CanvasRenderingContext2D, d: number) {
  const a = BOWL.a + d
  const b = BOWL.b + d
  const r = BOWL.r + d
  ctx.beginPath()
  ctx.roundRect(mx(-a), mz(-b), a * 2 * scale, b * 2 * scale, r * scale)
}

/** Top-down map of the tour, north up, with the visitor's position and heading. */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const dpr = window.devicePixelRatio || 1
    c.width = SIZE * dpr
    c.height = SIZE * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 66) return
      last = t
      ctx.clearRect(0, 0, SIZE, SIZE)
      // plaza
      ctx.fillStyle = 'rgba(120,120,120,0.25)'
      ctx.fillRect(0, 0, SIZE, SIZE)
      // stadium shell + stands
      roundRect(ctx, OUTER_D)
      ctx.fillStyle = 'rgba(90,30,30,0.85)'
      ctx.fill()
      roundRect(ctx, 0)
      ctx.fillStyle = '#2f7a2a'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 0.8
      ctx.strokeRect(mx(-PITCH_LENGTH / 2), mz(-PITCH_WIDTH / 2), PITCH_LENGTH * scale, PITCH_WIDTH * scale)
      ctx.beginPath()
      ctx.moveTo(mx(0), mz(-PITCH_WIDTH / 2))
      ctx.lineTo(mx(0), mz(PITCH_WIDTH / 2))
      ctx.stroke()
      // rooms
      for (const r of Object.values(ROOMS)) {
        ctx.fillStyle = r.id === 'store' ? '#c4141c' : r.id.startsWith('tunnel') ? '#e04a52' : '#d9d2c8'
        ctx.fillRect(mx(r.minX), mz(r.minZ), (r.maxX - r.minX) * scale, (r.maxZ - r.minZ) * scale)
      }
      // spawn labels
      ctx.font = '600 9px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.textAlign = 'center'
      for (const s of SPAWNS) {
        if (s.id === 'tunnel' || s.id === 'locker') continue
        ctx.fillText(s.hotkey, mx(s.position[0]), mz(s.position[2]) + 3)
      }
      // player
      const p = playerState.position
      const px = Math.max(4, Math.min(SIZE - 4, mx(p.x)))
      const pz = Math.max(4, Math.min(SIZE - 4, mz(p.z)))
      ctx.save()
      ctx.translate(px, pz)
      ctx.rotate(-playerState.facing)
      ctx.beginPath()
      ctx.moveTo(0, -8)
      ctx.lineTo(5, 5)
      ctx.lineTo(0, 2)
      ctx.lineTo(-5, 5)
      ctx.closePath()
      ctx.fillStyle = '#ffd400'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      // north marker
      ctx.fillStyle = '#fff'
      ctx.font = '700 10px system-ui, sans-serif'
      ctx.fillText('N', SIZE - 12, 14)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="minimap" style={{ width: SIZE, height: SIZE }} aria-label="미니맵" />
}
