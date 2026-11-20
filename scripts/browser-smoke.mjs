// Browser-level smoke test for the v0.36 rendering/export path.
// Run after `npm run build` with Playwright/Chromium installed.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  env: process.env,
  stdio: 'ignore',
})
let browser
const appUrl = 'http://127.0.0.1:4173'

async function ensureServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw Error('Vite preview exited before ready')
    try { if ((await fetch(appUrl)).ok) return } catch {}
    await sleep(500)
  }
  throw Error('Preview server did not become ready')
}

try {
  await ensureServer()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Circle Frame Studio' }).waitFor()
  // Force the Canvas2D preview for direct pixel inspection: the automatic
  // WebGL2 path intentionally leaves its hidden 2D canvas empty.
  await page.locator('.canvas-view-controls select').last().selectOption('quality')
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas.preview-canvas')
    return c && c.width > 0 && c.height > 0
  })
  await sleep(900)
  const hasPixels = await page.locator('canvas.preview-canvas').first().evaluate(canvas => {
    const c = canvas
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true
    return false
  })
  if (!hasPixels) throw Error('Initial preview rendered as an empty canvas')
  mkdirSync('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/v036-editor-preview.png' })

  // Exercise actual PNG export and verify the binary header and selected size.
  await page.locator('select.top-export-resolution').selectOption('500')
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: '전체 PNG' }).click(),
  ])
  const png = readFileSync(await pngDownload.path())
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Export did not produce a PNG')
  if (png.readUInt32BE(16) !== 500 || png.readUInt32BE(20) !== 500) {
    throw Error('PNG size differs from selected 500×500 output')
  }

  // Exercise the live animation preview and a short transparent Animated WebP.
  await page.getByRole('button', { name: '움직이는 파일' }).click()
  await page.getByRole('dialog', { name: '움직이는 파일 내보내기' }).waitFor()
  await page.locator('.animated-export-controls select').nth(1).selectOption('500')
  await page.locator('.animated-export-controls select').nth(2).selectOption('12')
  await page.locator('.animated-export-controls input[type="number"]').first().fill('0.5')
  const [webpDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    page.getByRole('button', { name: 'Animated WebP로 저장' }).click(),
  ])
  const webp = readFileSync(await webpDownload.path())
  if (webp.subarray(0, 4).toString() !== 'RIFF' || webp.subarray(8, 12).toString() !== 'WEBP') {
    throw Error('Animated output did not produce valid WebP signature')
  }
  if (webp.length < 500) throw Error('Animated WebP output is unexpectedly small')
  if (pageErrors.length) throw Error('Browser exceptions: ' + pageErrors.join(' | '))
  await context.close()
  process.stdout.write('Browser smoke PASS: preview, 500px PNG, animated WebP.\n')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
