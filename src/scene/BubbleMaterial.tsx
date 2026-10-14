import { MeshDistortMaterial } from '@react-three/drei'
import type { JSX } from 'react'
import type * as THREE from 'three'

import { restDistort } from './sphere.ts'

// drei does not export its material class, this is the part of it the scene drives
export interface DistortMaterial extends THREE.MeshPhysicalMaterial {
  distort: number
  radius: number
}

export interface BubbleMaterialProps {
  envMap: THREE.Texture
  bumpMap: THREE.Texture
  materialRef: (instance: DistortMaterial | null) => void
}

/*
  Values ported from three r0.120:
  - bumpScale: bump derivatives are normalized since r151; the old 0.005 grew with canvas height,
    0.7 matches it on the 566px tall canvas of screenshot.jpg
  - no clearcoat: the old rough clearcoat (roughness 1) added almost nothing, while the current one
    dims the base layer by its fresnel at grazing angles and eats the rim highlights that feed the bloom
  - envMapIntensity: the old environment BRDF approximation reflected more off-axis; 1.3 matches the
    amount of bright rim highlights in screenshot.jpg, higher values overfeed the bloom
*/
export function BubbleMaterial({ envMap, bumpMap, materialRef }: BubbleMaterialProps): JSX.Element {
  return (
    <MeshDistortMaterial
      ref={materialRef}
      color={'#010101'}
      roughness={0.1}
      metalness={1}
      bumpScale={0.7}
      envMapIntensity={1.3}
      radius={1}
      distort={restDistort}
      envMap={envMap}
      bumpMap={bumpMap}
    />
  )
}
