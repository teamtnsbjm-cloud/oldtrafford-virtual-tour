import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'

/**
 * Interiors should not reflect / be lit by the outdoor sky environment map.
 * Lowers envMapIntensity on every standard material under the group.
 */
export function useIndoorEnv(ref: RefObject<THREE.Object3D | null>, intensity = 0.12) {
  useEffect(() => {
    const seen = new Set<THREE.Material>()
    ref.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material
      const list = Array.isArray(m) ? m : m ? [m] : []
      for (const mat of list) {
        if (seen.has(mat)) continue
        seen.add(mat)
        if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) (mat as THREE.MeshStandardMaterial).envMapIntensity = intensity
      }
    })
  })
}
