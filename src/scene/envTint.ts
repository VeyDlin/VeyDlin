import * as THREE from 'three'

// The environment is a grayscale room, so rims, window reflections and the bloom they feed were neutral white.
// Tinting the environment light towards the terminal lavender of the text ties the scene to it. The tint is
// normalized to keep its luminance at 1, so the brightness the scene was tuned for does not change.
const tintColor: THREE.Color = new THREE.Color('#c0c0ff')
// 0 keeps the reflections neutral, 1 applies the full tint
const tintStrength: number = 1

function normalizedTint(color: THREE.Color, strength: number): THREE.Color {
  const luminance: number = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
  const tint: THREE.Color = color.clone().multiplyScalar(1 / luminance)
  return new THREE.Color(1, 1, 1).lerp(tint, strength)
}

export const envTint: THREE.IUniform<THREE.Color> = { value: normalizedTint(tintColor, tintStrength) }

const tintedMaterials: WeakSet<THREE.Material> = new WeakSet()

export function applyEnvTint(material: THREE.Material): void {
  if (tintedMaterials.has(material)) {
    return
  }
  tintedMaterials.add(material)
  const compile = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
  ): void => {
    compile(shader, renderer)
    shader.uniforms.uEnvTint = envTint
    shader.fragmentShader = `uniform vec3 uEnvTint;\n${shader.fragmentShader}`.replace(
      '#include <lights_fragment_maps>',
      `#include <lights_fragment_maps>
      #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
        radiance *= uEnvTint;
      #endif
      iblIrradiance *= uEnvTint;`
    )
  }
  const programKey = material.customProgramCacheKey.bind(material)
  material.customProgramCacheKey = (): string => `${programKey()}|env-tint`
}
