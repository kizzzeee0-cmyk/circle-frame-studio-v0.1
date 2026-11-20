export type RingKind =
  | 'basic'
  | 'double'
  | 'triple'
  | 'segmented'
  | 'arc'
  | 'dotted'
  | 'wavy'
  | 'scallop'
  | 'scribble'
  | 'rough'
  | 'brush'
  | 'sparkle'
  | 'star'
  | 'heart'
  | 'ribbon'
  | 'flower'
  | 'asset'
  | 'glossy'
  | 'glitter'
  | 'jelly'

export type GradientMode = 'solid' | 'linear' | 'radial' | 'conic'
export type DecorationLayout = 'count' | 'spacing'
export type AssetTintMode = 'original' | 'palette'
export type GlitterParticleStyle = 'soft' | 'twinkle' | 'sugar' | 'luminous'
export type GlitterSurfaceStyle = 'legacy' | 'gradient' | 'fine' | 'twinkle' | 'holographic' | 'orbit' | 'reflection'
export type GlitterAnimationMode = 'none' | 'twinkle' | 'rotate' | 'rotate-twinkle' | 'sweep' | 'orbit'
export type MediaLayerKind = 'image' | 'video'
export type MediaMaskMode = 'none' | 'circle' | 'ring' | 'custom'
export type MediaPlacement = 'below' | 'above'
export type MediaFitMode = 'cover' | 'contain'
export type MediaIntroAnimation = 'none' | 'fade' | 'popup' | 'bounce' | 'zoom' | 'rotate' | 'rotate-zoom' | 'jump' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'shake' | 'spring'
export type MediaOutroAnimation = 'none' | 'fade' | 'shrink' | 'zoom' | 'rotate' | 'rotate-shrink' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'bounce' | 'shake' | 'throw'
export type MediaContinuousAnimation = 'none' | 'sway' | 'float' | 'pulse' | 'bounce' | 'rotate' | 'heartbeat' | 'brightness'
export type AnimationEase = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light'
export type PerformanceMode = 'auto' | 'quality' | 'performance'

export interface GradientStop {
  id: string
  position: number
  color: string
}

export interface FrameEffects {
  embossEnabled: boolean
  embossSize: number
  embossDepth: number
  embossSoftness: number
  embossLightAngle: number
  embossLightAltitude: number
  embossHighlightColor: string
  embossHighlightOpacity: number
  embossShadowColor: string
  embossShadowOpacity: number
  embossMode: 'convex' | 'concave'
  embossStyle: 'inner-bevel' | 'outer-bevel'
  embossTechnique: 'smooth' | 'chisel-soft' | 'chisel-hard'
  embossDirection: 'up' | 'down'
  embossHighlightBlend: 'screen' | 'soft-light' | 'normal'
  embossShadowBlend: 'multiply' | 'soft-light' | 'normal'
  embossBaseRetention: number
  embossHighlightSharpness: number
  embossAutoShadowColor: boolean
  embossAutoShadowDarkness: number
  embossMidtoneStrength: number
  glowEnabled: boolean
  glowColor: string
  glowBlur: number
  glowIntensity: number
  bloom: number
  softBlur: number
  shadowEnabled: boolean
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  outlineEnabled: boolean
  outlineColor: string
  outlineWidth: number
}

export interface FramePattern {
  dash: number
  gap: number
  roughness: number
  strokeCount: number
  waveAmplitude: number
  waveCount: number
  bulgeAmplitude: number
  bulgeCount: number

  decorationLayout: DecorationLayout
  decorationCount: number
  decorationSpacing: number
  decorationSize: number
  decorationOffset: number
  decorationRotation: number
  keepUpright: boolean

  colorCount: 1 | 2 | 3 | 4
  paletteColors: [string, string, string, string]

  customAssetUrl: string
  customAssetName: string
  assetTintMode: AssetTintMode
  seed: number
}

export interface TripleRingSettings {
  attached: boolean
  colors: [string, string, string]
  widths: [number, number, number]
}

export interface GlitterSettings {
  surfaceStyle: GlitterSurfaceStyle
  animationMode: GlitterAnimationMode
  density: number
  particleSize: number
  particleSizeVariation: number
  sparkleSize: number
  accentSparkleCount: number
  accentSparkleDuration: number
  textureContrast: number
  surfaceHighlight: number
  rimStrength: number
  ringVisible: boolean
  orbitSpread: number
  orbitDensity: number
  orbitTrail: number
  loopDuration: number
  orbitEnabled: boolean
  twinkleEnabled: boolean
  highlightSweepEnabled: boolean
  sparkleRatio: number
  spread: number
  glow: number
  baseOpacity: number
  edgeHighlight: number
  colorCount: 1 | 2 | 3 | 4
  colors: [string, string, string, string]
  animated: boolean
  animationStyle: 'twinkle' | 'flash' | 'shimmer' | 'orbit' | 'mixed'
  animationSpeed: number
  animationStrength: number
  animationSmoothness: number
  sweepWidth: number
  particleStyle: GlitterParticleStyle
  highlightColor: string
  glowColor: string
  flowEnabled: boolean
  flowDirection: 1 | -1
}

export interface JellySettings {
  highlightColor: string
  highlightOpacity: number
  highlightWidth: number
  highlightLength: number
  highlightCount: number
  shadowColor: string
  shadowOpacity: number
  volume: number
}

export interface FrameRotationSettings {
  enabled: boolean
  direction: 1 | -1
  secondsPerTurn: number
  startAngle: number
  easing: AnimationEase
  startTime: number
  endTime: number
}

export interface MediaAnimationSettings {
  intro: MediaIntroAnimation
  introStart: number
  introDuration: number
  outro: MediaOutroAnimation
  outroStart: number
  outroDuration: number
  continuous: MediaContinuousAnimation
  speed: number
  strength: number
  ease: AnimationEase
  moveDistance: number
  rotateAngle: number
  scaleAmount: number
  bounceStrength: number
}

export interface MediaLayer {
  id: string
  name: string
  kind: MediaLayerKind
  assetId: string
  sourceUrl: string
  fileName: string
  mimeType: string
  visible: boolean
  locked: boolean
  placement: MediaPlacement
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotation: number
  opacity: number
  blendMode: BlendMode
  fit: MediaFitMode
  maskMode: MediaMaskMode
  maskRadius: number
  maskX: number
  maskY: number
  ringThickness: number
  maskFrameLayerId: string
  customMaskAssetId: string
  customMaskSourceUrl: string
  customMaskFileName: string
  customMaskInvert: boolean
  customMaskFit: MediaFitMode
  customMaskScale: number
  customMaskRotation: number
  customMaskX: number
  customMaskY: number
  maskSyncRotation: boolean
  keepFrameAbove: boolean
  startTime: number
  endTime: number
  trimStart: number
  trimEnd: number
  followFrameRotation: boolean
  followFrameLayerId: string
  audioEnabled: boolean
  audioVolume: number
  groupId: string
  animation: MediaAnimationSettings
}

export interface MediaGroup {
  id: string
  name: string
  layerIds: string[]
  locked: boolean
}

export interface ComposerSettings {
  snapEnabled: boolean
  snapSize: number
  showGuides: boolean
  showCenterGuides: boolean
  timelineSnapEnabled: boolean
  timelineFps: 12 | 15 | 20 | 24 | 30 | 60
  performanceMode: PerformanceMode
  previewResolution: 720 | 960 | 1200
}

export interface BackgroundSettings {
  type: 'transparent' | 'color' | 'image' | 'video'
  color: string
  assetId: string
  sourceUrl: string
  fileName: string
  mimeType: string
  opacity: number
  fit: MediaFitMode
  x: number
  y: number
  scale: number
  rotation: number
}

export interface TimelineSettings {
  duration: number
  loop: boolean
}

export interface TwoToneFlowSettings {
  enabled: boolean
  repeatCount: 1 | 2 | 3 | 4
  colorA: string
  colorB: string
  whiteCenter: number
  whiteWidth: number
  blendWidth: number
  rotation: number
  glossStrength: number
  innerHighlight: number
  outerHighlight: number
}

export interface FrameDesign {
  id: string
  name: string
  kind: RingKind
  radius: number
  thickness: number
  rotation: number
  offsetX: number
  offsetY: number
  opacity: number
  color: string
  secondaryColor: string
  gradientMode: GradientMode
  gradientAngle: number
  gradientStops: GradientStop[]
  twoToneFlow: TwoToneFlowSettings
  tripleRing: TripleRingSettings
  glitter: GlitterSettings
  jelly: JellySettings
  rotationAnimation: FrameRotationSettings
  effects: FrameEffects
  pattern: FramePattern
}

export interface FrameLayer {
  id: string
  name: string
  visible: boolean
  design: FrameDesign
}

export interface FrameProject {
  version: '0.35'
  width: 2000
  height: 2000
  autoFit: boolean
  design: FrameDesign
  layers: FrameLayer[]
  selectedLayerId: string
  mediaLayers?: MediaLayer[]
  background?: BackgroundSettings
  timeline?: TimelineSettings
  mediaGroups?: MediaGroup[]
  settings?: ComposerSettings
}

export interface FramePreset {
  id: string
  category: string
  name: string
  design: FrameDesign
}

export interface PaletteTemplate {
  id: string
  name: string
  colors: string[]
}
