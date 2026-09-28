export type RingStyle =
  | 'soft-center'
  | 'inner-white'
  | 'outer-white'
  | 'balanced'
  | 'glossy-soft'
  | 'pastel-sheen'

export interface GradientStopDef {
  position: number
  mix: number
  alpha?: number
}

export interface RingPreset {
  id: string
  category: string
  name: string
  style: RingStyle
  baseColor: string
  whiteColor: string
  radius: number
  thickness: number
  opacity: number
  glowEnabled: boolean
  glowColor: string
  glowBlur: number
  glowStrength: number
  outlineEnabled: boolean
  outlineColor: string
  outlineWidth: number
}

export interface RingState extends RingPreset {
  rotation: number
}
