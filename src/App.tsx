import { useCallback, useEffect, useRef, useState } from 'react'
import CanvasPanel from './components/CanvasPanel'
import PresetBrowser from './components/PresetBrowser'
import PropertyPanel from './components/PropertyPanel'
import UpdateSpotlight from './components/UpdateSpotlight'
import RecentSavesModal from './components/RecentSavesModal'
import AnimatedExportModal from './components/AnimatedExportModal'
import MediaPanel from './components/MediaPanel'
import MediaPropertyPanel from './components/MediaPropertyPanel'
import TimelinePanel from './components/TimelinePanel'
import { createDesign, PRESETS } from './presets'
import type { BackgroundSettings, FrameDesign, FrameLayer, FramePreset, FrameProject, MediaGroup, MediaLayer } from './types'
import { downloadProject, exportPng } from './utils/export'
import { addRecentSave, clearRecentSaves, deleteRecentSave, listRecentSaves, type RecentSaveRecord, type RecentSaveSource } from './utils/recentSaves'
import { uid } from './utils/id'
import { storeMediaFile } from './utils/media'
import { exportPortableProject, importPortableProject } from './utils/projectBundle'
import { createMediaLayer, defaultBackground, defaultComposerSettings, defaultTimeline, normalizeBackground, normalizeComposerSettings, normalizeMediaLayer, normalizeTimeline } from './utils/projectDefaults'
import { APP_VERSION, CURRENT_UPDATE, UPDATE_SEEN_KEY } from './updateNotes'
import './styles.css'

const AUTOSAVE_KEY = 'circle-frame-studio-project-v037'
const LEGACY_AUTOSAVE_KEYS = ['circle-frame-studio-project-v036', 'circle-frame-studio-project-v035', 'circle-frame-studio-project-v034', 'circle-frame-studio-project-v033', 'circle-frame-studio-project-v032', 'circle-frame-studio-project-v031', 'circle-frame-studio-project-v030', 'circle-frame-studio-project-v029', 'circle-frame-studio-project-v028', 'circle-frame-studio-project-v027', 'circle-frame-studio-project-v026', 'circle-frame-studio-project-v025', 'circle-frame-studio-project-v024', 'circle-frame-studio-project-v023', 'circle-frame-studio-project-v022', 'circle-frame-studio-project-v021', 'circle-frame-studio-project-v020', 'circle-frame-studio-project-v019', 'circle-frame-studio-project-v018', 'circle-frame-studio-project-v017', 'circle-frame-studio-project-v016', 'circle-frame-studio-project-v015', 'circle-frame-studio-project-v014', 'circle-frame-studio-project-v013', 'circle-frame-studio-project-v012', 'circle-frame-studio-project-v011', 'circle-frame-studio-project-v010', 'circle-frame-studio-project-v09', 'circle-frame-studio-project-v08', 'circle-frame-studio-project-v07', 'circle-frame-studio-project-v06', 'circle-frame-studio-project-v05', 'circle-frame-studio-project-v04', 'circle-frame-studio-project-v03']
const USER_PRESETS_KEY = 'circle-frame-studio-user-presets-v037'
const LEGACY_USER_PRESET_KEYS = ['circle-frame-studio-user-presets-v036', 'circle-frame-studio-user-presets-v035', 'circle-frame-studio-user-presets-v034', 'circle-frame-studio-user-presets-v033', 'circle-frame-studio-user-presets-v032', 'circle-frame-studio-user-presets-v031', 'circle-frame-studio-user-presets-v030', 'circle-frame-studio-user-presets-v029', 'circle-frame-studio-user-presets-v028', 'circle-frame-studio-user-presets-v027', 'circle-frame-studio-user-presets-v026', 'circle-frame-studio-user-presets-v025', 'circle-frame-studio-user-presets-v024', 'circle-frame-studio-user-presets-v023', 'circle-frame-studio-user-presets-v022', 'circle-frame-studio-user-presets-v021', 'circle-frame-studio-user-presets-v020', 'circle-frame-studio-user-presets-v019', 'circle-frame-studio-user-presets-v018', 'circle-frame-studio-user-presets-v017', 'circle-frame-studio-user-presets-v016', 'circle-frame-studio-user-presets-v015', 'circle-frame-studio-user-presets-v014', 'circle-frame-studio-user-presets-v013', 'circle-frame-studio-user-presets-v012', 'circle-frame-studio-user-presets-v011', 'circle-frame-studio-user-presets-v010', 'circle-frame-studio-user-presets-v09', 'circle-frame-studio-user-presets-v08', 'circle-frame-studio-user-presets-v07', 'circle-frame-studio-user-presets-v06', 'circle-frame-studio-user-presets-v05', 'circle-frame-studio-user-presets-v04', 'circle-frame-studio-user-presets-v03']

function normalizeDesign(source: Partial<FrameDesign>): FrameDesign {
  const base = createDesign(source.kind ?? 'basic', source.name ?? 'Frame')
  const legacyPattern = source.pattern as (Partial<FrameDesign['pattern']> & { alternateColors?: boolean; paletteColors?: string[] }) | undefined
  const incomingPalette = Array.isArray(legacyPattern?.paletteColors) ? legacyPattern!.paletteColors : []
  const paletteColors: [string, string, string, string] = [
    incomingPalette[0] ?? source.color ?? base.color,
    incomingPalette[1] ?? source.secondaryColor ?? base.secondaryColor,
    incomingPalette[2] ?? '#F3A9C8',
    incomingPalette[3] ?? '#B8A5F2',
  ]
  const rawColorCount = Number(legacyPattern?.colorCount ?? (legacyPattern?.alternateColors ? 2 : base.pattern.colorCount))
  const colorCount = rawColorCount >= 4 ? 4 : rawColorCount >= 3 ? 3 : rawColorCount >= 2 ? 2 : 1
  return {
    ...base,
    ...source,
    effects: { ...base.effects, ...(source.effects ?? {}) },
    twoToneFlow: {
      ...base.twoToneFlow,
      ...(source.twoToneFlow ?? {}),
      repeatCount: source.twoToneFlow?.repeatCount === 4 ? 4 : source.twoToneFlow?.repeatCount === 3 ? 3 : source.twoToneFlow?.repeatCount === 2 ? 2 : 1,
    },
    tripleRing: {
      ...base.tripleRing,
      ...(source.tripleRing ?? {}),
      colors: Array.isArray(source.tripleRing?.colors) && source.tripleRing.colors.length >= 3
        ? [source.tripleRing.colors[0], source.tripleRing.colors[1], source.tripleRing.colors[2]]
        : base.tripleRing.colors,
      widths: Array.isArray(source.tripleRing?.widths) && source.tripleRing.widths.length >= 3
        ? [
            Math.max(1, Number(source.tripleRing.widths[0]) || base.tripleRing.widths[0]),
            Math.max(1, Number(source.tripleRing.widths[1]) || base.tripleRing.widths[1]),
            Math.max(1, Number(source.tripleRing.widths[2]) || base.tripleRing.widths[2]),
          ]
        : base.tripleRing.widths,
    },
    glitter: {
      ...base.glitter,
      ...(source.glitter ?? {}),
      colorCount: Number(source.glitter?.colorCount) >= 4 ? 4 : Number(source.glitter?.colorCount) >= 3 ? 3 : Number(source.glitter?.colorCount) >= 2 ? 2 : 1,
      colors: Array.isArray(source.glitter?.colors) && source.glitter.colors.length >= 4
        ? [source.glitter.colors[0], source.glitter.colors[1], source.glitter.colors[2], source.glitter.colors[3]]
        : base.glitter.colors,
      surfaceStyle: ['legacy','gradient','fine','twinkle','holographic','orbit','reflection'].includes(String(source.glitter?.surfaceStyle))
        ? source.glitter!.surfaceStyle
        : base.glitter.surfaceStyle,
      animationMode: ['none','twinkle','rotate','rotate-twinkle','sweep','orbit'].includes(String(source.glitter?.animationMode))
        ? source.glitter!.animationMode
        : base.glitter.animationMode,
      density: Math.max(12, Math.min(900, Number(source.glitter?.density ?? base.glitter.density))),
      particleSize: Math.max(.35, Number(source.glitter?.particleSize ?? base.glitter.particleSize)),
      particleSizeVariation: Math.max(0, Math.min(1, Number(source.glitter?.particleSizeVariation ?? base.glitter.particleSizeVariation))),
      sparkleSize: Math.max(1, Number(source.glitter?.sparkleSize ?? base.glitter.sparkleSize)),
      accentSparkleCount: Math.max(0, Math.min(18, Math.round(Number(source.glitter?.accentSparkleCount ?? base.glitter.accentSparkleCount)))),
      accentSparkleDuration: Math.max(.04, Math.min(.8, Number(source.glitter?.accentSparkleDuration ?? base.glitter.accentSparkleDuration))),
      textureContrast: Math.max(0, Math.min(1, Number(source.glitter?.textureContrast ?? base.glitter.textureContrast))),
      surfaceHighlight: Math.max(0, Math.min(1, Number(source.glitter?.surfaceHighlight ?? base.glitter.surfaceHighlight))),
      rimStrength: Math.max(0, Math.min(1, Number(source.glitter?.rimStrength ?? base.glitter.rimStrength))),
      ringVisible: source.glitter?.ringVisible !== false,
      orbitSpread: Math.max(.5, Math.min(120, Number(source.glitter?.orbitSpread ?? base.glitter.orbitSpread))),
      orbitDensity: Math.max(48, Math.min(1200, Math.round(Number(source.glitter?.orbitDensity ?? base.glitter.orbitDensity)))),
      orbitTrail: Math.max(0, Math.min(1, Number(source.glitter?.orbitTrail ?? base.glitter.orbitTrail))),
      loopDuration: Math.max(.5, Math.min(30, Number(source.glitter?.loopDuration ?? base.glitter.loopDuration))),
      orbitEnabled: source.glitter?.orbitEnabled ?? (source.glitter?.animationMode === 'orbit'),
      twinkleEnabled: source.glitter?.twinkleEnabled ?? ['twinkle','rotate-twinkle','orbit'].includes(String(source.glitter?.animationMode ?? base.glitter.animationMode)),
      highlightSweepEnabled: source.glitter?.highlightSweepEnabled ?? (source.glitter?.animationMode === 'sweep'),
      sparkleRatio: Math.max(0, Math.min(1, Number(source.glitter?.sparkleRatio ?? base.glitter.sparkleRatio))),
      spread: Math.max(1, Number(source.glitter?.spread ?? base.glitter.spread)),
      glow: Math.max(0, Number(source.glitter?.glow ?? base.glitter.glow)),
      baseOpacity: Math.max(0, Math.min(1, Number(source.glitter?.baseOpacity ?? base.glitter.baseOpacity))),
      edgeHighlight: Math.max(0, Math.min(1, Number(source.glitter?.edgeHighlight ?? base.glitter.edgeHighlight))),
      animated: source.glitter?.animated ?? base.glitter.animated,
      animationStyle: ['twinkle','flash','shimmer','orbit','mixed'].includes(String(source.glitter?.animationStyle))
        ? source.glitter!.animationStyle
        : base.glitter.animationStyle,
      animationSpeed: Math.max(.05, Math.min(5, Number(source.glitter?.animationSpeed ?? base.glitter.animationSpeed))),
      animationStrength: Math.max(0, Math.min(1, Number(source.glitter?.animationStrength ?? base.glitter.animationStrength))),
      animationSmoothness: Math.max(0, Math.min(1, Number(source.glitter?.animationSmoothness ?? base.glitter.animationSmoothness))),
      sweepWidth: Math.max(.02, Math.min(.5, Number(source.glitter?.sweepWidth ?? base.glitter.sweepWidth))),
      particleStyle: ['soft','twinkle','sugar','luminous'].includes(String(source.glitter?.particleStyle))
        ? source.glitter!.particleStyle
        : base.glitter.particleStyle,
      highlightColor: source.glitter?.highlightColor ?? base.glitter.highlightColor,
      glowColor: source.glitter?.glowColor ?? base.glitter.glowColor,
      flowEnabled: source.glitter?.flowEnabled ?? base.glitter.flowEnabled,
      flowDirection: source.glitter?.flowDirection === -1 ? -1 : 1,
    },
    jelly: {
      ...base.jelly,
      ...(source.jelly ?? {}),
    },
    rotationAnimation: {
      ...base.rotationAnimation,
      ...(source.rotationAnimation ?? {}),
      direction: source.rotationAnimation?.direction === -1 ? -1 : 1,
      secondsPerTurn: Math.max(.1, Number(source.rotationAnimation?.secondsPerTurn ?? base.rotationAnimation.secondsPerTurn)),
      startTime: Math.max(0, Number(source.rotationAnimation?.startTime ?? base.rotationAnimation.startTime)),
      endTime: Math.max(0, Number(source.rotationAnimation?.endTime ?? base.rotationAnimation.endTime)),
    },
    pattern: {
      ...base.pattern,
      ...(legacyPattern ?? {}),
      paletteColors,
      colorCount,
      bulgeAmplitude: Number(legacyPattern?.bulgeAmplitude ?? base.pattern.bulgeAmplitude),
      bulgeCount: Math.max(0, Math.round(Number(legacyPattern?.bulgeCount ?? base.pattern.bulgeCount))),
    },
    gradientStops: source.gradientStops?.length ? source.gradientStops : base.gradientStops,
    id: source.id || uid('design'),
  }
}

function mediaLayerBounds(layer: MediaLayer) {
  const width = Math.max(1, layer.width * layer.scale)
  const height = Math.max(1, layer.height * layer.scale)
  const angle = layer.rotation * Math.PI / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const bw = width * cos + height * sin
  const bh = width * sin + height * cos
  return {
    left: layer.x - bw / 2,
    right: layer.x + bw / 2,
    top: layer.y - bh / 2,
    bottom: layer.y + bh / 2,
    width: bw,
    height: bh,
  }
}

function makeLayerFromDesign(source: Partial<FrameDesign>, layerName?: string): FrameLayer {
  const design = normalizeDesign(source)
  return {
    id: uid('layer'),
    name: layerName || design.name || '레이어',
    visible: true,
    design,
  }
}

function mergeEmbossSettings(target: FrameDesign, source: FrameDesign): FrameDesign {
  return {
    ...target,
    effects: {
      ...target.effects,
      // Once the user has tuned bevel/emboss, changing the frame preset should not reset it.
      // A preset can still turn emboss ON if the current frame had it OFF.
      embossEnabled: source.effects.embossEnabled || target.effects.embossEnabled,
      embossSize: source.effects.embossSize,
      embossDepth: source.effects.embossDepth,
      embossSoftness: source.effects.embossSoftness,
      embossLightAngle: source.effects.embossLightAngle,
      embossLightAltitude: source.effects.embossLightAltitude,
      embossHighlightColor: source.effects.embossHighlightColor,
      embossHighlightOpacity: source.effects.embossHighlightOpacity,
      embossShadowColor: source.effects.embossShadowColor,
      embossShadowOpacity: source.effects.embossShadowOpacity,
      embossMode: source.effects.embossMode,
      embossStyle: source.effects.embossStyle,
      embossTechnique: source.effects.embossTechnique,
      embossDirection: source.effects.embossDirection,
      embossHighlightBlend: source.effects.embossHighlightBlend,
      embossShadowBlend: source.effects.embossShadowBlend,
      embossBaseRetention: source.effects.embossBaseRetention,
      embossHighlightSharpness: source.effects.embossHighlightSharpness,
      embossAutoShadowColor: source.effects.embossAutoShadowColor,
      embossAutoShadowDarkness: source.effects.embossAutoShadowDarkness,
      embossMidtoneStrength: source.effects.embossMidtoneStrength,
    },
  }
}

function syncSelectedLayer(draft: FrameProject): FrameProject {
  if (!draft.layers.length) {
    const layer = makeLayerFromDesign(createDesign('basic', 'Circle Ring'), '레이어 1')
    draft.layers = [layer]
    draft.selectedLayerId = layer.id
  }
  const active = draft.layers.find(layer => layer.id === draft.selectedLayerId) ?? draft.layers[draft.layers.length - 1]
  draft.selectedLayerId = active.id
  draft.design = structuredClone(active.design)
  return draft
}

function normalizeProject(source: any): FrameProject {
  const timeline = normalizeTimeline(source?.timeline)
  const background = normalizeBackground(source?.background)
  const settings = normalizeComposerSettings(source?.settings)
  const mediaGroups: MediaGroup[] = Array.isArray(source?.mediaGroups)
    ? source.mediaGroups.map((group: Partial<MediaGroup>, index: number) => ({
        id: group.id || uid('group'),
        name: group.name || ('그룹 ' + (index + 1)),
        layerIds: Array.isArray(group.layerIds) ? group.layerIds.filter(Boolean) : [],
        locked: group.locked === true,
      }))
    : []
  const mediaLayers = Array.isArray(source?.mediaLayers)
    ? source.mediaLayers.map((layer: Partial<MediaLayer>, index: number) => normalizeMediaLayer(layer, index, timeline.duration))
    : []

  if (Array.isArray(source?.layers) && source.layers.length > 0) {
    const layers = source.layers.map((layer: any, index: number) => {
      if (layer?.design) {
        const normalized = makeLayerFromDesign(layer.design, layer.name || layer.design?.name || ('레이어 ' + (index + 1)))
        normalized.id = layer.id || normalized.id
        normalized.visible = layer.visible !== false
        return normalized
      }
      const normalized = makeLayerFromDesign(layer, layer?.name || ('레이어 ' + (index + 1)))
      normalized.id = layer?.id || normalized.id
      normalized.visible = layer?.visible !== false
      return normalized
    })
    return syncSelectedLayer({
      version: APP_VERSION,
      width: 2000,
      height: 2000,
      autoFit: typeof source.autoFit === 'boolean' ? source.autoFit : true,
      design: normalizeDesign(source.design ?? layers[layers.length - 1].design),
      layers,
      selectedLayerId: source.selectedLayerId ?? layers[layers.length - 1].id,
      mediaLayers,
      background,
      timeline,
      mediaGroups,
      settings,
    })
  }

  if (source?.design) {
    const layer = makeLayerFromDesign(source.design, source.design?.name || '레이어 1')
    return syncSelectedLayer({
      version: APP_VERSION,
      width: 2000,
      height: 2000,
      autoFit: typeof source.autoFit === 'boolean' ? source.autoFit : true,
      design: structuredClone(layer.design),
      layers: [layer],
      selectedLayerId: layer.id,
      mediaLayers,
      background,
      timeline,
      mediaGroups,
      settings,
    })
  }

  return makeInitialProject()
}

function makeInitialProject(): FrameProject {
  const design = createDesign('ribbon', 'Rounded Ribbon Ring')
  design.radius = 800
  design.pattern.decorationLayout = 'spacing'
  design.pattern.decorationSpacing = 170
  design.pattern.decorationSize = 24
  design.pattern.decorationOffset = 18
  design.pattern.keepUpright = true
  design.pattern.colorCount = 2
  design.pattern.paletteColors = ['#F8AFCF', '#FBD4E5', '#F8AFCF', '#FBD4E5']
  const layer = makeLayerFromDesign(design, design.name)
  return {
    version: APP_VERSION,
    width: 2000,
    height: 2000,
    autoFit: true,
    design: structuredClone(layer.design),
    layers: [layer],
    selectedLayerId: layer.id,
    mediaLayers: [],
    background: defaultBackground(),
    timeline: defaultTimeline(),
    mediaGroups: [],
    settings: defaultComposerSettings(),
  }
}

function loadInitialProject() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY) ?? LEGACY_AUTOSAVE_KEYS.map(key => localStorage.getItem(key)).find(Boolean)
    if (raw) return normalizeProject(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return makeInitialProject()
}

function loadUserPresets(): FramePreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY) ?? LEGACY_USER_PRESET_KEYS.map(key => localStorage.getItem(key)).find(Boolean)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function readImageSize(file: File) {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const item = new Image()
      item.onload = () => resolve(item)
      item.onerror = reject
      item.src = url
    })
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function optimizeAsset(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const maxSide = 512
    const scale = Math.min(1, maxSide / Math.max(1, img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function App() {
  const [project, setProject] = useState<FrameProject>(loadInitialProject)
  const [userPresets, setUserPresets] = useState<FramePreset[]>(loadUserPresets)
  const [recentSaves, setRecentSaves] = useState<RecentSaveRecord[]>([])
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentLoading, setRecentLoading] = useState(false)
  const [animatedExportOpen, setAnimatedExportOpen] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState('')
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [timelineTime, setTimelineTime] = useState(0)
  const [timelinePlaying, setTimelinePlaying] = useState(true)
  const [pngResolution, setPngResolution] = useState(2000)
  const [lastAutosaveAt, setLastAutosaveAt] = useState(0)
  const [updateSpotlightOpen, setUpdateSpotlightOpen] = useState(() => {
    try { return localStorage.getItem(UPDATE_SEEN_KEY) !== '1' } catch { return true }
  })
  const undoRef = useRef<FrameProject[]>([])
  const redoRef = useRef<FrameProject[]>([])
  const coalesceRef = useRef<{ key: string; time: number }>({ key: '', time: 0 })
  const fileInput = useRef<HTMLInputElement>(null)
  const bundleInput = useRef<HTMLInputElement>(null)
  const mediaClipboardRef = useRef<MediaLayer[]>([])

  const commit = useCallback((updater: (draft: FrameProject) => FrameProject) => {
    setProject(prev => {
      undoRef.current.push(structuredClone(prev))
      if (undoRef.current.length > 80) undoRef.current.shift()
      redoRef.current = []
      const next = updater(structuredClone(prev))
      return syncSelectedLayer(next)
    })
  }, [])

  const commitCoalesced = useCallback((key: string, updater: (draft: FrameProject) => FrameProject) => {
    setProject(prev => {
      const now = performance.now()
      const sameBurst = coalesceRef.current.key === key && now - coalesceRef.current.time < 450
      if (!sameBurst) {
        undoRef.current.push(structuredClone(prev))
        if (undoRef.current.length > 80) undoRef.current.shift()
        redoRef.current = []
      }
      coalesceRef.current = { key, time: now }
      const next = updater(structuredClone(prev))
      return syncSelectedLayer(next)
    })
  }, [])

  const undo = useCallback(() => {
    setProject(prev => {
      const last = undoRef.current.pop()
      if (!last) return prev
      redoRef.current.push(structuredClone(prev))
      return syncSelectedLayer(last)
    })
  }, [])

  const redo = useCallback(() => {
    setProject(prev => {
      const next = redoRef.current.pop()
      if (!next) return prev
      undoRef.current.push(structuredClone(prev))
      return syncSelectedLayer(next)
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project))
        setLastAutosaveAt(Date.now())
      } catch { /* quota */ }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [project])

  useEffect(() => {
    try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(userPresets)) } catch { /* quota */ }
  }, [userPresets])

  useEffect(() => {
    if (!timelinePlaying) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const delta = Math.max(0, Math.min(.1, (now - last) / 1000))
      last = now
      setTimelineTime(current => {
        const duration = Math.max(.5, project.timeline?.duration ?? 3)
        const next = current + delta
        if (next < duration) return next
        if (project.timeline?.loop !== false) return next % duration
        setTimelinePlaying(false)
        return duration
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [timelinePlaying, project.timeline?.duration, project.timeline?.loop])

  const refreshRecentSaves = useCallback(async () => {
    setRecentLoading(true)
    try {
      setRecentSaves(await listRecentSaves())
    } catch (error) {
      console.warn('최근 저장 내역을 불러오지 못했습니다.', error)
      setRecentSaves([])
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (recentOpen) void refreshRecentSaves()
  }, [recentOpen, refreshRecentSaves])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        downloadProject(project)
        void addRecentSave(project, 'json')
          .then(({ records }) => setRecentSaves(records))
          .catch(error => console.warn('최근 저장 내역 기록 실패', error))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, redo, undo])

  const dismissUpdateSpotlight = () => {
    try { localStorage.setItem(UPDATE_SEEN_KEY, '1') } catch { /* storage unavailable */ }
    setUpdateSpotlightOpen(false)
  }

  const selectPreset = (preset: FramePreset) => {
    setSelectedMediaId('')
    setSelectedMediaIds([])
    commit(draft => {
      let design = structuredClone(preset.design)
      design = mergeEmbossSettings(design, draft.design)
      design.id = uid('design')
      design.name = preset.name
      const index = draft.layers.findIndex(layer => layer.id === draft.selectedLayerId)
      if (index >= 0) {
        draft.layers[index].design = design
        draft.layers[index].name = design.name
      } else {
        const layer = makeLayerFromDesign(design, design.name)
        draft.layers.push(layer)
        draft.selectedLayerId = layer.id
      }
      draft.design = structuredClone(design)
      return draft
    })
  }

  const tryUpdatePreset = (presetId: string) => {
    const preset = PRESETS.find(item => item.id === presetId)
    if (preset) selectPreset(preset)
    dismissUpdateSpotlight()
  }

  const updateDesign = (next: FrameDesign) => {
    commitCoalesced('design:' + project.selectedLayerId, draft => {
      const index = draft.layers.findIndex(layer => layer.id === draft.selectedLayerId)
      if (index >= 0) {
        draft.layers[index].design = structuredClone(next)
        draft.layers[index].name = next.name
      }
      draft.design = structuredClone(next)
      return draft
    })
  }

  const recordRecentSave = async (source: RecentSaveSource) => {
    try {
      const { records } = await addRecentSave(project, source)
      setRecentSaves(records)
    } catch (error) {
      console.warn('최근 저장 내역 기록 실패', error)
      alert('파일은 저장했지만 최근 저장 내역을 기록하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.')
    }
  }

  const handlePngExport = async () => {
    try {
      await exportPng(project, timelineTime, pngResolution)
      await recordRecentSave('png')
    } catch {
      alert('PNG 파일을 저장하지 못했습니다.')
    }
  }

  const handleFramePngExport = async () => {
    try {
      const frameOnly = structuredClone(project)
      frameOnly.mediaLayers = []
      frameOnly.background = defaultBackground()
      await exportPng(frameOnly, timelineTime, pngResolution)
      await recordRecentSave('png')
    } catch {
      alert('프레임 PNG 파일을 저장하지 못했습니다.')
    }
  }

  const handleJsonSave = async () => {
    downloadProject(project)
    await recordRecentSave('json')
  }

  const handlePortableSave = async () => {
    try {
      await exportPortableProject(project)
      await recordRecentSave('project')
    } catch (error) {
      alert(error instanceof Error ? error.message : '휴대용 프로젝트를 저장하지 못했습니다.')
    }
  }

  const importPortable = async (file?: File) => {
    if (!file) return
    if (!confirm('프로젝트 패키지를 불러오면 현재 작업 상태가 바뀝니다. 계속할까요?')) return
    try {
      const restored = await importPortableProject(file)
      commit(() => normalizeProject(restored))
      setSelectedMediaId('')
      setSelectedMediaIds([])
      setTimelineTime(0)
    } catch (error) {
      alert(error instanceof Error ? error.message : '휴대용 프로젝트를 불러오지 못했습니다.')
    }
  }

  const loadRecentSave = (record: RecentSaveRecord) => {
    if (!confirm('최근 저장 내역을 불러오면 현재 작업 상태가 바뀝니다. 계속할까요?')) return
    commit(() => normalizeProject(record.project))
    setSelectedMediaId('')
    setSelectedMediaIds([])
    setTimelineTime(0)
    setRecentOpen(false)
  }

  const removeRecentSave = async (id: string) => {
    try {
      await deleteRecentSave(id)
      await refreshRecentSaves()
    } catch {
      alert('저장 내역을 삭제하지 못했습니다.')
    }
  }

  const removeAllRecentSaves = async () => {
    try {
      await clearRecentSaves()
      setRecentSaves([])
    } catch {
      alert('최근 저장 내역을 삭제하지 못했습니다.')
    }
  }

  const saveCurrentPreset = () => {
    const preset: FramePreset = {
      id: uid('user-preset'),
      category: '내 프리셋',
      name: `${project.design.name} 저장`,
      design: { ...structuredClone(project.design), id: uid('preset-design') },
    }
    setUserPresets(prev => [preset, ...prev].slice(0, 100))
  }

  const sampleColor = (hex: string) => {
    const next = structuredClone(project.design)
    next.color = hex
    next.pattern.paletteColors[0] = hex
    if (next.gradientMode !== 'solid' && next.gradientStops[0]) next.gradientStops[0].color = hex
    updateDesign(next)
  }

  const importProject = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      commit(() => normalizeProject(parsed))
      setSelectedMediaId('')
    setSelectedMediaIds([])
      setTimelineTime(0)
    } catch {
      alert('Circle Frame Studio 프로젝트 JSON 파일이 아닙니다.')
    }
  }

  const uploadAsset = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/webp', 'image/svg+xml'].includes(file.type) && !/\.(png|webp|svg)$/i.test(file.name)) {
      alert('투명 배경 PNG / WebP / SVG 파일을 선택해 주세요.')
      return
    }
    try {
      const dataUrl = await optimizeAsset(file)
      commit(draft => {
        const design = createDesign('asset', '내 PNG 반복 프레임')
        design.radius = 790
        design.pattern.customAssetUrl = dataUrl
        design.pattern.customAssetName = file.name
        design.pattern.decorationLayout = 'spacing'
        design.pattern.decorationSpacing = 145
        design.pattern.decorationSize = 24
        design.pattern.decorationOffset = 10
        design.pattern.keepUpright = true
        design.pattern.assetTintMode = 'original'
        design.pattern.colorCount = 4
        design.pattern.paletteColors = ['#F4C455', '#8DC5FF', '#F3A9C8', '#B8A5F2']
        const index = draft.layers.findIndex(layer => layer.id === draft.selectedLayerId)
        if (index >= 0) {
          draft.layers[index].design = design
          draft.layers[index].name = design.name
        } else {
          const layer = makeLayerFromDesign(design, design.name)
          draft.layers.push(layer)
          draft.selectedLayerId = layer.id
        }
        draft.design = design
        return draft
      })
    } catch {
      alert('이미지를 불러오지 못했습니다. PNG/WebP/SVG 파일인지 확인해 주세요.')
    }
  }

  const reset = () => {
    if (!confirm('현재 프로젝트를 초기화할까요?')) return
    commit(() => makeInitialProject())
    setSelectedMediaId('')
    setSelectedMediaIds([])
    setTimelineTime(0)
  }

  const resetUiLayout = () => {
    if (!confirm('즐겨찾기·접힘 상태·프리셋 즐겨찾기·타임라인 접힘 등 UI 배치만 초기화할까요? 현재 작업물은 유지됩니다.')) return
    try {
      localStorage.removeItem('circle-frame-studio-ui-sections-v034')
      localStorage.removeItem('circle-frame-studio-preset-favorites-v034')
      localStorage.removeItem('circle-frame-studio-timeline-collapsed-v034')
    } catch { /* ignore */ }
    window.location.reload()
  }

  const addLayer = () => {
    commit(draft => {
      const base = structuredClone(draft.design)
      base.id = uid('design')
      base.name = `${base.name} Copy`
      const layer = makeLayerFromDesign(base, `레이어 ${draft.layers.length + 1}`)
      layer.design.name = base.name
      draft.layers.unshift(layer)
      draft.selectedLayerId = layer.id
      draft.design = structuredClone(layer.design)
      return draft
    })
  }

  const selectLayer = (layerId: string) => {
    setSelectedMediaId('')
    setSelectedMediaIds([])
    commit(draft => {
      const layer = draft.layers.find(item => item.id === layerId)
      if (layer) {
        draft.selectedLayerId = layerId
        draft.design = structuredClone(layer.design)
      }
      return draft
    })
  }

  const renameLayer = (layerId: string, name: string) => {
    commit(draft => {
      const layer = draft.layers.find(item => item.id === layerId)
      if (layer) {
        layer.name = name
        layer.design.name = name
        if (draft.selectedLayerId === layerId) draft.design.name = name
      }
      return draft
    })
  }

  const toggleLayerVisibility = (layerId: string) => {
    commit(draft => {
      const layer = draft.layers.find(item => item.id === layerId)
      if (layer) layer.visible = !layer.visible
      return draft
    })
  }

  const moveLayer = (layerId: string, direction: -1 | 1) => {
    commit(draft => {
      const index = draft.layers.findIndex(item => item.id === layerId)
      if (index < 0) return draft
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= draft.layers.length) return draft
      const [layer] = draft.layers.splice(index, 1)
      draft.layers.splice(nextIndex, 0, layer)
      return draft
    })
  }

  const reorderLayer = (layerId: string, targetId: string) => {
    commit(draft => {
      const from = draft.layers.findIndex(layer => layer.id === layerId)
      const to = draft.layers.findIndex(layer => layer.id === targetId)
      if (from < 0 || to < 0 || from === to) return draft
      const [layer] = draft.layers.splice(from, 1)
      draft.layers.splice(to, 0, layer)
      return draft
    })
  }

  const deleteLayer = (layerId: string) => {
    if (project.layers.length <= 1) {
      alert('레이어는 최소 1개 이상 있어야 합니다.')
      return
    }
    commit(draft => {
      draft.layers = draft.layers.filter(layer => layer.id !== layerId)
      if (draft.selectedLayerId === layerId && draft.layers.length) {
        draft.selectedLayerId = draft.layers[0].id
      }
      return draft
    })
  }

  const importMedia = async (file?: File, mode: 'media' | 'decoration' = 'media') => {
    if (!file) return
    const image = /^image\/(png|jpeg|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
    const video = /^video\/(mp4|webm|quicktime)$/i.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name)
    if (!image && !video) {
      alert('PNG/JPG/WebP 이미지 또는 MP4/WebM/MOV 영상을 선택해 주세요.')
      return
    }
    if (mode === 'decoration' && !image) {
      alert('PNG·글자·장식 레이어에는 PNG 또는 WebP 이미지를 사용해 주세요.')
      return
    }
    if (video && file.type) {
      const probe = document.createElement('video')
      if (!probe.canPlayType(file.type)) {
        alert('이 브라우저가 해당 영상 코덱을 직접 재생하지 못합니다. MP4(H.264) 또는 WebM으로 변환한 뒤 다시 불러와 주세요.')
        return
      }
    }
    try {
      const stored = await storeMediaFile(file)
      const kind = video ? 'video' : 'image'
      const layer = createMediaLayer(kind, stored.id, stored.url, stored.name, stored.type, project.timeline?.duration ?? 3)
      const frame = project.layers.find(item => item.id === project.selectedLayerId)

      if (mode === 'decoration' && image) {
        layer.placement = 'above'
        layer.maskMode = 'none'
        layer.fit = 'contain'
        try {
          const size = await readImageSize(file)
          const ratio = Math.min(1, 1100 / Math.max(1, size.width, size.height))
          layer.width = Math.max(40, Math.round(size.width * ratio))
          layer.height = Math.max(40, Math.round(size.height * ratio))
        } catch {
          layer.width = 900
          layer.height = 900
        }
      } else {
        layer.placement = 'below'
        layer.maskMode = 'circle'
        layer.width = 1500
        layer.height = 1500
        layer.fit = 'cover'
      }

      if (frame) {
        layer.maskFrameLayerId = frame.id
        layer.maskRadius = frame.design.radius
        layer.ringThickness = frame.design.thickness
      }
      commit(draft => {
        draft.mediaLayers = [layer, ...(draft.mediaLayers ?? [])]
        return draft
      })
      setSelectedMediaId(layer.id)
      setSelectedMediaIds([layer.id])
    } catch {
      alert('미디어 파일을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.')
    }
  }

  const updateMedia = (next: MediaLayer) => {
    commitCoalesced('media:' + next.id, draft => {
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => layer.id === next.id ? structuredClone(next) : layer)
      return draft
    })
  }

  const selectMediaBatch = (ids: string[], additive = false) => {
    const valid = ids.filter(id => (project.mediaLayers ?? []).some(layer => layer.id === id))
    setSelectedMediaIds(prev => {
      if (!additive) return valid
      const merged = new Set(prev)
      for (const id of valid) merged.add(id)
      return [...merged]
    })
    setSelectedMediaId(valid[0] ?? (additive ? selectedMediaId : ''))
  }

  const selectMedia = (id: string, additive = false) => {
    const layer = (project.mediaLayers ?? []).find(item => item.id === id)
    if (!layer) return

    if (!additive && layer.groupId) {
      const groupIds = (project.mediaLayers ?? []).filter(item => item.groupId === layer.groupId).map(item => item.id)
      setSelectedMediaIds(groupIds)
      setSelectedMediaId(id)
      return
    }

    setSelectedMediaIds(prev => {
      if (!additive) return [id]
      return prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    })
    setSelectedMediaId(id)
  }

  const toggleMedia = (id: string) => commit(draft => {
    draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => layer.id === id ? { ...layer, visible: !layer.visible } : layer)
    return draft
  })

  const toggleMediaLock = (id: string) => commit(draft => {
    draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => layer.id === id ? { ...layer, locked: !layer.locked } : layer)
    return draft
  })

  const moveMedia = (id: string, direction: -1 | 1) => commit(draft => {
    const list = [...(draft.mediaLayers ?? [])]
    const index = list.findIndex(layer => layer.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= list.length) return draft
    const [layer] = list.splice(index, 1)
    list.splice(nextIndex, 0, layer)
    draft.mediaLayers = list
    return draft
  })

  const reorderMedia = (id: string, targetId: string) => commit(draft => {
    const list = [...(draft.mediaLayers ?? [])]
    const from = list.findIndex(layer => layer.id === id)
    const to = list.findIndex(layer => layer.id === targetId)
    if (from < 0 || to < 0 || from === to) return draft
    const [layer] = list.splice(from, 1)
    list.splice(to, 0, layer)
    draft.mediaLayers = list
    return draft
  })

  const duplicateMedia = (id: string) => commit(draft => {
    const list = [...(draft.mediaLayers ?? [])]
    const source = list.find(layer => layer.id === id)
    if (!source) return draft
    const copy = structuredClone(source)
    copy.id = uid('media')
    copy.name = source.name + ' Copy'
    copy.x += 30
    copy.y += 30
    list.unshift(copy)
    draft.mediaLayers = list
    setSelectedMediaId(copy.id)
    setSelectedMediaIds([copy.id])
    return draft
  })

  const deleteMedia = (id: string) => {
    commit(draft => {
      let layers = (draft.mediaLayers ?? []).filter(layer => layer.id !== id)
      const groups = (draft.mediaGroups ?? [])
        .map(group => ({ ...group, layerIds: group.layerIds.filter(item => item !== id) }))
        .filter(group => group.layerIds.length > 1)
      const validGroups = new Set(groups.map(group => group.id))
      layers = layers.map(layer => layer.groupId && !validGroups.has(layer.groupId) ? { ...layer, groupId: '', locked: false } : layer)
      draft.mediaLayers = layers
      draft.mediaGroups = groups
      return draft
    })
    if (selectedMediaId === id) setSelectedMediaId('')
    setSelectedMediaIds(prev => prev.filter(item => item !== id))
  }

  const deleteSelectedMedia = () => {
    if (!selectedMediaIds.length) return
    if (selectedMediaIds.length > 1 && !confirm(selectedMediaIds.length + '개 요소를 삭제할까요? 실행취소(Ctrl/⌘+Z)로 되돌릴 수 있습니다.')) return
    const ids = new Set(selectedMediaIds)
    commit(draft => {
      let layers = (draft.mediaLayers ?? []).filter(layer => !ids.has(layer.id))
      const groups = (draft.mediaGroups ?? [])
        .map(group => ({ ...group, layerIds: group.layerIds.filter(id => !ids.has(id)) }))
        .filter(group => group.layerIds.length > 1)
      const validGroups = new Set(groups.map(group => group.id))
      layers = layers.map(layer => layer.groupId && !validGroups.has(layer.groupId) ? { ...layer, groupId: '', locked: false } : layer)
      draft.mediaLayers = layers
      draft.mediaGroups = groups
      return draft
    })
    setSelectedMediaId('')
    setSelectedMediaIds([])
  }

  const setSelectedMediaVisibility = (visible: boolean) => {
    const ids = new Set(selectedMediaIds)
    if (!ids.size) return
    commit(draft => {
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => ids.has(layer.id) ? { ...layer, visible } : layer)
      return draft
    })
  }

  const setSelectedMediaLock = (locked: boolean) => {
    const ids = new Set(selectedMediaIds)
    if (!ids.size) return
    commit(draft => {
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => ids.has(layer.id) ? { ...layer, locked } : layer)
      for (const group of draft.mediaGroups ?? []) {
        if (group.layerIds.length && group.layerIds.every(id => ids.has(id))) group.locked = locked
      }
      return draft
    })
  }

  const duplicateSelectedMedia = () => {
    const originals = (project.mediaLayers ?? []).filter(layer => selectedMediaIds.includes(layer.id))
    if (!originals.length) return
    const copies = originals.map(layer => ({
      ...structuredClone(layer),
      id: uid('media'),
      name: layer.name + ' Copy',
      x: layer.x + 30,
      y: layer.y + 30,
      groupId: '',
    }))
    commit(draft => {
      draft.mediaLayers = [...copies, ...(draft.mediaLayers ?? [])]
      return draft
    })
    setSelectedMediaIds(copies.map(layer => layer.id))
    setSelectedMediaId(copies[0]?.id ?? '')
  }

  const copySelectedMedia = () => {
    mediaClipboardRef.current = (project.mediaLayers ?? [])
      .filter(layer => selectedMediaIds.includes(layer.id))
      .map(layer => structuredClone(layer))
  }

  const pasteMediaClipboard = () => {
    if (!mediaClipboardRef.current.length) return
    const copies = mediaClipboardRef.current.map(layer => ({
      ...structuredClone(layer),
      id: uid('media'),
      name: layer.name + ' Copy',
      x: layer.x + 24,
      y: layer.y + 24,
      groupId: '',
    }))
    commit(draft => {
      draft.mediaLayers = [...copies, ...(draft.mediaLayers ?? [])]
      return draft
    })
    mediaClipboardRef.current = copies.map(layer => structuredClone(layer))
    setSelectedMediaIds(copies.map(layer => layer.id))
    setSelectedMediaId(copies[0]?.id ?? '')
  }

  const groupSelectedMedia = () => {
    const ids = selectedMediaIds.filter(id => (project.mediaLayers ?? []).some(layer => layer.id === id))
    if (ids.length < 2) return
    commit(draft => {
      const selected = new Set(ids)
      const touchedGroups = new Set(
        (draft.mediaLayers ?? []).filter(layer => selected.has(layer.id) && layer.groupId).map(layer => layer.groupId),
      )
      const group: MediaGroup = {
        id: uid('group'),
        name: '그룹 ' + ((draft.mediaGroups?.length ?? 0) + 1),
        layerIds: ids,
        locked: false,
      }
      draft.mediaGroups = [...(draft.mediaGroups ?? []).filter(item => !touchedGroups.has(item.id)), group]
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => {
        if (selected.has(layer.id)) return { ...layer, groupId: group.id, locked: false }
        if (touchedGroups.has(layer.groupId)) return { ...layer, groupId: '', locked: false }
        return layer
      })
      return draft
    })
  }

  const ungroupSelectedMedia = () => {
    const ids = selectedMediaIds
    commit(draft => {
      const groupIds = new Set((draft.mediaLayers ?? []).filter(layer => ids.includes(layer.id) && layer.groupId).map(layer => layer.groupId))
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => groupIds.has(layer.groupId) ? { ...layer, groupId: '', locked: false } : layer)
      draft.mediaGroups = (draft.mediaGroups ?? []).filter(group => !groupIds.has(group.id))
      return draft
    })
  }

  const renameMediaGroup = (id: string, name: string) => {
    commitCoalesced('group-name:' + id, draft => {
      draft.mediaGroups = (draft.mediaGroups ?? []).map(group => group.id === id ? { ...group, name } : group)
      return draft
    })
  }

  const toggleMediaGroupLock = (id: string) => {
    commit(draft => {
      const group = (draft.mediaGroups ?? []).find(item => item.id === id)
      if (!group) return draft
      const locked = !group.locked
      group.locked = locked
      const ids = new Set(group.layerIds)
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => ids.has(layer.id) ? { ...layer, locked } : layer)
      return draft
    })
  }

  const batchUpdateMedia = (updates: Array<Partial<MediaLayer> & { id: string }>) => {
    const byId = new Map(updates.map(update => [update.id, update]))
    commitCoalesced('batch-media', draft => {
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => {
        const update = byId.get(layer.id)
        return update ? { ...layer, ...update } : layer
      })
      return draft
    })
  }

  const beginMediaTransform = () => {
    undoRef.current.push(structuredClone(project))
    if (undoRef.current.length > 80) undoRef.current.shift()
    redoRef.current = []
  }

  const transformMediaTransient = (updates: Array<Partial<MediaLayer> & { id: string }>) => {
    const byId = new Map(updates.map(update => [update.id, update]))
    setProject(prev => {
      const next = structuredClone(prev)
      next.mediaLayers = (next.mediaLayers ?? []).map(layer => {
        const update = byId.get(layer.id)
        return update ? { ...layer, ...update } : layer
      })
      return syncSelectedLayer(next)
    })
  }

  const alignSelectedMedia = (mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'center' | 'distribute-x' | 'distribute-y') => {
    const selected = (project.mediaLayers ?? []).filter(layer => selectedMediaIds.includes(layer.id) && !layer.locked)
    if (!selected.length) return
    const entries = selected.map(layer => ({ layer, bounds: mediaLayerBounds(layer) }))
    const left = Math.min(...entries.map(item => item.bounds.left))
    const right = Math.max(...entries.map(item => item.bounds.right))
    const top = Math.min(...entries.map(item => item.bounds.top))
    const bottom = Math.max(...entries.map(item => item.bounds.bottom))
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2

    if (mode === 'center') {
      const dx = -centerX
      const dy = -centerY
      batchUpdateMedia(entries.map(({ layer }) => ({ id: layer.id, x: layer.x + dx, y: layer.y + dy })))
      return
    }
    if (mode === 'left') {
      batchUpdateMedia(entries.map(({ layer, bounds }) => ({ id: layer.id, x: layer.x + left - bounds.left })))
      return
    }
    if (mode === 'right') {
      batchUpdateMedia(entries.map(({ layer, bounds }) => ({ id: layer.id, x: layer.x + right - bounds.right })))
      return
    }
    if (mode === 'top') {
      batchUpdateMedia(entries.map(({ layer, bounds }) => ({ id: layer.id, y: layer.y + top - bounds.top })))
      return
    }
    if (mode === 'bottom') {
      batchUpdateMedia(entries.map(({ layer, bounds }) => ({ id: layer.id, y: layer.y + bottom - bounds.bottom })))
      return
    }
    if (mode === 'center-x') {
      batchUpdateMedia(entries.map(({ layer, bounds }) => ({ id: layer.id, x: layer.x + centerX - (bounds.left + bounds.right) / 2 })))
      return
    }
    if (mode === 'center-y') {
      batchUpdateMedia(entries.map(({ layer, bounds }) => ({ id: layer.id, y: layer.y + centerY - (bounds.top + bounds.bottom) / 2 })))
      return
    }

    if (entries.length < 3) return
    if (mode === 'distribute-x') {
      const sorted = [...entries].sort((a,b) => a.bounds.left - b.bounds.left)
      const totalWidth = sorted.reduce((sum,item) => sum + item.bounds.width, 0)
      const span = sorted[sorted.length - 1].bounds.right - sorted[0].bounds.left
      const gap = (span - totalWidth) / (sorted.length - 1)
      let cursor = sorted[0].bounds.left
      batchUpdateMedia(sorted.map(({ layer, bounds }) => {
        const x = cursor + bounds.width / 2
        cursor += bounds.width + gap
        return { id: layer.id, x }
      }))
      return
    }

    const sorted = [...entries].sort((a,b) => a.bounds.top - b.bounds.top)
    const totalHeight = sorted.reduce((sum,item) => sum + item.bounds.height, 0)
    const span = sorted[sorted.length - 1].bounds.bottom - sorted[0].bounds.top
    const gap = (span - totalHeight) / (sorted.length - 1)
    let cursor = sorted[0].bounds.top
    batchUpdateMedia(sorted.map(({ layer, bounds }) => {
      const y = cursor + bounds.height / 2
      cursor += bounds.height + gap
      return { id: layer.id, y }
    }))
  }

  const splitSelectedAtPlayhead = () => {
    const ids = new Set(selectedMediaIds)
    const splitTime = timelineTime
    if (!ids.size) return
    const eligible = (project.mediaLayers ?? []).filter(layer =>
      ids.has(layer.id) && splitTime > layer.startTime + .02 && splitTime < layer.endTime - .02,
    )
    if (!eligible.length) return

    const newIds: string[] = []
    commit(draft => {
      const next: MediaLayer[] = []
      for (const layer of draft.mediaLayers ?? []) {
        if (!ids.has(layer.id) || splitTime <= layer.startTime + .02 || splitTime >= layer.endTime - .02) {
          next.push(layer)
          continue
        }
        const before = structuredClone(layer)
        const after = structuredClone(layer)
        const elapsed = splitTime - layer.startTime
        before.endTime = splitTime
        before.animation = { ...before.animation, outro: 'none', outroStart: splitTime, outroDuration: .05 }
        after.id = uid('media')
        after.name = layer.name + ' · 뒤'
        after.startTime = splitTime
        after.groupId = ''
        after.animation = { ...after.animation, intro: 'none', introStart: splitTime, introDuration: .05 }
        if (after.kind === 'video') {
          const segmentStart = Math.max(0, layer.trimStart || 0)
          const segmentEnd = layer.trimEnd > segmentStart ? layer.trimEnd : Infinity
          after.trimStart = Math.min(segmentEnd === Infinity ? segmentStart + elapsed : segmentEnd - .01, segmentStart + elapsed)
        }
        next.push(before, after)
        newIds.push(after.id)
      }
      draft.mediaLayers = next
      return draft
    })
    if (newIds.length) {
      setSelectedMediaIds(newIds)
      setSelectedMediaId(newIds[0])
    }
  }

  const fitSelectedToTimeline = () => {
    const ids = new Set(selectedMediaIds)
    if (!ids.size) return
    const duration = Math.max(.5, project.timeline?.duration ?? 3)
    commit(draft => {
      draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => ids.has(layer.id) ? {
        ...layer,
        startTime: 0,
        endTime: duration,
        animation: {
          ...layer.animation,
          introStart: 0,
          outroStart: Math.max(0, duration - layer.animation.outroDuration),
        },
      } : layer)
      return draft
    })
  }

  const uploadCustomMask = async (id: string, file?: File) => {
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
      alert('사용자 마스크는 PNG/JPG/WebP 이미지를 선택해 주세요.')
      return
    }
    try {
      const stored = await storeMediaFile(file)
      const current = (project.mediaLayers ?? []).find(layer => layer.id === id)
      if (!current) return
      updateMedia({
        ...current,
        maskMode: 'custom',
        customMaskAssetId: stored.id,
        customMaskSourceUrl: stored.url,
        customMaskFileName: stored.name,
      })
    } catch {
      alert('사용자 마스크를 저장하지 못했습니다.')
    }
  }

  const relinkMedia = async (id: string, file?: File) => {
    if (!file) return
    const current = (project.mediaLayers ?? []).find(layer => layer.id === id)
    if (!current) return
    try {
      const stored = await storeMediaFile(file, current.assetId || undefined)
      updateMedia({
        ...current,
        kind: /^video\//.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name) ? 'video' : 'image',
        assetId: stored.id,
        sourceUrl: stored.url,
        fileName: stored.name,
        mimeType: stored.type,
      })
    } catch {
      alert('원본을 재연결하지 못했습니다.')
    }
  }

  const changeBackground = (next: BackgroundSettings) => commitCoalesced('background', draft => {
    draft.background = next
    return draft
  })

  const uploadBackground = async (file?: File) => {
    if (!file) return
    try {
      const stored = await storeMediaFile(file)
      const type = /^video\//.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name) ? 'video' : 'image'
      changeBackground({
        ...(project.background ?? defaultBackground()),
        type,
        assetId: stored.id,
        sourceUrl: stored.url,
        fileName: stored.name,
        mimeType: stored.type,
      })
    } catch {
      alert('배경 파일을 저장하지 못했습니다.')
    }
  }

  const selectedMedia = (project.mediaLayers ?? []).find(layer => layer.id === selectedMediaId)
  const selectedMediaList = (project.mediaLayers ?? []).filter(layer => selectedMediaIds.includes(layer.id))

  const currentAssetLayer = project.layers.find(layer => layer.id === project.selectedLayerId)?.design ?? project.design

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )
      if (editing) return

      const meta = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (event.key === 'Escape') {
        setSelectedMediaIds([])
        setSelectedMediaId('')
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMediaIds.length) {
        event.preventDefault()
        deleteSelectedMedia()
        return
      }
      if (meta && key === 'a' && (project.mediaLayers?.length ?? 0) > 0) {
        event.preventDefault()
        const ids = (project.mediaLayers ?? []).map(layer => layer.id)
        setSelectedMediaIds(ids)
        setSelectedMediaId(ids[0] ?? '')
        return
      }
      if (meta && key === 'c' && selectedMediaIds.length) {
        event.preventDefault()
        copySelectedMedia()
        return
      }
      if (meta && key === 'v' && mediaClipboardRef.current.length) {
        event.preventDefault()
        pasteMediaClipboard()
        return
      }
      if (meta && key === 'd' && selectedMediaIds.length) {
        event.preventDefault()
        duplicateSelectedMedia()
        return
      }
      if (meta && key === 'g' && selectedMediaIds.length > 1) {
        event.preventDefault()
        if (event.shiftKey) ungroupSelectedMedia()
        else groupSelectedMedia()
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        setTimelinePlaying(value => !value)
        return
      }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && selectedMediaIds.length) {
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        commitCoalesced('keyboard-nudge', draft => {
          draft.mediaLayers = (draft.mediaLayers ?? []).map(layer =>
            selectedMediaIds.includes(layer.id) && !layer.locked
              ? { ...layer, x: layer.x + dx, y: layer.y + dy }
              : layer
          )
          return draft
        })
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [project.mediaLayers, selectedMediaIds, commitCoalesced])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◯</div>
          <div><h1>Circle Frame Studio</h1><span>v{APP_VERSION} · Update Guide</span></div>
        </div>
        <div className="toolbar">
          <button className="toolbar-icon-button" onClick={undo} title="실행취소 · Ctrl/⌘+Z">↶</button>
          <button className="toolbar-icon-button" onClick={redo} title="다시실행 · Ctrl/⌘+Y">↷</button>
          <span className={lastAutosaveAt ? 'autosave-status saved' : 'autosave-status'} title={lastAutosaveAt ? '마지막 자동 저장 ' + new Date(lastAutosaveAt).toLocaleTimeString() : '자동 저장 준비 중'}>
            {lastAutosaveAt ? '저장됨' : '자동 저장'}
          </span>
          <button className="project-package-button toolbar-save-main" onClick={() => void handlePortableSave()}>프로젝트 저장</button>
          <details className="toolbar-more toolbar-project-menu">
            <summary>프로젝트</summary>
            <div>
              <button onClick={reset}>새 프로젝트</button>
              <button onClick={() => bundleInput.current?.click()}>프로젝트 불러오기</button>
              <button onClick={() => setRecentOpen(true)}>최근 저장 내역</button>
              <span className="toolbar-menu-divider" />
              <button onClick={() => void handleJsonSave()}>JSON 백업</button>
              <button onClick={() => fileInput.current?.click()}>JSON 불러오기</button>
              <span className="toolbar-menu-divider" />
              <button onClick={resetUiLayout}>UI 배치 초기화</button>
            </div>
          </details>
          <details className="toolbar-more shortcut-menu compact-help-menu">
            <summary title="단축키 도움말">?</summary>
            <div className="shortcut-menu-body">
              <span><b>Ctrl/⌘ + C / V</b> 선택 요소 복사 / 붙여넣기</span>
              <span><b>Ctrl/⌘ + D</b> 선택 요소 복제</span>
              <span><b>Ctrl/⌘ + G</b> 그룹 · Shift 추가 시 해제</span>
              <span><b>Delete</b> 선택 요소 삭제</span>
              <span><b>방향키</b> 1px 이동 · Shift 10px</span>
              <span><b>Space</b> 타임라인 재생 / 일시정지</span>
              <span><b>Ctrl/⌘ + A</b> 미디어 전체 선택</span>
              <span><b>Esc</b> 선택 해제</span>
              <button type="button" className="shortcut-update-button" onClick={() => setUpdateSpotlightOpen(true)}>v{APP_VERSION} 업데이트 내용 다시 보기</button>
            </div>
          </details>
          <input ref={bundleInput} hidden type="file" accept=".cfszip,application/zip" onChange={e => void importPortable(e.target.files?.[0])} />
          <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={e => importProject(e.target.files?.[0])} />
          <label className="autofit"><input type="checkbox" checked={project.autoFit} onChange={e => commit(d => ({ ...d, autoFit: e.target.checked }))} /> Auto Fit</label>
          <select className="top-export-resolution" value={pngResolution} onChange={e => setPngResolution(Number(e.target.value))} title="PNG 해상도">
            <option value={500}>500px</option>
            <option value={1000}>1000px</option>
            <option value={2000}>2000px</option>
            <option value={3000}>3000px</option>
            <option value={4000}>4000px</option>
          </select>
          <button onClick={() => void handleFramePngExport()}>프레임 PNG</button>
          <button onClick={() => setAnimatedExportOpen(true)}>움직이는 파일</button>
          <button className="primary-button" onClick={() => void handlePngExport()}>전체 PNG</button>
        </div>
      </header>

      <main className="workspace composer-workspace">
        <div className="left-stack">
          <MediaPanel
            mediaLayers={project.mediaLayers ?? []}
            selectedMediaIds={selectedMediaIds}
            primaryMediaId={selectedMediaId}
            groups={project.mediaGroups ?? []}
            background={project.background ?? defaultBackground()}
            onSelectMedia={(id, additive = false) => selectMedia(id, additive)}
            onAddMedia={importMedia}
            onToggleMedia={toggleMedia}
            onToggleLock={toggleMediaLock}
            onMoveMedia={moveMedia}
            onReorderMedia={reorderMedia}
            onDuplicateMedia={duplicateMedia}
            onDeleteMedia={deleteMedia}
            onGroupSelected={groupSelectedMedia}
            onUngroupSelected={ungroupSelectedMedia}
            onRenameGroup={renameMediaGroup}
            onToggleGroupLock={toggleMediaGroupLock}
            onSelectAllMedia={() => {
              const ids = (project.mediaLayers ?? []).map(layer => layer.id)
              setSelectedMediaIds(ids)
              setSelectedMediaId(ids[0] ?? '')
            }}
            onClearSelection={() => { setSelectedMediaIds([]); setSelectedMediaId('') }}
            onSetSelectedVisibility={setSelectedMediaVisibility}
            onSetSelectedLock={setSelectedMediaLock}
            onDuplicateSelected={duplicateSelectedMedia}
            onDeleteSelected={deleteSelectedMedia}
            onBackgroundChange={changeBackground}
            onBackgroundFile={uploadBackground}
          />
          <PresetBrowser
            onSelect={selectPreset}
            userPresets={userPresets}
            onUploadAsset={uploadAsset}
            currentAssetName={currentAssetLayer.kind === 'asset' ? currentAssetLayer.pattern.customAssetName : ''}
            currentAssetUrl={currentAssetLayer.kind === 'asset' ? currentAssetLayer.pattern.customAssetUrl : ''}
          />
        </div>

        <section className="center-column composer-center">
          <CanvasPanel
            project={project}
            onSampleColor={sampleColor}
            timeSec={timelineTime}
            playing={timelinePlaying}
            selectedMediaIds={selectedMediaIds}
            primaryMediaId={selectedMediaId}
            settings={project.settings ?? defaultComposerSettings()}
            onSelectMedia={selectMedia}
            onSelectMediaBatch={selectMediaBatch}
            onBeginTransform={beginMediaTransform}
            onTransformMedia={transformMediaTransient}
            onSettingsChange={settings => commit(draft => ({ ...draft, settings }))}
            onMoveMedia={(id, x, y) => {
              const layer = (project.mediaLayers ?? []).find(item => item.id === id)
              if (layer) updateMedia({ ...layer, x, y })
            }}
          />
          <TimelinePanel
            duration={project.timeline?.duration ?? 3}
            currentTime={timelineTime}
            playing={timelinePlaying}
            loop={project.timeline?.loop !== false}
            snapEnabled={(project.settings ?? defaultComposerSettings()).timelineSnapEnabled}
            snapFps={(project.settings ?? defaultComposerSettings()).timelineFps}
            onSnapEnabledChange={value => commit(draft => {
              draft.settings = { ...(draft.settings ?? defaultComposerSettings()), timelineSnapEnabled: value }
              return draft
            })}
            onSnapFpsChange={value => commit(draft => {
              draft.settings = { ...(draft.settings ?? defaultComposerSettings()), timelineFps: value }
              return draft
            })}
            mediaLayers={project.mediaLayers ?? []}
            selectedMediaIds={selectedMediaIds}
            primaryMediaId={selectedMediaId}
            onBeginTimingEdit={beginMediaTransform}
            onTimingChange={(id, patch) => {
              transformMediaTransient([{ id, ...patch }])
            }}
            onTimeChange={value => { setTimelinePlaying(false); setTimelineTime(value) }}
            onTogglePlay={() => setTimelinePlaying(value => !value)}
            onToStart={() => { setTimelinePlaying(false); setTimelineTime(0) }}
            onDurationChange={value => commit(draft => {
              draft.timeline = { ...(draft.timeline ?? defaultTimeline()), duration: Math.max(.5, Math.min(60, value)) }
              draft.mediaLayers = (draft.mediaLayers ?? []).map(layer => ({ ...layer, endTime: Math.min(layer.endTime, Math.max(.5, value)) }))
              return draft
            })}
            onSplitSelected={splitSelectedAtPlayhead}
            onFitSelected={fitSelectedToTimeline}
            onLoopChange={value => commit(draft => {
              draft.timeline = { ...(draft.timeline ?? defaultTimeline()), loop: value }
              return draft
            })}
            onSelectMedia={selectMedia}
          />
        </section>

        {selectedMedia ? (
          <MediaPropertyPanel
            media={selectedMedia}
            selectedMedia={selectedMediaList}
            frameLayers={project.layers}
            duration={project.timeline?.duration ?? 3}
            onChange={updateMedia}
            onBatchChange={batchUpdateMedia}
            onAlign={alignSelectedMedia}
            onGroup={groupSelectedMedia}
            onUngroup={ungroupSelectedMedia}
            onCustomMask={file => void uploadCustomMask(selectedMedia.id, file)}
            onRelink={file => void relinkMedia(selectedMedia.id, file)}
            onDuplicate={() => duplicateMedia(selectedMedia.id)}
            onDelete={() => deleteMedia(selectedMedia.id)}
            onReturnFrame={() => setSelectedMediaId('')}
          />
        ) : (
          <PropertyPanel
            design={project.design}
            timelineDuration={Math.max(.5, project.timeline?.duration ?? 3)}
            onTimelineDurationChange={value => commitCoalesced('timeline-duration', draft => {
              draft.timeline = { ...(draft.timeline ?? defaultTimeline()), duration: Math.max(.5, Math.min(30, value)) }
              return draft
            })}
            onChange={updateDesign}
            onSavePreset={saveCurrentPreset}
            onUploadAsset={uploadAsset}
            layers={project.layers}
            selectedLayerId={project.selectedLayerId}
            onAddLayer={addLayer}
            onSelectLayer={selectLayer}
            onRenameLayer={renameLayer}
            onToggleLayerVisibility={toggleLayerVisibility}
            onMoveLayer={moveLayer}
            onReorderLayer={reorderLayer}
            onDeleteLayer={deleteLayer}
          />
        )}
      </main>

      <UpdateSpotlight
        open={updateSpotlightOpen}
        update={CURRENT_UPDATE}
        onClose={dismissUpdateSpotlight}
        onTryPreset={tryUpdatePreset}
      />

      <AnimatedExportModal
        open={animatedExportOpen}
        project={project}
        onClose={() => setAnimatedExportOpen(false)}
        onExported={() => void recordRecentSave('animation')}
      />

      <RecentSavesModal
        open={recentOpen}
        records={recentSaves}
        loading={recentLoading}
        onClose={() => setRecentOpen(false)}
        onLoad={loadRecentSave}
        onDelete={removeRecentSave}
        onClear={removeAllRecentSaves}
      />

      <footer className="statusbar">
        <span>휠: 확대·축소 · 휠 클릭 드래그: 화면 이동 · 미디어 선택 후 좌클릭 드래그: 위치 이동 · Alt+클릭: 스포이드</span>
        <span>현재 레이어: {project.layers.find(layer => layer.id === project.selectedLayerId)?.name ?? project.design.name} · 총 {project.layers.length}개</span>
      </footer>
    </div>
  )
}
