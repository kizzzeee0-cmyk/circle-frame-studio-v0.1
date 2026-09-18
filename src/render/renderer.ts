import type { FrameDesign, FrameProject } from '../types'
import { getCachedImage, getTintedImage } from '../utils/assets'

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

function makeGradient(ctx: CanvasRenderingContext2D, design: FrameDesign, cx: number, cy: number, r: number) {
  const stops = [...design.gradientStops].sort((a, b) => a.position - b.position)
  if (design.gradientMode === 'solid') return validColor(design.color)
  let gradient: CanvasGradient
  const angle = (design.gradientAngle * Math.PI) / 180
  if (design.gradientMode === 'linear') {
    const d = r * 1.55
    gradient = ctx.createLinearGradient(cx - Math.cos(angle) * d, cy - Math.sin(angle) * d, cx + Math.cos(angle) * d, cy + Math.sin(angle) * d)
  } else if (design.gradientMode === 'radial') {
    gradient = ctx.createRadialGradient(cx, cy, Math.max(1, r * .2), cx, cy, r * 1.15)
  } else {
    gradient = ctx.createConicGradient(angle - Math.PI / 2, cx, cy)
  }
  stops.forEach(stop => gradient.addColorStop(Math.min(1, Math.max(0, stop.position)), validColor(stop.color, validColor(design.color))))
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

function irregularPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, roughness: number, rotation: number, seed: number, scallop = false, waveCount = 16, amplitude = 12) {
  const rand = seeded(seed)
  const points = 240
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
  ctx.moveTo(0, 7)
  ctx.bezierCurveTo(-14, -2, -10, -14, 0, -7)
  ctx.bezierCurveTo(10, -14, 14, -2, 0, 7)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  const s = size / 25
  ctx.scale(s, s)

  const baseFill = `${ctx.fillStyle}`

  // 미리캔버스 예시처럼 넓고 둥근 리본 실루엣
  // 좌측 큰 루프
  ctx.beginPath()
  ctx.moveTo(-1.2, -0.5)
  ctx.bezierCurveTo(-6.5, -13.0, -22.5, -15.0, -27.0, -5.6)
  ctx.bezierCurveTo(-30.6, 2.1, -22.8, 9.8, -12.8, 8.8)
  ctx.bezierCurveTo(-7.1, 8.1, -3.0, 5.1, -1.2, 1.0)
  ctx.closePath()
  ctx.fill()

  // 우측 큰 루프
  ctx.beginPath()
  ctx.moveTo(1.2, -0.5)
  ctx.bezierCurveTo(6.5, -13.0, 22.5, -15.0, 27.0, -5.6)
  ctx.bezierCurveTo(30.6, 2.1, 22.8, 9.8, 12.8, 8.8)
  ctx.bezierCurveTo(7.1, 8.1, 3.0, 5.1, 1.2, 1.0)
  ctx.closePath()
  ctx.fill()

  // 아래 꼬리(짧고 두툼하게)
  ctx.beginPath()
  ctx.moveTo(-7.1, 4.4)
  ctx.bezierCurveTo(-11.5, 8.0, -13.6, 13.0, -13.5, 19.5)
  ctx.lineTo(-5.9, 14.6)
  ctx.lineTo(-0.6, 22.8)
  ctx.bezierCurveTo(0.2, 15.3, 0.3, 10.0, 0.0, 4.8)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(7.1, 4.4)
  ctx.bezierCurveTo(11.5, 8.0, 13.6, 13.0, 13.5, 19.5)
  ctx.lineTo(5.9, 14.6)
  ctx.lineTo(0.6, 22.8)
  ctx.bezierCurveTo(-0.2, 15.3, -0.3, 10.0, 0.0, 4.8)
  ctx.closePath()
  ctx.fill()

  // 중앙 매듭
  ctx.beginPath()
  ctx.ellipse(0, 0.7, 6.4, 5.9, 0, 0, TAU)
  ctx.fill()

  // 리본 접힌 안쪽 모양(투명하지 않게 흰 하이라이트로만 표현)
  const oldAlpha = ctx.globalAlpha
  ctx.fillStyle = '#FFFFFF'
  ctx.globalAlpha = oldAlpha * 0.24

  ctx.beginPath()
  ctx.moveTo(-10.0, -1.8)
  ctx.bezierCurveTo(-14.0, -6.8, -20.0, -6.0, -21.0, -1.8)
  ctx.bezierCurveTo(-18.2, -1.0, -14.0, -0.6, -9.2, 0.8)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(10.0, -1.8)
  ctx.bezierCurveTo(14.0, -6.8, 20.0, -6.0, 21.0, -1.8)
  ctx.bezierCurveTo(18.2, -1.0, 14.0, -0.6, 9.2, 0.8)
  ctx.closePath()
  ctx.fill()

  // 중앙 매듭의 살짝 밝은 느낌
  ctx.beginPath()
  ctx.ellipse(-1.0, -0.2, 2.2, 1.7, -0.5, 0, TAU)
  ctx.fill()

  ctx.globalAlpha = oldAlpha
  ctx.fillStyle = baseFill
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
    ctx.ellipse(0, -size * .5, size * .32, size * .5, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  const petal = ctx.fillStyle
  ctx.fillStyle = centerColor
  ctx.beginPath()
  ctx.arc(0, 0, size * .22, 0, TAU)
  ctx.fill()
  ctx.fillStyle = petal
  ctx.restore()
}

function palette(design: FrameDesign) {
  const count = Math.max(1, Math.min(4, design.pattern.colorCount))
  return design.pattern.paletteColors.slice(0, count).map((c, i) => validColor(c, i === 0 ? design.color : design.secondaryColor))
}

function decorationCount(design: FrameDesign, orbitProjectRadius: number) {
  if (design.pattern.decorationLayout === 'spacing') {
    const spacing = Math.max(8, design.pattern.decorationSpacing)
    return Math.max(3, Math.min(180, Math.round((TAU * Math.max(40, orbitProjectRadius)) / spacing)))
  }
  return Math.max(3, Math.min(180, Math.round(design.pattern.decorationCount)))
}

function drawDecorationAt(ctx: CanvasRenderingContext2D, design: FrameDesign, x: number, y: number, size: number, angle: number, centerColor: string) {
  const rotation = design.pattern.keepUpright ? 0 : angle + Math.PI / 2
  switch (design.kind) {
    case 'heart': drawHeart(ctx, x, y, size, rotation); break
    case 'star': drawStar(ctx, x, y, size, rotation, 5); break
    case 'sparkle': drawStar(ctx, x, y, size, rotation, 4); break
    case 'ribbon': drawRibbon(ctx, x, y, size, rotation); break
    case 'flower': drawFlower(ctx, x, y, size, rotation, centerColor); break
  }
}

function drawDecorations(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, design: FrameDesign, rotation: number, scale: number) {
  const orbitProject = design.radius + design.pattern.decorationOffset
  const orbit = r + design.pattern.decorationOffset * scale
  const count = decorationCount(design, orbitProject)
  const size = Math.max(3, design.pattern.decorationSize * scale)
  const colors = palette(design)
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (design.pattern.decorationRotation * Math.PI / 180) + (i / count) * TAU
    const x = cx + Math.cos(a) * orbit
    const y = cy + Math.sin(a) * orbit
    const color = colors[i % colors.length]
    const centerColor = colors[(i + 1) % colors.length] ?? color
    ctx.fillStyle = color
    drawDecorationAt(ctx, design, x, y, size, a, centerColor)
  }
}

function drawDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, design: FrameDesign, rotation: number, scale: number) {
  const orbitProject = design.radius + design.pattern.decorationOffset
  const orbit = r + design.pattern.decorationOffset * scale
  const count = decorationCount(design, orbitProject)
  const size = Math.max(1, design.pattern.decorationSize * scale)
  const colors = palette(design)
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (design.pattern.decorationRotation * Math.PI / 180) + (i / count) * TAU
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * orbit, cy + Math.sin(a) * orbit, size / 2, 0, TAU)
    ctx.fill()
  }
}

function drawAssetDecorations(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, design: FrameDesign, rotation: number, scale: number) {
  const url = design.pattern.customAssetUrl
  const img = url ? getCachedImage(url) : undefined
  if (!img) return
  const orbitProject = design.radius + design.pattern.decorationOffset
  const orbit = r + design.pattern.decorationOffset * scale
  const count = decorationCount(design, orbitProject)
  const size = Math.max(4, design.pattern.decorationSize * scale)
  const colors = palette(design)

  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (design.pattern.decorationRotation * Math.PI / 180) + (i / count) * TAU
    const x = cx + Math.cos(a) * orbit
    const y = cy + Math.sin(a) * orbit
    const source = design.pattern.assetTintMode === 'palette' ? getTintedImage(url, colors[i % colors.length]) ?? img : img
    const aspect = source.width / Math.max(1, source.height)
    const maxSide = size * 2
    const w = aspect >= 1 ? maxSide : maxSide * aspect
    const h = aspect >= 1 ? maxSide / aspect : maxSide
    ctx.save()
    ctx.translate(x, y)
    if (!design.pattern.keepUpright) ctx.rotate(a + Math.PI / 2)
    ctx.drawImage(source, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

function drawBrush(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, design: FrameDesign, rotation: number, scale: number) {
  const rand = seeded(design.pattern.seed)
  const dash = design.pattern.dash * scale
  const gap = design.pattern.gap * scale
  const count = Math.max(28, Math.round(TAU * r / Math.max(12 * scale, (dash + gap) * .72)))
  for (let i = 0; i < count; i++) {
    const a = rotation - Math.PI / 2 + (i / count) * TAU
    const span = (dash / Math.max(1, r)) * (.35 + rand() * .4)
    ctx.save()
    ctx.globalAlpha *= .32 + rand() * .68
    ctx.lineWidth = Math.max(1, design.thickness * scale * (.68 + rand() * .65))
    ctx.beginPath()
    ctx.arc(cx, cy, r + (rand() - .5) * design.pattern.roughness * scale, a, a + span)
    ctx.stroke()
    ctx.restore()
  }
}

function drawGlossy(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, design: FrameDesign, rotation: number, scale: number) {
  strokeCircle(ctx, cx, cy, r, rotation)
  ctx.save()
  ctx.globalAlpha *= .55
  ctx.lineWidth = Math.max(2, design.thickness * .23 * scale)
  ctx.strokeStyle = 'rgba(255,255,255,.92)'
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.arc(cx - design.thickness * .08 * scale, cy - design.thickness * .11 * scale, r - design.thickness * .17 * scale, Math.PI * 1.05, Math.PI * 1.88)
  ctx.stroke()
  ctx.globalAlpha *= .45
  ctx.strokeStyle = 'rgba(50,45,90,.32)'
  ctx.beginPath()
  ctx.arc(cx + design.thickness * .05 * scale, cy + design.thickness * .08 * scale, r + design.thickness * .10 * scale, .05, Math.PI * .92)
  ctx.stroke()
  ctx.restore()
}

function drawDesignCore(ctx: CanvasRenderingContext2D, design: FrameDesign, scale: number, canvasWidth: number, canvasHeight: number) {
  const cx = canvasWidth / 2 + design.offsetX * scale
  const cy = canvasHeight / 2 + design.offsetY * scale
  const r = design.radius * scale
  const rot = (design.rotation * Math.PI) / 180

  ctx.lineWidth = Math.max(1, design.thickness * scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const paint = makeGradient(ctx, design, cx, cy, r)
  ctx.strokeStyle = paint
  ctx.fillStyle = paint

  switch (design.kind) {
    case 'double': {
      const ringGap = Math.max(18, design.thickness * 1.8) * scale
      strokeCircle(ctx, cx, cy, r - ringGap / 2, rot)
      strokeCircle(ctx, cx, cy, r + ringGap / 2, rot)
      break
    }
    case 'triple': {
      const ringGap = Math.max(18, design.thickness * 1.65) * scale
      strokeCircle(ctx, cx, cy, r - ringGap, rot)
      strokeCircle(ctx, cx, cy, r, rot)
      strokeCircle(ctx, cx, cy, r + ringGap, rot)
      break
    }
    case 'segmented':
    case 'arc': {
      ctx.setLineDash([Math.max(1, design.pattern.dash * scale), Math.max(1, design.pattern.gap * scale)])
      ctx.lineDashOffset = -(design.rotation / 360) * TAU * r
      strokeCircle(ctx, cx, cy, r, 0)
      ctx.setLineDash([])
      break
    }
    case 'dotted': drawDots(ctx, cx, cy, r, design, rot, scale); break
    case 'wavy':
      irregularPath(ctx, cx, cy, r, 0, rot, design.pattern.seed, false, design.pattern.waveCount, design.pattern.waveAmplitude * scale)
      ctx.stroke()
      break
    case 'scallop':
      irregularPath(ctx, cx, cy, r, 0, rot, design.pattern.seed, true, design.pattern.waveCount, design.pattern.waveAmplitude * scale)
      ctx.stroke()
      break
    case 'scribble': {
      const count = Math.max(2, Math.round(design.pattern.strokeCount))
      for (let i = 0; i < count; i++) {
        irregularPath(ctx, cx, cy, r + (i - count / 2) * design.thickness * .42 * scale, design.pattern.roughness * scale, rot, design.pattern.seed + i * 97)
        ctx.stroke()
      }
      break
    }
    case 'rough': {
      const count = Math.max(1, Math.round(design.pattern.strokeCount))
      for (let i = 0; i < count; i++) {
        irregularPath(ctx, cx, cy, r, design.pattern.roughness * scale, rot, design.pattern.seed + i * 41)
        ctx.stroke()
      }
      break
    }
    case 'brush': drawBrush(ctx, cx, cy, r, design, rot, scale); break
    case 'sparkle':
    case 'star':
    case 'heart':
    case 'ribbon':
    case 'flower': drawDecorations(ctx, cx, cy, r, design, rot, scale); break
    case 'asset': drawAssetDecorations(ctx, cx, cy, r, design, rot, scale); break
    case 'glossy': drawGlossy(ctx, cx, cy, r, design, rot, scale); break
    default: strokeCircle(ctx, cx, cy, r, rot)
  }
}

function drawDesign(ctx: CanvasRenderingContext2D, design: FrameDesign, scale: number, canvasWidth: number, canvasHeight: number) {
  if (design.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = design.opacity

  if (design.effects.shadowEnabled) {
    ctx.save()
    ctx.shadowColor = validColor(design.effects.shadowColor, '#5B547D')
    ctx.shadowBlur = design.effects.shadowBlur * scale
    ctx.shadowOffsetX = design.effects.shadowOffsetX * scale
    ctx.shadowOffsetY = design.effects.shadowOffsetY * scale
    ctx.globalAlpha *= .7
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight)
    ctx.restore()
  }

  if (design.effects.glowEnabled) {
    const blur = Math.max(0, design.effects.glowBlur * scale)
    const intensity = Math.max(0, design.effects.glowIntensity)
    for (const multi of [1, .65, .36]) {
      ctx.save()
      ctx.shadowBlur = Math.max(1, blur * multi)
      ctx.shadowColor = validColor(design.effects.glowColor, validColor(design.color))
      ctx.globalAlpha *= intensity * (.48 + multi * .42)
      drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight)
      ctx.restore()
    }
  }

  if (design.effects.bloom > 0) {
    ctx.save()
    ctx.filter = `blur(${(design.effects.bloom * .12) * scale}px)`
    ctx.globalAlpha *= .28
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight)
    ctx.restore()
  }

  if (design.effects.softBlur > 0) {
    ctx.save()
    ctx.filter = `blur(${design.effects.softBlur * scale}px)`
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight)
    ctx.restore()
  } else {
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight)
  }

  ctx.restore()
}

export function estimateDesignExtent(design: FrameDesign) {
  const r = Math.max(0, design.radius)
  const thickness = Math.max(0, design.thickness)
  const halfLine = thickness / 2
  let geometry = r + halfLine

  switch (design.kind) {
    case 'double': {
      const ringGap = Math.max(18, thickness * 1.8)
      geometry = r + ringGap / 2 + halfLine
      break
    }
    case 'triple': {
      const ringGap = Math.max(18, thickness * 1.65)
      geometry = r + ringGap + halfLine
      break
    }
    case 'wavy':
    case 'scallop':
      geometry = r + Math.abs(design.pattern.waveAmplitude) + halfLine
      break
    case 'scribble': {
      const count = Math.max(2, Math.round(design.pattern.strokeCount))
      const outerStrokeOffset = (count / 2) * thickness * .42
      geometry = r + outerStrokeOffset + Math.abs(design.pattern.roughness) + halfLine
      break
    }
    case 'rough':
      geometry = r + Math.abs(design.pattern.roughness) + halfLine
      break
    case 'brush':
      geometry = r + Math.abs(design.pattern.roughness) + thickness
      break
    case 'dotted':
      geometry = Math.abs(r + design.pattern.decorationOffset) + Math.max(1, design.pattern.decorationSize) / 2
      break
    case 'sparkle':
    case 'star':
    case 'heart':
    case 'ribbon':
    case 'flower':
    case 'asset':
      geometry = Math.abs(r + design.pattern.decorationOffset) + Math.max(1, design.pattern.decorationSize) * 1.1
      break
    default:
      break
  }

  const glow = design.effects.glowEnabled ? Math.max(0, design.effects.glowBlur) * 2.6 : 0
  const bloom = Math.max(0, design.effects.bloom) * .12 * 3
  const softBlur = Math.max(0, design.effects.softBlur) * 3
  const shadow = design.effects.shadowEnabled
    ? Math.max(Math.abs(design.effects.shadowOffsetX), Math.abs(design.effects.shadowOffsetY)) + Math.max(0, design.effects.shadowBlur) * 2.6
    : 0
  const offset = Math.max(Math.abs(design.offsetX), Math.abs(design.offsetY))

  return geometry + glow + bloom + softBlur + shadow + offset + 8
}

export function getProjectFitScale(project: FrameProject) {
  if (!project.autoFit) return 1
  const extent = estimateDesignExtent(project.design)
  return Math.min(1.18, 950 / Math.max(1, extent))
}

export function renderProject(canvas: HTMLCanvasElement, project: FrameProject, forcedFitScale?: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const baseScale = canvas.width / project.width
  const fitScale = forcedFitScale ?? getProjectFitScale(project)
  const scale = baseScale * fitScale
  drawDesign(ctx, project.design, scale, canvas.width, canvas.height)
}
