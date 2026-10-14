import { Icosahedron } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { RootState, ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import * as THREE from 'three'

import { BubbleText } from '../bubble/BubbleText.ts'
import { applyBubbleText } from '../bubble/bubbleShader.ts'
import { BubbleMaterial } from './BubbleMaterial.tsx'
import { restDistort, sphereArgs } from './sphere.ts'
import type { DistortMaterial } from './BubbleMaterial.tsx'
import { applyEnvTint } from './envTint.ts'
import { applyMaterialToneMapping } from './toneMapping.ts'

export interface MainBubbleProps {
  envMap: THREE.Texture
  bumpMap: THREE.Texture
  expanded: boolean
  onToggle: () => void
}

const expandSeconds: number = 0.8
const reducedExpandSeconds: number = 0.25
// calmer surface while the profile is open, so the text stays readable
const expandedDistort: number = 0.25
const hoverDistort: number = 0.08
// the grown bubble shows much larger rim reflections, dimmer ones keep the bloom from flaring
const restEnvIntensity: number = 1.3
const expandedEnvIntensity: number = 0.9

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// world radius a sphere at the given distance needs to cover radiusPx on screen
function scaleForScreenRadius(radiusPx: number, viewportHeight: number, fov: number, distance: number): number {
  const halfFov: number = THREE.MathUtils.degToRad(fov / 2)
  const angle: number = Math.atan((radiusPx * Math.tan(halfFov)) / (viewportHeight / 2))
  return distance * Math.sin(angle)
}

export function MainBubble({ envMap, bumpMap, expanded, onToggle }: MainBubbleProps): JSX.Element {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<DistortMaterial | null>(null)
  const progress = useRef<number>(0)
  const hover = useRef<number>(0)
  const projected = useRef<THREE.Vector3>(new THREE.Vector3())
  const center = useRef<THREE.Vector2>(new THREE.Vector2())
  const [hovered, setHovered] = useState<boolean>(false)
  const [bubbleText] = useState<BubbleText>((): BubbleText => new BubbleText())
  const [reducedMotion] = useState<boolean>(
    (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const size = useThree((state: RootState): RootState['size'] => state.size)
  const dpr: number = useThree((state: RootState): number => state.viewport.dpr)

  useEffect((): void => {
    bubbleText.resize(size.width, size.height, dpr)
  }, [bubbleText, size, dpr])

  useEffect((): (() => void) => {
    return (): void => {
      bubbleText.dispose()
    }
  }, [bubbleText])

  useEffect((): (() => void) | undefined => {
    if (!hovered) {
      return undefined
    }
    document.body.style.cursor = 'pointer'
    return (): void => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  const materialRef = useCallback(
    (instance: DistortMaterial | null): void => {
      material.current = instance
      if (instance) {
        applyMaterialToneMapping(instance)
        applyBubbleText(instance, bubbleText.uniforms)
        applyEnvTint(instance)
      }
    },
    [bubbleText]
  )

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>): void => {
      event.stopPropagation()
      onToggle()
    },
    [onToggle]
  )

  useFrame((state: RootState, delta: number): void => {
    const sphere: THREE.Mesh | null = mesh.current
    if (!sphere) {
      return
    }
    const step: number = delta / (reducedMotion ? reducedExpandSeconds : expandSeconds)
    progress.current = THREE.MathUtils.clamp(progress.current + (expanded ? step : -step), 0, 1)
    hover.current = THREE.MathUtils.damp(hover.current, hovered && !expanded ? 1 : 0, 6, delta)
    const eased: number = easeInOutCubic(progress.current)

    const camera: THREE.PerspectiveCamera = state.camera as THREE.PerspectiveCamera
    const distance: number = camera.position.distanceTo(sphere.position)
    const expandedScale: number = scaleForScreenRadius(bubbleText.expandedRadius, size.height, camera.fov, distance)
    sphere.scale.setScalar(THREE.MathUtils.lerp(1, Math.max(1, expandedScale), eased))
    if (material.current) {
      material.current.distort =
        THREE.MathUtils.lerp(restDistort, expandedDistort, eased) + hoverDistort * hover.current
      material.current.envMapIntensity = THREE.MathUtils.lerp(restEnvIntensity, expandedEnvIntensity, eased)
    }

    // the sphere rotates following the pointer, more lazily while the profile is open
    const follow: number = 0.1 * (1 - 0.6 * eased)
    sphere.rotation.z = state.clock.elapsedTime
    sphere.rotation.y = THREE.MathUtils.lerp(sphere.rotation.y, state.pointer.x * Math.PI, follow)
    sphere.rotation.x = THREE.MathUtils.lerp(sphere.rotation.x, state.pointer.y * Math.PI, follow)

    projected.current.copy(sphere.position).project(camera)
    center.current.set(
      (projected.current.x * 0.5 + 0.5) * size.width * dpr,
      (projected.current.y * 0.5 + 0.5) * size.height * dpr
    )
    bubbleText.update(state.clock.elapsedTime, center.current, progress.current)
  })

  return (
    <Icosahedron
      args={sphereArgs}
      ref={mesh}
      position={[0, 0, 0]}
      onClick={handleClick}
      onPointerOver={(): void => {
        setHovered(true)
      }}
      onPointerOut={(): void => {
        setHovered(false)
      }}>
      <BubbleMaterial envMap={envMap} bumpMap={bumpMap} materialRef={materialRef} />
    </Icosahedron>
  )
}
