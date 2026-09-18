import type { FrameProject, RingLayer } from '../types'
import { getCachedImage } from '../utils/assets'

const TAU = Math.PI * 2

function validColor(value: string, fallback = '#9389DE') {
  return /^#[0-9A-Fa-f]{6}$/.test(value) || /^rgba?\(/.test(value) ? value : fallback
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeGradient(ctx: CanvasRenderingContext2D, layer: RingLayer, cx: number, cy: number, r: number) {
  const stops = [...layer.gradientStops].sort((a, b) => a.position - b.position)
  if (layer.gradientMode === 'solid') return validColor(layer.color)
  let gradient: CanvasGradient
  const angle = (layer.gradientAngle * Math.PI) / 180
  if (layer.gradientMode === 'linear') {
    const d = r * 1.55
    gradient = ctx.createLinearGradient(
      cx - Math.cos(angle) * d,
      cy - Math.sin(angle) * d,
      cx + Math.cos(angle) * d,
      cy + Math.sin(angle) * d,
    )
  } else if (layer.gradientMode === 'radial') {
    gradient = ctx.createRadialGradient(cx, cy, Math.max(1, r * .2), cx, cy, r * 1.15)
  } else {
    gradient = ctx.createConicGradient(angle - Math.PI / 2, cx, cy)
  }
  stops.forEach(stop => gradient.addColorStop(Math.min(1, Math.max(0, stop.position)), validColor(stop.color, validColor(layer.color))))
  return gradient
}

function beginRingPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation = 0) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2 + rotation, Math.PI * 1.5 + rotation)
}

function strokeCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation = 0) {
  beginRingPath(ctx, cx, cy, r, rotation)
  ctx.stroke()
}

function irregularPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  roughness: number,
  rotation: number,
  seed: number,
  scallop = false,
  waveCount = 16,
  amplitude = 12,
) {
  const rand = seeded(seed)
  const points = 220
  ctx.beginPath()
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * TAU + rotation - Math.PI / 2
    const wave = scallop ? Math.abs(Math.sin((t + rotation) * waveCount / 2)) * amplitude : Math.sin((t + rotation) * waveCount) * amplitude
    const noise = scallop ? 0 : (rand() - .5) * roughness * 2
    const rr = r + wave + noise
    const x = cx + Math.cos(t) * rr
    const y = cy + Math.sin(t) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, points = 4) {
  ctx.beginPath()
  const inner = size * .34
  for (let i = 0; i < points * 2; i++) {
    const a = rotation + (i * Math.PI) / points
    const rr = i % 2 === 0 ? size : inner
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  const s = size / 18
  ctx.scale(s, s)
  ctx.beginPath()
  ctx.moveTo(0, 6)
  ctx.bezierCurveTo(-14, -3, -9, -14, 0, -7)
  ctx.bezierCurveTo(9, -14, 14, -3, 0, 6)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  const s = size / 22
  ctx.scale(s, s)
  ctx.beginPath()
  ctx.moveTo(-16, -2)
  ctx.quadraticCurveTo(-6, -11, -1, -3)
  ctx.quadraticCurveTo(-7, 1, -16, -2)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(16, -2)
  ctx.quadraticCurveTo(6, -11, 1, -3)
  ctx.quadraticCurveTo(7, 1, 16, -2)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, 5, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-3, 4)
  ctx.lineTo(-10, 17)
  ctx.lineTo(-1, 12)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(3, 4)
  ctx.lineTo(10, 17)
  ctx.lineTo(1, 12)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number, centerColor: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  for (let i = 0; i < 5; i++) {
    ctx.save()
    ctx.rotate((i / 5) * TAU)
    ctx.beginPath()
    ctx.ellipse(0, -size * .5, size * .33, size * .5, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  const current = ctx.fillStyle
  ctx.fillStyle = centerColor
  ctx.beginPath()
  ctx.arc(0, 0, size * .22, 0, TAU)
  ctx.fill()
  ctx.fillStyle = current
  ctx.restore()
}

function drawDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  const count = Math.max(3, Math.round(layer.pattern.decorationCount))
  const size = Math.max(1, layer.pattern.decorationSize * scale)
  const orbit = r + layer.pattern.decorationOffset * scale
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + ((i + layer.pattern.decorationRotation / 360) / count) * TAU
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * orbit, cy + Math.sin(a) * orbit, size / 2, 0, TAU)
    ctx.fillStyle = layer.pattern.alternateColors && i % 2 === 1 ? validColor(layer.secondaryColor) : (ctx.strokeStyle as string)
    ctx.fill()
  }
}

function drawDecorationAt(ctx: CanvasRenderingContext2D, layer: RingLayer, x: number, y: number, size: number, angle: number) {
  const upright = layer.pattern.keepUpright
  const rotation = upright ? 0 : angle + Math.PI / 2
  switch (layer.kind) {
    case 'heart':
      drawHeart(ctx, x, y, size, rotation)
      break
    case 'star':
    case 'sparkle':
      drawStar(ctx, x, y, size, rotation, layer.kind === 'star' ? 5 : 4)
      break
    case 'ribbon':
      drawRibbon(ctx, x, y, size, rotation)
      break
    case 'flower':
      drawFlower(ctx, x, y, size, rotation, validColor(layer.secondaryColor, '#FFE087'))
      break
  }
}

function drawDecorations(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  const count = Math.max(3, Math.round(layer.pattern.decorationCount))
  const size = Math.max(3, layer.pattern.decorationSize * scale)
  const orbit = r + layer.pattern.decorationOffset * scale
  const baseColor = validColor(layer.color)
  const altColor = validColor(layer.secondaryColor, baseColor)
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + ((i + layer.pattern.decorationRotation / 360) / count) * TAU
    const x = cx + Math.cos(a) * orbit
    const y = cy + Math.sin(a) * orbit
    ctx.fillStyle = layer.pattern.alternateColors && i % 2 === 1 ? altColor : baseColor
    drawDecorationAt(ctx, layer, x, y, size, a)
  }
}

function drawAssetDecorations(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  const url = layer.pattern.customAssetUrl
  const img = url ? getCachedImage(url) : undefined
  if (!img) return
  const count = Math.max(3, Math.round(layer.pattern.decorationCount))
  const size = Math.max(4, layer.pattern.decorationSize * scale)
  const orbit = r + layer.pattern.decorationOffset * scale
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + ((i + layer.pattern.decorationRotation / 360) / count) * TAU
    const x = cx + Math.cos(a) * orbit
    const y = cy + Math.sin(a) * orbit
    const aspect = img.width / Math.max(1, img.height)
    const h = size * 2
    const w = h * aspect
    ctx.save()
    ctx.translate(x, y)
    if (!layer.pattern.keepUpright) ctx.rotate(a + Math.PI / 2)
    ctx.globalAlpha *= .96
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

function drawBrush(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  const rand = seeded(layer.pattern.seed)
  const dash = layer.pattern.dash * scale
  const gap = layer.pattern.gap * scale
  const count = Math.max(28, Math.round(TAU * r / Math.max(12 * scale, (dash + gap) * .72)))
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (i / count) * TAU
    const span = (dash / Math.max(1, r)) * (.35 + rand() * .4)
    ctx.save()
    ctx.globalAlpha *= .32 + rand() * .68
    ctx.lineWidth = Math.max(1, layer.thickness * scale * (.68 + rand() * .65))
    ctx.beginPath()
    ctx.arc(cx, cy, r + (rand() - .5) * layer.pattern.roughness * scale, a, a + span)
    ctx.stroke()
    ctx.restore()
  }
}

function drawGlossy(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  strokeCircle(ctx, cx, cy, r, rotation)
  ctx.save()
  ctx.globalAlpha *= .55
  ctx.lineWidth = Math.max(2, layer.thickness * .23 * scale)
  ctx.strokeStyle = 'rgba(255,255,255,.92)'
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(cx - layer.thickness * .08 * scale, cy - layer.thickness * .11 * scale, r - layer.thickness * .17 * scale, Math.PI * 1.05, Math.PI * 1.88)
  ctx.stroke()
  ctx.globalAlpha *= .45
  ctx.strokeStyle = 'rgba(50,45,90,.32)'
  ctx.beginPath()
  ctx.arc(cx + layer.thickness * .05 * scale, cy + layer.thickness * .08 * scale, r + layer.thickness * .10 * scale, .05, Math.PI * .92)
  ctx.stroke()
  ctx.restore()
}

function drawLayerCore(ctx: CanvasRenderingContext2D, layer: RingLayer, scale: number) {
  const cx = 1000 * scale + layer.offsetX * scale
  const cy = 1000 * scale + layer.offsetY * scale
  const r = layer.radius * scale
  const rot = (layer.rotation * Math.PI) / 180

  ctx.lineWidth = Math.max(1, layer.thickness * scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const paint = makeGradient(ctx, layer, cx, cy, r)
  ctx.strokeStyle = paint
  ctx.fillStyle = paint

  switch (layer.kind) {
    case 'double': {
      const gap = Math.max(18, layer.thickness * 1.8) * scale
      strokeCircle(ctx, cx, cy, r - gap / 2, rot)
      strokeCircle(ctx, cx, cy, r + gap / 2, rot)
      break
    }
    case 'triple': {
      const gap = Math.max(18, layer.thickness * 1.65) * scale
      strokeCircle(ctx, cx, cy, r - gap, rot)
      strokeCircle(ctx, cx, cy, r, rot)
      strokeCircle(ctx, cx, cy, r + gap, rot)
      break
    }
    case 'segmented':
    case 'arc': {
      ctx.setLineDash([Math.max(1, layer.pattern.dash * scale), Math.max(1, layer.pattern.gap * scale)])
      ctx.lineDashOffset = -(layer.rotation / 360) * TAU * r
      strokeCircle(ctx, cx, cy, r, 0)
      ctx.setLineDash([])
      break
    }
    case 'dotted':
      drawDots(ctx, cx, cy, r, layer, rot, scale)
      break
    case 'wavy':
      irregularPath(ctx, cx, cy, r, 0, rot, layer.pattern.seed, false, layer.pattern.waveCount, layer.pattern.waveAmplitude * scale)
      ctx.stroke()
      break
    case 'scallop':
      irregularPath(ctx, cx, cy, r, 0, rot, layer.pattern.seed, true, layer.pattern.waveCount, layer.pattern.waveAmplitude * scale)
      ctx.stroke()
      break
    case 'scribble': {
      const count = Math.max(2, Math.round(layer.pattern.strokeCount))
      for (let i = 0; i < count; i++) {
        irregularPath(ctx, cx, cy, r + (i - count / 2) * layer.thickness * .42 * scale, layer.pattern.roughness * scale, rot, layer.pattern.seed + i * 97)
        ctx.stroke()
      }
      break
    }
    case 'rough': {
      const count = Math.max(1, Math.round(layer.pattern.strokeCount))
      for (let i = 0; i < count; i++) {
        irregularPath(ctx, cx, cy, r, layer.pattern.roughness * scale, rot, layer.pattern.seed + i * 41)
        ctx.stroke()
      }
      break
    }
    case 'brush':
      drawBrush(ctx, cx, cy, r, layer, rot, scale)
      break
    case 'sparkle':
    case 'star':
    case 'heart':
    case 'ribbon':
    case 'flower':
      drawDecorations(ctx, cx, cy, r, layer, rot, scale)
      break
    case 'asset':
      drawAssetDecorations(ctx, cx, cy, r, layer, rot, scale)
      break
    case 'glossy':
      drawGlossy(ctx, cx, cy, r, layer, rot, scale)
      break
    default:
      strokeCircle(ctx, cx, cy, r, rot)
  }
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: RingLayer, scale: number) {
  if (!layer.visible || layer.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = layer.opacity

  if (layer.effects.shadowEnabled) {
    ctx.save()
    ctx.shadowColor = validColor(layer.effects.shadowColor, '#5B547D')
    ctx.shadowBlur = layer.effects.shadowBlur * scale
    ctx.shadowOffsetX = layer.effects.shadowOffsetX * scale
    ctx.shadowOffsetY = layer.effects.shadowOffsetY * scale
    ctx.globalAlpha *= .62
    drawLayerCore(ctx, layer, scale)
    ctx.restore()
  }

  if (layer.effects.glowEnabled) {
    const blur = Math.max(0, layer.effects.glowBlur * scale)
    const intensity = Math.max(0, layer.effects.glowIntensity)
    for (const multi of [1, 0.66, 0.35]) {
      ctx.save()
      ctx.shadowBlur = Math.max(1, blur * multi)
      ctx.shadowColor = validColor(layer.effects.glowColor, validColor(layer.color))
      ctx.globalAlpha *= intensity * (0.55 + multi * 0.5)
      drawLayerCore(ctx, layer, scale)
      ctx.restore()
    }
  }

  if (layer.effects.bloom > 0) {
    ctx.save()
    ctx.filter = `blur(${(layer.effects.bloom * .12) * scale}px)`
    ctx.globalAlpha *= .28
    drawLayerCore(ctx, layer, scale)
    ctx.restore()
  }

  if (layer.effects.softBlur > 0) {
    ctx.save()
    ctx.filter = `blur(${layer.effects.softBlur * scale}px)`
    drawLayerCore(ctx, layer, scale)
    ctx.restore()
  } else {
    drawLayerCore(ctx, layer, scale)
  }

  ctx.restore()
}

export function estimateLayerExtent(layer: RingLayer) {
  const base = layer.radius + layer.thickness * 1.5 + Math.max(0, layer.pattern.decorationOffset)
  const decoration = ['dotted', 'sparkle', 'star', 'heart', 'ribbon', 'flower', 'asset'].includes(layer.kind) ? layer.pattern.decorationSize * 1.4 : 0
  const glow = layer.effects.glowEnabled ? layer.effects.glowBlur * (1.2 + layer.effects.glowIntensity) : 0
  const shadow = layer.effects.shadowEnabled ? Math.max(Math.abs(layer.effects.shadowOffsetX), Math.abs(layer.effects.shadowOffsetY)) + layer.effects.shadowBlur : 0
  const softBlur = layer.effects.softBlur + layer.effects.bloom
  return base + decoration + glow + shadow + softBlur + Math.max(Math.abs(layer.offsetX), Math.abs(layer.offsetY))
}

export function estimateProjectExtent(project: FrameProject) {
  return project.layers.reduce((max, layer) => Math.max(max, estimateLayerExtent(layer)), 0)
}

export function renderProject(canvas: HTMLCanvasElement, project: FrameProject, outputScale = 1) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const scale = (canvas.width / project.width) * outputScale
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  for (const layer of project.layers) drawLayer(ctx, layer, scale)
  ctx.restore()
}
