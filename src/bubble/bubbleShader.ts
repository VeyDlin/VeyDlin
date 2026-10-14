import * as THREE from 'three'

import type { BubbleTextUniforms } from './BubbleText.ts'

// drei MeshDistortMaterial scales every vertex by this noise; the text follows the same wobble
const distortLine: string = 'vec3 transformed = vec3(position * (noise * pow(distort, 2.0) + radius));'

const fragmentHeader: string = /* glsl */ `
uniform sampler2D uTextMap;
uniform vec2 uTextCenter;
uniform float uTextSize;
uniform float uTextIntensity;
uniform float uLens;
uniform float uWobble;
uniform float uRipple;
uniform float uLiquid;
uniform float uTime;
varying float vBubbleNoise;
`

// The text sits on a screen-aligned plane behind the surface: the smooth geometry normal bends it like a lens,
// the bump-mapped normal adds a slight ripple, the surface noise and two crossing sine waves make it sway with
// the liquid, and it fades out where the surface turns away from the camera.
const fragmentText: string = /* glsl */ `
{
  vec2 bubbleP = (gl_FragCoord.xy - uTextCenter) / uTextSize;
  bubbleP -= bubbleLensNormal.xy * uLens;
  bubbleP -= (normal.xy - bubbleLensNormal.xy) * uRipple;
  bubbleP *= 1.0 - vBubbleNoise * uWobble;
  bubbleP += uLiquid * vec2(
    sin(bubbleP.y * 23.0 + uTime * 1.7) + 0.5 * sin(bubbleP.y * 41.0 - uTime * 2.3),
    sin(bubbleP.x * 19.0 - uTime * 1.3) + 0.5 * sin(bubbleP.x * 37.0 + uTime * 2.1)
  );
  vec2 bubbleUv = bubbleP + 0.5;
  vec2 bubbleInside = step(vec2(0.0), bubbleUv) * step(bubbleUv, vec2(1.0));
  float bubbleFacing = smoothstep(0.2, 0.75, bubbleLensNormal.z);
  totalEmissiveRadiance += texture2D(uTextMap, bubbleUv).rgb * bubbleInside.x * bubbleInside.y * bubbleFacing * uTextIntensity;
}
`

const textMaterials: WeakSet<THREE.Material> = new WeakSet()

export function applyBubbleText(material: THREE.Material, uniforms: BubbleTextUniforms): void {
  if (textMaterials.has(material)) {
    return
  }
  textMaterials.add(material)
  const compile = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
  ): void => {
    compile(shader, renderer)
    if (!shader.vertexShader.includes(distortLine)) {
      console.warn('Bubble text: distort vertex code changed, the text will not follow the wobble')
    }
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `varying float vBubbleNoise;\n${shader.vertexShader}`.replace(
      distortLine,
      `${distortLine}\nvBubbleNoise = noise;`
    )
    shader.fragmentShader = `${fragmentHeader}\n${shader.fragmentShader}`
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nvec3 bubbleLensNormal = normal;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fragmentText}`)
  }
  const programKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = (): string => `${programKey()}|bubble-text`
}
