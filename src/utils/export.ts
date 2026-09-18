import type { FrameProject } from '../types'
import { estimateProjectExtent, renderProject } from '../render/renderer'
import { preloadProjectAssets } from './assets'

export async function exportPng(project: FrameProject) {
  const canvas = document.createElement('canvas')
  canvas.width = 2000
  canvas.height = 2000
  await preloadProjectAssets(project)
  const extent = estimateProjectExtent(project)
  const safe = 965
  const scale = project.autoFit ? Math.min(1.55, safe / Math.max(1, extent)) : 1
  renderProject(canvas, project, scale)
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `circle-frame-v02-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

export function downloadProject(project: FrameProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'circle-frame-project-v02.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
