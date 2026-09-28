import type { FramePreset, RingKind, FrameDesign } from '../types'

const baseEffects = () => ({
  glowEnabled: false,
  glowColor: '#9389DE',
  glowBlur: 36,
  glowIntensity: 0.55,
  bloom: 0,
  softBlur: 0,
  shadowEnabled: false,
  shadowColor: '#5B547D',
  shadowBlur: 24,
  shadowOffsetX: 0,
  shadowOffsetY: 18,
  outlineEnabled: false,
  outlineColor: '#FFFFFF',
  outlineWidth: 8,
})

const basePattern = () => ({
  dash: 105,
  gap: 50,
  roughness: 12,
  strokeCount: 4,
  waveAmplitude: 18,
  waveCount: 20,
  bulgeAmplitude: 12,
  bulgeCount: 16,
  decorationLayout: 'count' as const,
  decorationCount: 18,
  decorationSpacing: 120,
  decorationSize: 28,
  decorationOffset: 0,
  decorationRotation: 0,
  keepUpright: false,
  colorCount: 1 as 1 | 2 | 3 | 4,
  paletteColors: ['#9389DE', '#E9B6D2', '#8DC5FF', '#F4D87A'] as [string, string, string, string],
  customAssetUrl: '',
  customAssetName: '',
  assetTintMode: 'original' as const,
  seed: 3701,
})

export function createDesign(kind: RingKind = 'basic', name = 'Circle Ring'): FrameDesign {
  return {
    id: `design-${Math.random().toString(36).slice(2, 9)}`,
    name,
    kind,
    radius: 720,
    thickness: 28,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    opacity: 1,
    color: '#9389DE',
    secondaryColor: '#E9B6D2',
    gradientMode: 'solid',
    gradientAngle: 0,
    gradientStops: [
      { id: 's1', position: 0, color: '#9389DE' },
      { id: 's2', position: 0.38, color: '#C7B8F1' },
      { id: 's3', position: 0.72, color: '#F0BDD7' },
      { id: 's4', position: 1, color: '#8DC5FF' },
    ],
    effects: baseEffects(),
    pattern: basePattern(),
  }
}

function p(id: string, category: string, name: string, kind: RingKind, patch: Partial<FrameDesign> = {}, pattern = {}, effects = {}): FramePreset {
  const design = createDesign(kind, name)
  Object.assign(design, patch)
  Object.assign(design.pattern, pattern)
  if (!(pattern as { paletteColors?: unknown }).paletteColors) {
    design.pattern.paletteColors = [design.color, design.secondaryColor, '#F7A8CF', '#B9D1FF']
  }
  Object.assign(design.effects, effects)
  design.id = `preset-${id}`
  return { id, category, name, design }
}

export const PRESETS: FramePreset[] = [
  p('basic-thin', 'Basic', 'Thin Ring', 'basic', { thickness: 12 }),
  p('basic-medium', 'Basic', 'Clean Ring', 'basic', { thickness: 26 }),
  p('basic-thick', 'Basic', 'Thick Ring', 'basic', { thickness: 62 }),
  p('double-clean', 'Basic', 'Double Ring', 'double', { thickness: 18 }),
  p('double-bold', 'Basic', 'Bold Double', 'double', { thickness: 30 }),
  p('triple-line', 'Basic', 'Triple Ring', 'triple', { thickness: 12 }),
  p('triple-soft', 'Basic', 'Soft Triple', 'triple', { thickness: 18, opacity: .82 }),
  p('minimal-fine', 'Minimal', 'Fine Minimal', 'basic', { thickness: 7, radius: 760 }),
  p('minimal-inner', 'Minimal', 'Inner Minimal', 'double', { thickness: 8, radius: 690 }),
  p('minimal-wide', 'Minimal', 'Wide Space Double', 'double', { thickness: 9 }, { gap: 90 }),

  p('broken-soft', 'Broken', 'Broken Circle', 'segmented', { thickness: 24 }, { dash: 150, gap: 52 }),
  p('broken-wide', 'Broken', 'Wide Broken', 'segmented', { thickness: 34 }, { dash: 215, gap: 105 }),
  p('broken-mini', 'Broken', 'Mini Segments', 'segmented', { thickness: 18 }, { dash: 70, gap: 32 }),
  p('broken-round', 'Broken', 'Rounded Segments', 'segmented', { thickness: 48 }, { dash: 135, gap: 65 }),
  p('broken-three-long', 'Broken', 'Long 3-Cut Segments', 'segmented', { thickness: 26 }, { dash: 1120, gap: 360 }),
  p('arc-single', 'Broken', 'Open Arc', 'arc', { thickness: 30 }, { dash: 900, gap: 600 }),
  p('arc-multi', 'Broken', 'Multiple Arcs', 'arc', { thickness: 24 }, { dash: 390, gap: 145 }),
  p('arc-fine', 'Broken', 'Fine Arcs', 'arc', { thickness: 13 }, { dash: 280, gap: 120 }),

  p('dot-mini', 'Dot', 'Mini Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 84, decorationSize: 9 }),
  p('dot-soft', 'Dot', 'Soft Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 52, decorationSize: 14 }),
  p('dot-bold', 'Dot', 'Bold Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 32, decorationSize: 24 }),
  p('dot-double', 'Dot', 'Dense Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 100, decorationSize: 7 }),
  p('dot-fourcolor', 'Dot', 'Four Color Dots', 'dotted', { color: '#F2B3CD', secondaryColor: '#95C8F0' }, { decorationLayout: 'spacing', decorationSpacing: 68, decorationSize: 13, colorCount: 4, paletteColors: ['#F2B3CD','#95C8F0','#F2D272','#B79AF6'] }),

  p('wave-small', 'Wavy', 'Soft Wave', 'wavy', { thickness: 18 }, { waveAmplitude: 10, waveCount: 28 }),
  p('wave-cute', 'Wavy', 'Cute Wavy', 'wavy', { thickness: 24 }, { waveAmplitude: 24, waveCount: 22 }),
  p('wave-large', 'Wavy', 'Large Wave', 'wavy', { thickness: 28 }, { waveAmplitude: 42, waveCount: 14 }),
  p('scallop-mini', 'Wavy', 'Mini Scallop', 'scallop', { thickness: 15 }, { waveAmplitude: 18, waveCount: 34 }),
  p('scallop-lace', 'Wavy', 'Lace Scallop', 'scallop', { thickness: 20 }, { waveAmplitude: 30, waveCount: 26 }),

  p('scribble-3', 'Scribble', 'Triple Scribble', 'scribble', { thickness: 9 }, { roughness: 13, strokeCount: 3 }),
  p('scribble-5', 'Scribble', 'Messy Scribble', 'scribble', { thickness: 8 }, { roughness: 25, strokeCount: 5 }),
  p('scribble-soft', 'Scribble', 'Soft Scribble', 'scribble', { thickness: 7, opacity: .72 }, { roughness: 15, strokeCount: 6 }),
  p('rough-pencil', 'Scribble', 'Rough Pencil', 'rough', { thickness: 10 }, { roughness: 18, strokeCount: 2 }),
  p('rough-bold', 'Scribble', 'Rough Bold', 'rough', { thickness: 18 }, { roughness: 24, strokeCount: 3 }),
  p('doodle-broken', 'Scribble', 'Doodle Broken', 'segmented', { thickness: 16 }, { dash: 110, gap: 26 }, { glowEnabled: false }),
  p('doodle-outline', 'Scribble', 'Loose Doodle Outline', 'rough', { thickness: 7, color: '#A48CE9' }, { roughness: 9, strokeCount: 4 }),
  p('clean-double-sketch', 'Scribble', 'Clean Double Sketch', 'scribble', { thickness: 8, color: '#EE88AF', opacity: .96 }, { roughness: 2, strokeCount: 2 }),
  p('soft-twin-sketch', 'Scribble', 'Soft Twin Sketch', 'scribble', { thickness: 10, color: '#F09BB9', opacity: .9 }, { roughness: 3, strokeCount: 2 }),
  p('pastel-double-ring', 'Scribble', 'Pastel Double Ring', 'scribble', { thickness: 9, color: '#F4A4C2', opacity: .94 }, { roughness: 2.4, strokeCount: 2 }),
  p('clean-twin-outline', 'Scribble', 'Clean Twin Outline', 'scribble', { thickness: 7, color: '#C08CCF', opacity: .98 }, { roughness: 1.2, strokeCount: 2 }),

  p('brush-dry', 'Brush', 'Dry Brush Circle', 'brush', { thickness: 34 }, { dash: 85, gap: 15, roughness: 25 }),
  p('brush-ink', 'Brush', 'Ink Brush Ring', 'brush', { thickness: 52 }, { dash: 115, gap: 10, roughness: 18 }),
  p('brush-soft', 'Brush', 'Soft Brush Ring', 'brush', { thickness: 42, opacity: .78 }, { dash: 75, gap: 10, roughness: 12 }),
  p('brush-water', 'Brush', 'Watercolor Ring', 'brush', { thickness: 58, opacity: .58 }, { dash: 60, gap: 8, roughness: 30 }),

  p('sparkle-light', 'Decorative', 'Sparkle Ring', 'sparkle', { thickness: 8 }, { decorationCount: 16, decorationSize: 32, decorationOffset: 15 }),
  p('sparkle-dense', 'Decorative', 'Dense Sparkle', 'sparkle', { thickness: 6 }, { decorationCount: 28, decorationSize: 24, decorationOffset: 18 }),
  p('star-cute', 'Decorative', 'Star Circle', 'star', { thickness: 5 }, { decorationCount: 18, decorationSize: 28, decorationOffset: 10 }),
  p('star-mini', 'Decorative', 'Mini Star Ring', 'star', { thickness: 5 }, { decorationCount: 30, decorationSize: 18, decorationOffset: 10 }),
  p('heart-cute', 'Decorative', 'Heart Circle', 'heart', { thickness: 5 }, { decorationCount: 22, decorationSize: 24, decorationOffset: 10 }),
  p('heart-wide', 'Decorative', 'Wide Heart Ring', 'heart', { thickness: 5 }, { decorationCount: 14, decorationSize: 34, decorationOffset: 12 }),
  p('heart-fourcolor', 'Decorative', 'Four Color Heart Ring', 'heart', { color: '#F4C455', secondaryColor: '#8DC5FF' }, { decorationCount: 34, decorationSize: 15, decorationOffset: 10, colorCount: 4, paletteColors: ['#F4C455','#8DC5FF','#F6A8C8','#B8A5F2'], keepUpright: true }),
  p('ribbon-cute', 'Decorative', 'Rounded Ribbon Ring', 'ribbon', { color: '#FFFFFF' }, { decorationCount: 12, decorationSize: 29, decorationOffset: 18, keepUpright: true, colorCount: 1, paletteColors: ['#FFFFFF','#FFFFFF','#FFFFFF','#FFFFFF'] }),
  p('ribbon-mini', 'Decorative', 'Mini Ribbon Ring', 'ribbon', { color: '#FFFFFF', secondaryColor: '#E4D1F9' }, { decorationCount: 20, decorationSize: 18, decorationOffset: 16, keepUpright: true, colorCount: 2, paletteColors: ['#FFFFFF','#E4D1F9','#FFFFFF','#E4D1F9'] }),
  p('ribbon-fourcolor', 'Decorative', 'Pastel Ribbon Ring', 'ribbon', { color: '#F6A9CC', secondaryColor: '#F8C4DD' }, { decorationLayout: 'spacing', decorationSpacing: 210, decorationSize: 24, decorationOffset: 18, keepUpright: true, colorCount: 4, paletteColors: ['#F6A9CC','#F8C4DD','#F9A9C7','#F7D9E7'] }),
      p('flower-soft', 'Decorative', 'Soft Flower Ring', 'flower', { color: '#FFFFFF', secondaryColor: '#FFDD74' }, { decorationCount: 18, decorationSize: 23, decorationOffset: 14, keepUpright: true }),
  p('flower-pastel', 'Decorative', 'Pastel Flower Ring', 'flower', { color: '#FFD7EF', secondaryColor: '#FFF1A6' }, { decorationCount: 24, decorationSize: 19, decorationOffset: 16, keepUpright: true, colorCount: 2, paletteColors: ['#FFD7EF','#FFF1A6','#FFD7EF','#FFF1A6'] }),
  p('flower-fourcolor', 'Decorative', 'Four Color Flower Ring', 'flower', { color: '#F1BDD7', secondaryColor: '#A7D4F3' }, { decorationLayout: 'spacing', decorationSpacing: 175, decorationSize: 20, decorationOffset: 18, keepUpright: true, colorCount: 4, paletteColors: ['#F1BDD7','#A7D4F3','#F3D987','#C3AEF4'] }),

  p('gradient-lav', 'Gradient', 'Lavender Gradient', 'basic', { thickness: 42, gradientMode: 'conic' }),
  p('gradient-pink', 'Gradient', 'Pink Blue Gradient', 'basic', { thickness: 52, gradientMode: 'conic', gradientStops: [
    { id: 'g1', position: 0, color: '#F2AFCB' }, { id: 'g2', position: .34, color: '#9BC9EE' }, { id: 'g3', position: .7, color: '#F3D47F' }, { id: 'g4', position: 1, color: '#B9A5F2' },
  ] }),
  p('gradient-double', 'Gradient', 'Double Gradient', 'double', { thickness: 22, gradientMode: 'conic' }),
  p('gradient-segment', 'Gradient', 'Segment Gradient', 'segmented', { thickness: 38, gradientMode: 'conic' }, { dash: 175, gap: 70 }),

  // v0.18 — 흰색 + 한 가지색, 링 두께 방향으로 자연스럽게 이어지는 2색 그라데이션
  p('twotone-lavender-soft', 'TwoTone', 'Lavender White Duo', 'basic', {
    thickness: 104,
    color: '#B79BF1',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'twl1', position: 0, color: '#B79BF1' },
      { id: 'twl2', position: .775, color: '#B79BF1' },
      { id: 'twl3', position: .815, color: '#FFFFFF' },
      { id: 'twl4', position: .855, color: '#FFFFFF' },
      { id: 'twl5', position: .905, color: '#B79BF1' },
      { id: 'twl6', position: 1, color: '#B79BF1' },
    ],
  }, {}, { glowEnabled: true, glowColor: '#B79BF1', glowBlur: 16, glowIntensity: .14 }),

  p('twotone-lavender-wide', 'TwoTone', 'Lavender White Wide', 'basic', {
    thickness: 116,
    color: '#AA88EA',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'tww1', position: 0, color: '#AA88EA' },
      { id: 'tww2', position: .765, color: '#AA88EA' },
      { id: 'tww3', position: .805, color: '#FFFFFF' },
      { id: 'tww4', position: .865, color: '#FFFFFF' },
      { id: 'tww5', position: .915, color: '#AA88EA' },
      { id: 'tww6', position: 1, color: '#AA88EA' },
    ],
  }),

  p('twotone-lavender-inner', 'TwoTone', 'Lavender Inner White', 'basic', {
    thickness: 96,
    color: '#B8A0F0',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'twi1', position: 0, color: '#B8A0F0' },
      { id: 'twi2', position: .77, color: '#B8A0F0' },
      { id: 'twi3', position: .80, color: '#FFFFFF' },
      { id: 'twi4', position: .845, color: '#FFFFFF' },
      { id: 'twi5', position: .905, color: '#B8A0F0' },
      { id: 'twi6', position: 1, color: '#B8A0F0' },
    ],
  }),

  p('twotone-lavender-glossy', 'TwoTone', 'Lavender Soft Gloss', 'glossy', {
    thickness: 108,
    color: '#B69AF0',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'twg1', position: 0, color: '#B69AF0' },
      { id: 'twg2', position: .77, color: '#B69AF0' },
      { id: 'twg3', position: .81, color: '#FFFFFF' },
      { id: 'twg4', position: .85, color: '#FFFFFF' },
      { id: 'twg5', position: .90, color: '#B69AF0' },
      { id: 'twg6', position: 1, color: '#B69AF0' },
    ],
  }, {}, { glowEnabled: true, glowColor: '#B69AF0', glowBlur: 20, glowIntensity: .16 }),

  p('twotone-pink-soft', 'TwoTone', 'Pink White Duo', 'basic', {
    thickness: 104,
    color: '#F29BBC',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'twp1', position: 0, color: '#F29BBC' },
      { id: 'twp2', position: .775, color: '#F29BBC' },
      { id: 'twp3', position: .815, color: '#FFFFFF' },
      { id: 'twp4', position: .855, color: '#FFFFFF' },
      { id: 'twp5', position: .905, color: '#F29BBC' },
      { id: 'twp6', position: 1, color: '#F29BBC' },
    ],
  }),

  p('twotone-sky-soft', 'TwoTone', 'Sky White Duo', 'basic', {
    thickness: 104,
    color: '#9FC8F4',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'tws1', position: 0, color: '#9FC8F4' },
      { id: 'tws2', position: .775, color: '#9FC8F4' },
      { id: 'tws3', position: .815, color: '#FFFFFF' },
      { id: 'tws4', position: .855, color: '#FFFFFF' },
      { id: 'tws5', position: .905, color: '#9FC8F4' },
      { id: 'tws6', position: 1, color: '#9FC8F4' },
    ],
  }),

  p('twotone-mint-soft', 'TwoTone', 'Mint White Duo', 'basic', {
    thickness: 104,
    color: '#91D9C4',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'twm1', position: 0, color: '#91D9C4' },
      { id: 'twm2', position: .775, color: '#91D9C4' },
      { id: 'twm3', position: .815, color: '#FFFFFF' },
      { id: 'twm4', position: .855, color: '#FFFFFF' },
      { id: 'twm5', position: .905, color: '#91D9C4' },
      { id: 'twm6', position: 1, color: '#91D9C4' },
    ],
  }),

  p('twotone-peach-soft', 'TwoTone', 'Peach White Duo', 'basic', {
    thickness: 104,
    color: '#F5B39E',
    secondaryColor: '#FFFFFF',
    gradientMode: 'radial',
    gradientStops: [
      { id: 'twpe1', position: 0, color: '#F5B39E' },
      { id: 'twpe2', position: .775, color: '#F5B39E' },
      { id: 'twpe3', position: .815, color: '#FFFFFF' },
      { id: 'twpe4', position: .855, color: '#FFFFFF' },
      { id: 'twpe5', position: .905, color: '#F5B39E' },
      { id: 'twpe6', position: 1, color: '#F5B39E' },
    ],
  }),

  p('glow-soft', 'Glow', 'Soft Glow Ring', 'basic', { thickness: 22 }, {}, { glowEnabled: true, glowBlur: 42, glowIntensity: .45 }),
  p('glow-neon', 'Glow', 'Neon Circle', 'basic', { thickness: 20, color: '#9A8CFF' }, {}, { glowEnabled: true, glowColor: '#8C7BFF', glowBlur: 70, glowIntensity: .85, bloom: 20 }),
  p('glow-double', 'Glow', 'Double Glow', 'double', { thickness: 16, gradientMode: 'conic' }, {}, { glowEnabled: true, glowBlur: 55, glowIntensity: .7 }),
  p('glow-broken', 'Glow', 'Broken Neon', 'segmented', { thickness: 28, gradientMode: 'conic' }, { dash: 170, gap: 75 }, { glowEnabled: true, glowBlur: 65, glowIntensity: .75 }),
  p('glow-dots', 'Glow', 'Glow Dots', 'dotted', { thickness: 8 }, { decorationCount: 46, decorationSize: 16 }, { glowEnabled: true, glowBlur: 38, glowIntensity: .72 }),
  p('glow-neon-sign', 'Glow', 'Neon Sign Outline', 'scribble', { thickness: 7, color: '#B38AFF' }, { roughness: 6, strokeCount: 3 }, { glowEnabled: true, glowColor: '#A47BFF', glowBlur: 54, glowIntensity: .95, bloom: 18 }),
  p('glow-neon-heart', 'Glow', 'Neon Heart Wreath', 'heart', { color: '#F7D267', secondaryColor: '#8AC9FF' }, { decorationCount: 26, decorationSize: 18, decorationOffset: 16, keepUpright: true, colorCount: 2, paletteColors: ['#F7D267','#8AC9FF','#F7D267','#8AC9FF'] }, { glowEnabled: true, glowColor: '#FFF0A4', glowBlur: 40, glowIntensity: .75 }),
  p('glow-neon-ribbon', 'Glow', 'Neon Ribbon Ring', 'ribbon', { color: '#FFFFFF', secondaryColor: '#E2CBFF' }, { decorationCount: 14, decorationSize: 22, decorationOffset: 22, keepUpright: true, colorCount: 2, paletteColors: ['#FFFFFF','#E2CBFF','#FFFFFF','#E2CBFF'] }, { glowEnabled: true, glowColor: '#B38AFF', glowBlur: 44, glowIntensity: .65 }),

  p('glossy-clean', '3D', 'Glossy Ring', 'glossy', { thickness: 74, gradientMode: 'conic' }, {}, { shadowEnabled: true, shadowBlur: 30, shadowOffsetY: 18 }),
  p('glossy-thin', '3D', 'Thin Glossy', 'glossy', { thickness: 42, gradientMode: 'conic' }, {}, { glowEnabled: true, glowBlur: 28, glowIntensity: .25 }),
  p('glossy-bright', '3D', 'Luminous Glossy', 'glossy', { thickness: 64, gradientMode: 'conic' }, {}, { glowEnabled: true, glowBlur: 55, glowIntensity: .48, bloom: 12 }),

  p('abstract-offset', 'Abstract', 'Offset Arcs', 'arc', { thickness: 18, gradientMode: 'conic', rotation: 33 }, { dash: 340, gap: 110 }),
  p('abstract-mix', 'Abstract', 'Mixed Segments', 'segmented', { thickness: 15 }, { dash: 95, gap: 25 }),
  p('abstract-wave', 'Abstract', 'Organic Circle', 'wavy', { thickness: 16 }, { waveAmplitude: 15, waveCount: 9 }),
  p('abstract-rough', 'Abstract', 'Organic Rough', 'rough', { thickness: 13 }, { roughness: 20, strokeCount: 4 }),
]

export const CATEGORIES = ['전체', ...Array.from(new Set(PRESETS.map(x => x.category)))]
