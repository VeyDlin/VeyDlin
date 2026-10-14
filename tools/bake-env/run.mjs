// @ts-check
// Bakes the prefiltered environment atlas into public/env-cubeuv.png.
// three compiles a heavy blur shader the first time it prefilters a cube map, which stalls the first visit
// for over half a second, so the site loads this precomputed result instead.
// Re-run after updating three: `yarn bake:env`. Needs a local Chrome, or BAKE_BROWSER_PATH pointing to one.
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer } from 'vite'

import { encodePng } from './png.mjs'

/** @type {string} */
const root = fileURLToPath(new URL('../..', import.meta.url))
/** @type {string} */
const output = fileURLToPath(new URL('../../public/env-cubeuv.png', import.meta.url))
/** @type {string | undefined} */
const browserPath = process.env.BAKE_BROWSER_PATH

const server = await createServer({ root, logLevel: 'error', server: { port: 0, strictPort: false } })
await server.listen()
/** @type {string} */
const baseUrl = server.resolvedUrls?.local[0] ?? ''
const browser = await chromium.launch({
  channel: browserPath ? undefined : 'chrome',
  executablePath: browserPath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist'],
})

try {
  const page = await browser.newPage()
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[browser] ${message.text()}`)
    }
  })
  await page.goto(`${baseUrl}tools/bake-env/`)
  await page.waitForFunction(() => window.bakeResult !== undefined || window.bakeError !== undefined, null, {
    timeout: 60000,
  })
  /** @type {{ result?: import('./bake.ts').BakeResult, error?: string }} */
  const outcome = await page.evaluate(() => ({ result: window.bakeResult, error: window.bakeError }))
  if (!outcome.result) {
    throw new Error(`Bake failed in the browser:\n${outcome.error}`)
  }
  const { pixels, width, height, revision } = outcome.result
  const bottomUp = Buffer.from(pixels, 'base64')
  // WebGL reads the bottom row first, PNG stores the top row first
  const topDown = new Uint8Array(bottomUp.length)
  const stride = width * 4
  for (let y = 0; y < height; y++) {
    topDown.set(bottomUp.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride)
  }
  const png = encodePng(topDown, width, height)
  await writeFile(output, png)
  console.log(
    `Baked ${width}x${height} environment atlas with three r${revision} into public/env-cubeuv.png ` +
      `(${Math.round(png.length / 1024)} KB)`
  )
} finally {
  await browser.close()
  await server.close()
}
