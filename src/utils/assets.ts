import type { FrameProject } from '../types'

const loaded = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<HTMLImageElement>>()
const tinted = new Map<string, HTMLCanvasElement>()

export function getCachedImage(url: string) {
  return loaded.get(url)
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  if (!url) return Promise.reject(new Error('empty url'))
  const ready = loaded.get(url)
  if (ready) return Promise.resolve(ready)
  const wait = pending.get(url)
  if (wait) return wait
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      loaded.set(url, img)
      pending.delete(url)
      resolve(img)
    }
    img.onerror = (err) => {
      pending.delete(url)
      reject(err)
    }
    img.src = url
  })
  pending.set(url, promise)
  return promise
}

export function getTintedImage(url: string, color: string) {
  const img = loaded.get(url)
  if (!img) return undefined
  const key = `${url}|${color}`
  const cached = tinted.get(key)
  if (cached) return cached

  const maxSide = 512
  const ratio = Math.min(1, maxSide / Math.max(1, img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * ratio))
  canvas.height = Math.max(1, Math.round(img.height * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
  tinted.set(key, canvas)
  return canvas
}

export async function preloadProjectAssets(project: FrameProject) {
  const url = project.design.pattern.customAssetUrl
  if (!url) return
  await Promise.allSettled([loadImage(url)])
}
