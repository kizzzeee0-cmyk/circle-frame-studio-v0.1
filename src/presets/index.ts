import type { FramePreset, RingKind, RingLayer } from '../types'

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
})

const basePattern = () => ({
  dash: 105,
  gap: 50,
  segmentCount: 12,
  roughness: 12,
  strokeCount: 4,
  waveAmplitude: 18,
  waveCount: 20,
  decorationCount: 18,
  decorationSize: 28,
  seed: 3701,
})

export function createLayer(kind: RingKind = 'basic', name = 'Circle Ring'): RingLayer {
  return {
    id: `layer-${Math.random().toString(36).slice(2, 9)}`,
    name,
    kind,
    visible: true,
    locked: false,
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
      { id: 's2', position: 0.52, color: '#C7B8F1' },
      { id: 's3', position: 1, color: '#F0BDD7' },
    ],
    effects: baseEffects(),
    pattern: basePattern(),
  }
}

function p(id: string, category: string, name: string, kind: RingKind, patch: Partial<RingLayer> = {}, pattern = {}, effects = {}): FramePreset {
  const layer = createLayer(kind, name)
  Object.assign(layer, patch)
  Object.assign(layer.pattern, pattern)
  Object.assign(layer.effects, effects)
  layer.id = `preset-${id}`
  return { id, category, name, layer }
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
  p('arc-single', 'Broken', 'Open Arc', 'arc', { thickness: 30 }, { dash: 900, gap: 600 }),
  p('arc-multi', 'Broken', 'Multiple Arcs', 'arc', { thickness: 24 }, { dash: 390, gap: 145 }),
  p('arc-fine', 'Broken', 'Fine Arcs', 'arc', { thickness: 13 }, { dash: 280, gap: 120 }),

  p('dot-mini', 'Dot', 'Mini Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 84, decorationSize: 9 }),
  p('dot-soft', 'Dot', 'Soft Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 52, decorationSize: 14 }),
  p('dot-bold', 'Dot', 'Bold Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 32, decorationSize: 24 }),
  p('dot-double', 'Dot', 'Dense Dot Ring', 'dotted', { thickness: 8 }, { decorationCount: 100, decorationSize: 7 }),

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

  p('brush-dry', 'Brush', 'Dry Brush Circle', 'brush', { thickness: 34 }, { dash: 85, gap: 15, roughness: 25 }),
  p('brush-ink', 'Brush', 'Ink Brush Ring', 'brush', { thickness: 52 }, { dash: 115, gap: 10, roughness: 18 }),
  p('brush-soft', 'Brush', 'Soft Brush Ring', 'brush', { thickness: 42, opacity: .78 }, { dash: 75, gap: 10, roughness: 12 }),
  p('brush-water', 'Brush', 'Watercolor Ring', 'brush', { thickness: 58, opacity: .58 }, { dash: 60, gap: 8, roughness: 30 }),

  p('sparkle-light', 'Decorative', 'Sparkle Ring', 'sparkle', { thickness: 8 }, { decorationCount: 16, decorationSize: 32 }),
  p('sparkle-dense', 'Decorative', 'Dense Sparkle', 'sparkle', { thickness: 6 }, { decorationCount: 28, decorationSize: 24 }),
  p('star-cute', 'Decorative', 'Star Circle', 'star', { thickness: 5 }, { decorationCount: 18, decorationSize: 28 }),
  p('star-mini', 'Decorative', 'Mini Star Ring', 'star', { thickness: 5 }, { decorationCount: 30, decorationSize: 18 }),
  p('heart-cute', 'Decorative', 'Heart Circle', 'heart', { thickness: 5 }, { decorationCount: 22, decorationSize: 24 }),
  p('heart-wide', 'Decorative', 'Wide Heart Ring', 'heart', { thickness: 5 }, { decorationCount: 14, decorationSize: 34 }),

  p('gradient-lav', 'Gradient', 'Lavender Gradient', 'basic', { thickness: 42, gradientMode: 'conic' }),
  p('gradient-pink', 'Gradient', 'Pink Blue Gradient', 'basic', { thickness: 52, gradientMode: 'conic', gradientStops: [
    { id: 'g1', position: 0, color: '#F2AFCB' }, { id: 'g2', position: .5, color: '#9BC9EE' }, { id: 'g3', position: 1, color: '#F2AFCB' }
  ] }),
  p('gradient-double', 'Gradient', 'Double Gradient', 'double', { thickness: 22, gradientMode: 'conic' }),
  p('gradient-segment', 'Gradient', 'Segment Gradient', 'segmented', { thickness: 38, gradientMode: 'conic' }, { dash: 175, gap: 70 }),

  p('glow-soft', 'Glow', 'Soft Glow Ring', 'basic', { thickness: 22 }, {}, { glowEnabled: true, glowBlur: 42, glowIntensity: .45 }),
  p('glow-neon', 'Glow', 'Neon Circle', 'basic', { thickness: 20, color: '#9A8CFF' }, {}, { glowEnabled: true, glowColor: '#8C7BFF', glowBlur: 70, glowIntensity: .85, bloom: 20 }),
  p('glow-double', 'Glow', 'Double Glow', 'double', { thickness: 16, gradientMode: 'conic' }, {}, { glowEnabled: true, glowBlur: 55, glowIntensity: .7 }),
  p('glow-broken', 'Glow', 'Broken Neon', 'segmented', { thickness: 28, gradientMode: 'conic' }, { dash: 170, gap: 75 }, { glowEnabled: true, glowBlur: 65, glowIntensity: .75 }),
  p('glow-dots', 'Glow', 'Glow Dots', 'dotted', { thickness: 8 }, { decorationCount: 46, decorationSize: 16 }, { glowEnabled: true, glowBlur: 38, glowIntensity: .72 }),

  p('glossy-clean', '3D', 'Glossy Ring', 'glossy', { thickness: 74, gradientMode: 'conic' }, {}, { shadowEnabled: true, shadowBlur: 30, shadowOffsetY: 18 }),
  p('glossy-thin', '3D', 'Thin Glossy', 'glossy', { thickness: 42, gradientMode: 'conic' }, {}, { glowEnabled: true, glowBlur: 28, glowIntensity: .25 }),
  p('glossy-bright', '3D', 'Luminous Glossy', 'glossy', { thickness: 64, gradientMode: 'conic' }, {}, { glowEnabled: true, glowBlur: 55, glowIntensity: .48, bloom: 12 }),

  p('abstract-offset', 'Abstract', 'Offset Arcs', 'arc', { thickness: 18, gradientMode: 'conic', rotation: 33 }, { dash: 340, gap: 110 }),
  p('abstract-mix', 'Abstract', 'Mixed Segments', 'segmented', { thickness: 15 }, { dash: 95, gap: 25 }),
  p('abstract-wave', 'Abstract', 'Organic Circle', 'wavy', { thickness: 16 }, { waveAmplitude: 15, waveCount: 9 }),
  p('abstract-rough', 'Abstract', 'Organic Rough', 'rough', { thickness: 13 }, { roughness: 20, strokeCount: 4 }),
]

export const CATEGORIES = ['전체', ...Array.from(new Set(PRESETS.map(x => x.category)))]
