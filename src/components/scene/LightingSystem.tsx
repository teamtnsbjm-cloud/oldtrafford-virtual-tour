import { useEffect, useRef } from 'react'
import { Sky } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky as SkyObject } from 'three/examples/jsm/objects/Sky.js'
import { useTour } from '../../state/tourStore'

const SUN_DIR = new THREE.Vector3(0.35, 0.62, 0.7).normalize()
const SKY = { turbidity: 5, rayleigh: 1.2, mieCoefficient: 0.004, mieDirectionalG: 0.85 }

/**
 * Global outdoor lighting: physical sky, sun with shadows, sky/ground bounce
 * and a sky-derived environment map for believable metal & glass reflections.
 * Interior spaces add their own local point lights.
 * The `quality` preset trades shadow resolution for speed on low-end devices.
 */
export function LightingSystem() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const quality = useTour((s) => s.quality)

  useEffect(() => {
    scene.fog = new THREE.Fog('#c9d6e2', 260, 950)
    const l = sun.current
    if (l) {
      l.target.position.set(0, 0, 20)
      scene.add(l.target)
    }
    return () => {
      scene.fog = null
      if (l) scene.remove(l.target)
    }
  }, [scene])

  // environment map rendered once from the same sky model
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const sky = new SkyObject()
    sky.scale.setScalar(1000)
    const u = sky.material.uniforms
    u.turbidity.value = SKY.turbidity
    u.rayleigh.value = SKY.rayleigh
    u.mieCoefficient.value = SKY.mieCoefficient
    u.mieDirectionalG.value = SKY.mieDirectionalG
    u.sunPosition.value.copy(SUN_DIR)
    const envScene = new THREE.Scene()
    envScene.add(sky)
    // warm "ground" so reflections are not pure sky underneath
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16), new THREE.MeshBasicMaterial({ color: '#6b625a', side: THREE.DoubleSide }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -5
    envScene.add(ground)
    const rt = pmrem.fromScene(envScene, 0.02, 1, 3000)
    scene.environment = rt.texture
    scene.environmentIntensity = 0.42
    return () => {
      scene.environment = null
      rt.dispose()
      pmrem.dispose()
      sky.geometry.dispose()
      sky.material.dispose()
    }
  }, [gl, scene])

  // update shadow resolution when the quality preset changes
  useEffect(() => {
    const l = sun.current
    if (!l) return
    const size = quality === 'low' ? 1024 : 4096
    if (l.shadow.mapSize.x !== size) {
      l.shadow.mapSize.set(size, size)
      l.shadow.map?.dispose()
      l.shadow.map = null as unknown as THREE.WebGLRenderTarget
    }
  }, [quality])

  const sunPos = SUN_DIR.clone().multiplyScalar(260).add(new THREE.Vector3(0, 0, 20))

  return (
    <>
      <Sky distance={1400} sunPosition={SUN_DIR.toArray()} {...SKY} />
      <hemisphereLight args={['#dfe9f5', '#5b5148', 0.6]} />
      <ambientLight intensity={0.08} />
      <directionalLight
        ref={sun}
        position={sunPos.toArray()}
        intensity={3.2}
        color="#fff1dc"
        castShadow={quality === 'high'}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={10}
        shadow-camera-far={600}
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
      />
    </>
  )
}
