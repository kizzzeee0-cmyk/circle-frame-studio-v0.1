import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { FrameProject } from '../types'
import { getStoredMediaBlob, storeMediaFile } from './media'

interface BundleAsset {
  id: string
  name: string
  type: string
  path: string
}

interface BundleManifest {
  format: 'circle-frame-studio-bundle'
  version: 1
  appVersion: '0.34'
  createdAt: string
  assets: BundleAsset[]
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'asset'
}

function extension(name: string, type: string) {
  const dot = name.lastIndexOf('.')
  if (dot >= 0 && name.length - dot <= 9) return name.slice(dot).toLowerCase()
  if (type === 'image/png') return '.png'
  if (type === 'image/jpeg') return '.jpg'
  if (type === 'image/webp') return '.webp'
  if (type === 'video/mp4') return '.mp4'
  if (type === 'video/webm') return '.webm'
  if (type === 'video/quicktime') return '.mov'
  return '.bin'
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function referencedAssetIds(project: FrameProject) {
  const ids = new Map<string, { name: string; type: string }>()
  for (const layer of project.mediaLayers ?? []) {
    if (layer.assetId) ids.set(layer.assetId, { name: layer.fileName || 'media', type: layer.mimeType || '' })
    if (layer.customMaskAssetId) {
      ids.set(layer.customMaskAssetId, { name: layer.customMaskFileName || 'mask.png', type: 'image/png' })
    }
  }
  const background = project.background
  if (background?.assetId) ids.set(background.assetId, { name: background.fileName || 'background', type: background.mimeType || '' })
  return ids
}

function portableSnapshot(project: FrameProject) {
  const snapshot = structuredClone(project)
  for (const layer of snapshot.mediaLayers ?? []) {
    if (layer.assetId) layer.sourceUrl = ''
    if (layer.customMaskAssetId) layer.customMaskSourceUrl = ''
  }
  if (snapshot.background?.assetId) snapshot.background.sourceUrl = ''
  return snapshot
}

export async function exportPortableProject(project: FrameProject) {
  const refs = referencedAssetIds(project)
  const files: Record<string, Uint8Array> = {}
  const assets: BundleAsset[] = []
  let total = 0

  for (const [id, meta] of refs) {
    const blob = await getStoredMediaBlob(id)
    if (!blob) throw new Error('프로젝트 원본 미디어를 찾지 못했습니다: ' + meta.name)
    total += blob.size
    if (total > 850 * 1024 * 1024) {
      throw new Error('휴대용 프로젝트의 미디어가 850MB를 초과합니다. 일부 대용량 영상을 줄인 뒤 다시 저장해 주세요.')
    }
    const ext = extension(meta.name, blob.type || meta.type)
    const path = 'assets/' + safeName(id) + ext
    files[path] = new Uint8Array(await blob.arrayBuffer())
    assets.push({ id, name: meta.name, type: blob.type || meta.type || 'application/octet-stream', path })
  }

  const manifest: BundleManifest = {
    format: 'circle-frame-studio-bundle',
    version: 1,
    appVersion: '0.34',
    createdAt: new Date().toISOString(),
    assets,
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  files['project.json'] = strToU8(JSON.stringify(portableSnapshot(project), null, 2))

  const zipped = zipSync(files, { level: 0 })
  const blob = new Blob([zipped], { type: 'application/zip' })
  downloadBlob(blob, 'circle-frame-project-v034.cfszip')
  return { assetCount: assets.length, size: blob.size }
}

export async function importPortableProject(file: File) {
  if (file.size > 950 * 1024 * 1024) {
    throw new Error('프로젝트 패키지가 950MB를 초과하여 브라우저에서 안전하게 불러오기 어렵습니다.')
  }
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const manifestBytes = entries['manifest.json']
  const projectBytes = entries['project.json']
  if (!manifestBytes || !projectBytes) throw new Error('Circle Frame Studio 프로젝트 패키지가 아닙니다.')

  const manifest = JSON.parse(strFromU8(manifestBytes)) as BundleManifest
  if (manifest.format !== 'circle-frame-studio-bundle' || manifest.version !== 1) {
    throw new Error('지원하지 않는 프로젝트 패키지 버전입니다.')
  }

  const restoredUrls = new Map<string, string>()
  for (const asset of manifest.assets) {
    const bytes = entries[asset.path]
    if (!bytes) throw new Error('패키지 내부 미디어가 누락되었습니다: ' + asset.name)
    const blob = new Blob([bytes], { type: asset.type || 'application/octet-stream' })
    const mediaFile = new File([blob], asset.name, { type: asset.type || blob.type })
    const stored = await storeMediaFile(mediaFile, asset.id)
    restoredUrls.set(asset.id, stored.url)
  }

  const project = JSON.parse(strFromU8(projectBytes)) as FrameProject
  for (const layer of project.mediaLayers ?? []) {
    if (layer.assetId) layer.sourceUrl = restoredUrls.get(layer.assetId) ?? ''
    if (layer.customMaskAssetId) layer.customMaskSourceUrl = restoredUrls.get(layer.customMaskAssetId) ?? ''
  }
  if (project.background?.assetId) project.background.sourceUrl = restoredUrls.get(project.background.assetId) ?? ''
  return project
}
