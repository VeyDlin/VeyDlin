import { useTexture } from '@react-three/drei'
import type { JSX } from 'react'
import * as THREE from 'three'

import { BackgroundBubbles } from './BackgroundBubbles.tsx'
import { MainBubble } from './MainBubble.tsx'

export interface SceneProps {
  expanded: boolean
  onToggle: () => void
}

// three version the environment atlas was baked with; its layout is internal to three
const envBakeRevision: string = '186'

// The environment arrives already prefiltered by `yarn bake:env` (tools/bake-env), so three does not have to
// compile its blur shader and prefilter the cube map on the first visit, which stalled loading for ~650ms.
function prepareEnvAtlas(texture: THREE.Texture): void {
  texture.mapping = THREE.CubeUVReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  if (import.meta.env.DEV && THREE.REVISION !== envBakeRevision) {
    console.warn(`Environment atlas was baked with three r${envBakeRevision}, run \`yarn bake:env\` again`)
  }
}

export function Scene({ expanded, onToggle }: SceneProps): JSX.Element {
  const bumpMap: THREE.Texture = useTexture('/bump.jpg')
  const envMap: THREE.Texture = useTexture('/env-cubeuv.png', prepareEnvAtlas)
  return (
    <>
      <MainBubble envMap={envMap} bumpMap={bumpMap} expanded={expanded} onToggle={onToggle} />
      <BackgroundBubbles envMap={envMap} bumpMap={bumpMap} />
    </>
  )
}
