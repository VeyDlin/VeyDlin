import * as THREE from 'three'

export interface BakeResult {
  // RGBA8 sRGB pixels, bottom row first as WebGL reads them, base64 encoded
  pixels: string
  width: number
  height: number
  revision: string
}

declare global {
  interface Window {
    bakeResult?: BakeResult
    bakeError?: string
  }
}

const faces: string[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(
  (face: string): string => new URL(`./cube/${face}.png`, import.meta.url).href
)

// Copies the half-float atlas texel by texel into the RGBA8 canvas, encoded to sRGB so 8 bits keep the darks
const copyFragment: string = /* glsl */ `
uniform sampler2D map;
out vec4 fragColor;

void main() {
  vec3 linear = clamp(texelFetch(map, ivec2(gl_FragCoord.xy), 0).rgb, 0.0, 1.0);
  vec3 encoded = mix(linear * 12.92, 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, linear));
  fragColor = vec4(encoded, 1.0);
}
`

// Runs the exact conversion three performs at runtime when a cube map is used as envMap of a physical material
async function bake(): Promise<BakeResult> {
  const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: false })
  // three only logs shader errors; a broken shader must fail the bake instead of writing an empty atlas
  renderer.debug.onShaderError = (): void => {
    throw new Error('A shader failed to compile, see the browser console output above')
  }
  const cube: THREE.CubeTexture = await new THREE.CubeTextureLoader().loadAsync(faces)
  // react-three-fiber marks envMap textures as sRGB when they are assigned, the bake has to match
  cube.colorSpace = THREE.SRGBColorSpace
  const generator: THREE.PMREMGenerator = new THREE.PMREMGenerator(renderer)
  const atlas: THREE.WebGLRenderTarget = generator.fromCubemap(cube)

  renderer.setPixelRatio(1)
  renderer.setSize(atlas.width, atlas.height, false)
  const material: THREE.ShaderMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { map: { value: atlas.texture } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: copyFragment,
  })
  const scene: THREE.Scene = new THREE.Scene()
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
  renderer.setRenderTarget(null)
  renderer.render(scene, new THREE.Camera())

  const gl: WebGL2RenderingContext = renderer.getContext() as WebGL2RenderingContext
  const pixels: Uint8Array = new Uint8Array(atlas.width * atlas.height * 4)
  gl.readPixels(0, 0, atlas.width, atlas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  let binary: string = ''
  for (let offset: number = 0; offset < pixels.length; offset += 0x8000) {
    binary += String.fromCharCode(...pixels.subarray(offset, offset + 0x8000))
  }
  return {
    pixels: btoa(binary),
    width: atlas.width,
    height: atlas.height,
    revision: THREE.REVISION,
  }
}

bake()
  .then((result: BakeResult): void => {
    window.bakeResult = result
  })
  .catch((error: unknown): void => {
    window.bakeError = error instanceof Error ? (error.stack ?? error.message) : String(error)
  })
