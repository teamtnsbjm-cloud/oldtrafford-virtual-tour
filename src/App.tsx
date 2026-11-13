import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Experience } from './components/scene/Experience'
import { NavigationUI } from './components/ui/NavigationUI'
import { MobileControls } from './components/ui/MobileControls'
import { useTour } from './state/tourStore'

export default function App() {
  const quality = useTour((s) => s.quality)
  const low = quality === 'low'
  return (
    <div className="app">
      <div className="scene">
        <Canvas
          data-engine="three"
          shadows={!low}
          dpr={low ? [0.8, 1.25] : [1, 1.75]}
          camera={{ fov: 60, near: 0.08, far: 2000, position: [0, 1.7, 128] }}
          gl={{ antialias: !low, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.shadowMap.type = THREE.PCFSoftShadowMap
          }}
        >
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </Canvas>
      </div>
      <NavigationUI />
      <MobileControls />
    </div>
  )
}
