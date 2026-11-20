import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from './assets'
import { preloadProjectMedia, seekProjectMedia } from './media'
import { createProjectAudioMix } from './audio'
import { encodePngMov } from './mov'

export type AnimatedExportFormat = 'gif' | 'webp' | 'apng' | 'webm' | 'mp4' | 'mov'
export type AnimatedLoopCount = 0 | 1 | 2

export interface AnimatedExportOptions {
  format: AnimatedExportFormat
  resolution: 500 | 1000 | 2000
  fps: 12 | 15 | 20 | 24 | 30 | 60
  duration: number
  loopCount: AnimatedLoopCount
  webpQuality: number
  videoBitrateMbps?: number
  includeAudio?: boolean
}

export interface AnimatedExportProgress {
  stage: 'render' | 'encode' | 'done'
  current: number
  total: number
  message: string
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('내보내기가 취소되었습니다.', 'AbortError')
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

export function isVideoFormatSupported(format: 'webm' | 'mp4') {
  if (typeof VideoEncoder !== 'undefined') return true
  if (typeof MediaRecorder === 'undefined') return false
  const mime = format === 'mp4'
    ? 'video/mp4;codecs=avc1.42E01E'
    : 'video/webm;codecs=vp9'
  return MediaRecorder.isTypeSupported(mime)
}

function assertMemoryBudget(options: AnimatedExportOptions) {
  const rawBytes = estimateAnimatedRawMemory(options)
  if (!['gif','webm','mp4','mov'].includes(options.format) && rawBytes > 320 * 1024 * 1024) {
    throw new Error('이 설정은 브라우저 메모리를 너무 많이 사용합니다. 2000px에서는 FPS 또는 길이를 낮추거나 GIF/영상 출력을 선택해 주세요.')
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

async function prepareProject(project: FrameProject) {
  await Promise.all([preloadProjectAssets(project), preloadProjectMedia(project)])
}

async function renderTimedFrame(canvas: HTMLCanvasElement, project: FrameProject, progress: number, duration: number) {
  const sceneTime = progress * duration
  await seekProjectMedia(project, sceneTime)
  renderProject(canvas, project, undefined, sceneTime * 1000, progress)
}

async function exportGif(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
  signal?: AbortSignal,
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
    throwIfAborted(signal)
    const progress = i / frameCount
    await renderTimedFrame(canvas, project, progress, options.duration)
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
    if (i % 2 === 1) await new Promise(resolve => setTimeout(resolve, 0))
  }

  throwIfAborted(signal)
  onProgress?.({ stage: 'encode', current: frameCount, total: frameCount, message: 'GIF 파일 마무리 중' })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

async function collectFrames(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
  signal?: AbortSignal,
) {
  assertMemoryBudget(options)
  const canvas = makeAnimationCanvas(options.resolution)
  const frameCount = getAnimatedFrameCount(options)
  const frames: Uint8Array[] = []

  for (let i = 0; i < frameCount; i++) {
    throwIfAborted(signal)
    await renderTimedFrame(canvas, project, i / frameCount, options.duration)
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
  signal?: AbortSignal,
) {
  const frames = await collectFrames(project, options, onProgress, signal)
  throwIfAborted(signal)
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
  signal?: AbortSignal,
) {
  const frames = await collectFrames(project, options, onProgress, signal)
  throwIfAborted(signal)
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

async function exportAlphaMov(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
  signal?: AbortSignal,
) {
  const rawBytes = estimateAnimatedRawMemory(options)
  if (rawBytes > 1.6 * 1024 * 1024 * 1024) {
    throw new Error('알파 MOV 설정이 브라우저 메모리 한계를 넘을 가능성이 큽니다. 해상도·FPS·길이를 낮춰 주세요.')
  }
  const canvas = makeAnimationCanvas(options.resolution)
  const frameCount = getAnimatedFrameCount(options)
  const frames: Blob[] = []

  for (let i = 0; i < frameCount; i++) {
    throwIfAborted(signal)
    const progress = i / frameCount
    await renderTimedFrame(canvas, project, progress, options.duration)
    frames.push(await canvasToBlob(canvas, 'image/png'))
    onProgress?.({
      stage: 'render',
      current: i + 1,
      total: frameCount,
      message: '알파 MOV PNG 프레임 ' + (i + 1) + ' / ' + frameCount + ' 생성 중',
    })
    if (i % 2 === 1) await new Promise(resolve => setTimeout(resolve, 0))
  }

  throwIfAborted(signal)
  onProgress?.({ stage: 'encode', current: 0, total: 1, message: 'QuickTime MOV 컨테이너 작성 중' })
  return encodePngMov(frames, options.resolution, options.resolution, options.fps)
}

async function exportDeterministicVideo(
  project: FrameProject,
  options: AnimatedExportOptions,
  format: 'mp4' | 'webm',
  onProgress?: (progress: AnimatedExportProgress) => void,
  signal?: AbortSignal,
) {
  if (typeof VideoEncoder === 'undefined') throw new Error('이 브라우저는 WebCodecs VideoEncoder를 지원하지 않습니다.')
  const mod = await import('mediabunny')
  const canvas = makeAnimationCanvas(options.resolution)
  const fps = Math.max(1, options.fps)
  const frameCount = Math.max(2, Math.round(options.duration * fps))
  const bitrate = Math.max(2, Math.min(80, options.videoBitrateMbps ?? (options.resolution >= 2000 ? 28 : 12))) * 1_000_000
  const target = new mod.BufferTarget()
  const output = new mod.Output({
    format: format === 'mp4'
      ? new mod.Mp4OutputFormat({ fastStart: 'in-memory' })
      : new mod.WebMOutputFormat(),
    target,
  })
  const source = new mod.CanvasSource(canvas, format === 'mp4'
    ? { codec: 'avc', quality: new mod.Quality({ bitrate }) }
    : { codec: 'vp9', quality: new mod.Quality({ bitrate }), alpha: 'keep' })
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()

  try {
    for (let i = 0; i < frameCount; i++) {
      throwIfAborted(signal)
      const timestamp = i / fps
      const progress = i / frameCount
      await renderTimedFrame(canvas, project, progress, options.duration)
      await source.add(timestamp, 1 / fps, { keyFrame: i === 0 || i % Math.max(1, Math.round(fps * 2)) === 0 })
      onProgress?.({
        stage: 'render',
        current: i + 1,
        total: frameCount,
        message: (format === 'mp4' ? 'MP4' : 'WebM') + ' 정확한 프레임 ' + (i + 1) + ' / ' + frameCount + ' 인코딩 중',
      })
    }
    throwIfAborted(signal)
    onProgress?.({ stage: 'encode', current: 0, total: 1, message: '영상 컨테이너 최종 정리 중' })
    await output.finalize()
  } catch (error) {
    await output.cancel().catch(() => {})
    throw error
  }

  if (!target.buffer) throw new Error('영상 파일 버퍼를 생성하지 못했습니다.')
  return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' })
}

async function exportCanvasVideo(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
  signal?: AbortSignal,
) {
  const format = options.format === 'mp4' ? 'mp4' : 'webm'
  if (!isVideoFormatSupported(format)) {
    throw new Error(format === 'mp4'
      ? '현재 브라우저는 MP4 MediaRecorder 인코딩을 지원하지 않습니다. WebM 또는 APNG/Animated WebP를 사용해 주세요.'
      : '현재 브라우저는 VP9 WebM 인코딩을 지원하지 않습니다.')
  }
  const canvas = makeAnimationCanvas(options.resolution)
  const fps = options.fps >= 60 ? 60 : Math.max(12, options.fps)
  const capture = canvas.captureStream(0)
  const track = capture.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
  const audioMix = options.includeAudio === false ? null : await createProjectAudioMix(project, options.duration)
  if (audioMix?.warnings.length) console.warn('오디오 믹싱 경고:', audioMix.warnings)
  const combinedStream = new MediaStream([
    ...capture.getVideoTracks(),
    ...(audioMix?.stream.getAudioTracks() ?? []),
  ])
  const mimeType = format === 'mp4' ? 'video/mp4;codecs=avc1.42E01E' : 'video/webm;codecs=vp9'
  const bitrate = Math.max(2, Math.min(80, options.videoBitrateMbps ?? (options.resolution >= 2000 ? 28 : 12))) * 1_000_000
  const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: bitrate })
  const chunks: Blob[] = []

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onerror = () => reject(recorder.error ?? new Error('영상 인코딩 오류'))
    recorder.onstop = () => resolve()
  })

  recorder.start()
  await audioMix?.start()
  const frameCount = Math.max(2, Math.round(options.duration * fps))
  const frameDelay = 1000 / fps

  for (let i = 0; i < frameCount; i++) {
    throwIfAborted(signal)
    const progress = i / frameCount
    await renderTimedFrame(canvas, project, progress, options.duration)
    track.requestFrame?.()
    onProgress?.({
      stage: 'render',
      current: i + 1,
      total: frameCount,
      message: (format === 'mp4' ? 'MP4' : 'WebM') + ' 프레임 ' + (i + 1) + ' / ' + frameCount + ' 기록 중',
    })
    await new Promise(resolve => setTimeout(resolve, frameDelay))
  }

  throwIfAborted(signal)
  recorder.stop()
  await stopped
  capture.getTracks().forEach(item => item.stop())
  audioMix?.stop()
  return new Blob(chunks, { type: mimeType })
}

export async function exportPng(project: FrameProject, sceneTimeSec = 0, resolution = 2000) {
  const size = Math.max(256, Math.min(4096, Math.round(resolution)))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  await prepareProject(project)
  await seekProjectMedia(project, sceneTimeSec)
  const duration = Math.max(.5, project.timeline?.duration ?? 3)
  const progress = ((sceneTimeSec % duration) + duration) % duration / duration
  renderProject(canvas, project, undefined, sceneTimeSec * 1000, progress)
  const blob = await canvasToBlob(canvas, 'image/png')
  downloadBlob(blob, 'circle-frame-v032-' + size + 'px-' + exportDate() + '.png')
}

export async function exportAnimatedFrame(
  project: FrameProject,
  options: AnimatedExportOptions,
  onProgress?: (progress: AnimatedExportProgress) => void,
  signal?: AbortSignal,
) {
  await prepareProject(project)
  let blob: Blob
  if (options.format === 'gif') blob = await exportGif(project, options, onProgress, signal)
  else if (options.format === 'apng') blob = await exportApng(project, options, onProgress, signal)
  else if (options.format === 'webp') blob = await exportAnimatedWebp(project, options, onProgress, signal)
  else if (options.format === 'mov') blob = await exportAlphaMov(project, options, onProgress, signal)
  else {
    const hasEnabledAudio = options.includeAudio !== false && (project.mediaLayers ?? []).some(layer =>
      layer.visible && layer.kind === 'video' && layer.audioEnabled && layer.audioVolume > 0
    )
    if (!hasEnabledAudio && typeof VideoEncoder !== 'undefined') {
      blob = await exportDeterministicVideo(project, options, options.format as 'mp4' | 'webm', onProgress, signal)
    } else {
      blob = await exportCanvasVideo(project, options, onProgress, signal)
    }
  }

  throwIfAborted(signal)
  const ext = options.format === 'apng' ? 'png' : options.format
  const label = options.format === 'apng' ? 'apng' : options.format
  downloadBlob(blob, 'circle-frame-v032-' + label + '-' + options.resolution + 'px-' + exportDate() + '.' + ext)
  onProgress?.({ stage: 'done', current: 1, total: 1, message: '저장이 완료되었습니다.' })
  return blob
}

export function downloadProject(project: FrameProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  downloadBlob(blob, 'circle-frame-project-v032.json')
}
