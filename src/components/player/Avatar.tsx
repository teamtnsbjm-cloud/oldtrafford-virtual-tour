import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { playerState } from '../../state/playerState'
import { useAvatar, type AvatarConfig } from '../../state/avatarStore'
import { selfBubble, useNet } from '../../net/netClient'
import { AVATAR_MODELS, FOOT_HEIGHT, type ProceduralModel } from './avatarModels'
import { DISPLAY_FONT, UI_FONT } from '../../world/textures'
import { audio, type Surface } from '../../audio/audioEngine'
import type { ZoneId } from '../../world/layout'

const SURFACE: Record<ZoneId, Surface> = { pitch: 'grass', stands: 'concrete', plaza: 'stone', lobby: 'indoor', locker: 'indoor', tunnel: 'indoor', store: 'indoor' }

/*
 * Procedural humanoid avatar with a joint hierarchy
 *   hips → spine → (neck → head) / (shoulder → elbow → hand)
 *   hips → hip → knee → ankle
 * animated by blended Idle / Walk / Run procedural cycles.
 * The hip height is solved every frame from leg angles so the planted foot
 * always sits exactly on the ground (no floating, no sinking).
 *
 * The avatar faces +Z in local space.
 */

const WALK_SPEED = 3.4
const RUN_SPEED = 7.2

type V3 = [number, number, number]

// ---------------------------------------------------------------- textures --
const texCache = new Map<string, THREE.CanvasTexture>()

function backPrint(number: number, name: string, shirt: string) {
  const key = `${number}|${name}|${shirt}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  const lum = new THREE.Color(shirt).getHSL({ h: 0, s: 0, l: 0 }).l
  const ink = lum > 0.62 ? '#151515' : '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink
  ctx.font = `800 30px ${DISPLAY_FONT}`
  const label = name.toUpperCase().slice(0, 14)
  const m = ctx.measureText(label).width
  ctx.save()
  ctx.translate(128, 40)
  if (m > 220) ctx.scale(220 / m, 1)
  ctx.fillText(label, 0, 0)
  ctx.restore()
  ctx.font = `900 150px ${DISPLAY_FONT}`
  ctx.fillText(String(number), 128, 150)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  texCache.set(key, t)
  return t
}

function nameTag(name: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.font = `700 54px ${UI_FONT}`
  const w = Math.min(500, ctx.measureText(name).width + 70)
  ctx.fillStyle = 'rgba(12,13,16,0.72)'
  ctx.beginPath()
  ctx.roundRect((512 - w) / 2, 18, w, 92, 46)
  ctx.fill()
  ctx.fillStyle = '#d0141f'
  ctx.beginPath()
  ctx.arc((512 - w) / 2 + 40, 64, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(name, 256 + 14, 66, w - 70)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// --------------------------------------------------------------- materials --
function useMaterials(cfg: AvatarConfig) {
  const mats = useMemo(
    () => ({
      shirt: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      shorts: new THREE.MeshStandardMaterial({ roughness: 0.75 }),
      sock: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
      skin: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
      boot: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.35, metalness: 0.1 }),
      sole: new THREE.MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.6 }),
      eye: new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.2 }),
      print: new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.7, depthWrite: false }),
    }),
    [],
  )
  useEffect(() => {
    mats.shirt.color.set(cfg.shirtColor)
    mats.trim.color.set(cfg.trimColor)
    mats.shorts.color.set(cfg.shortsColor)
    mats.sock.color.set(cfg.sockColor)
    mats.skin.color.set(cfg.skinTone)
    mats.hair.color.set(cfg.hairColor)
    mats.print.map = backPrint(cfg.number, cfg.nickname, cfg.shirtColor)
    mats.print.needsUpdate = true
  }, [mats, cfg])
  return mats
}

// ------------------------------------------------------------------ helpers --
/** Capsule centred between two y values along a joint's local -Y axis. */
function Limb({ len, r, y0 = 0, mat, sx = 1, sz = 1 }: { len: number; r: number; y0?: number; mat: THREE.Material; sx?: number; sz?: number }) {
  const body = Math.max(0.001, len - r * 2)
  return (
    <mesh position={[0, y0 - len / 2, 0]} material={mat} scale={[sx, 1, sz]}>
      <capsuleGeometry args={[r, body, 6, 14]} />
    </mesh>
  )
}

interface Rig {
  root: THREE.Group
  hips: THREE.Group
  spine: THREE.Group
  chest: THREE.Group
  head: THREE.Group
  shoulder: [THREE.Group, THREE.Group]
  elbow: [THREE.Group, THREE.Group]
  hip: [THREE.Group, THREE.Group]
  knee: [THREE.Group, THREE.Group]
  ankle: [THREE.Group, THREE.Group]
}

const lerp = THREE.MathUtils.lerp

/** What drives an avatar each frame: the local player or an interpolated remote player. */
export interface AvatarSource {
  x: number
  y: number
  z: number
  facing: number
  speed: number
  airborne: boolean
  zone: ZoneId
  visible: boolean
}

function bubbleTexture(text: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const ctx = c.getContext('2d')!
  ctx.font = `600 40px ${UI_FONT}`
  const w = Math.min(500, ctx.measureText(text).width + 56)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.beginPath()
  ctx.roundRect((512 - w) / 2, 10, w, 104, 28)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(240, 112)
  ctx.lineTo(256, 140)
  ctx.lineTo(272, 112)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 64, w - 40)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The local visitor's avatar. */
export function Avatar() {
  const baseCfg = useAvatar((s) => s.config)
  const netName = useNet((s) => (s.status === 'online' ? s.myName : null))
  const cfg = useMemo(() => (netName ? { ...baseCfg, nickname: netName } : baseCfg), [baseCfg, netName])
  const src = useMemo<AvatarSource>(
    () => ({ x: 0, y: 0, z: 0, facing: 0, speed: 0, airborne: false, zone: 'plaza', visible: true }),
    [],
  )
  useFrame(() => {
    src.x = playerState.position.x
    src.y = playerState.position.y
    src.z = playerState.position.z
    src.facing = playerState.facing
    src.speed = playerState.speed
    src.airborne = playerState.airborne
    src.zone = playerState.zone
    src.visible = playerState.camActualDist > 0.75
  }, -1)
  return <AvatarRig cfg={cfg} src={src} local getBubble={() => selfBubble.current} />
}

/**
 * Procedural avatar rig. `local` enables footstep audio and the
 * close-camera name-tag fade; remote players pass their own source.
 */
export function AvatarRig({ cfg, src, local = false, getBubble }: {
  cfg: AvatarConfig
  src: AvatarSource
  local?: boolean
  getBubble?: () => { text: string; until: number } | null
}) {
  const model: ProceduralModel = AVATAR_MODELS[cfg.modelId] ?? AVATAR_MODELS.athlete
  const mats = useMaterials(cfg)
  const tag = useMemo(() => nameTag(cfg.nickname || 'VISITOR'), [cfg.nickname])

  const refs = useRef<Partial<Rig>>({})
  const set = <K extends keyof Rig>(k: K) => (v: THREE.Group | null) => {
    if (v) (refs.current as Record<string, unknown>)[k] = v
  }
  const setPair = (k: 'shoulder' | 'elbow' | 'hip' | 'knee' | 'ankle', i: 0 | 1) => (v: THREE.Group | null) => {
    if (!v) return
    const arr = ((refs.current as Record<string, unknown>)[k] as THREE.Group[] | undefined) ?? []
    arr[i] = v
    ;(refs.current as Record<string, unknown>)[k] = arr
  }

  const anim = useRef({ phase: 0, moveW: 0, runW: 0, facing: 0, lean: 0, lastStep: 0, jumpW: 0, wasAir: false, land: 0 })
  const rootRef = useRef<THREE.Group>(null)
  const tagMat = useRef<THREE.SpriteMaterial>(null)
  const bubbleMat = useRef<THREE.SpriteMaterial>(null)
  const bubbleSprite = useRef<THREE.Sprite>(null)
  const bubbleText = useRef('')

  useEffect(() => {
    rootRef.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o as THREE.Mesh).userData.noShadow) o.castShadow = true
    })
  })

  useFrame((state, rawDt) => {
    const r = refs.current as Rig
    const root = rootRef.current
    if (!root || !r.hips || !r.hip) return
    const dt = Math.min(rawDt, 0.05)
    const a = anim.current
    root.position.set(src.x, src.y, src.z)
    root.visible = src.visible
    if (!src.visible) return
    const camD = local ? playerState.camActualDist : state.camera.position.distanceTo(root.position)
    if (tagMat.current) {
      tagMat.current.opacity = local ? THREE.MathUtils.clamp((camD - 1.6) / 2.2, 0.18, 1) : THREE.MathUtils.clamp((45 - camD) / 15, 0, 1)
    }
    // chat bubble
    const b = getBubble?.()
    const bt = b && b.until > performance.now() ? b.text : ''
    if (bt !== bubbleText.current) {
      bubbleText.current = bt
      if (bubbleMat.current) {
        bubbleMat.current.map?.dispose()
        bubbleMat.current.map = bt ? bubbleTexture(bt) : null
        bubbleMat.current.needsUpdate = true
      }
      if (bubbleSprite.current) bubbleSprite.current.visible = !!bt
    }

    // facing: shortest-arc smoothing toward the movement direction
    let d = src.facing - a.facing
    d = Math.atan2(Math.sin(d), Math.cos(d))
    const turnRate = 10
    a.facing += d * (1 - Math.exp(-dt * turnRate))
    root.rotation.y = a.facing + Math.PI // model faces +Z; facing 0 means -Z

    // blend weights (smoothed so state changes ease in/out)
    const sp = src.speed
    const moveT = THREE.MathUtils.clamp(sp / 1.2, 0, 1)
    const runT = THREE.MathUtils.clamp((sp - WALK_SPEED - 0.2) / (RUN_SPEED - WALK_SPEED - 0.6), 0, 1)
    a.moveW += (moveT - a.moveW) * (1 - Math.exp(-dt * 8))
    a.runW += (runT - a.runW) * (1 - Math.exp(-dt * 6))
    const mW = a.moveW
    const rW = a.runW

    // phase advances with distance travelled so feet don't skate
    const stride = lerp(1.5, 2.55, rW)
    if (sp > 0.05) a.phase += (sp / stride) * Math.PI * 2 * dt
    else a.phase += dt * 0.4 * mW // settle
    // footsteps on every half cycle
    const stepIdx = Math.floor(a.phase / Math.PI)
    if (stepIdx !== a.lastStep) {
      a.lastStep = stepIdx
      if (local && mW > 0.5 && sp > 0.6 && !src.airborne) audio.footstep(SURFACE[src.zone], 0.7 + rW * 0.5)
    }
    // jump / landing weights
    a.jumpW += ((src.airborne ? 1 : 0) - a.jumpW) * (1 - Math.exp(-dt * (src.airborne ? 14 : 10)))
    if (a.wasAir && !src.airborne) {
      a.land = 1
      if (local) audio.footstep(SURFACE[src.zone], 1.3)
    }
    a.wasAir = src.airborne
    a.land = Math.max(0, a.land - dt * 5)
    const jW = a.jumpW
    const s = Math.sin(a.phase)
    const c = Math.cos(a.phase)
    const t = state.clock.elapsedTime

    // ---- locomotion pose (walk ↔ run) ----
    const legA = lerp(0.42, 0.8, rW)
    const kneeSwing = lerp(0.85, 1.75, rW)
    const kneeStance = lerp(0.08, 0.22, rW)
    const armA = lerp(0.36, 0.85, rW)
    const elbowBase = lerp(0.28, 1.5, rW)
    const leanMove = lerp(0.05, 0.2, rW)
    const twistA = lerp(0.07, 0.12, rW)

    const thighMove: [number, number] = [legA * s, -legA * s]
    const kneeMove: [number, number] = [
      kneeStance + kneeSwing * Math.pow(Math.max(0, c), 1.4),
      kneeStance + kneeSwing * Math.pow(Math.max(0, -c), 1.4),
    ]
    const armMove: [number, number] = [-armA * s, armA * s]

    // ---- idle pose ----
    const breath = Math.sin(t * 1.6)
    const sway = Math.sin(t * 0.55)

    // ---- blend ----
    const thighG = thighMove.map((v) => v * mW) as [number, number]
    const kneeG = kneeMove.map((v) => lerp(0.04, v, mW) + a.land * 0.55) as [number, number]
    const armG = armMove.map((v) => lerp(0.04 + breath * 0.015, v, mW)) as [number, number]
    const elbowG = [0, 1].map((i) => lerp(0.16, elbowBase + Math.max(0, armMove[i]) * 0.35, mW))
    // airborne tuck pose blended on top
    const thigh = [lerp(thighG[0], 0.75, jW), lerp(thighG[1], -0.2, jW)] as [number, number]
    const knee = [lerp(kneeG[0], 1.25, jW), lerp(kneeG[1], 0.55, jW)] as [number, number]
    const arm = [lerp(armG[0], -0.55, jW), lerp(armG[1], 0.75, jW)] as [number, number]
    const elbow = [lerp(elbowG[0], 0.7, jW), lerp(elbowG[1], 0.9, jW)]

    for (let i = 0; i < 2; i++) {
      r.hip[i].rotation.x = -thigh[i]
      r.hip[i].rotation.z = (i === 0 ? 1 : -1) * 0.02
      r.knee[i].rotation.x = knee[i]
      // keep the foot roughly level, lift the toe during swing
      const shinAngle = thigh[i] - knee[i]
      r.ankle[i].rotation.x = shinAngle * 0.9 - 0.15 * Math.max(0, i === 0 ? c : -c) * mW
      r.shoulder[i].rotation.x = -arm[i]
      r.shoulder[i].rotation.z = (i === 0 ? 1 : -1) * lerp(lerp(0.1 + sway * 0.01, 0.14, mW), 0.45, jW)
      r.elbow[i].rotation.x = -elbow[i]
    }

    // torso
    a.lean += (leanMove * mW - a.lean) * (1 - Math.exp(-dt * 5))
    r.spine.rotation.x = a.lean
    r.spine.rotation.y = twistA * s * mW
    r.spine.rotation.z = sway * 0.012 * (1 - mW)
    r.chest.scale.set(1 + breath * 0.012 * (1 - mW), 1 + breath * 0.008 * (1 - mW), 1 + breath * 0.02 * (1 - mW))
    r.head.rotation.y = -twistA * s * mW * 0.8
    r.head.rotation.x = -a.lean * 0.6 + Math.sin(t * 0.37) * 0.03 * (1 - mW)
    r.head.rotation.z = Math.sin(t * 0.29) * 0.03 * (1 - mW)

    // foot planting: hip height = the longer leg's vertical reach
    const reach = (i: number) => model.thigh * Math.cos(thigh[i]) + model.shin * Math.cos(thigh[i] - knee[i])
    const hipH = 0.03 + Math.max(reach(0), reach(1)) + FOOT_HEIGHT
    const bounce = Math.abs(Math.sin(a.phase)) * 0.045 * rW * mW
    r.hips.position.y = hipH + bounce
    r.hips.position.x = sway * 0.012 * (1 - mW)
    r.hips.rotation.y = -twistA * s * mW * 0.6
  })

  const M = model
  const ls = M.limbScale
  const longSleeve = cfg.topStyle === 'longsleeve'
  const training = cfg.topStyle === 'training'
  const sleeveMat = training ? mats.trim : mats.shirt
  const chestZ = M.chestRadius * M.chestDepth

  const arm = (i: 0 | 1) => {
    const sx = i === 0 ? 1 : -1
    return (
      <group ref={setPair('shoulder', i)} position={[sx * M.shoulder, 0.43, 0]}>
        <mesh material={mats.shirt} position={[0, 0.005, 0]}>
          <sphereGeometry args={[0.074 * ls, 16, 12]} />
        </mesh>
        {/* sleeve */}
        {longSleeve || training ? (
          <Limb len={M.upperArm} r={0.062 * ls} mat={sleeveMat} />
        ) : (
          <>
            <Limb len={0.14} r={0.07 * ls} mat={mats.shirt} />
            <mesh position={[0, -0.125, 0]} material={mats.trim}>
              <cylinderGeometry args={[0.066 * ls, 0.066 * ls, 0.018, 14]} />
            </mesh>
            <Limb len={M.upperArm} r={0.056 * ls} mat={mats.skin} />
          </>
        )}
        <group ref={setPair('elbow', i)} position={[0, -M.upperArm, 0]}>
          <mesh material={longSleeve || training ? sleeveMat : mats.skin}>
            <sphereGeometry args={[0.052 * ls, 12, 10]} />
          </mesh>
          <Limb len={M.forearm} r={0.049 * ls} mat={longSleeve || training ? sleeveMat : mats.skin} />
          {(longSleeve || training) && (
            <mesh position={[0, -M.forearm + 0.02, 0]} material={training ? mats.shirt : mats.trim}>
              <cylinderGeometry args={[0.051 * ls, 0.051 * ls, 0.025, 12]} />
            </mesh>
          )}
          <mesh position={[0, -M.forearm - 0.045, 0.005]} scale={[0.75, 1.15, 0.5]} material={mats.skin}>
            <sphereGeometry args={[0.05 * ls, 12, 10]} />
          </mesh>
        </group>
      </group>
    )
  }

  const leg = (i: 0 | 1) => {
    const sx = i === 0 ? 1 : -1
    return (
      <group ref={setPair('hip', i)} position={[sx * M.hipWidth, -0.03, 0]}>
        {/* shorts leg */}
        <Limb len={0.22} r={0.1 * ls} y0={0.03} mat={mats.shorts} />
        <Limb len={M.thigh} r={0.084 * ls} mat={mats.skin} />
        <group ref={setPair('knee', i)} position={[0, -M.thigh, 0]}>
          <mesh material={mats.skin}>
            <sphereGeometry args={[0.07 * ls, 12, 10]} />
          </mesh>
          {/* sock from just below the knee to the ankle */}
          <Limb len={M.shin - 0.05} r={0.066 * ls} y0={-0.05} mat={mats.sock} />
          <mesh position={[0, -0.075, 0]} material={mats.trim}>
            <cylinderGeometry args={[0.069 * ls, 0.069 * ls, 0.03, 12]} />
          </mesh>
          <Limb len={0.16} r={0.062 * ls} y0={0.02} mat={mats.skin} />
          <group ref={setPair('ankle', i)} position={[0, -M.shin, 0]}>
            {/* boot: bottom sits exactly at ankle - FOOT_HEIGHT */}
            <mesh position={[0, -FOOT_HEIGHT / 2 + 0.008, 0.05]} material={mats.boot}>
              <boxGeometry args={[0.11 * ls + 0.01, FOOT_HEIGHT - 0.016, 0.26]} />
            </mesh>
            <mesh position={[0, -FOOT_HEIGHT + 0.006, 0.05]} material={mats.sole}>
              <boxGeometry args={[0.104 * ls + 0.01, 0.012, 0.255]} />
            </mesh>
            <mesh position={[0, -0.01, 0.0]} material={mats.boot}>
              <sphereGeometry args={[0.058, 12, 8]} />
            </mesh>
          </group>
        </group>
      </group>
    )
  }

  const headR = M.headRadius
  const tagPos: V3 = [0, 2.12, 0]

  return (
    <group ref={rootRef} name="Avatar">
      <group ref={set('hips')}>
        {/* pelvis / shorts */}
        <mesh position={[0, 0.0, 0]} scale={[1.18, 1, 0.78]} material={mats.shorts}>
          <capsuleGeometry args={[M.waistRadius * 0.98, 0.06, 6, 16]} />
        </mesh>
        {leg(0)}
        {leg(1)}
        <group ref={set('spine')} position={[0, 0.05, 0]}>
          <group ref={set('chest')}>
            <mesh position={[0, 0.1, 0]} scale={[1.05, 1, 0.7]} material={mats.shirt}>
              <capsuleGeometry args={[M.waistRadius, 0.1, 6, 16]} />
            </mesh>
            <mesh position={[0, 0.3, 0]} scale={[1.14, 1, M.chestDepth]} material={mats.shirt}>
              <capsuleGeometry args={[M.chestRadius, 0.16, 8, 18]} />
            </mesh>
            {/* training top: contrasting shoulder panel */}
            {training && (
              <mesh position={[0, 0.41, 0]} scale={[1.16, 0.45, M.chestDepth + 0.02]} material={mats.trim}>
                <sphereGeometry args={[M.chestRadius, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
            )}
            {/* collar */}
            <mesh position={[0, 0.49, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.trim}>
              <torusGeometry args={[0.058, 0.014, 8, 20]} />
            </mesh>
            {/* hem trim */}
            <mesh position={[0, 0.02, 0]} scale={[1.05, 1, 0.7]} material={mats.trim}>
              <cylinderGeometry args={[M.waistRadius + 0.004, M.waistRadius + 0.004, 0.02, 20]} />
            </mesh>
            {/* back print: number + nickname (no club badge anywhere) */}
            <mesh position={[0, 0.3, -chestZ - 0.006]} rotation={[0, Math.PI, 0]} material={mats.print} userData={{ noShadow: true }}>
              <planeGeometry args={[0.27, 0.27]} />
            </mesh>
          </group>
          {arm(0)}
          {arm(1)}
          <group position={[0, 0.5, 0]}>
            <mesh position={[0, 0.04, 0]} material={mats.skin}>
              <cylinderGeometry args={[0.045, 0.05, 0.1, 12]} />
            </mesh>
            <group ref={set('head')} position={[0, 0.09, 0]}>
              <mesh position={[0, headR * 0.92, 0.005]} scale={[0.9, 1.08, 1]} material={mats.skin}>
                <sphereGeometry args={[headR, 24, 18]} />
              </mesh>
              {/* hair cap */}
              <mesh position={[0, headR * 0.98, -0.006]} scale={[0.95, 1.06, 1.04]} rotation={[-0.25, 0, 0]} material={mats.hair}>
                <sphereGeometry args={[headR * 1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
              </mesh>
              {[-1, 1].map((s) => (
                <group key={s}>
                  <mesh position={[s * 0.036, headR * 0.98, headR * 0.86]} material={mats.eye}>
                    <sphereGeometry args={[0.012, 8, 6]} />
                  </mesh>
                  <mesh position={[s * headR * 0.88, headR * 0.9, 0]} scale={[0.4, 1, 0.7]} material={mats.skin}>
                    <sphereGeometry args={[0.03, 8, 6]} />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, headR * 0.82, headR * 0.95]} scale={[0.8, 1.2, 1]} material={mats.skin}>
                <sphereGeometry args={[0.016, 8, 6]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      {/* chat bubble */}
      <sprite ref={bubbleSprite} position={[0, 2.55, 0]} scale={[1.6, 0.5, 1]} renderOrder={11} visible={false}>
        <spriteMaterial ref={bubbleMat} transparent depthWrite={false} />
      </sprite>
      {/* nickname tag */}
      <sprite position={tagPos} scale={[0.86, 0.215, 1]} renderOrder={10}>
        <spriteMaterial ref={tagMat} map={tag} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}
