import type { FrameProject } from '../types'

const loaded = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<HTMLImageElement>>()

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

export async function preloadProjectAssets(project: FrameProject) {
  const urls = Array.from(new Set(project.layers.map(layer => layer.pattern.customAssetUrl).filter(Boolean)))
  await Promise.allSettled(urls.map(loadImage))
}
