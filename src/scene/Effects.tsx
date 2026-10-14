import { useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { BloomEffect } from 'postprocessing'
import { useRef } from 'react'
import type { JSX } from 'react'

// Effect settings from the version captured in screenshot.jpg; the old Bloom blended with SCREEN and a Kawase blur.
// postprocessing 6.16 stepped that blur in texels of the reduced bloom resolution, current versions step in full
// canvas texels, which makes the glow several times narrower, so the blur scale restores the old spread.
function WideBloom(): JSX.Element {
  const bloom = useRef<BloomEffect>(null)
  useFrame((): void => {
    const effect: BloomEffect | null = bloom.current
    if (!effect || effect.resolution.height === 0) {
      return
    }
    effect.blurPass.scale = effect.resolution.baseHeight / effect.resolution.height
  })
  return (
    <Bloom
      ref={bloom}
      blendFunction={BlendFunction.SCREEN}
      opacity={3}
      luminanceThreshold={0}
      luminanceSmoothing={0.9}
      mipmapBlur={false}
      resolutionY={300}
    />
  )
}

export function Effects(): JSX.Element {
  return (
    <EffectComposer>
      {/*
        focus range is in world units now; 20 matches the old normalized focalLength of 0.02.
        The original focused at the camera, which left the main bubble slightly soft; focusing on its surface
        keeps the text inside sharp while the far bubbles blur about as much as before.
      */}
      <DepthOfField focusDistance={2} focusRange={20} bokehScale={2} resolutionY={480} />
      <WideBloom />
      <Noise opacity={0.025} />
      <Vignette offset={0.1} darkness={1.1} />
    </EffectComposer>
  )
}
