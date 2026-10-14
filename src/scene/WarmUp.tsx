import { useFrame, useThree } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import * as THREE from 'three'

export interface WarmUpProps {
  children: ReactNode
  onReady: () => void
}

// frames to wait before compiling, so meshes that mount after their material settles are in the tree
const settleFrames: number = 2
// frames to render after compiling before the canvas is shown, so nothing half-drawn fades in
const shownFrames: number = 2

// Keeps the scene hidden while its shaders compile in parallel off the main thread, instead of stalling
// the first frame for several hundred milliseconds, then reports when it has been drawn for real.
export function WarmUp({ children, onReady }: WarmUpProps): JSX.Element {
  const group = useRef<THREE.Group>(null)
  const frames = useRef<number>(0)
  const started = useRef<boolean>(false)
  const reported = useRef<boolean>(false)
  const [compiled, setCompiled] = useState<boolean>(false)
  const gl = useThree((state: RootState): THREE.WebGLRenderer => state.gl)

  useFrame((state: RootState): void => {
    frames.current += 1
    if (!started.current && frames.current >= settleFrames && group.current) {
      started.current = true
      frames.current = 0
      // The effect composer draws the scene into a render target, which changes the program variant
      // (linear output, no tone mapping). Binding a target while compiling builds exactly those variants.
      const target: THREE.WebGLRenderTarget = new THREE.WebGLRenderTarget(1, 1)
      const previous: THREE.WebGLRenderTarget | null = gl.getRenderTarget()
      gl.setRenderTarget(target)
      const compiling: Promise<THREE.Object3D> = gl.compileAsync(group.current, state.camera, state.scene)
      gl.setRenderTarget(previous)
      compiling
        .catch((error: unknown): void => {
          console.warn('Shader warm-up failed, compiling on first draw instead', error)
        })
        .finally((): void => {
          target.dispose()
          frames.current = 0
          setCompiled(true)
        })
      return
    }
    if (compiled && !reported.current && frames.current >= shownFrames) {
      reported.current = true
      onReady()
    }
  })

  return (
    <group ref={group} visible={compiled}>
      {children}
    </group>
  )
}
