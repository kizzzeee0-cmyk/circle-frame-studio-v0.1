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

export type GradientMode = 'solid' | 'linear' | 'radial' | 'conic'
export type DecorationLayout = 'count' | 'spacing'
export type AssetTintMode = 'original' | 'palette'

export interface GradientStop {
  id: string
  position: number
  color: string
}

export interface FrameEffects {
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

export interface TwoToneFlowSettings {
  enabled: boolean
  repeatCount: 1 | 2
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
  version: '0.20'
  width: 2000
  height: 2000
  autoFit: boolean
  design: FrameDesign
  layers: FrameLayer[]
  selectedLayerId: string
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
