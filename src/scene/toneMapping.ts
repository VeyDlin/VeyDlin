import * as THREE from 'three'

const toneMappedMaterials: WeakSet<THREE.Material> = new WeakSet()

// three r0.120 tone-mapped materials even when rendering into a target, before fog was applied.
// Current three tone-maps only the screen and the effect composer always renders into a target,
// so ACES is baked into the material to keep the look the scene was tuned for.
export function applyMaterialToneMapping(material: THREE.Material): void {
  if (toneMappedMaterials.has(material)) {
    return
  }
  toneMappedMaterials.add(material)
  const compile = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
  ): void => {
    compile(shader, renderer)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n#include <tonemapping_pars_fragment>')
      .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);')
  }
  // three tells programs of built-in materials apart by this key, not by the shader source; the default key is
  // the outermost onBeforeCompile wrapper, which differently patched materials may share. Every patch appends
  // its own tag on top of this static base instead.
  material.customProgramCacheKey = (): string => 'aces'
}
