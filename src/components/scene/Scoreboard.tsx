import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { MatchData } from '../../data/matchData'
import { DISPLAY_FONT, UI_FONT } from '../../world/textures'

interface ScoreboardProps {
  data: MatchData | null
  position: [number, number, number]
  rotationY?: number
  width?: number
  height?: number
}

function drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number, data: MatchData | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0b0d12')
  bg.addColorStop(1, '#151a22')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  // LED pixel grid
  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (!data) {
    ctx.fillStyle = '#9aa3ad'
    ctx.font = `800 64px ${DISPLAY_FONT}`
    ctx.fillText('NO MATCH DATA', w / 2, h / 2)
    return
  }

  // header bar
  ctx.fillStyle = '#c4141c'
  ctx.fillRect(0, 0, w, 96)
  ctx.fillStyle = '#fff'
  ctx.font = `900 54px ${DISPLAY_FONT}`
  ctx.fillText(data.competition, w / 2, 50)

  // DEMO badge — always shown for placeholder data so nobody mistakes it for a real result
  if (data.isDemo) {
    ctx.fillStyle = '#f3c623'
    ctx.fillRect(28, 18, 190, 62)
    ctx.fillStyle = '#111'
    ctx.font = `900 46px ${DISPLAY_FONT}`
    ctx.fillText('DEMO', 123, 51)
    ctx.fillStyle = '#f3c623'
    ctx.fillRect(w - 218, 18, 190, 62)
    ctx.fillStyle = '#111'
    ctx.fillText('DEMO', w - 123, 51)
  }

  const fit = (text: string, x: number, y: number, maxW: number, size: number, color: string) => {
    ctx.font = `900 ${size}px ${DISPLAY_FONT}`
    ctx.fillStyle = color
    const m = ctx.measureText(text).width
    ctx.save()
    ctx.translate(x, y)
    if (m > maxW) ctx.scale(maxW / m, 1)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  fit(data.home, w * 0.25, 210, w * 0.42, 66, '#ffffff')
  fit(data.away, w * 0.75, 210, w * 0.42, 66, '#ffffff')
  fit(`${data.homeScore}`, w * 0.36, 345, 200, 210, '#ffffff')
  fit(':', w * 0.5, 335, 80, 170, '#c4141c')
  fit(`${data.awayScore}`, w * 0.64, 345, 200, 210, '#ffffff')

  ctx.fillStyle = '#1f2630'
  ctx.fillRect(w / 2 - 110, 430, 220, 64)
  fit(data.clock, w / 2, 463, 200, 46, '#f3c623')

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = `700 30px ${UI_FONT}`
  ctx.fillText(data.isDemo ? '데모 데이터 · 실제 경기 결과가 아닙니다 (DEMO DATA — NOT A REAL MATCH)' : data.source, w / 2, h - 34)
}

/**
 * Stadium big screen. Purely presentational: give it a MatchData object.
 * Swap the provider in `useMatchData` (src/data/matchData.ts) to go live.
 */
export function Scoreboard({ data, position, rotationY = 0, width = 15, height = 7.9 }: ScoreboardProps) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 672
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return { canvas, texture }
  }, [])

  useEffect(() => {
    drawBoard(canvas.getContext('2d')!, canvas.width, canvas.height, data)
    texture.needsUpdate = true
  }, [canvas, texture, data])

  return (
    <group position={position} rotation={[0, rotationY, 0]} name="Scoreboard">
      <mesh position={[0, 0, -0.35]} castShadow>
        <boxGeometry args={[width + 0.8, height + 0.8, 0.6]} />
        <meshStandardMaterial color="#1a1c20" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* hanging cables to the roof */}
      {[-width / 2 + 1, width / 2 - 1].map((x) => (
        <mesh key={x} position={[x, height / 2 + 2.2, -0.35]}>
          <cylinderGeometry args={[0.06, 0.06, 4]} />
          <meshStandardMaterial color="#777" />
        </mesh>
      ))}
    </group>
  )
}
