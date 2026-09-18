import type { FrameProject, RingLayer } from '../types'

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

function drawDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  const count = Math.max(3, Math.round(layer.pattern.decorationCount))
  const size = Math.max(1, layer.pattern.decorationSize * scale)
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (i / count) * TAU
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size / 2, 0, TAU)
    ctx.fill()
  }
}

function drawDecorations(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, layer: RingLayer, rotation: number, scale: number) {
  const count = Math.max(3, Math.round(layer.pattern.decorationCount))
  const size = Math.max(3, layer.pattern.decorationSize * scale)
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (i / count) * TAU
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (layer.kind === 'heart') drawHeart(ctx, x, y, size, a + Math.PI / 2)
    else drawStar(ctx, x, y, size, a, layer.kind === 'star' ? 5 : 4)
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
      drawDecorations(ctx, cx, cy, r, layer, rot, scale)
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
    const strength = Math.max(0, Math.min(1, layer.effects.glowIntensity))
    const passes = [1.45, .85, .42]
    passes.forEach((mult, index) => {
      ctx.save()
      ctx.shadowColor = validColor(layer.effects.glowColor, validColor(layer.color))
      ctx.shadowBlur = layer.effects.glowBlur * mult * scale
      ctx.globalAlpha *= strength * (index === 0 ? .28 : index === 1 ? .42 : .65)
      drawLayerCore(ctx, layer, scale)
      ctx.restore()
    })
  }

  if (layer.effects.bloom > 0) {
    ctx.save()
    ctx.shadowColor = validColor(layer.effects.glowColor, validColor(layer.color))
    ctx.shadowBlur = (layer.effects.glowBlur + layer.effects.bloom * 2.3) * scale
    ctx.globalAlpha *= .22
    drawLayerCore(ctx, layer, scale)
    ctx.restore()
  }

  if (layer.effects.softBlur > 0) ctx.filter = `blur(${layer.effects.softBlur * scale}px)`
  drawLayerCore(ctx, layer, scale)
  ctx.restore()
}

export function renderProject(canvas: HTMLCanvasElement, project: FrameProject, logicalScale = 1) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  if (logicalScale !== 1) {
    const center = canvas.width / 2
    ctx.translate(center, center)
    ctx.scale(logicalScale, logicalScale)
    ctx.translate(-center, -center)
  }
  for (const layer of project.layers) drawLayer(ctx, layer, canvas.width / 2000)
  ctx.restore()
}

export function estimateProjectExtent(project: FrameProject) {
  let extent = 100
  for (const layer of project.layers) {
    if (!layer.visible) continue
    const multi = layer.kind === 'triple' ? layer.thickness * 3.5 : layer.kind === 'double' ? layer.thickness * 2.6 : 0
    const deco = ['dotted', 'sparkle', 'star', 'heart'].includes(layer.kind) ? layer.pattern.decorationSize : 0
    const wave = ['wavy', 'scallop'].includes(layer.kind) ? layer.pattern.waveAmplitude : 0
    const rough = ['scribble', 'rough', 'brush'].includes(layer.kind) ? layer.pattern.roughness * 1.4 : 0
    const glow = layer.effects.glowEnabled ? layer.effects.glowBlur * 1.85 + layer.effects.bloom * 2.3 : 0
    const shadow = layer.effects.shadowEnabled
      ? layer.effects.shadowBlur * 1.4 + Math.max(Math.abs(layer.effects.shadowOffsetX), Math.abs(layer.effects.shadowOffsetY))
      : 0
    const blur = layer.effects.softBlur * 2
    const local = layer.radius + layer.thickness + multi + deco + wave + rough + glow + shadow + blur + Math.max(Math.abs(layer.offsetX), Math.abs(layer.offsetY))
    extent = Math.max(extent, local)
  }
  return extent
}
