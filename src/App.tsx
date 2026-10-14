import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'

import { Effects } from './scene/Effects.tsx'
import { Scene } from './scene/Scene.tsx'
import { WarmUp } from './scene/WarmUp.tsx'
import { Overlay } from './ui/Overlay.tsx'

export default function App(): JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(false)
  // the canvas stays transparent until the first complete frame, so the bare background never flashes
  const [ready, setReady] = useState<boolean>(false)

  const reveal = useCallback((): void => {
    setReady(true)
  }, [])

  const toggle = useCallback((): void => {
    setExpanded((value: boolean): boolean => !value)
  }, [])

  const collapse = useCallback((): void => {
    setExpanded(false)
  }, [])

  useEffect((): (() => void) => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return (): void => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <>
      <Canvas
        className={ready ? 'stage stage--ready' : 'stage'}
        // r3f v5 never applied the device pixel ratio, the scene was tuned for CSS-pixel rendering
        dpr={1}
        camera={{ position: [0, 0, 3] }}
        gl={{ powerPreference: 'high-performance', alpha: false, antialias: false, stencil: false, depth: false }}
        onPointerMissed={collapse}>
        {/* r3f v5 did not convert args to linear, so the old raw #050505 is #262626 under color management */}
        <color attach="background" args={['#262626']} />
        <fog attach="fog" args={['#161616', 8, 30]} />
        <Suspense fallback={null}>
          <WarmUp onReady={reveal}>
            <Scene expanded={expanded} onToggle={toggle} />
          </WarmUp>
          <Effects />
        </Suspense>
      </Canvas>
      <Overlay expanded={expanded} ready={ready} onToggle={toggle} />
    </>
  )
}
