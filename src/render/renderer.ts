import type { FrameDesign, FrameProject, MediaLayer } from '../types'
import { getCachedImage, getTintedImage } from '../utils/assets'
import { getBackgroundElement, getCustomMaskElement, getMediaElement } from '../utils/media'

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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function easeValue(value: number, mode: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out') {
  const t = clamp01(value)
  if (mode === 'ease-in') return t * t
  if (mode === 'ease-out') return 1 - (1 - t) * (1 - t)
  if (mode === 'ease-in-out') return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  return t
}

function animatedFrameRotation(design: FrameDesign, sceneTimeSec: number, loopDurationSec?: number) {
  const motion = design.rotationAnimation
  const surface = design.kind === 'glitter' && design.glitter.surfaceStyle !== 'legacy'
  if (surface && !['rotate', 'rotate-twinkle'].includes(design.glitter.animationMode)) return 0
  if (!motion?.enabled || sceneTimeSec < motion.startTime) return motion?.startAngle ?? 0
  const end = Math.max(motion.startTime, motion.endTime)
  const seconds = Math.max(.1, motion.secondsPerTurn)
  if (surface && loopDurationSec && motion.startTime <= 0 && end >= loopDurationSec) {
    const wholeTurns = Math.max(1, Math.round(loopDurationSec / seconds))
    return motion.startAngle + motion.direction * 360 * wholeTurns * sceneTimeSec / loopDurationSec
  }
  const activeTime = Math.min(sceneTimeSec, end) - motion.startTime
  const turn = activeTime / seconds
  const whole = Math.floor(turn)
  const fractional = easeValue(turn - whole, motion.easing)
  return motion.startAngle + motion.direction * 360 * (whole + fractional)
}

function mixHex(a: string, b: string, amount: number) {
  const read = (value: string, fallback: string) => {
    const clean = (/^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback).slice(1)
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ]
  }
  const ca = read(a, '#9389DE')
  const cb = read(b, '#FFFFFF')
  const t = clamp01(amount)
  const hex = ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')
  return `#${hex}`
}

function makeTwoToneFlowGradient(ctx: CanvasRenderingContext2D, design: FrameDesign, cx: number, cy: number) {
  const flow = design.twoToneFlow
  const repeatCount = Math.max(1, Math.min(4, flow.repeatCount || 1))
  const angle = ((flow.rotation + design.gradientAngle) * Math.PI) / 180 - Math.PI / 2
  const gradient = ctx.createConicGradient(angle, cx, cy)
  const center = ((flow.whiteCenter % 1) + 1) % 1
  const halfWhite = Math.min(.45, Math.max(.01, flow.whiteWidth / 2))

  // 흰색 길이를 늘려도 연결부가 찌그러지거나 색상 구간을 잡아먹지 않도록
  // 남은 반 주기 안에서만 blend 폭을 자동 제한한다.
  const maxBlend = Math.max(.005, .495 - halfWhite)
  const blend = Math.min(maxBlend, Math.max(.005, flow.blendWidth))

  const colorA = validColor(flow.colorA, validColor(design.color))
  const colorB = validColor(flow.colorB, '#FFFFFF')
  const samples = 96 + repeatCount * 40

  for (let i = 0; i <= samples; i++) {
    const t = i / samples

    // repeatCount=1/2/3/4 => 2/4/6/8구간
    // 각 반복 주기를 동일한 비율로 계산해 모든 흰색/선택색상 구간 길이를 균등하게 유지한다.
    const cycleT = ((t * repeatCount) % 1 + 1) % 1
    const rawDistance = Math.abs(cycleT - center)
    const distance = Math.min(rawDistance, 1 - rawDistance)

    let whiteMix = 0
    if (distance <= halfWhite) {
      whiteMix = 1
    } else if (distance < halfWhite + blend) {
      const x = clamp01((distance - halfWhite) / blend)
      const smooth = x * x * (3 - 2 * x)
      whiteMix = 1 - smooth
    }

    gradient.addColorStop(t, mixHex(colorA, colorB, whiteMix))
  }

  return gradient
}

function drawTwoToneFlowHighlights(ctx: CanvasRenderingContext2D, design: FrameDesign, cx: number, cy: number, r: number, scale: number) {
  const flow = design.twoToneFlow
  if (!flow.enabled || !['basic', 'double', 'triple', 'glossy'].includes(design.kind)) return
  if (design.kind === 'triple' && design.tripleRing.attached) return

  const repeatCount = Math.max(1, Math.min(4, flow.repeatCount || 1))
  const baseAngle = ((flow.rotation + design.gradientAngle) * Math.PI) / 180 - Math.PI / 2
  const cycleAngle = TAU / repeatCount
  const span = Math.min(cycleAngle * .82, Math.max(.15, (flow.whiteWidth + flow.blendWidth * 1.35) * cycleAngle))
  const thickness = design.thickness * scale
  const highlightColor = validColor(flow.colorB, '#FFFFFF')

  ctx.save()
  ctx.shadowBlur = 0
  ctx.lineCap = 'round'
  ctx.strokeStyle = highlightColor

  for (let i = 0; i < repeatCount; i++) {
    const centerAngle = baseAngle + ((flow.whiteCenter + i) / repeatCount) * TAU
    const start = centerAngle - span / 2
    const end = centerAngle + span / 2

    if (flow.glossStrength > 0) {
      ctx.globalAlpha = design.opacity * clamp01(flow.glossStrength) * .42
      ctx.lineWidth = Math.max(1, thickness * .12)
      ctx.beginPath()
      ctx.arc(cx, cy, r, start + span * .08, end - span * .08)
      ctx.stroke()
    }

    if (flow.outerHighlight > 0) {
      ctx.globalAlpha = design.opacity * clamp01(flow.outerHighlight) * .55
      ctx.lineWidth = Math.max(1, thickness * .075)
      ctx.beginPath()
      ctx.arc(cx, cy, r + thickness * .38, start, end)
      ctx.stroke()
    }

    if (flow.innerHighlight > 0) {
      ctx.globalAlpha = design.opacity * clamp01(flow.innerHighlight) * .55
      ctx.lineWidth = Math.max(1, thickness * .075)
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1, r - thickness * .38), start, end)
      ctx.stroke()
    }
  }

  ctx.restore()
}

function makeGradient(ctx: CanvasRenderingContext2D, design: FrameDesign, cx: number, cy: number, r: number) {
  if (design.twoToneFlow.enabled) return makeTwoToneFlowGradient(ctx, design, cx, cy)
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

const embossMaskCache = new Map<string, HTMLCanvasElement>()
const glitterSurfaceCache = new Map<string, HTMLCanvasElement>()

function makeEmbossMaskDesign(design: FrameDesign): FrameDesign {
  const white = '#FFFFFF'
  const next: FrameDesign = structuredClone(design)
  next.opacity = 1
  next.color = white
  next.secondaryColor = white
  next.gradientMode = 'solid'
  next.gradientAngle = 0
  next.gradientStops = next.gradientStops.map(stop => ({ ...stop, color: white }))
  next.twoToneFlow = {
    ...next.twoToneFlow,
    enabled: false,
    colorA: white,
    colorB: white,
  }
  next.effects = {
    ...next.effects,
    glowEnabled: false,
    bloom: 0,
    softBlur: 0,
    shadowEnabled: false,
    outlineEnabled: false,
    embossEnabled: false,
  }
  next.pattern = {
    ...next.pattern,
    colorCount: 1,
    paletteColors: [white, white, white, white],
    assetTintMode: 'palette',
  }
  next.glitter = {
    ...next.glitter,
    colors: [white, white, white, white],
    colorCount: 1,
    baseOpacity: 1,
    edgeHighlight: 0,
    glow: 0,
  }
  if (next.kind === 'glossy') next.kind = 'basic'
  return next
}

function embossMaskKey(design: FrameDesign, scale: number, canvasWidth: number, canvasHeight: number) {
  const p = design.pattern
  return JSON.stringify([
    canvasWidth, canvasHeight, scale.toFixed(4),
    design.kind, design.radius, design.thickness, design.rotation, design.offsetX, design.offsetY,
    p.dash, p.gap, p.roughness, p.strokeCount, p.waveAmplitude, p.waveCount, p.bulgeAmplitude, p.bulgeCount,
    p.decorationLayout, p.decorationCount, p.decorationSpacing, p.decorationSize, p.decorationOffset,
    p.decorationRotation, p.keepUpright, p.seed, p.customAssetUrl,
  ])
}

function getEmbossMask(design: FrameDesign, scale: number, canvasWidth: number, canvasHeight: number) {
  // Emboss must follow the actual ring silhouette, not semi-transparent glitter
  // particles. Reuse the same mask as ring clipping for consistent edges.
  if (design.kind === 'glitter' && design.glitter.surfaceStyle !== 'legacy') {
    return surfaceRingMask(design, scale, canvasWidth, canvasHeight)
  }
  const canCache = design.kind !== 'asset'
  const key = canCache ? embossMaskKey(design, scale, canvasWidth, canvasHeight) : ''
  if (canCache) {
    const cached = embossMaskCache.get(key)
    if (cached) return cached
  }

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = canvasWidth
  maskCanvas.height = canvasHeight
  const mctx = maskCanvas.getContext('2d')
  if (!mctx) return maskCanvas

  drawDesignCore(mctx, makeEmbossMaskDesign(design), scale, canvasWidth, canvasHeight)

  if (canCache) {
    embossMaskCache.set(key, maskCanvas)
    while (embossMaskCache.size > 12) {
      const first = embossMaskCache.keys().next().value
      if (typeof first === 'string') embossMaskCache.delete(first)
      else break
    }
  }
  return maskCanvas
}

function makeEmbossEdgeMask(maskCanvas: HTMLCanvasElement, shiftX: number, shiftY: number) {
  const edge = document.createElement('canvas')
  edge.width = maskCanvas.width
  edge.height = maskCanvas.height
  const ectx = edge.getContext('2d')
  if (!ectx) return edge

  ectx.drawImage(maskCanvas, 0, 0)
  ectx.globalCompositeOperation = 'destination-out'
  ectx.drawImage(maskCanvas, shiftX, shiftY)
  return edge
}

function drawEmbossEdgePass(
  target: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  shiftX: number,
  shiftY: number,
  blur: number,
  color: string,
  alpha: number,
  blendMode: GlobalCompositeOperation,
) {
  if (alpha <= 0) return
  const edgeMask = makeEmbossEdgeMask(maskCanvas, shiftX, shiftY)
  const temp = document.createElement('canvas')
  temp.width = maskCanvas.width
  temp.height = maskCanvas.height
  const tctx = temp.getContext('2d')
  if (!tctx) return

  tctx.save()
  tctx.filter = blur > 0 ? `blur(${blur}px)` : 'none'
  tctx.drawImage(edgeMask, 0, 0)
  tctx.restore()

  tctx.globalCompositeOperation = 'source-in'
  tctx.fillStyle = color
  tctx.fillRect(0, 0, temp.width, temp.height)

  tctx.globalCompositeOperation = 'destination-in'
  tctx.drawImage(maskCanvas, 0, 0)

  target.save()
  target.globalAlpha *= clamp01(alpha)
  target.globalCompositeOperation = blendMode
  target.drawImage(temp, 0, 0)
  target.restore()
}

function drawEmbossMidtonePass(
  target: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  color: string,
  alpha: number,
  blendMode: GlobalCompositeOperation,
) {
  if (alpha <= 0) return
  const temp = document.createElement('canvas')
  temp.width = maskCanvas.width
  temp.height = maskCanvas.height
  const tctx = temp.getContext('2d')
  if (!tctx) return

  tctx.drawImage(maskCanvas, 0, 0)
  tctx.globalCompositeOperation = 'source-in'
  tctx.fillStyle = color
  tctx.fillRect(0, 0, temp.width, temp.height)

  target.save()
  target.globalAlpha *= clamp01(alpha)
  target.globalCompositeOperation = blendMode
  target.drawImage(temp, 0, 0)
  target.restore()
}

function resolveEmbossBlend(mode: FrameDesign['effects']['embossHighlightBlend']): GlobalCompositeOperation {
  if (mode === 'soft-light') return 'soft-light'
  if (mode === 'normal') return 'source-over'
  return 'screen'
}

function resolveEmbossShadowBlend(mode: FrameDesign['effects']['embossShadowBlend']): GlobalCompositeOperation {
  if (mode === 'soft-light') return 'soft-light'
  if (mode === 'normal') return 'source-over'
  return 'multiply'
}

function drawEmbossEffect(
  ctx: CanvasRenderingContext2D,
  design: FrameDesign,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const fx = design.effects
  if (!fx.embossEnabled) return

  const maskCanvas = getEmbossMask(design, scale, canvasWidth, canvasHeight)
  const angle = (fx.embossLightAngle * Math.PI) / 180
  const altitude = clamp01(fx.embossLightAltitude / 90)
  const thicknessPx = Math.max(1, design.thickness * scale)
  const requestedSize = Math.max(1, fx.embossSize * scale)
  const edgeSize = Math.min(requestedSize, Math.max(1, thicknessPx * .58))
  const softness = Math.max(0, fx.embossSoftness * scale)
  const depth = Math.max(.01, fx.embossDepth)
  const sharpness = clamp01(fx.embossHighlightSharpness)
  const baseRetention = clamp01(fx.embossBaseRetention)

  const style = fx.embossStyle ?? 'inner-bevel'
  const technique = fx.embossTechnique ?? 'smooth'
  const direction = fx.embossDirection ?? 'up'

  // Style / technique are intentionally separate so changing depth does not just make the ring look thicker.
  const techniqueCore = technique === 'chisel-hard' ? 1.38 : technique === 'chisel-soft' ? 1.18 : 1
  const techniqueBlur = technique === 'chisel-hard' ? .38 : technique === 'chisel-soft' ? .72 : 1
  const techniqueSoftSpread = technique === 'chisel-hard' ? .64 : technique === 'chisel-soft' ? .80 : 1
  const styleSpread = style === 'outer-bevel' ? 1.12 : .96
  const styleMidtone = style === 'outer-bevel' ? .74 : 1

  // Keep the original base color visible, but allow bevel contrast to become much stronger than v0.22.
  const effectMix = .38 + (1 - baseRetention) * .98
  const altitudeTravel = .24 + (1 - altitude) * .76
  const travel = Math.min(edgeSize * .78, thicknessPx * .38) * altitudeTravel * styleSpread
  const dx = Math.cos(angle) * travel
  const dy = Math.sin(angle) * travel

  // Convex/concave and Up/Down both affect light/shadow orientation.
  const sign = (fx.embossMode === 'concave' ? -1 : 1) * (direction === 'down' ? -1 : 1)

  // Depth primarily increases tonal contrast, not geometry displacement.
  const depthGain = Math.min(2.2, .34 + depth * 1.05)
  const highlightAltitude = .78 + altitude * .30
  const shadowAltitude = .50 + (1 - altitude) * .66

  const coreBlur = Math.max(.08, softness * (.46 - sharpness * .40) * techniqueBlur)
  const mediumBlur = Math.max(.28, (softness * (.54 + (1 - sharpness) * .22) + edgeSize * .035) * (.86 + techniqueBlur * .14))
  const softBlur = Math.max(.65, (softness + edgeSize * (.14 + (1 - altitude) * .18)) / techniqueSoftSpread)

  const highlightColor = validColor(fx.embossHighlightColor, '#FFF9C5')
  const representativeColor = design.twoToneFlow.enabled
    ? validColor(design.twoToneFlow.colorA, validColor(design.color))
    : validColor(design.color)
  const autoShadow = mixHex(representativeColor, '#000000', .16 + clamp01(fx.embossAutoShadowDarkness) * .58)
  const shadowColor = fx.embossAutoShadowColor
    ? autoShadow
    : validColor(fx.embossShadowColor, autoShadow)

  const highlightAlpha = clamp01(fx.embossHighlightOpacity) * depthGain * effectMix * highlightAltitude
  const shadowAlpha = clamp01(fx.embossShadowOpacity) * depthGain * effectMix * shadowAltitude
  const highlightBlend = resolveEmbossBlend(fx.embossHighlightBlend)
  const shadowBlend = resolveEmbossShadowBlend(fx.embossShadowBlend)

  ctx.save()

  // A center-body pass is essential: without it the result reads as a thick stroke rather than a rounded tube.
  const midtone = clamp01(fx.embossMidtoneStrength) * (.34 + altitude * .34) * depthGain * effectMix * styleMidtone
  if (fx.embossMode === 'convex') {
    drawEmbossMidtonePass(ctx, maskCanvas, highlightColor, midtone * .45, 'soft-light')
    drawEmbossMidtonePass(ctx, maskCanvas, shadowColor, midtone * .14, shadowBlend)
  } else {
    drawEmbossMidtonePass(ctx, maskCanvas, shadowColor, midtone * .52, shadowBlend)
    drawEmbossMidtonePass(ctx, maskCanvas, highlightColor, midtone * .11, 'soft-light')
  }

  // Thin bright core + medium highlight + soft light wrap.
  drawEmbossEdgePass(ctx, maskCanvas, -dx * sign * .34, -dy * sign * .34, coreBlur, highlightColor, highlightAlpha * (.76 * techniqueCore), highlightBlend)
  drawEmbossEdgePass(ctx, maskCanvas, -dx * sign * .62, -dy * sign * .62, mediumBlur, highlightColor, highlightAlpha * .52, highlightBlend)
  drawEmbossEdgePass(ctx, maskCanvas, -dx * sign, -dy * sign, softBlur, highlightColor, highlightAlpha * .28, 'soft-light')

  // Shadow uses its own blend mode. Multiply is the default, matching Photoshop-like bevel controls.
  drawEmbossEdgePass(ctx, maskCanvas, dx * sign * .38, dy * sign * .38, mediumBlur * .72, shadowColor, shadowAlpha * .36, shadowBlend)
  drawEmbossEdgePass(ctx, maskCanvas, dx * sign * .74, dy * sign * .74, softBlur, shadowColor, shadowAlpha * .60, shadowBlend)
  drawEmbossEdgePass(ctx, maskCanvas, dx * sign, dy * sign, softBlur * 1.26 + edgeSize * .025, shadowColor, shadowAlpha * .30, shadowBlend)

  ctx.restore()
}

function beginRingPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation = 0) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2 + rotation, Math.PI * 1.5 + rotation)
}

function strokeCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation = 0) {
  beginRingPath(ctx, cx, cy, r, rotation)
  ctx.stroke()
}

function irregularPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, roughness: number, rotation: number, seed: number, scallop = false, waveCount = 0, amplitude = 0) {
  const rand = seeded(seed)
  const points = 240
  ctx.beginPath()
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * TAU + rotation - Math.PI / 2
    const hasBulge = waveCount > 0 && amplitude !== 0
    const wave = !hasBulge ? 0 : scallop ? Math.abs(Math.sin((t + rotation) * waveCount / 2)) * amplitude : Math.sin((t + rotation) * waveCount) * amplitude
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
  if (ctx.lineWidth > 0) ctx.stroke()
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
  if (ctx.lineWidth > 0) ctx.stroke()
  ctx.restore()
}

function drawRibbon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  const s = size / 26
  ctx.scale(s, s)

  const baseFill = `${ctx.fillStyle}`
  const oldAlpha = ctx.globalAlpha

  ctx.fillStyle = baseFill

  // 상단 루프를 아주 조금 더 두툼하게 조정
  ctx.beginPath()
  ctx.moveTo(-2.1, 0.2)
  ctx.bezierCurveTo(-9.3, -12.0, -25.6, -13.8, -29.1, -4.1)
  ctx.bezierCurveTo(-31.6, 3.0, -24.6, 9.2, -14.5, 8.6)
  ctx.bezierCurveTo(-7.3, 8.2, -2.8, 5.0, -2.1, 1.5)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(2.1, 0.2)
  ctx.bezierCurveTo(9.3, -12.0, 25.6, -13.8, 29.1, -4.1)
  ctx.bezierCurveTo(31.6, 3.0, 24.6, 9.2, 14.5, 8.6)
  ctx.bezierCurveTo(7.3, 8.2, 2.8, 5.0, 2.1, 1.5)
  ctx.closePath()
  ctx.fill()

  // 아래 꼬리: 아주 조금 더 얇게, 끝은 둥글지도 뾰족하지도 않게 일자 마감
  ctx.beginPath()
  ctx.moveTo(-4.6, 4.5)
  ctx.bezierCurveTo(-10.2, 7.8, -17.8, 13.3, -20.7, 18.0)
  ctx.lineTo(-20.2, 20.3)
  ctx.lineTo(-15.7, 20.3)
  ctx.bezierCurveTo(-12.7, 19.4, -8.9, 16.5, -6.0, 13.2)
  ctx.bezierCurveTo(-3.9, 10.8, -2.3, 8.2, -1.0, 5.2)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(4.6, 4.5)
  ctx.bezierCurveTo(10.2, 7.8, 17.8, 13.3, 20.7, 18.0)
  ctx.lineTo(20.2, 20.3)
  ctx.lineTo(15.7, 20.3)
  ctx.bezierCurveTo(12.7, 19.4, 8.9, 16.5, 6.0, 13.2)
  ctx.bezierCurveTo(3.9, 10.8, 2.3, 8.2, 1.0, 5.2)
  ctx.closePath()
  ctx.fill()

  // 중앙 매듭도 소폭 정리
  ctx.beginPath()
  ctx.ellipse(0, 0.9, 6.3, 5.6, 0, 0, TAU)
  ctx.fill()

  // 내부 구멍은 조금만 비워 상단 두께감 유지
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.ellipse(-14.3, -0.8, 8.3, 4.6, 0.18, 0, TAU)
  ctx.ellipse(14.3, -0.8, 8.3, 4.6, -0.18, 0, TAU)
  ctx.fill()
  ctx.restore()

  // 약한 하이라이트
  ctx.fillStyle = '#FFFFFF'
  ctx.globalAlpha = oldAlpha * 0.15
  ctx.beginPath()
  ctx.ellipse(-8.7, -5.2, 5.4, 2.0, -0.35, 0, TAU)
  ctx.ellipse(8.7, -5.2, 5.4, 2.0, 0.35, 0, TAU)
  ctx.ellipse(-1.0, 0.0, 2.0, 1.5, -0.4, 0, TAU)
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
  if (ctx.lineWidth > 0) ctx.stroke()
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


function makeOutlineDesign(design: FrameDesign): FrameDesign {
  const outlineColor = validColor(design.effects.outlineColor, '#FFFFFF')
  const width = Math.max(1, design.effects.outlineWidth)
  const next: FrameDesign = structuredClone(design)
  if (next.kind === 'glitter') {
    next.kind = 'basic'
    next.color = outlineColor
    next.secondaryColor = outlineColor
    next.gradientMode = 'solid'
    next.twoToneFlow = { ...next.twoToneFlow, enabled: false, colorA: outlineColor, colorB: outlineColor }
    next.thickness += width * 2
    return next
  }
  next.color = outlineColor
  next.secondaryColor = outlineColor
  next.gradientMode = 'solid'
  next.gradientAngle = 0
  next.gradientStops = next.gradientStops.map(stop => ({ ...stop, color: outlineColor }))
  next.twoToneFlow = { ...next.twoToneFlow, enabled: false, colorA: outlineColor, colorB: outlineColor }

  switch (next.kind) {
    case 'basic':
    case 'double':
    case 'triple':
      if (next.tripleRing.attached) {
        const extraPerLine = (width * 2) / 3
        next.tripleRing = {
          ...next.tripleRing,
          colors: [outlineColor, outlineColor, outlineColor],
          widths: [
            Math.max(1, next.tripleRing.widths[0] + extraPerLine),
            Math.max(1, next.tripleRing.widths[1] + extraPerLine),
            Math.max(1, next.tripleRing.widths[2] + extraPerLine),
          ],
        }
      }
      next.thickness += width * 2
      break
    case 'segmented':
    case 'arc':
    case 'wavy':
    case 'scallop':
    case 'scribble':
    case 'rough':
    case 'brush':
    case 'glossy':
      next.thickness += width * 2
      break
    case 'dotted':
    case 'sparkle':
    case 'star':
    case 'heart':
    case 'ribbon':
    case 'flower':
      next.pattern.decorationSize += width * 2
      next.pattern.paletteColors = [outlineColor, outlineColor, outlineColor, outlineColor]
      next.pattern.colorCount = 1
      break
    case 'asset':
      next.pattern.decorationSize += width * 2
      next.pattern.assetTintMode = 'palette'
      next.pattern.paletteColors = [outlineColor, outlineColor, outlineColor, outlineColor]
      next.pattern.colorCount = 1
      break
  }
  return next
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
    ctx.strokeStyle = color
    drawDecorationAt(ctx, design, x, y, size, a, centerColor)
  }
}


function drawEqualSegments(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rotation: number, dash: number, gap: number) {
  const circumference = TAU * r
  const safeDash = Math.max(1, dash)
  const safeGap = Math.max(0, gap)

  let count = Math.max(1, Math.round(circumference / Math.max(1, safeDash + safeGap)))
  // gap이 너무 커서 실제 세그먼트 길이가 0 이하가 되는 경우를 방지
  while (count > 1 && circumference - safeGap * count <= count) count -= 1

  const segmentLength = Math.max(1, (circumference - safeGap * count) / count)
  const segAngle = segmentLength / r
  const gapAngle = safeGap / r
  const startBase = rotation - Math.PI / 2

  for (let i = 0; i < count; i++) {
    const start = startBase + i * (segAngle + gapAngle)
    const end = start + segAngle
    ctx.beginPath()
    ctx.arc(cx, cy, r, start, end)
    ctx.stroke()
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



function drawJellyRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  design: FrameDesign,
  rotation: number,
  scale: number,
) {
  const thickness = Math.max(3, design.thickness * scale)
  const jelly = design.jelly
  const base = validColor(design.color, '#FF2760')
  const light = validColor(design.secondaryColor, '#FF6F91')
  const shadow = validColor(jelly.shadowColor, '#8A1740')
  const highlight = validColor(jelly.highlightColor, '#FFFFFF')
  const volume = clamp01(jelly.volume)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // dark outer body
  ctx.strokeStyle = mixHex(base, shadow, .30 + volume * .16)
  ctx.lineWidth = thickness
  strokeCircle(ctx, cx, cy, radius, rotation)

  // colored body layer
  ctx.globalAlpha *= .98
  ctx.strokeStyle = base
  ctx.lineWidth = thickness * .91
  strokeCircle(ctx, cx, cy, radius - thickness * .006, rotation)

  // soft inner volume band
  ctx.globalAlpha *= .78
  ctx.strokeStyle = mixHex(base, light, .45 + volume * .20)
  ctx.lineWidth = thickness * .63
  strokeCircle(ctx, cx, cy, radius - thickness * .08, rotation)

  // lower/right shadow gives balloon volume without blur-heavy glow
  ctx.globalAlpha = clamp01(jelly.shadowOpacity) * (.52 + volume * .35)
  ctx.strokeStyle = shadow
  ctx.lineWidth = Math.max(2, thickness * .11)
  const shadowSpan = Math.PI * .72
  ctx.beginPath()
  ctx.arc(cx, cy, radius + thickness * .28, rotation + Math.PI * .08, rotation + Math.PI * .08 + shadowSpan)
  ctx.stroke()

  // long curved glossy highlights distributed around the ring
  const count = Math.max(1, Math.min(8, Math.round(jelly.highlightCount)))
  const span = Math.max(.06, Math.min(.42, jelly.highlightLength)) * TAU
  ctx.globalAlpha = clamp01(jelly.highlightOpacity)
  ctx.strokeStyle = highlight
  ctx.lineWidth = Math.max(2, thickness * Math.max(.035, jelly.highlightWidth))
  ctx.shadowBlur = 0
  for (let i = 0; i < count; i++) {
    const center = rotation - Math.PI / 2 + (i / count) * TAU - .18
    const rr = radius - thickness * .18
    ctx.beginPath()
    ctx.arc(cx, cy, rr, center - span / 2, center + span / 2)
    ctx.stroke()
  }

  // thin inner glint makes the central hole edge crisp
  ctx.globalAlpha = .34 + volume * .18
  ctx.strokeStyle = mixHex(light, '#FFFFFF', .60)
  ctx.lineWidth = Math.max(1, thickness * .035)
  strokeCircle(ctx, cx, cy, Math.max(1, radius - thickness * .43), rotation)
  ctx.restore()
}

function angularDistance(a: number, b: number) {
  const d = Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI)
  return Math.min(Math.PI, d)
}

function drawFourPointGlint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) {
  const short = size * .15
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(short, -short)
  ctx.lineTo(size, 0)
  ctx.lineTo(short, short)
  ctx.lineTo(0, size)
  ctx.lineTo(-short, short)
  ctx.lineTo(-size, 0)
  ctx.lineTo(-short, -short)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp01((value - edge0) / Math.max(.0001, edge1 - edge0))
  return x * x * (3 - 2 * x)
}

function glitterMotion(
  style: FrameDesign['glitter']['animationStyle'],
  angle: number,
  phase: number,
  time: number,
  strength: number,
  sweepWidth: number,
  smoothness: number,
) {
  const smooth = clamp01(smoothness)
  const slowWave = .5 + .5 * Math.sin(time + phase * 2.13)
  const secondaryWave = .5 + .5 * Math.sin(time * 2 + phase * 4.91)
  const breathing = smoothstep(0, 1, slowWave)
  const twinkle = clamp01(breathing * .72 + secondaryWave * .28)

  // Flash still has a peak, but it eases in/out instead of crossing a hard on/off threshold.
  const flashStart = .48 + smooth * .08
  const flash = smoothstep(flashStart, .98, twinkle)
  const softenedFlash = flash * (.68 + .32 * breathing)

  // Moving light bands have a wider head plus a soft trailing lobe so they glide rather than jump.
  const width = Math.max(.05, sweepWidth * (1 + smooth * .45)) * TAU
  const sweepAngle = (time + phase * .018) % TAU
  const distance = angularDistance(angle, sweepAngle)
  const sweepHead = Math.exp(-Math.pow(distance / width, 2) * 1.75)
  const trailAngle = sweepAngle - width * .42
  const sweepTrail = Math.exp(-Math.pow(angularDistance(angle, trailAngle) / (width * 1.35), 2) * 1.55)
  const sweep = clamp01(sweepHead * .74 + sweepTrail * .34)

  const oppositeAngle = sweepAngle + Math.PI
  const opposite = Math.exp(-Math.pow(angularDistance(angle, oppositeAngle) / (width * 1.1), 2) * 1.7)

  let value = twinkle
  if (style === 'flash') value = .24 + softenedFlash * .76
  if (style === 'shimmer') value = .26 + sweep * .74
  if (style === 'orbit') value = .22 + Math.max(sweep, opposite * .82) * .78
  if (style === 'mixed') value = clamp01(.20 + twinkle * .34 + softenedFlash * .20 + sweep * .42)

  // Never fully disappear: a faint afterglow prevents the frame from looking like discrete animation frames.
  const floor = .22 + smooth * .12
  const eased = floor + (1 - floor) * smoothstep(0, 1, clamp01(value))
  return (1 - strength) * .78 + strength * eased
}

function drawLegacyGlitter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  design: FrameDesign,
  rotation: number,
  scale: number,
  animationTimeMs = 0,
  animationProgress?: number,
) {
  const glitter = design.glitter
  const thickness = Math.max(1, design.thickness * scale)
  const basePaint = makeGradient(ctx, design, cx, cy, r)
  const baseOpacity = clamp01(glitter.baseOpacity)
  const edgeHighlight = clamp01(glitter.edgeHighlight)
  const rand = seeded(design.pattern.seed)
  const colors = glitter.colors
    .slice(0, Math.max(1, Math.min(4, glitter.colorCount)))
    .map((color, index) => validColor(color, index === 0 ? '#FFFFFF' : validColor(design.color)))
  const density = Math.max(12, Math.min(720, Math.round(glitter.density)))
  const spread = Math.max(1, glitter.spread * scale)
  const particleSize = Math.max(.7, glitter.particleSize * scale)
  const sparkleSize = Math.max(2, glitter.sparkleSize * scale)
  const sparkleRatio = clamp01(glitter.sparkleRatio)
  const particleGlow = Math.max(0, glitter.glow * scale)
  const animationStrength = glitter.animated ? clamp01(glitter.animationStrength) : 0
  const animationSpeed = Math.max(.05, glitter.animationSpeed || 1)
  const animationSmoothness = clamp01(glitter.animationSmoothness ?? .86)
  const baseTime = animationProgress == null
    ? (animationTimeMs / 1000) * animationSpeed * TAU
    : (((animationProgress % 1) + 1) % 1) * TAU
  const flowDirection = glitter.flowDirection === -1 ? -1 : 1
  const time = baseTime * (glitter.flowEnabled ? flowDirection : 1)

  // Semi-transparent pearly base keeps the ring shape readable underneath the glitter.
  ctx.save()
  ctx.globalAlpha *= baseOpacity
  ctx.lineWidth = Math.max(1, thickness * .72)
  ctx.strokeStyle = basePaint
  ctx.lineCap = 'round'
  strokeCircle(ctx, cx, cy, r, rotation)
  ctx.restore()

  // A fine inner/outer highlight gives the soft coated edge visible in the reference.
  if (edgeHighlight > 0) {
    const edgeColor = mixHex(validColor(design.secondaryColor, '#FFFFFF'), '#FFFFFF', .72)
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.globalAlpha *= edgeHighlight * (side < 0 ? .52 : .72)
      ctx.strokeStyle = edgeColor
      ctx.lineWidth = Math.max(.8, thickness * .045)
      ctx.shadowColor = edgeColor
      ctx.shadowBlur = Math.max(0, particleGlow * .45)
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1, r + side * thickness * .39), 0, TAU)
      ctx.stroke()
      ctx.restore()
    }
  }

  // Deterministic glitter positions: preview and exported PNG stay pixel-consistent.
  for (let i = 0; i < density; i++) {
    const jitter = rand()
    const angle = rotation - Math.PI / 2 + ((i + jitter * .92) / density) * TAU
    const radial = (rand() * 2 - 1) * spread
    const rr = r + radial
    const x = cx + Math.cos(angle) * rr
    const y = cy + Math.sin(angle) * rr
    const color = colors[Math.floor(rand() * colors.length)] ?? '#FFFFFF'
    const phase = rand() * TAU
    const baseAlpha = .18 + rand() * .72
    const style = glitter.particleStyle ?? 'soft'
    const styleSparkleBoost = style === 'twinkle' ? .18 : style === 'luminous' ? .06 : style === 'sugar' ? -.05 : 0
    const isSparkle = rand() < clamp01(sparkleRatio + styleSparkleBoost)
    const motion = glitterMotion(glitter.animationStyle, angle, phase, time, animationStrength, glitter.sweepWidth, animationSmoothness)
    const alphaBoost = style === 'luminous' ? .12 : style === 'sugar' ? .06 : 0
    const alpha = baseAlpha * (.34 + motion * .70 + alphaBoost)
    // Size barely changes; brightness does most of the animation so the ring does not look like popping dots.
    const pulseSize = .88 + motion * .16

    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.shadowColor = validColor(glitter.glowColor, color)
    ctx.shadowBlur = particleGlow * (isSparkle ? (.16 + motion * .72) : (.06 + motion * .20))

    if (isSparkle) {
      const size = sparkleSize * (.42 + rand() * .62) * pulseSize
      drawFourPointGlint(ctx, x, y, size, angle * .15 + phase)

      // Cross rays now fade continuously instead of suddenly switching on/off at a brightness threshold.
      const rayAlpha = smoothstep(.34, .92, motion)
      ctx.save()
      ctx.globalAlpha *= rayAlpha * .68
      ctx.strokeStyle = validColor(glitter.highlightColor, '#FFFFFF')
      ctx.lineWidth = Math.max(.48, size * .04)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - size * (.58 + rayAlpha * .36), y)
      ctx.lineTo(x + size * (.58 + rayAlpha * .36), y)
      ctx.moveTo(x, y - size * (.58 + rayAlpha * .36))
      ctx.lineTo(x, y + size * (.58 + rayAlpha * .36))
      ctx.stroke()
      ctx.restore()

      ctx.globalAlpha *= .76 + rayAlpha * .12
      ctx.fillStyle = validColor(glitter.highlightColor, '#FFFFFF')
      ctx.beginPath()
      ctx.arc(x, y, Math.max(.4, size * .065), 0, TAU)
      ctx.fill()
    } else {
      const styleSize = style === 'soft' ? .72 : style === 'sugar' ? 1.06 : style === 'luminous' ? .84 : 1
      const size = particleSize * styleSize * (.28 + rand() * .92) * (.64 + motion * .48)
      if (style === 'sugar') {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(Math.PI / 4 + phase * .2)
        ctx.fillRect(-size * .42, -size * .42, size * .84, size * .84)
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(.34, size / 2), 0, TAU)
        ctx.fill()
      }

      const hasPinHighlight = rand() < (style === 'soft' ? .18 : .28)
      if (hasPinHighlight) {
        const pinAlpha = smoothstep(.46, .96, motion)
        ctx.globalAlpha *= pinAlpha * .58
        ctx.fillStyle = validColor(glitter.highlightColor, '#FFFFFF')
        ctx.beginPath()
        ctx.arc(x - size * .08, y - size * .10, Math.max(.22, size * .10), 0, TAU)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}


function glitterSurfaceKey(design: FrameDesign, r: number, scale: number) {
  const g = design.glitter
  return JSON.stringify([
    Math.round(r * 100) / 100,
    Math.round(scale * 10000) / 10000,
    design.thickness,
    design.color,
    design.secondaryColor,
    design.gradientMode,
    design.gradientAngle,
    design.gradientStops.map(stop => [stop.position, stop.color]),
    g.surfaceStyle,
    g.density,
    g.particleSize,
    g.particleSizeVariation,
    g.textureContrast,
    g.surfaceHighlight,
    g.rimStrength,
    g.baseOpacity,
    g.colorCount,
    g.colors.slice(0, g.colorCount),
    g.highlightColor,
    design.pattern.seed,
  ])
}

function surfacePalette(design: FrameDesign) {
  const g = design.glitter
  const colors = g.colors
    .slice(0, Math.max(1, Math.min(4, g.colorCount)))
    .map((color, index) => validColor(color, index === 0 ? validColor(design.color) : validColor(design.secondaryColor, '#FFFFFF')))
  return colors.length ? colors : [validColor(design.color)]
}

function makeSurfaceGlitterGradient(
  ctx: CanvasRenderingContext2D,
  design: FrameDesign,
  cx: number,
  cy: number,
  r: number,
) {
  const g = design.glitter
  const colors = surfacePalette(design)
  if (g.surfaceStyle !== 'gradient' && g.surfaceStyle !== 'holographic') {
    if (design.gradientMode !== 'solid') return makeGradient(ctx, design, cx, cy, r)
    if (colors.length === 1) return colors[0]
    const subtle = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
    subtle.addColorStop(0, mixHex(colors[1] ?? colors[0], '#FFFFFF', .18))
    subtle.addColorStop(.48, colors[0])
    subtle.addColorStop(1, mixHex(colors[Math.min(colors.length - 1, 2)] ?? colors[0], design.color, .34))
    return subtle
  }
  if (colors.length === 1) return colors[0]

  const gradient = ctx.createConicGradient(-Math.PI / 2 + (design.gradientAngle * Math.PI) / 180, cx, cy)
  if (g.surfaceStyle === 'gradient' && colors.length >= 4) {
    const stops = [
      [0, colors[0]],
      [.18, colors[1]],
      [.50, colors[2]],
      [.78, colors[3]],
      [1, colors[0]],
    ] as Array<[number, string]>
    stops.forEach(([position, color]) => gradient.addColorStop(position, color))
    return gradient
  }

  const repeats = g.surfaceStyle === 'holographic' ? 1 : 1
  const count = colors.length * repeats
  for (let i = 0; i <= count; i++) {
    gradient.addColorStop(i / count, colors[i % colors.length])
  }
  return gradient
}

function createSurfaceGlitterTexture(design: FrameDesign, r: number, scale: number) {
  const g = design.glitter
  const thickness = Math.max(1, design.thickness * scale)
  const pad = Math.ceil(Math.max(6 * scale, g.particleSize * scale * 2, thickness * .08))
  const half = Math.ceil(r + thickness / 2 + pad)
  const size = Math.max(8, half * 2)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const cx = size / 2
  const cy = size / 2
  const outer = r + thickness / 2
  const inner = Math.max(1, r - thickness / 2)
  const rand = seeded(design.pattern.seed + 35051)
  const colors = surfacePalette(design)
  const contrast = clamp01(g.textureContrast)
  const variation = clamp01(g.particleSizeVariation)
  const style = g.surfaceStyle
  const densityMultiplier = style === 'fine' ? 1.4 : style === 'twinkle' ? 1.18 : style === 'holographic' ? 1.08 : 1.2
  const density = Math.max(80, Math.min(1600, Math.round(g.density * densityMultiplier)))
  const baseSize = Math.max(.35, g.particleSize * scale)

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, outer, 0, TAU)
  ctx.arc(cx, cy, inner, 0, TAU, true)
  ctx.clip('evenodd')

  ctx.globalAlpha = Math.max(.2, clamp01(g.baseOpacity) * .94)
  ctx.fillStyle = makeSurfaceGlitterGradient(ctx, design, cx, cy, r)
  ctx.fillRect(0, 0, size, size)

  if (g.surfaceHighlight > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = validColor(g.highlightColor, '#FFFFFF')
    ctx.globalAlpha = clamp01(g.surfaceHighlight) * .20
    ctx.lineWidth = Math.max(1, thickness * .46)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy, r, -2.78, -1.05)
    ctx.stroke()
    ctx.globalAlpha *= .62
    ctx.lineWidth = Math.max(1, thickness * .26)
    ctx.beginPath()
    ctx.arc(cx, cy, r, .24, 1.18)
    ctx.stroke()
    ctx.restore()
  }

  for (let i = 0; i < density; i++) {
    const angularJitter = rand()
    const angle = ((i + angularJitter) / density) * TAU
    const radial = (rand() * 2 - 1) * thickness * .43
    const rr = r + radial
    const x = cx + Math.cos(angle) * rr
    const y = cy + Math.sin(angle) * rr
    const sizeVariance = 1 + (rand() * 2 - 1) * variation
    const particle = Math.max(.28, baseSize * sizeVariance)
    const shine = Math.pow(rand(), 1.45)
    const alpha = (.08 + shine * (.30 + contrast * .48)) * (style === 'fine' ? .82 : 1)
    const sourceColor = colors[Math.floor(rand() * colors.length)] ?? '#FFFFFF'
    const whiteMix = .28 + shine * (.34 + contrast * .24)
    const color = mixHex(sourceColor, '#FFFFFF', whiteMix)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.strokeStyle = color

    if (style === 'holographic' && rand() < .32) {
      const w = particle * (1.1 + rand() * .9)
      const h = Math.max(.35, particle * .32)
      ctx.translate(x, y)
      ctx.rotate(angle + (rand() - .5) * .8)
      ctx.fillRect(-w / 2, -h / 2, w, h)
    } else if (style === 'gradient' && rand() < .18) {
      ctx.lineWidth = Math.max(.35, particle * .22)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - particle * .55, y)
      ctx.lineTo(x + particle * .55, y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, Math.max(.2, particle * (style === 'fine' ? .32 : .42)), 0, TAU)
      ctx.fill()
    }

    if (shine > .86 && rand() < .34) {
      ctx.globalAlpha *= .72
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(x - particle * .12, y - particle * .12, Math.max(.18, particle * .10), 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.restore()

  const rim = clamp01(g.rimStrength)
  if (rim > 0) {
    const rimColor = mixHex(validColor(design.secondaryColor, '#FFFFFF'), '#FFFFFF', .76)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = rimColor
    ctx.lineCap = 'round'
    ctx.shadowBlur = 0
    for (const [radius, alpha, width] of [
      [outer - Math.max(.5, scale * .65), rim * .68, Math.max(.7, thickness * .035)],
      [inner + Math.max(.5, scale * .65), rim * .92, Math.max(.7, thickness * .048)],
    ] as Array<[number, number, number]>) {
      ctx.globalAlpha = alpha
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, TAU)
      ctx.stroke()
    }
    ctx.restore()
  }

  return canvas
}

function getSurfaceGlitterTexture(design: FrameDesign, r: number, scale: number) {
  const key = glitterSurfaceKey(design, r, scale)
  const cached = glitterSurfaceCache.get(key)
  if (cached) return cached
  const canvas = createSurfaceGlitterTexture(design, r, scale)
  glitterSurfaceCache.set(key, canvas)
  // Count-only eviction retained 14 very large RGBA textures (hundreds of MB).
  // Keep newest texture and evict older ones by estimated pixel memory.
  const budgetBytes = 96 * 1024 * 1024
  const cacheBytes = () => [...glitterSurfaceCache.values()]
    .reduce((total, item) => total + item.width * item.height * 4, 0)
  while (glitterSurfaceCache.size > 1 &&
    (glitterSurfaceCache.size > 14 || cacheBytes() > budgetBytes)) {
    const oldest = glitterSurfaceCache.keys().next().value
    if (oldest == null) break
    glitterSurfaceCache.delete(oldest)
  }
  return canvas
}

function surfaceAnimationCycle(
  glitter: FrameDesign['glitter'], animationTimeMs: number,
  animationProgress?: number, loopDurationSec?: number,
) {
  const speed = Math.max(.05, glitter.animationSpeed || 1)
  if (animationProgress != null && loopDurationSec) {
    const cycles = Math.max(1, Math.round(speed * loopDurationSec))
    return ((animationProgress * cycles) % 1 + 1) % 1
  }
  return (((animationTimeMs / 1000) * speed) % 1 + 1) % 1
}

function drawSurfaceGlitterOverlay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  design: FrameDesign,
  rotation: number,
  scale: number,
  animationTimeMs: number,
  animationProgress?: number,
  loopDurationSec?: number,
) {
  const g = design.glitter
  const mode = g.animationMode
  if (!g.animated || mode === 'none' || mode === 'rotate') return

  const cycle = surfaceAnimationCycle(g, animationTimeMs, animationProgress, loopDurationSec)
  const thickness = Math.max(1, design.thickness * scale)
  const direction = g.flowDirection === -1 ? -1 : 1

  if (mode === 'sweep') {
    const centerAngle = rotation - Math.PI / 2 + direction * cycle * TAU
    const span = Math.max(.08, Math.min(.75, g.sweepWidth * TAU * .52))
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = validColor(g.highlightColor, '#FFFFFF')
    ctx.lineCap = 'round'
    ctx.shadowColor = validColor(g.glowColor, '#FFFFFF')
    ctx.shadowBlur = Math.max(0, g.glow * scale * .45)
    ctx.globalAlpha *= .18 + clamp01(g.animationStrength) * .48
    ctx.lineWidth = Math.max(1, thickness * .18)
    ctx.beginPath()
    ctx.arc(cx, cy, r, centerAngle - span / 2, centerAngle + span / 2)
    ctx.stroke()
    ctx.globalAlpha *= .55
    ctx.lineWidth = Math.max(.7, thickness * .055)
    ctx.beginPath()
    ctx.arc(cx, cy, r - thickness * .34, centerAngle - span * .34, centerAngle + span * .34)
    ctx.stroke()
    ctx.restore()
    return
  }

  const rand = seeded(design.pattern.seed + 90271)
  const count = Math.max(0, Math.min(18, Math.round(g.accentSparkleCount)))
  const duration = Math.max(.04, Math.min(.8, g.accentSparkleDuration))
  const strength = clamp01(g.animationStrength)
  const sparkleSize = Math.max(1, g.sparkleSize * scale)

  for (let i = 0; i < count; i++) {
    const angle = rotation - Math.PI / 2 + rand() * TAU
    const radial = (rand() * 2 - 1) * thickness * .31
    const rr = r + radial
    const x = cx + Math.cos(angle) * rr
    const y = cy + Math.sin(angle) * rr
    const phase = rand()
    const wave = .5 + .5 * Math.cos(TAU * (cycle + phase))
    const pulse = smoothstep(1 - duration, 1, wave)
    if (pulse < .015) continue
    const size = sparkleSize * (.46 + rand() * .42) * (.82 + pulse * .18)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha *= pulse * (.28 + strength * .68)
    ctx.fillStyle = validColor(g.highlightColor, '#FFFFFF')
    ctx.shadowColor = validColor(g.glowColor, '#FFFFFF')
    ctx.shadowBlur = Math.max(0, g.glow * scale * (.18 + pulse * .36))
    drawFourPointGlint(ctx, x, y, size, angle * .08 + phase * TAU)
    ctx.globalAlpha *= .75
    ctx.beginPath()
    ctx.arc(x, y, Math.max(.4, size * .06), 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

function drawSurfaceGlitter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  design: FrameDesign,
  rotation: number,
  scale: number,
  animationTimeMs = 0,
  animationProgress?: number,
  loopDurationSec?: number,
) {
  const texture = getSurfaceGlitterTexture(design, r, scale)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotation)
  ctx.drawImage(texture, -texture.width / 2, -texture.height / 2)
  ctx.restore()
  drawSurfaceGlitterOverlay(ctx, cx, cy, r, design, rotation, scale, animationTimeMs, animationProgress, loopDurationSec)
}

function drawGlitter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  design: FrameDesign,
  rotation: number,
  scale: number,
  animationTimeMs = 0,
  animationProgress?: number,
  loopDurationSec?: number,
) {
  if (design.glitter.surfaceStyle === 'legacy') {
    drawLegacyGlitter(ctx, cx, cy, r, design, rotation, scale, animationTimeMs, animationProgress)
    return
  }
  drawSurfaceGlitter(ctx, cx, cy, r, design, rotation, scale, animationTimeMs, animationProgress, loopDurationSec)
}

function drawAttachedTriple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  design: FrameDesign,
  scale: number,
) {
  const widths = design.tripleRing.widths.map(value => Math.max(1, value * scale)) as [number, number, number]
  const colors = design.tripleRing.colors.map((value, index) =>
    validColor(value, index === 0 ? design.color : index === 1 ? design.secondaryColor : design.color)
  ) as [string, string, string]

  const totalWidth = widths[0] + widths[1] + widths[2]
  const allSameColor = colors[0] === colors[1] && colors[1] === colors[2]

  // Outline passes often turn all three bands into one color. Draw them as one solid band
  // so the outline surrounds the whole triple ring instead of creating separators.
  if (allSameColor) {
    ctx.save()
    ctx.strokeStyle = colors[0]
    ctx.lineWidth = Math.max(1, totalWidth)
    ctx.lineCap = 'round'
    strokeCircle(ctx, cx, cy, r, 0)
    ctx.restore()
    return
  }

  // Keep the combined triple band centered on design.radius.
  // Each stroke is slightly overlapped to remove anti-aliasing hairline gaps.
  const overlap = Math.max(.65, scale * .75)
  let outerEdge = r + totalWidth / 2

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < 3; i++) {
    const width = widths[i]
    const lineRadius = outerEdge - width / 2
    ctx.strokeStyle = colors[i]
    ctx.lineWidth = width + overlap
    strokeCircle(ctx, cx, cy, Math.max(1, lineRadius), 0)
    outerEdge -= width
  }
  ctx.restore()
}

function drawDesignCore(ctx: CanvasRenderingContext2D, design: FrameDesign, scale: number, canvasWidth: number, canvasHeight: number, animationTimeMs = 0, animationProgress?: number, sceneTimeSec = 0, loopDurationSec?: number) {
  const cx = canvasWidth / 2 + design.offsetX * scale
  const cy = canvasHeight / 2 + design.offsetY * scale
  const r = design.radius * scale
  const motionRotation = animatedFrameRotation(design, sceneTimeSec, loopDurationSec)
  const rot = ((design.rotation + motionRotation) * Math.PI) / 180

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
      if (design.tripleRing.attached) {
        drawAttachedTriple(ctx, cx, cy, r, design, scale)
      } else {
        const ringGap = Math.max(18, design.thickness * 1.65) * scale
        strokeCircle(ctx, cx, cy, r - ringGap, rot)
        strokeCircle(ctx, cx, cy, r, rot)
        strokeCircle(ctx, cx, cy, r + ringGap, rot)
      }
      break
    }
    case 'segmented': {
      drawEqualSegments(ctx, cx, cy, r, rot, Math.max(1, design.pattern.dash * scale), Math.max(0, design.pattern.gap * scale))
      break
    }
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
        irregularPath(ctx, cx, cy, r + (i - count / 2) * design.thickness * .42 * scale, design.pattern.roughness * scale, rot, design.pattern.seed + i * 97, false, design.pattern.bulgeCount, design.pattern.bulgeAmplitude * scale)
        ctx.stroke()
      }
      break
    }
    case 'rough': {
      const count = Math.max(1, Math.round(design.pattern.strokeCount))
      for (let i = 0; i < count; i++) {
        irregularPath(ctx, cx, cy, r, design.pattern.roughness * scale, rot, design.pattern.seed + i * 41, false, design.pattern.bulgeCount, design.pattern.bulgeAmplitude * scale)
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
    case 'jelly': drawJellyRing(ctx, cx, cy, r, design, rot, scale); break
    case 'glitter': drawGlitter(ctx, cx, cy, r, design, rot, scale, animationTimeMs, animationProgress, loopDurationSec); break
    default: strokeCircle(ctx, cx, cy, r, rot)
  }
}

function drawDesign(ctx: CanvasRenderingContext2D, design: FrameDesign, scale: number, canvasWidth: number, canvasHeight: number, animationTimeMs = 0, animationProgress?: number, sceneTimeSec = 0, loopDurationSec?: number) {
  if (design.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = design.opacity

  if (design.effects.outlineEnabled && design.effects.outlineWidth > 0) {
    ctx.save()
    const outlined = makeOutlineDesign(design)
    drawDesignCore(ctx, outlined, scale, canvasWidth, canvasHeight, animationTimeMs, animationProgress, sceneTimeSec, loopDurationSec)
    ctx.restore()
  }

  if (design.effects.shadowEnabled) {
    ctx.save()
    ctx.shadowColor = validColor(design.effects.shadowColor, '#5B547D')
    ctx.shadowBlur = design.effects.shadowBlur * scale
    ctx.shadowOffsetX = design.effects.shadowOffsetX * scale
    ctx.shadowOffsetY = design.effects.shadowOffsetY * scale
    ctx.globalAlpha *= .7
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight, animationTimeMs, animationProgress, sceneTimeSec, loopDurationSec)
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
      drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight, animationTimeMs, animationProgress, sceneTimeSec, loopDurationSec)
      ctx.restore()
    }
  }

  if (design.effects.bloom > 0) {
    ctx.save()
    ctx.filter = `blur(${(design.effects.bloom * .12) * scale}px)`
    ctx.globalAlpha *= .28
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight, animationTimeMs, animationProgress, sceneTimeSec, loopDurationSec)
    ctx.restore()
  }

  if (design.effects.softBlur > 0) {
    ctx.save()
    ctx.filter = `blur(${design.effects.softBlur * scale}px)`
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight, animationTimeMs, animationProgress, sceneTimeSec, loopDurationSec)
    ctx.restore()
  } else {
    drawDesignCore(ctx, design, scale, canvasWidth, canvasHeight, animationTimeMs, animationProgress, sceneTimeSec, loopDurationSec)
  }

  if (design.twoToneFlow.enabled) {
    const cx = canvasWidth / 2 + design.offsetX * scale
    const cy = canvasHeight / 2 + design.offsetY * scale
    const r = design.radius * scale
    drawTwoToneFlowHighlights(ctx, design, cx, cy, r, scale)
  }

  if (design.effects.embossEnabled) {
    drawEmbossEffect(ctx, design, scale, canvasWidth, canvasHeight)
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
      if (design.tripleRing.attached) {
        const total = design.tripleRing.widths.reduce((sum, value) => sum + Math.max(1, value), 0)
        geometry = r + total / 2 + 1
      } else {
        const ringGap = Math.max(18, thickness * 1.65)
        geometry = r + ringGap + halfLine
      }
      break
    }
    case 'wavy':
    case 'scallop':
      geometry = r + Math.abs(design.pattern.waveAmplitude) + halfLine
      break
    case 'scribble': {
      const count = Math.max(2, Math.round(design.pattern.strokeCount))
      const outerStrokeOffset = (count / 2) * thickness * .42
      geometry = r + outerStrokeOffset + Math.abs(design.pattern.roughness) + Math.abs(design.pattern.bulgeAmplitude) + halfLine
      break
    }
    case 'rough':
      geometry = r + Math.abs(design.pattern.roughness) + Math.abs(design.pattern.bulgeAmplitude) + halfLine
      break
    case 'brush':
      geometry = r + Math.abs(design.pattern.roughness) + Math.abs(design.pattern.bulgeAmplitude) + thickness
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
    case 'jelly':
      geometry = r + halfLine + Math.max(2, thickness * .06)
      break
    case 'glitter': {
      const particleExtent = Math.max(
        Math.max(1, design.thickness) / 2,
        Math.max(1, design.glitter.spread) + Math.max(design.glitter.particleSize, design.glitter.sparkleSize) * .65,
      )
      geometry = r + particleExtent
      break
    }
    default:
      break
  }

  // Auto Fit은 프레임의 실제 구조 크기만 기준으로 계산합니다.
  // Glow / Shadow / Bloom / Soft Blur 같은 시각 효과를 켰을 때
  // 프레임 본체 자체가 갑자기 작아지는 현상을 막기 위해 효과 반경은 제외합니다.
  // Outline은 실제 외곽 형상을 넓히므로 최소한으로만 반영합니다.
  const outline = design.effects.outlineEnabled ? Math.max(0, design.effects.outlineWidth) * 1.25 : 0
  const offset = Math.max(Math.abs(design.offsetX), Math.abs(design.offsetY))

  return geometry + outline + offset + 8
}

function mediaElementSize(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth || 1, height: source.videoHeight || 1 }
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth || source.width || 1, height: source.naturalHeight || source.height || 1 }
  if (source instanceof HTMLCanvasElement) return { width: source.width || 1, height: source.height || 1 }
  return { width: 1, height: 1 }
}

function mediaAnimationTransform(layer: MediaLayer, sceneTimeSec: number) {
  const a = layer.animation
  let opacity = 1
  let x = 0
  let y = 0
  let rotation = 0
  let scale = 1
  let brightness = 1

  const introRaw = a.intro === 'none' ? 1 : clamp01((sceneTimeSec - a.introStart) / Math.max(.01, a.introDuration))
  const intro = easeValue(introRaw, a.ease)
  if (a.intro !== 'none' && introRaw < 1) {
    if (a.intro === 'fade') opacity *= intro
    if (a.intro === 'popup' || a.intro === 'zoom') scale *= .35 + intro * .65
    if (a.intro === 'bounce') scale *= .55 + intro * .45 + Math.sin(intro * Math.PI * 3) * (1 - intro) * .12 * a.bounceStrength
    if (a.intro === 'rotate') rotation += (1 - intro) * -a.rotateAngle
    if (a.intro === 'rotate-zoom') { rotation += (1 - intro) * -a.rotateAngle; scale *= .35 + intro * .65 }
    if (a.intro === 'jump') y += (1 - intro) * a.moveDistance - Math.sin(intro * Math.PI) * a.moveDistance * .45
    if (a.intro === 'slide-left') x -= (1 - intro) * a.moveDistance
    if (a.intro === 'slide-right') x += (1 - intro) * a.moveDistance
    if (a.intro === 'slide-up') y -= (1 - intro) * a.moveDistance
    if (a.intro === 'slide-down') y += (1 - intro) * a.moveDistance
    if (a.intro === 'shake') x += Math.sin(intro * Math.PI * 8) * (1 - intro) * a.moveDistance * .2
    if (a.intro === 'spring') scale *= 1 + Math.sin(intro * Math.PI * 5) * (1 - intro) * .18 * a.bounceStrength
  }

  const outroRaw = a.outro === 'none' ? 0 : clamp01((sceneTimeSec - a.outroStart) / Math.max(.01, a.outroDuration))
  const outro = easeValue(outroRaw, a.ease)
  if (a.outro !== 'none' && outroRaw > 0) {
    if (a.outro === 'fade') opacity *= 1 - outro
    if (a.outro === 'shrink') scale *= 1 - outro * .82
    if (a.outro === 'zoom') scale *= 1 + outro * a.scaleAmount
    if (a.outro === 'rotate') rotation += outro * a.rotateAngle
    if (a.outro === 'rotate-shrink') { rotation += outro * a.rotateAngle; scale *= 1 - outro * .82 }
    if (a.outro === 'slide-left') x -= outro * a.moveDistance
    if (a.outro === 'slide-right') x += outro * a.moveDistance
    if (a.outro === 'slide-up') y -= outro * a.moveDistance
    if (a.outro === 'slide-down') y += outro * a.moveDistance
    if (a.outro === 'bounce') y -= Math.sin(outro * Math.PI) * a.moveDistance * .35
    if (a.outro === 'shake') x += Math.sin(outro * Math.PI * 10) * a.moveDistance * .16
    if (a.outro === 'throw') { x += outro * a.moveDistance; y -= Math.sin(outro * Math.PI) * a.moveDistance * .3; rotation += outro * a.rotateAngle }
  }

  const t = sceneTimeSec * Math.max(.05, a.speed)
  const strength = Math.max(0, a.strength)
  if (a.continuous === 'sway') rotation += Math.sin(t * TAU) * 4 * strength
  if (a.continuous === 'float') y += Math.sin(t * TAU) * 14 * strength
  if (a.continuous === 'pulse') scale *= 1 + Math.sin(t * TAU) * .04 * strength
  if (a.continuous === 'bounce') y -= Math.abs(Math.sin(t * Math.PI)) * 18 * strength
  if (a.continuous === 'rotate') rotation += t * 36 * strength
  if (a.continuous === 'heartbeat') {
    const beat = Math.pow(Math.max(0, Math.sin(t * TAU)), 8)
    scale *= 1 + beat * .09 * strength
  }
  if (a.continuous === 'brightness') brightness = 1 + Math.sin(t * TAU) * .18 * strength

  return { opacity: clamp01(opacity), x, y, rotation, scale: Math.max(.01, scale), brightness: Math.max(.1, brightness) }
}

const mediaScratchCache = new Map<string, HTMLCanvasElement>()
function mediaScratch(width: number, height: number, tag = 'main') {
  const key = tag + ':' + width + 'x' + height
  const cached = mediaScratchCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  mediaScratchCache.set(key, canvas)
  while (mediaScratchCache.size > 4) {
    const first = mediaScratchCache.keys().next().value
    if (typeof first === 'string') mediaScratchCache.delete(first)
    else break
  }
  return canvas
}

function drawSourceIntoBox(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  fit: 'cover' | 'contain',
) {
  const size = mediaElementSize(source)
  const sourceRatio = size.width / Math.max(1, size.height)
  const boxRatio = width / Math.max(1, height)
  let dw = width
  let dh = height
  if ((fit === 'cover' && sourceRatio > boxRatio) || (fit === 'contain' && sourceRatio < boxRatio)) {
    dh = height
    dw = dh * sourceRatio
  } else {
    dw = width
    dh = dw / sourceRatio
  }
  // A cover-fitted source is larger than its layer box. Clip it before applying
  // circle/ring/custom masks so it cannot spill into neighboring elements.
  ctx.save()
  ctx.beginPath()
  ctx.rect(-width / 2, -height / 2, width, height)
  ctx.clip()
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

// Surface glitter is a filled annulus, not an alpha cloud of particles.
 // Masking against the visual texture caused photo/video opacity holes in the ring.
function surfaceRingMask(target: FrameDesign, scale: number, width: number, height: number) {
  const key = JSON.stringify(['surface-ring', width, height, scale, target.radius,
    target.thickness, target.offsetX, target.offsetY])
  const cached = embossMaskCache.get(key)
  if (cached) return cached

  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const ctx = mask.getContext('2d')
  if (!ctx) return mask
  const cx = width / 2 + target.offsetX * scale
  const cy = height / 2 + target.offsetY * scale
  const r = Math.max(0, target.radius * scale)
  const half = Math.max(.5, target.thickness * scale / 2)
  ctx.beginPath()
  ctx.arc(cx, cy, r + half, 0, TAU)
  const inner = Math.max(0, r - half)
  if (inner > 0) ctx.arc(cx, cy, inner, 0, TAU, true)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill('evenodd')

  embossMaskCache.set(key, mask)
  while (embossMaskCache.size > 12) {
    const oldest = embossMaskCache.keys().next().value
    if (oldest == null) break
    embossMaskCache.delete(oldest)
  }
  return mask
}

function frameMaskCanvas(
  target: FrameDesign,
  scale: number,
  width: number,
  height: number,
  animationTimeMs: number,
  animationProgress: number | undefined,
  sceneTimeSec: number,
  syncRotation: boolean,
) {
  if (target.kind === 'glitter' && target.glitter.surfaceStyle !== 'legacy') {
    // A perfect annulus is rotationally symmetric: rotation cannot change its mask.
    return surfaceRingMask(target, scale, width, height)
  }
  if (!syncRotation || !target.rotationAnimation.enabled) return getEmbossMask(target, scale, width, height)
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const mctx = mask.getContext('2d')
  if (!mctx) return mask
  drawDesignCore(mctx, makeEmbossMaskDesign(target), scale, width, height, animationTimeMs, animationProgress, sceneTimeSec)
  return mask
}

function mediaBlendMode(mode: MediaLayer['blendMode']): GlobalCompositeOperation {
  if (mode === 'multiply') return 'multiply'
  if (mode === 'screen') return 'screen'
  if (mode === 'overlay') return 'overlay'
  if (mode === 'soft-light') return 'soft-light'
  return 'source-over'
}

function drawCustomMask(
  target: CanvasRenderingContext2D,
  layer: MediaLayer,
  scale: number,
) {
  const maskImage = getCustomMaskElement(layer)
  if (!maskImage) return false

  const maskCanvas = mediaScratch(target.canvas.width, target.canvas.height, 'mask')
  const mctx = maskCanvas.getContext('2d')
  if (!mctx) return false
  mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)

  if (layer.customMaskInvert) {
    mctx.fillStyle = '#FFFFFF'
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    mctx.globalCompositeOperation = 'destination-out'
  }

  const box = Math.min(target.canvas.width, target.canvas.height) * Math.max(.02, layer.customMaskScale)
  const size = mediaElementSize(maskImage)
  const sourceRatio = size.width / Math.max(1, size.height)
  let dw = box
  let dh = box
  if ((layer.customMaskFit === 'cover' && sourceRatio > 1) || (layer.customMaskFit === 'contain' && sourceRatio < 1)) {
    dh = box
    dw = dh * sourceRatio
  } else {
    dw = box
    dh = dw / sourceRatio
  }

  mctx.save()
  mctx.translate(
    maskCanvas.width / 2 + layer.customMaskX * scale,
    maskCanvas.height / 2 + layer.customMaskY * scale,
  )
  mctx.rotate((layer.customMaskRotation * Math.PI) / 180)
  mctx.drawImage(maskImage, -dw / 2, -dh / 2, dw, dh)
  mctx.restore()
  mctx.globalCompositeOperation = 'source-over'

  target.globalCompositeOperation = 'destination-in'
  target.drawImage(maskCanvas, 0, 0)
  target.globalCompositeOperation = 'source-over'
  return true
}

function drawMediaLayer(
  ctx: CanvasRenderingContext2D,
  project: FrameProject,
  layer: MediaLayer,
  scale: number,
  animationTimeMs: number,
  animationProgress: number | undefined,
  sceneTimeSec: number,
) {
  if (!layer.visible || layer.opacity <= 0 || sceneTimeSec < layer.startTime || sceneTimeSec > layer.endTime) return
  const source = getMediaElement(layer)
  if (!source) return
  if (source instanceof HTMLVideoElement && source.readyState < 2) return

  const motion = mediaAnimationTransform(layer, sceneTimeSec)
  if (motion.opacity <= 0) return
  const w = Math.max(1, layer.width * layer.scale * motion.scale * scale)
  const h = Math.max(1, layer.height * layer.scale * motion.scale * scale)
  const x = ctx.canvas.width / 2 + (layer.x + motion.x) * scale
  const y = ctx.canvas.height / 2 + (layer.y + motion.y) * scale
  const followTarget = layer.followFrameRotation
    ? project.layers.find(item => item.id === (layer.followFrameLayerId || layer.maskFrameLayerId))
    : undefined
  const followRotation = followTarget
    ? followTarget.design.rotation + animatedFrameRotation(followTarget.design, sceneTimeSec, Math.max(.1, project.timeline?.duration ?? 2))
    : 0
  const rotation = ((layer.rotation + motion.rotation + followRotation) * Math.PI) / 180

  const paint = (target: CanvasRenderingContext2D, composite: GlobalCompositeOperation = mediaBlendMode(layer.blendMode)) => {
    target.save()
    target.translate(x, y)
    target.rotate(rotation)
    target.globalAlpha *= layer.opacity * motion.opacity
    target.globalCompositeOperation = composite
    target.filter = motion.brightness !== 1 ? 'brightness(' + motion.brightness + ')' : 'none'
    drawSourceIntoBox(target, source, w, h, layer.fit)
    target.restore()
  }

  if (layer.maskMode === 'none') {
    ctx.save()
    paint(ctx)
    ctx.restore()
    return
  }

  if (layer.maskMode === 'circle') {
    ctx.save()
    const mx = ctx.canvas.width / 2 + layer.maskX * scale
    const my = ctx.canvas.height / 2 + layer.maskY * scale
    ctx.beginPath()
    ctx.arc(mx, my, Math.max(1, layer.maskRadius * scale), 0, TAU)
    ctx.clip()
    paint(ctx)
    ctx.restore()
    return
  }

  const scratch = mediaScratch(ctx.canvas.width, ctx.canvas.height)
  const sctx = scratch.getContext('2d')
  if (!sctx) return
  sctx.clearRect(0, 0, scratch.width, scratch.height)
  // Apply the selected blend mode only when compositing onto the destination.
  // Blending into an empty scratch canvas first can corrupt alpha and colors.
  paint(sctx, 'source-over')

  if (layer.maskMode === 'custom') {
    drawCustomMask(sctx, layer, scale)
    ctx.save()
    ctx.globalCompositeOperation = mediaBlendMode(layer.blendMode)
    ctx.drawImage(scratch, 0, 0)
    ctx.restore()
    return
  }

  const targetLayer = project.layers.find(item => item.id === layer.maskFrameLayerId)
  if (targetLayer) {
    const mask = frameMaskCanvas(targetLayer.design, scale, ctx.canvas.width, ctx.canvas.height, animationTimeMs, animationProgress, sceneTimeSec, layer.maskSyncRotation)
    sctx.globalCompositeOperation = 'destination-in'
    sctx.drawImage(mask, 0, 0)
    sctx.globalCompositeOperation = 'source-over'
  } else {
    const mx = ctx.canvas.width / 2 + layer.maskX * scale
    const my = ctx.canvas.height / 2 + layer.maskY * scale
    const outer = Math.max(1, layer.maskRadius * scale)
    const inner = Math.max(0, outer - layer.ringThickness * scale)
    sctx.globalCompositeOperation = 'destination-in'
    sctx.beginPath()
    sctx.arc(mx, my, outer, 0, TAU)
    sctx.arc(mx, my, inner, 0, TAU, true)
    sctx.fillStyle = '#FFFFFF'
    sctx.fill('evenodd')
    sctx.globalCompositeOperation = 'source-over'
  }

  ctx.save()
  ctx.globalCompositeOperation = mediaBlendMode(layer.blendMode)
  ctx.drawImage(scratch, 0, 0)
  ctx.restore()
}

function drawBackground(ctx: CanvasRenderingContext2D, project: FrameProject) {
  const background = project.background
  if (!background || background.type === 'transparent' || background.opacity <= 0) return
  ctx.save()
  ctx.globalAlpha = clamp01(background.opacity)
  if (background.type === 'color') {
    ctx.fillStyle = validColor(background.color, '#FFFFFF')
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
    return
  }
  const source = getBackgroundElement(background)
  if (!source || (source instanceof HTMLVideoElement && source.readyState < 2)) {
    ctx.restore()
    return
  }
  const size = mediaElementSize(source)
  const sourceRatio = size.width / Math.max(1, size.height)
  const boxRatio = ctx.canvas.width / Math.max(1, ctx.canvas.height)
  let dw = ctx.canvas.width
  let dh = ctx.canvas.height
  if ((background.fit === 'cover' && sourceRatio > boxRatio) || (background.fit === 'contain' && sourceRatio < boxRatio)) {
    dh = ctx.canvas.height
    dw = dh * sourceRatio
  } else {
    dw = ctx.canvas.width
    dh = dw / sourceRatio
  }
  const projectScale = ctx.canvas.width / project.width
  const bgScale = Math.max(.02, background.scale || 1)
  ctx.translate(
    ctx.canvas.width / 2 + (background.x || 0) * projectScale,
    ctx.canvas.height / 2 + (background.y || 0) * projectScale,
  )
  ctx.rotate(((background.rotation || 0) * Math.PI) / 180)
  ctx.drawImage(source, -(dw * bgScale) / 2, -(dh * bgScale) / 2, dw * bgScale, dh * bgScale)
  ctx.restore()
}

function projectLayers(project: FrameProject) {
  if (Array.isArray(project.layers) && project.layers.length) {
    return project.layers.filter(layer => layer.visible !== false).map(layer => layer.design).reverse()
  }
  return [project.design]
}

export function getProjectFitScale(project: FrameProject) {
  if (!project.autoFit) return 1
  const designs = projectLayers(project)
  const extent = Math.max(...designs.map(estimateDesignExtent), estimateDesignExtent(project.design))
  return Math.min(1.18, 950 / Math.max(1, extent))
}

export function renderProject(canvas: HTMLCanvasElement, project: FrameProject, forcedFitScale?: number, animationTimeMs = 0, animationProgress?: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const baseScale = canvas.width / project.width
  const fitScale = forcedFitScale ?? getProjectFitScale(project)
  const scale = baseScale * fitScale
  const duration = Math.max(.1, project.timeline?.duration ?? 2)
  const sceneTimeSec = animationProgress == null
    ? ((animationTimeMs / 1000) % duration + duration) % duration
    : clamp01(animationProgress) * duration

  drawBackground(ctx, project)

  const media = project.mediaLayers ?? []
  for (const layer of media.filter(item => item.placement === 'below').slice().reverse()) {
    drawMediaLayer(ctx, project, layer, scale, animationTimeMs, animationProgress, sceneTimeSec)
  }

  for (const design of projectLayers(project)) {
    drawDesign(ctx, design, scale, canvas.width, canvas.height, animationTimeMs, animationProgress, sceneTimeSec, duration)
  }

  for (const layer of media.filter(item => item.placement === 'above').slice().reverse()) {
    drawMediaLayer(ctx, project, layer, scale, animationTimeMs, animationProgress, sceneTimeSec)
    if (layer.keepFrameAbove && layer.maskFrameLayerId) {
      const target = project.layers.find(item => item.id === layer.maskFrameLayerId)
      if (target?.visible) drawDesign(ctx, target.design, scale, canvas.width, canvas.height, animationTimeMs, animationProgress, sceneTimeSec, duration)
    }
  }
}
