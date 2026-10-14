import * as THREE from 'three'

import { profileSections } from '../profile.ts'
import {
  commandRow,
  layoutProfile,
  longestRow,
  rowLength,
  scheduleRows,
  visibleCharacters,
} from '../terminal/layout.ts'
import type { RowSchedule, SegmentKind, TerminalRow } from '../terminal/layout.ts'

export interface BubbleTextUniforms {
  [uniform: string]: THREE.IUniform
  uTextMap: THREE.IUniform<THREE.Texture>
  uTextCenter: THREE.IUniform<THREE.Vector2>
  uTextSize: THREE.IUniform<number>
  uTextIntensity: THREE.IUniform<number>
  uLens: THREE.IUniform<number>
  uWobble: THREE.IUniform<number>
  uRipple: THREE.IUniform<number>
  uLiquid: THREE.IUniform<number>
  uTime: THREE.IUniform<number>
}

type Mode = 'teaser' | 'profile'

const fontFamily: string = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"
const palette: Record<SegmentKind | 'cursor', string> = {
  prompt: '#7c7cff',
  command: '#c0c0ff',
  prefix: '#555555',
  output: '#888888',
  cursor: '#c0c0ff',
}
// share of the expanded bubble radius the text block may use; the rest fades out towards the rim
const usableRadius: number = 0.78
const maxColumns: number = 46
const typingSpeed: number = 55
const outputDelay: number = 0.07
// The scene bloom has no threshold and a wide blur that turns text rows into large glowing plates,
// so the text feeds it less and carries its own tight glow baked into the texture instead.
const intensity: number = 0.38
const glowPx: number = 5
const lens: number = 0.06
const ripple: number = 0.015
// sway of the text with the liquid: livelier on the small bubble, calm on the open profile so it reads well
const restWobble: number = 0.1
const expandedWobble: number = 0.04
// liquid amplitude is in shares of the text square (0.0025 is about 2px on a desktop)
const restLiquid: number = 0.0025
const expandedLiquid: number = 0.0008
// expansion progress at which the teaser is fully sunk and the profile takes its place
const swapPoint: number = 0.45
// the lens magnifies the text by up to ~20%, a 2x texture keeps the glyphs crisp under it
const supersample: number = 2

export class BubbleText {
  public readonly uniforms: BubbleTextUniforms
  // radius in CSS pixels the bubble needs on screen to show the whole profile
  public expandedRadius: number = 300

  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly texture: THREE.CanvasTexture
  private readonly reducedMotion: boolean
  private rows: TerminalRow[] = []
  private schedule: RowSchedule[] = []
  private viewportWidth: number = 0
  private viewportHeight: number = 0
  private pixelRatio: number = 1
  private fontPx: number = 14
  private charWidth: number = 8.4
  private lineHeight: number = 22
  private side: number = 0
  private mode: Mode = 'teaser'
  private typingStart: number = 0
  private signature: string = ''
  private disposed: boolean = false

  constructor() {
    this.canvas = document.createElement('canvas')
    const context: CanvasRenderingContext2D | null = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('2D canvas is not available')
    }
    this.context = context
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.generateMipmaps = false
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.uniforms = {
      uTextMap: { value: this.texture },
      uTextCenter: { value: new THREE.Vector2() },
      uTextSize: { value: 1 },
      uTextIntensity: { value: intensity },
      uLens: { value: lens },
      uWobble: { value: restWobble },
      uRipple: { value: ripple },
      uLiquid: { value: restLiquid },
      uTime: { value: 0 },
    }
    // canvas text is drawn with whatever font is available, so lay out again once the web font arrives
    document.fonts.load(`400 16px ${fontFamily}`).then((): void => {
      if (!this.disposed && this.viewportWidth > 0) {
        this.resize(this.viewportWidth, this.viewportHeight, this.pixelRatio)
      }
    })
  }

  public resize(width: number, height: number, pixelRatio: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
    this.pixelRatio = pixelRatio
    this.fontPx = THREE.MathUtils.clamp(Math.min(width, height) / 62, 12, 15)
    this.lineHeight = Math.round(this.fontPx * 1.6)
    this.context.font = `400 ${this.fontPx}px ${fontFamily}`
    this.charWidth = this.context.measureText('M').width
    const columns: number = Math.min(maxColumns, Math.floor((width - 48) / this.charWidth))
    this.rows = layoutProfile(profileSections, columns)
    this.schedule = scheduleRows(this.rows, typingSpeed, outputDelay)
    const blockWidth: number = longestRow(this.rows) * this.charWidth
    const blockHeight: number = this.rows.length * this.lineHeight
    this.expandedRadius = (0.5 * Math.hypot(blockWidth, blockHeight) + this.fontPx) / usableRadius
    // an even side keeps texels aligned with screen pixels around the integer bubble center
    this.side = Math.ceil(this.expandedRadius) * 2
    this.canvas.width = Math.ceil(this.side * pixelRatio * supersample)
    this.canvas.height = Math.ceil(this.side * pixelRatio * supersample)
    // the GPU texture is allocated with a fixed size, a new canvas size needs a fresh one
    this.texture.dispose()
    this.uniforms.uTextSize.value = this.side * pixelRatio
    this.signature = ''
  }

  // time is in seconds; center is the bubble center in drawing buffer pixels; progress is the bubble
  // expansion 0..1, so the text swap runs in step with the growth: the teaser sinks while the bubble
  // starts growing, the profile surfaces and gets typed while it finishes, and the reverse on collapse
  public update(time: number, center: THREE.Vector2, progress: number): void {
    this.uniforms.uTextCenter.value.set(Math.round(center.x), Math.round(center.y))
    this.uniforms.uTime.value = time
    const mode: Mode = progress < swapPoint ? 'teaser' : 'profile'
    if (mode !== this.mode) {
      this.mode = mode
      this.typingStart = time
    }
    const linearSink: number = progress < swapPoint ? progress / swapPoint : (1 - progress) / (1 - swapPoint)
    const sink: number = linearSink * linearSink * (3 - 2 * linearSink)
    // the text sinks into the liquid while it is swapped: stronger warp, fading glow
    this.uniforms.uTextIntensity.value = intensity * (1 - sink)
    const wobble: number = THREE.MathUtils.lerp(restWobble, expandedWobble, progress)
    const liquid: number = THREE.MathUtils.lerp(restLiquid, expandedLiquid, progress)
    this.uniforms.uLens.value = lens + sink * 0.2
    this.uniforms.uWobble.value = wobble + sink * 0.6
    this.uniforms.uLiquid.value = liquid + sink * restLiquid * 4
    this.draw(time)
  }

  public dispose(): void {
    this.disposed = true
    this.texture.dispose()
  }

  private draw(time: number): void {
    if (this.side === 0) {
      return
    }
    const blink: boolean = Math.floor(time * 2) % 2 === 0
    let signature: string
    let visible: number[] = []
    let cursorRow: number = -1
    if (this.mode === 'teaser') {
      signature = `teaser:${blink}`
    } else {
      const elapsed: number = this.reducedMotion ? Infinity : time - this.typingStart
      visible = this.rows.map((row: TerminalRow, index: number): number =>
        visibleCharacters(row, this.schedule[index], elapsed)
      )
      cursorRow = this.typingRow(visible)
      const typing: boolean = cursorRow < this.rows.length - 1
      signature = `profile:${visible.join(',')}:${cursorRow}:${typing || blink}`
    }
    signature += `:${this.side}:${this.fontPx}:${this.charWidth}`
    if (signature === this.signature) {
      return
    }
    this.signature = signature

    const context: CanvasRenderingContext2D = this.context
    const scale: number = this.pixelRatio * supersample
    context.setTransform(scale, 0, 0, scale, 0, 0)
    // opaque black adds nothing to the emissive term and keeps antialiased edges correct
    context.shadowBlur = 0
    context.fillStyle = '#000000'
    context.fillRect(0, 0, this.side, this.side)
    context.textBaseline = 'middle'
    context.shadowBlur = glowPx * scale

    if (this.mode === 'teaser') {
      this.drawTeaser(blink)
    } else {
      this.drawProfile(visible, cursorRow, cursorRow < this.rows.length - 1 || blink)
    }
    this.texture.needsUpdate = true
  }

  private drawTeaser(cursorVisible: boolean): void {
    const fontPx: number = this.fontPx * 1.35
    this.context.font = `400 ${fontPx}px ${fontFamily}`
    const charWidth: number = this.context.measureText('M').width
    const row: TerminalRow = commandRow(null)
    row.segments.push({ kind: 'command', text: 'profile' })
    const width: number = (rowLength(row) + 1) * charWidth
    const x: number = Math.round((this.side - width) / 2)
    const y: number = this.side / 2
    this.drawRow(row, rowLength(row), x, y, charWidth, fontPx, cursorVisible)
  }

  private drawProfile(visible: number[], cursorRow: number, cursorVisible: boolean): void {
    this.context.font = `400 ${this.fontPx}px ${fontFamily}`
    const blockWidth: number = longestRow(this.rows) * this.charWidth
    const blockHeight: number = this.rows.length * this.lineHeight
    const left: number = Math.round((this.side - blockWidth) / 2)
    const top: number = Math.round((this.side - blockHeight) / 2 + this.lineHeight / 2)
    this.rows.forEach((row: TerminalRow, index: number): void => {
      const x: number = left + row.indent * this.charWidth
      const y: number = top + index * this.lineHeight
      this.drawRow(row, visible[index], x, y, this.charWidth, this.fontPx, index === cursorRow && cursorVisible)
    })
  }

  private drawRow(
    row: TerminalRow,
    visible: number,
    x: number,
    y: number,
    charWidth: number,
    fontPx: number,
    cursor: boolean
  ): void {
    let remaining: number = visible
    let cursorX: number = x
    for (const segment of row.segments) {
      if (remaining <= 0) {
        break
      }
      const text: string = segment.text.slice(0, remaining)
      this.context.fillStyle = palette[segment.kind]
      this.context.shadowColor = palette[segment.kind]
      this.context.fillText(text, cursorX, y)
      cursorX += text.length * charWidth
      remaining -= text.length
    }
    if (cursor) {
      this.context.fillStyle = palette.cursor
      this.context.shadowColor = palette.cursor
      this.context.fillRect(cursorX + charWidth * 0.1, y - fontPx * 0.6, charWidth * 0.8, fontPx * 1.2)
    }
  }

  // the row the cursor sits on: the one being typed, or the final prompt once everything is shown
  private typingRow(visible: number[]): number {
    for (let index: number = 0; index < this.rows.length; index++) {
      if (visible[index] < rowLength(this.rows[index])) {
        return this.rows[index].typed ? index : Math.max(0, index - 1)
      }
    }
    return this.rows.length - 1
  }
}
