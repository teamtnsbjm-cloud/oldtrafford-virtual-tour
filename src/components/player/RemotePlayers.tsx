import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { remotes, updateRemotes, useNet, type RemotePlayer } from '../../net/netClient'
import { DEFAULT_AVATAR } from '../../state/avatarStore'
import { playerState } from '../../state/playerState'
import { useTour } from '../../state/tourStore'
import { AvatarRig, type AvatarSource } from './Avatar'

/** One remote visitor rendered with the full animated rig. */
function RemoteAvatar({ r }: { r: RemotePlayer }) {
  const cfg = useMemo(() => ({ ...DEFAULT_AVATAR, ...r.cfg, nickname: r.name }), [r.cfg, r.name])
  const src = useMemo<AvatarSource>(() => ({ x: 0, y: 0, z: 0, facing: 0, speed: 0, airborne: false, zone: 'plaza', visible: false }), [])
  useFrame(() => {
    const o = r.render
    src.x = o.x
    src.y = o.y
    src.z = o.z
    src.facing = o.facing
    src.speed = o.speed
    src.airborne = o.airborne
    src.visible = o.visible
  }, -1)
  return <AvatarRig cfg={cfg} src={src} getBubble={() => r.bubble} />
}

const MAX_FAR = 120

/**
 * Other visitors in the same channel.
 * The nearest N get the full animated avatar; anyone further away is drawn
 * as a cheap instanced silhouette so 100 people stay affordable.
 */
export function RemotePlayers() {
  const ids = useNet((s) => s.ids)
  const quality = useTour((s) => s.quality)
  const maxFull = quality === 'low' ? 8 : 20
  const [near, setNear] = useState<number[]>([])
  const acc = useRef(0)

  // cheap far-LOD silhouettes (body + head) coloured by shirt
  const far = useMemo(() => {
    const body = new THREE.CapsuleGeometry(0.22, 0.9, 4, 8).translate(0, 0.9, 0)
    const head = new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.66, 0)
    const bodyMesh = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAX_FAR)
    const headMesh = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: '#d9a77f', roughness: 0.6 }), MAX_FAR)
    for (const m of [bodyMesh, headMesh]) {
      m.count = 0
      m.frustumCulled = false
    }
    return { bodyMesh, headMesh }
  }, [])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), q: new THREE.Quaternion(), y: new THREE.Vector3(0, 1, 0), s: new THREE.Vector3(1, 1, 1), p: new THREE.Vector3() }), [])

  useEffect(() => () => {
    far.bodyMesh.dispose()
    far.headMesh.dispose()
  }, [far])

  useFrame((_, dt) => {
    updateRemotes()
    const me = playerState.position
    // re-pick the nearest players a few times per second
    acc.current += dt
    const visible = [...remotes.values()].filter((r) => r.render.visible)
    if (acc.current > 0.4) {
      acc.current = 0
      const sorted = visible
        .map((r) => [(r.render.x - me.x) ** 2 + (r.render.z - me.z) ** 2, r.id] as const)
        .sort((a, b) => a[0] - b[0])
        .slice(0, maxFull)
        .map(([, id]) => id)
        .sort((a, b) => a - b)
      if (sorted.join(',') !== near.join(',')) setNear(sorted)
    }
    // everyone else → instanced silhouettes
    const nearSet = new Set(near)
    let n = 0
    for (const r of visible) {
      if (nearSet.has(r.id) || n >= MAX_FAR) continue
      tmp.p.set(r.render.x, r.render.y, r.render.z)
      tmp.q.setFromAxisAngle(tmp.y, r.render.facing)
      tmp.m.compose(tmp.p, tmp.q, tmp.s)
      far.bodyMesh.setMatrixAt(n, tmp.m)
      far.headMesh.setMatrixAt(n, tmp.m)
      far.bodyMesh.setColorAt(n, tmp.c.set(r.cfg.shirtColor ?? DEFAULT_AVATAR.shirtColor))
      n++
    }
    far.bodyMesh.count = n
    far.headMesh.count = n
    far.bodyMesh.instanceMatrix.needsUpdate = true
    far.headMesh.instanceMatrix.needsUpdate = true
    if (far.bodyMesh.instanceColor) far.bodyMesh.instanceColor.needsUpdate = true
  }, -2)

  const nearPlayers = near.map((id) => remotes.get(id)).filter((r): r is RemotePlayer => !!r && ids.includes(r.id))
  return (
    <group name="RemotePlayers">
      {nearPlayers.map((r) => (
        <RemoteAvatar key={r.id} r={r} />
      ))}
      <primitive object={far.bodyMesh} />
      <primitive object={far.headMesh} />
    </group>
  )
}
