import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from './assets'

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 생성에 실패했습니다.')), type, quality)
  })
}

export async function exportPng(project: FrameProject) {
  const canvas = document.createElement('canvas')
  canvas.width = 2000
  canvas.height = 2000
  await preloadProjectAssets(project)
  renderProject(canvas, project)
  const blob = await canvasToBlob(canvas, 'image/png')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `circle-frame-v026-${new Date().toISOString().slice(0, 10)}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadProject(project: FrameProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'circle-frame-project-v026.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
