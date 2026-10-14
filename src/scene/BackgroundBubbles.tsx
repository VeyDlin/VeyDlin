import { Icosahedron } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useRef, useState } from 'react'
import type { JSX } from 'react'
import type * as THREE from 'three'

import { BubbleMaterial } from './BubbleMaterial.tsx'
import { sphereArgs } from './sphere.ts'
import type { DistortMaterial } from './BubbleMaterial.tsx'
import { applyEnvTint } from './envTint.ts'
import { applyMaterialToneMapping } from './toneMapping.ts'

export interface BackgroundBubblesProps {
  envMap: THREE.Texture
  bumpMap: THREE.Texture
}

// background spheres start here and drift upwards
const initialPositions: Array<[number, number, number]> = [
  [-4, 20, -12],
  [-10, 12, -4],
  [-11, -12, -23],
  [-16, -6, -10],
  [12, -2, -3],
  [13, 4, -12],
  [14, -2, -23],
  [8, 10, -20],
]

export function BackgroundBubbles({ envMap, bumpMap }: BackgroundBubblesProps): JSX.Element {
  const spheres = useRef<Array<THREE.Mesh | null>>([])
  // the material is shared by all spheres, so they render only once it exists
  const [material, setMaterial] = useState<DistortMaterial | null>(null)
  const materialRef = useCallback((instance: DistortMaterial | null): void => {
    if (instance) {
      applyMaterialToneMapping(instance)
      applyEnvTint(instance)
    }
    setMaterial(instance)
  }, [])
  useFrame((): void => {
    for (const sphere of spheres.current) {
      if (!sphere) {
        continue
      }
      sphere.position.y += 0.02
      if (sphere.position.y > 19) {
        sphere.position.y = -18
      }
      sphere.rotation.x += 0.06
      sphere.rotation.y += 0.06
      sphere.rotation.z += 0.02
    }
  })
  return (
    <group>
      <BubbleMaterial envMap={envMap} bumpMap={bumpMap} materialRef={materialRef} />
      {material &&
        initialPositions.map((position: [number, number, number], i: number): JSX.Element => (
          <Icosahedron
            args={sphereArgs}
            position={position}
            material={material}
            key={i}
            ref={(mesh: THREE.Mesh | null): void => {
              spheres.current[i] = mesh
            }}
          />
        ))}
    </group>
  )
}
