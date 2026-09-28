import { hexToRgba, mixHex } from './color'
import { STYLE_MAP } from './presets'
import type { RingState } from './types'

function drawDonutPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerRadius: number, innerRadius: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2)
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true)
  ctx.closePath()
}

export function renderRing(canvas: HTMLCanvasElement, ring: RingState, size = 2000) {
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const outerRadius = ring.radius
  const innerRadius = Math.max(1, ring.radius - ring.thickness)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((ring.rotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  ctx.globalAlpha = ring.opacity

  const stops = STYLE_MAP[ring.style].stops
  const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius)
  for (const stop of stops) {
    gradient.addColorStop(stop.position, hexToRgba(mixHex(ring.baseColor, ring.whiteColor, stop.mix), stop.alpha ?? 1))
  }

  ctx.shadowBlur = ring.glowEnabled ? ring.glowBlur : 0
  ctx.shadowColor = ring.glowEnabled ? hexToRgba(ring.glowColor, ring.glowStrength) : 'transparent'

  drawDonutPath(ctx, cx, cy, outerRadius, innerRadius)
  ctx.fillStyle = gradient
  ctx.fill('evenodd')

  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'

  if (ring.outlineEnabled && ring.outlineWidth > 0) {
    ctx.lineWidth = ring.outlineWidth
    ctx.strokeStyle = ring.outlineColor
    ctx.globalAlpha = Math.min(1, ring.opacity * 0.9)
    ctx.beginPath()
    ctx.arc(cx, cy, outerRadius - ring.outlineWidth * 0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, innerRadius + ring.outlineWidth * 0.5, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.globalAlpha = 0.28 * ring.opacity
  ctx.lineWidth = Math.max(2, ring.thickness * 0.16)
  ctx.strokeStyle = hexToRgba(ring.whiteColor, 0.9)
  ctx.beginPath()
  ctx.arc(cx, cy, outerRadius - ring.thickness * 0.26, Math.PI * 1.05, Math.PI * 1.85)
  ctx.stroke()

  ctx.globalAlpha = 0.18 * ring.opacity
  ctx.lineWidth = Math.max(2, ring.thickness * 0.12)
  ctx.strokeStyle = hexToRgba(ring.baseColor, 0.7)
  ctx.beginPath()
  ctx.arc(cx, cy, innerRadius + ring.thickness * 0.22, Math.PI * 0.04, Math.PI * 0.92)
  ctx.stroke()

  ctx.restore()
}

export function exportPng(ring: RingState) {
  const canvas = document.createElement('canvas')
  renderRing(canvas, ring, 2000)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `circle-frame-v0.18-${Date.now()}.png`
  a.click()
}
