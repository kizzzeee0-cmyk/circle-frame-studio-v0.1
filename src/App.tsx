import { useCallback, useEffect, useRef, useState } from 'react'
import CanvasPanel from './components/CanvasPanel'
import PresetBrowser from './components/PresetBrowser'
import PropertyPanel from './components/PropertyPanel'
import { createDesign } from './presets'
import type { FrameDesign, FrameLayer, FramePreset, FrameProject } from './types'
import { downloadProject, exportPng } from './utils/export'
import { uid } from './utils/id'
import './styles.css'

const AUTOSAVE_KEY = 'circle-frame-studio-project-v020'
const LEGACY_AUTOSAVE_KEYS = ['circle-frame-studio-project-v019', 'circle-frame-studio-project-v018', 'circle-frame-studio-project-v017', 'circle-frame-studio-project-v016', 'circle-frame-studio-project-v015', 'circle-frame-studio-project-v014', 'circle-frame-studio-project-v013', 'circle-frame-studio-project-v012', 'circle-frame-studio-project-v011', 'circle-frame-studio-project-v010', 'circle-frame-studio-project-v09', 'circle-frame-studio-project-v08', 'circle-frame-studio-project-v07', 'circle-frame-studio-project-v06', 'circle-frame-studio-project-v05', 'circle-frame-studio-project-v04', 'circle-frame-studio-project-v03']
const USER_PRESETS_KEY = 'circle-frame-studio-user-presets-v020'
const LEGACY_USER_PRESET_KEYS = ['circle-frame-studio-user-presets-v019', 'circle-frame-studio-user-presets-v018', 'circle-frame-studio-user-presets-v017', 'circle-frame-studio-user-presets-v016', 'circle-frame-studio-user-presets-v015', 'circle-frame-studio-user-presets-v014', 'circle-frame-studio-user-presets-v013', 'circle-frame-studio-user-presets-v012', 'circle-frame-studio-user-presets-v011', 'circle-frame-studio-user-presets-v010', 'circle-frame-studio-user-presets-v09', 'circle-frame-studio-user-presets-v08', 'circle-frame-studio-user-presets-v07', 'circle-frame-studio-user-presets-v06', 'circle-frame-studio-user-presets-v05', 'circle-frame-studio-user-presets-v04', 'circle-frame-studio-user-presets-v03']

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
      repeatCount: source.twoToneFlow?.repeatCount === 2 ? 2 : 1,
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

function makeLayerFromDesign(source: Partial<FrameDesign>, layerName?: string): FrameLayer {
  const design = normalizeDesign(source)
  return {
    id: uid('layer'),
    name: layerName || design.name || '레이어',
    visible: true,
    design,
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
  if (Array.isArray(source?.layers) && source.layers.length > 0) {
    const layers = source.layers.map((layer: any, index: number) => {
      if (layer?.design) {
        const normalized = makeLayerFromDesign(layer.design, layer.name || layer.design?.name || `레이어 ${index + 1}`)
        normalized.id = layer.id || normalized.id
        normalized.visible = layer.visible !== false
        return normalized
      }
      const normalized = makeLayerFromDesign(layer, layer?.name || `레이어 ${index + 1}`)
      normalized.id = layer?.id || normalized.id
      normalized.visible = layer?.visible !== false
      return normalized
    })
    return syncSelectedLayer({
      version: '0.20',
      width: 2000,
      height: 2000,
      autoFit: typeof source.autoFit === 'boolean' ? source.autoFit : true,
      design: normalizeDesign(source.design ?? layers[layers.length - 1].design),
      layers,
      selectedLayerId: source.selectedLayerId ?? layers[layers.length - 1].id,
    })
  }
  if (source?.design) {
    const layer = makeLayerFromDesign(source.design, source.design?.name || '레이어 1')
    return syncSelectedLayer({
      version: '0.20',
      width: 2000,
      height: 2000,
      autoFit: typeof source.autoFit === 'boolean' ? source.autoFit : true,
      design: structuredClone(layer.design),
      layers: [layer],
      selectedLayerId: layer.id,
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
    version: '0.20',
    width: 2000,
    height: 2000,
    autoFit: true,
    design: structuredClone(layer.design),
    layers: [layer],
    selectedLayerId: layer.id,
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
  const undoRef = useRef<FrameProject[]>([])
  const redoRef = useRef<FrameProject[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const commit = useCallback((updater: (draft: FrameProject) => FrameProject) => {
    setProject(prev => {
      undoRef.current.push(structuredClone(prev))
      if (undoRef.current.length > 80) undoRef.current.shift()
      redoRef.current = []
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
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project)) } catch { /* quota */ }
  }, [project])

  useEffect(() => {
    try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(userPresets)) } catch { /* quota */ }
  }, [userPresets])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); downloadProject(project) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [project, redo, undo])

  const selectPreset = (preset: FramePreset) => {
    commit(draft => {
      const design = structuredClone(preset.design)
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

  const updateDesign = (next: FrameDesign) => {
    commit(draft => {
      const index = draft.layers.findIndex(layer => layer.id === draft.selectedLayerId)
      if (index >= 0) {
        draft.layers[index].design = structuredClone(next)
        draft.layers[index].name = next.name
      }
      draft.design = structuredClone(next)
      return draft
    })
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
    if (!confirm('현재 프레임을 초기화할까요?')) return
    commit(() => makeInitialProject())
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

  const currentAssetLayer = project.layers.find(layer => layer.id === project.selectedLayerId)?.design ?? project.design

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◯</div>
          <div><h1>Circle Frame Studio</h1><span>v0.20 · Layered Frame Builder + 4-Segment Two-Tone Flow</span></div>
        </div>
        <div className="toolbar">
          <button onClick={reset}>새 프레임</button>
          <span className="toolbar-sep" />
          <button onClick={undo} title="Ctrl+Z">↶ 실행취소</button>
          <button onClick={redo} title="Ctrl+Y">↷ 다시실행</button>
          <span className="toolbar-sep" />
          <button onClick={() => downloadProject(project)}>JSON 저장</button>
          <button onClick={() => fileInput.current?.click()}>JSON 불러오기</button>
          <input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={e => importProject(e.target.files?.[0])} />
          <label className="autofit"><input type="checkbox" checked={project.autoFit} onChange={e => commit(d => ({ ...d, autoFit: e.target.checked }))} /> Auto Fit</label>
          <button className="primary-button" onClick={() => exportPng(project)}>PNG 내보내기</button>
        </div>
      </header>

      <main className="workspace single-workspace">
        <PresetBrowser
          onSelect={selectPreset}
          userPresets={userPresets}
          onUploadAsset={uploadAsset}
          currentAssetName={currentAssetLayer.kind === 'asset' ? currentAssetLayer.pattern.customAssetName : ''}
          currentAssetUrl={currentAssetLayer.kind === 'asset' ? currentAssetLayer.pattern.customAssetUrl : ''}
        />
        <section className="center-column single-center">
          <CanvasPanel project={project} onSampleColor={sampleColor} />
        </section>
        <PropertyPanel
          design={project.design}
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
          onDeleteLayer={deleteLayer}
        />
      </main>

      <footer className="statusbar">
        <span>프리셋은 현재 선택된 레이어만 교체됩니다 · 레이어 순서 변경 가능 · Alt+클릭 스포이드</span>
        <span>현재 레이어: {project.layers.find(layer => layer.id === project.selectedLayerId)?.name ?? project.design.name} · 총 {project.layers.length}개</span>
      </footer>
    </div>
  )
}
