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

export interface GradientStop {
  id: string
  position: number
  color: string
}

export interface LayerEffects {
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
}

export interface RingPattern {
  dash: number
  gap: number
  segmentCount: number
  roughness: number
  strokeCount: number
  waveAmplitude: number
  waveCount: number
  decorationCount: number
  decorationSize: number
  decorationOffset: number
  decorationRotation: number
  alternateColors: boolean
  keepUpright: boolean
  customAssetUrl: string
  customAssetName: string
  seed: number
}

export interface RingLayer {
  id: string
  name: string
  kind: RingKind
  visible: boolean
  locked: boolean
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
  effects: LayerEffects
  pattern: RingPattern
}

export interface FrameProject {
  version: '0.2'
  width: 2000
  height: 2000
  autoFit: boolean
  selectedLayerId: string | null
  layers: RingLayer[]
}

export interface FramePreset {
  id: string
  category: string
  name: string
  layer: RingLayer
}

export interface PaletteTemplate {
  id: string
  name: string
  colors: string[]
}
