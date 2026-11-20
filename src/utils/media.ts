import type { BackgroundSettings, FrameProject, MediaLayer } from '../types'

const DB_NAME = 'circle-frame-studio-media'
const DB_VERSION = 1
const STORE = 'assets'

interface StoredAsset {
  id: string
  name: string
  type: string
  blob: Blob
  savedAt: number
}

const urlCache = new Map<string, string>()
const imageCache = new Map<string, HTMLImageElement>()
const videoCache = new Map<string, HTMLVideoElement>()
const missingAssets = new Set<string>()
let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('미디어 저장소를 열지 못했습니다.'))
  })
  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('미디어 저장소 요청 실패'))
  })
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('미디어 저장 실패'))
    tx.onabort = () => reject(tx.error ?? new Error('미디어 저장 취소'))
  })
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? 'media-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

export async function storeMediaFile(file: File, reuseId?: string) {
  const id = reuseId || makeId()
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const record: StoredAsset = { id, name: file.name, type: file.type, blob: file, savedAt: Date.now() }
  tx.objectStore(STORE).put(record)
  await txDone(tx)

  const old = urlCache.get(id)
  if (old) URL.revokeObjectURL(old)
  const url = URL.createObjectURL(file)
  urlCache.set(id, url)
  missingAssets.delete(id)
  imageCache.delete(id)
  videoCache.delete(id)
  return { id, url, name: file.name, type: file.type }
}

export async function getStoredMediaUrl(assetId: string) {
  if (!assetId) return ''
  const cached = urlCache.get(assetId)
  if (cached) return cached
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const record = await requestResult(tx.objectStore(STORE).get(assetId)) as StoredAsset | undefined
    if (!record?.blob) {
      missingAssets.add(assetId)
      return ''
    }
    const url = URL.createObjectURL(record.blob)
    urlCache.set(assetId, url)
    missingAssets.delete(assetId)
    return url
  } catch {
    missingAssets.add(assetId)
    return ''
  }
}

export function isMediaMissing(assetId: string) {
  return !!assetId && missingAssets.has(assetId)
}

function sourceKey(assetId: string, sourceUrl: string) {
  return assetId || sourceUrl
}

async function ensureImage(assetId: string, sourceUrl: string) {
  const key = sourceKey(assetId, sourceUrl)
  if (!key) return undefined
  const cached = imageCache.get(key)
  if (cached) return cached
  const url = sourceUrl || await getStoredMediaUrl(assetId)
  if (!url) return undefined
  const image = new Image()
  image.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('이미지 원본을 불러오지 못했습니다.'))
    image.src = url
  })
  imageCache.set(key, image)
  return image
}

async function ensureVideo(assetId: string, sourceUrl: string) {
  const key = sourceKey(assetId, sourceUrl)
  if (!key) return undefined
  const cached = videoCache.get(key)
  if (cached) return cached
  const url = sourceUrl || await getStoredMediaUrl(assetId)
  if (!url) return undefined

  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      cleanup()
      resolve()
    }
    const fail = () => {
      cleanup()
      reject(new Error('영상 원본을 불러오지 못했습니다.'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', ready)
      video.removeEventListener('error', fail)
    }
    video.addEventListener('loadeddata', ready)
    video.addEventListener('error', fail)
    video.load()
  })
  videoCache.set(key, video)
  return video
}

export async function preloadMediaLayer(layer: MediaLayer) {
  if (!layer.visible) return
  try {
    if (layer.kind === 'video') await ensureVideo(layer.assetId, layer.sourceUrl)
    else await ensureImage(layer.assetId, layer.sourceUrl)
  } catch {
    if (layer.assetId) missingAssets.add(layer.assetId)
  }
}

async function preloadBackground(background?: BackgroundSettings) {
  if (!background || !['image','video'].includes(background.type)) return
  try {
    if (background.type === 'video') await ensureVideo(background.assetId, background.sourceUrl)
    else await ensureImage(background.assetId, background.sourceUrl)
  } catch {
    if (background.assetId) missingAssets.add(background.assetId)
  }
}

export async function preloadProjectMedia(project: FrameProject) {
  await Promise.all([
    ...(project.mediaLayers ?? []).map(preloadMediaLayer),
    preloadBackground(project.background),
  ])
}

export function getMediaElement(layer: MediaLayer) {
  const key = sourceKey(layer.assetId, layer.sourceUrl)
  return layer.kind === 'video' ? videoCache.get(key) : imageCache.get(key)
}

export function getBackgroundElement(background?: BackgroundSettings) {
  if (!background) return undefined
  const key = sourceKey(background.assetId, background.sourceUrl)
  return background.type === 'video' ? videoCache.get(key) : imageCache.get(key)
}

function targetVideoTime(layer: MediaLayer, sceneTimeSec: number, duration: number) {
  const local = Math.max(0, sceneTimeSec - layer.startTime)
  const start = Math.max(0, Math.min(duration - .001, layer.trimStart || 0))
  const requestedEnd = layer.trimEnd && layer.trimEnd > start ? Math.min(duration, layer.trimEnd) : duration
  const usable = Math.max(.01, requestedEnd - start)
  return Math.min(requestedEnd - .001, start + (local % usable))
}

export function syncProjectMediaPreview(project: FrameProject, sceneTimeSec: number, playing: boolean) {
  for (const layer of project.mediaLayers ?? []) {
    if (layer.kind !== 'video') continue
    const video = getMediaElement(layer)
    if (!(video instanceof HTMLVideoElement) || !Number.isFinite(video.duration) || video.duration <= 0) continue
    const target = targetVideoTime(layer, sceneTimeSec, video.duration)
    if (playing) {
      if (Math.abs(video.currentTime - target) > .45) {
        try { video.currentTime = target } catch { /* ignore */ }
      }
      if (video.paused) void video.play().catch(() => {})
    } else {
      video.pause()
      if (Math.abs(video.currentTime - target) > .035) {
        try { video.currentTime = target } catch { /* ignore */ }
      }
    }
  }

  const background = project.background
  if (background?.type === 'video') {
    const video = getBackgroundElement(background)
    if (video instanceof HTMLVideoElement && Number.isFinite(video.duration) && video.duration > 0) {
      const target = sceneTimeSec % video.duration
      if (playing) {
        if (Math.abs(video.currentTime - target) > .45) {
          try { video.currentTime = target } catch { /* ignore */ }
        }
        if (video.paused) void video.play().catch(() => {})
      } else {
        video.pause()
        if (Math.abs(video.currentTime - target) > .035) {
          try { video.currentTime = target } catch { /* ignore */ }
        }
      }
    }
  }
}

function seekVideo(video: HTMLVideoElement, target: number) {
  if (!Number.isFinite(target) || Math.abs(video.currentTime - target) < .01) return Promise.resolve()
  return new Promise<void>(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      video.removeEventListener('seeked', finish)
      clearTimeout(timeout)
      resolve()
    }
    const timeout = window.setTimeout(finish, 800)
    video.addEventListener('seeked', finish, { once: true })
    try { video.currentTime = Math.max(0, Math.min(video.duration || target, target)) } catch { finish() }
  })
}

export async function seekProjectMedia(project: FrameProject, sceneTimeSec: number) {
  const jobs: Promise<void>[] = []
  for (const layer of project.mediaLayers ?? []) {
    if (layer.kind !== 'video') continue
    const video = getMediaElement(layer)
    if (video instanceof HTMLVideoElement && Number.isFinite(video.duration) && video.duration > 0) {
      video.pause()
      jobs.push(seekVideo(video, targetVideoTime(layer, sceneTimeSec, video.duration)))
    }
  }
  const background = project.background
  if (background?.type === 'video') {
    const video = getBackgroundElement(background)
    if (video instanceof HTMLVideoElement && Number.isFinite(video.duration) && video.duration > 0) {
      video.pause()
      jobs.push(seekVideo(video, sceneTimeSec % video.duration))
    }
  }
  await Promise.all(jobs)
}
