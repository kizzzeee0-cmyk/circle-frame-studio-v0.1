import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from './assets'

export async function exportPng(project: FrameProject) {
  const canvas = document.createElement('canvas')
  canvas.width = 2000
  canvas.height = 2000
  await preloadProjectAssets(project)
  renderProject(canvas, project)
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `circle-frame-v011-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export function downloadProject(project: FrameProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'circle-frame-project-v011.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
