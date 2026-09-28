import type { GradientStopDef, RingPreset, RingStyle } from './types'

export const STYLE_MAP: Record<RingStyle, { label: string; stops: GradientStopDef[] }> = {
  'soft-center': {
    label: '중앙 화이트 밴드',
    stops: [
      { position: 0, mix: 0.18 },
      { position: 0.14, mix: 0.04 },
      { position: 0.30, mix: 0.42 },
      { position: 0.44, mix: 0.96 },
      { position: 0.56, mix: 1 },
      { position: 0.72, mix: 0.46 },
      { position: 0.88, mix: 0.06 },
      { position: 1, mix: 0.18 },
    ],
  },
  'inner-white': {
    label: '안쪽 화이트 강조',
    stops: [
      { position: 0, mix: 0.05 },
      { position: 0.22, mix: 0.20 },
      { position: 0.46, mix: 0.60 },
      { position: 0.72, mix: 1 },
      { position: 0.86, mix: 0.92 },
      { position: 1, mix: 0.45 },
    ],
  },
  'outer-white': {
    label: '바깥 화이트 강조',
    stops: [
      { position: 0, mix: 0.52 },
      { position: 0.16, mix: 0.92 },
      { position: 0.32, mix: 1 },
      { position: 0.52, mix: 0.52 },
      { position: 0.78, mix: 0.08 },
      { position: 1, mix: 0.18 },
    ],
  },
  'balanced': {
    label: '균형형 2색',
    stops: [
      { position: 0, mix: 0.12 },
      { position: 0.20, mix: 0.10 },
      { position: 0.40, mix: 0.62 },
      { position: 0.50, mix: 0.96 },
      { position: 0.60, mix: 0.62 },
      { position: 0.80, mix: 0.10 },
      { position: 1, mix: 0.12 },
    ],
  },
  'glossy-soft': {
    label: '글로시 소프트',
    stops: [
      { position: 0, mix: 0.20 },
      { position: 0.10, mix: 0.05 },
      { position: 0.26, mix: 0.26 },
      { position: 0.42, mix: 0.82 },
      { position: 0.56, mix: 1 },
      { position: 0.76, mix: 0.34 },
      { position: 1, mix: 0.16 },
    ],
  },
  'pastel-sheen': {
    label: '파스텔 쉬머',
    stops: [
      { position: 0, mix: 0.24 },
      { position: 0.18, mix: 0.46 },
      { position: 0.32, mix: 0.90 },
      { position: 0.50, mix: 1 },
      { position: 0.68, mix: 0.88 },
      { position: 0.84, mix: 0.40 },
      { position: 1, mix: 0.18 },
    ],
  },
}

function preset(id: string, category: string, name: string, style: RingStyle, baseColor: string, patch: Partial<RingPreset> = {}): RingPreset {
  return {
    id,
    category,
    name,
    style,
    baseColor,
    whiteColor: '#FFFFFF',
    radius: 760,
    thickness: 92,
    opacity: 1,
    glowEnabled: false,
    glowColor: baseColor,
    glowBlur: 28,
    glowStrength: 0.38,
    outlineEnabled: false,
    outlineColor: '#FFFFFF',
    outlineWidth: 4,
    ...patch,
  }
}

export const PRESETS: RingPreset[] = [
  preset('g1', '2색 그라데이션', 'Soft Lavender Duo', 'soft-center', '#B79BF1', { glowEnabled: true, glowBlur: 18, glowStrength: 0.16 }),
  preset('g2', '2색 그라데이션', 'Soft Pink Duo', 'soft-center', '#F3A4C8', { glowEnabled: true, glowBlur: 18, glowStrength: 0.16 }),
  preset('g3', '2색 그라데이션', 'Soft Sky Duo', 'balanced', '#A9C8FF'),
  preset('g4', '2색 그라데이션', 'Soft Mint Duo', 'balanced', '#9FDCC7'),
  preset('g5', '2색 그라데이션', 'Inner White Lavender', 'inner-white', '#B59CED'),
  preset('g6', '2색 그라데이션', 'Outer White Lavender', 'outer-white', '#B59CED'),
  preset('g7', '2색 그라데이션', 'Glossy Lavender Duo', 'glossy-soft', '#B9A0F3', { glowEnabled: true, glowBlur: 26, glowStrength: 0.22 }),
  preset('g8', '2색 그라데이션', 'Pastel Sheen Purple', 'pastel-sheen', '#C1A8F7'),
  preset('g9', '기본', 'Clean Solid Lavender', 'balanced', '#B9A0F3', { thickness: 70 }),
  preset('g10', '기본', 'Thin White Blend Ring', 'soft-center', '#C8B4F6', { thickness: 58, radius: 770 }),
]
