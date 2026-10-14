// @ts-check
// Minimal PNG encoder for the baked atlas: 8-bit grayscale or RGB, adaptive per-row filters, zlib level 9.
// Browsers can only export RGBA from a canvas, which for this gray atlas is several times larger.
import { crc32, deflateSync } from 'node:zlib'

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * @param {string} type
 * @param {Buffer} data
 * @returns {Buffer}
 */
function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

/**
 * @param {number} left
 * @param {number} up
 * @param {number} upLeft
 * @returns {number}
 */
function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft
  const toLeft = Math.abs(estimate - left)
  const toUp = Math.abs(estimate - up)
  const toUpLeft = Math.abs(estimate - upLeft)
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left
  }
  if (toUp <= toUpLeft) {
    return up
  }
  return upLeft
}

/**
 * Filters one scanline with every PNG filter and keeps the one with the smallest sum of signed bytes,
 * the usual heuristic for picking what deflate compresses best.
 * @param {Uint8Array} row
 * @param {Uint8Array} previous
 * @param {number} bytesPerPixel
 * @returns {Buffer}
 */
function filterRow(row, previous, bytesPerPixel) {
  /** @type {Buffer | null} */
  let best = null
  let bestScore = Infinity
  for (let filter = 0; filter < 5; filter++) {
    const out = Buffer.alloc(row.length + 1)
    out[0] = filter
    let score = 0
    for (let i = 0; i < row.length; i++) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0
      const up = previous[i]
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0
      /** @type {number} */
      let predicted
      if (filter === 0) {
        predicted = 0
      } else if (filter === 1) {
        predicted = left
      } else if (filter === 2) {
        predicted = up
      } else if (filter === 3) {
        predicted = (left + up) >> 1
      } else {
        predicted = paeth(left, up, upLeft)
      }
      const value = (row[i] - predicted) & 0xff
      out[i + 1] = value
      score += value < 128 ? value : 256 - value
    }
    if (score < bestScore) {
      bestScore = score
      best = out
    }
  }
  return /** @type {Buffer} */ (best)
}

/**
 * @param {Uint8Array} rgba RGBA8 pixels, top row first
 * @param {number} width
 * @param {number} height
 * @returns {Buffer}
 */
export function encodePng(rgba, width, height) {
  let gray = true
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] !== rgba[i + 1] || rgba[i] !== rgba[i + 2]) {
      gray = false
      break
    }
  }
  const bytesPerPixel = gray ? 1 : 3
  const rows = []
  let previous = new Uint8Array(width * bytesPerPixel)
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(width * bytesPerPixel)
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4
      for (let channel = 0; channel < bytesPerPixel; channel++) {
        row[x * bytesPerPixel + channel] = rgba[source + channel]
      }
    }
    rows.push(filterRow(row, previous, bytesPerPixel))
    previous = row
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = gray ? 0 : 2
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
