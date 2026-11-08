import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from './assets'

export type AnimatedExportFormat = 'gif' | 'webp' | 'apng'
export type AnimatedLoopCount = 0 | 1 | 2

export interface AnimatedExportOptions {
  format: AnimatedExportFormat
  resolution: 500 | 1000 | 2000
  fps: 12 | 15 | 20 | 24 | 30
  duration: 1 | 1.5 | 2 | 2.4 | 3 | 4
  loopCount: AnimatedLoopCount
  webpQuality: number
}

export interface AnimatedExportProgress {
  stage: 'render' | 'encode' | 'done'
  current: number
  total: number
  message: string
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 생성에 실패했습니다.')), type, quality)
  })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function exportDate() {
  return new Date().toISOString().slice(0, 10)
}

export function getAnimatedFrameCount(options: AnimatedExportOptions) {
  return Math.max(2, Math.round(options.fps * options.duration))
}

export function estimateAnimatedRawMemory(options: AnimatedExportOptions) {
  return options.resolution * options.resolution * 4 * getAnimatedFrameCount(options)
}

function assertMemoryBudget(options: AnimatedExportOptions) {
  const rawBytes = estimateAnimatedRawMemory(options)
  if (options.format !== 'gif' && rawBytes > 320 * 1024 * 1024) {
    throw new Error('이 설정은 브라우저 메모리를 너무 많이 사용합니다. 2000px에서는 FPS 또는 길이를 낮추거나 GIF를 선택해 주세요.')
  }
}

function makeAnimationCanvas(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

function frameImage(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D를 사용할 수 없습니다.')
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

async function exportGif(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
) {
  const mod = await import('gifenc')
  const GIFEncoder = mod.GIFEncoder
  const quantize = mod.quantize
  const applyPalette = mod.applyPalette
  const canvas = makeAnimationCanvas(options.resolution)
  const frameCount = getAnimatedFrameCount(options)
  const delay = Math.max(20, Math.round(1000 / options.fps))
  const gif = GIFEncoder()
  const repeat = options.loopCount === 0 ? 0 : options.loopCount === 1 ? -1 : 1

  for (let i = 0; i < frameCount; i++) {
    renderProject(canvas, project, undefined, 0, i / frameCount)
    const image = frameImage(canvas)
    const palette = quantize(image.data, 256, { format: 'rgba4444', oneBitAlpha: 127 })
    const index = applyPalette(image.data, palette, 'rgba4444')
    const transparentIndex = palette.findIndex((color: number[]) => color.length > 3 && color[3] === 0)

    gif.writeFrame(index, canvas.width, canvas.height, {
      palette,
      delay,
      repeat,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      dispose: 2,
    })

    onProgress?.({
      stage: 'render',
      current: i + 1,
      total: frameCount,
      message: 'GIF 프레임 ' + (i + 1) + ' / ' + frameCount + ' 인코딩 중',
    })
    if (i % 3 === 2) await new Promise(resolve => setTimeout(resolve, 0))
  }

  onProgress?.({ stage: 'encode', current: frameCount, total: frameCount, message: 'GIF 파일 마무리 중' })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

async function collectFrames(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
) {
  assertMemoryBudget(options)
  const canvas = makeAnimationCanvas(options.resolution)
  const frameCount = getAnimatedFrameCount(options)
  const frames: Uint8Array[] = []

  for (let i = 0; i < frameCount; i++) {
    renderProject(canvas, project, undefined, 0, i / frameCount)
    const image = frameImage(canvas)
    frames.push(new Uint8Array(image.data))
    onProgress?.({
      stage: 'render',
      current: i + 1,
      total: frameCount,
      message: '투명 프레임 ' + (i + 1) + ' / ' + frameCount + ' 생성 중',
    })
    if (i % 2 === 1) await new Promise(resolve => setTimeout(resolve, 0))
  }
  return frames
}

async function exportApng(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
) {
  const frames = await collectFrames(project, options, onProgress)
  onProgress?.({ stage: 'encode', current: 0, total: 1, message: 'APNG 압축 중 · 투명 글로우 무손실 유지' })
  const mod = await import('@upng/upng-js')
  const UPNG = mod.default
  const delay = Math.max(20, Math.round(1000 / options.fps))
  const buffers = frames.map(frame => frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength) as ArrayBuffer)
  const png = UPNG.encode(buffers, options.resolution, options.resolution, 0, Array(frames.length).fill(delay))
  return new Blob([png], { type: 'image/png' })
}

async function exportAnimatedWebp(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
) {
  const frames = await collectFrames(project, options, onProgress)
  onProgress?.({ stage: 'encode', current: 0, total: 1, message: 'Animated WebP 압축 중' })
  const mod = await import('wasm-webp')
  const delay = Math.max(20, Math.round(1000 / options.fps))
  const result = await mod.encodeAnimation(options.resolution, options.resolution, true, frames.map(frame => ({
    data: frame,
    duration: delay,
    config: { lossless: 0, quality: Math.max(1, Math.min(100, options.webpQuality)) },
  })))
  if (!result) throw new Error('Animated WebP 인코딩에 실패했습니다.')
  return new Blob([result], { type: 'image/webp' })
}

export async function exportPng(project: FrameProject) {
  const canvas = document.createElement('canvas')
  canvas.width = 2000
  canvas.height = 2000
  await preloadProjectAssets(project)
  renderProject(canvas, project, undefined, performance.now())
  const blob = await canvasToBlob(canvas, 'image/png')
  downloadBlob(blob, 'circle-frame-v030-' + exportDate() + '.png')
}

export async function exportAnimatedFrame(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
) {
  await preloadProjectAssets(project)
  let blob: Blob
  if (options.format === 'gif') blob = await exportGif(project, options, onProgress)
  else if (options.format === 'apng') blob = await exportApng(project, options, onProgress)
  else blob = await exportAnimatedWebp(project, options, onProgress)

  const ext = options.format === 'apng' ? 'png' : options.format
  const label = options.format === 'apng' ? 'apng' : options.format
  downloadBlob(blob, 'circle-frame-v030-' + label + '-' + options.resolution + 'px-' + exportDate() + '.' + ext)
  onProgress?.({ stage: 'done', current: 1, total: 1, message: '저장이 완료되었습니다.' })
  return blob
}

export function downloadProject(project: FrameProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  downloadBlob(blob, 'circle-frame-project-v030.json')
}
