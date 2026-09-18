import { useCallback, useEffect, useRef, useState } from 'react'
import CanvasPanel from './components/CanvasPanel'
import PresetBrowser from './components/PresetBrowser'
import PropertyPanel from './components/PropertyPanel'
import { createDesign } from './presets'
import type { FrameDesign, FramePreset, FrameProject } from './types'
import { downloadProject, exportPng } from './utils/export'
import { uid } from './utils/id'
import './styles.css'

const AUTOSAVE_KEY = 'circle-frame-studio-project-v07'
const LEGACY_AUTOSAVE_KEYS = ['circle-frame-studio-project-v06', 'circle-frame-studio-project-v05', 'circle-frame-studio-project-v04', 'circle-frame-studio-project-v03']
const USER_PRESETS_KEY = 'circle-frame-studio-user-presets-v07'
const LEGACY_USER_PRESET_KEYS = ['circle-frame-studio-user-presets-v06', 'circle-frame-studio-user-presets-v05', 'circle-frame-studio-user-presets-v04', 'circle-frame-studio-user-presets-v03']

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
    pattern: {
      ...base.pattern,
      ...(legacyPattern ?? {}),
      paletteColors,
      colorCount,
    },
    gradientStops: source.gradientStops?.length ? source.gradientStops : base.gradientStops,
    id: source.id || uid('design'),
  }
}

function normalizeProject(source: any): FrameProject {
  if (source?.design) {
    return {
      version: '0.7',
      width: 2000,
      height: 2000,
      autoFit: typeof source.autoFit === 'boolean' ? source.autoFit : true,
      design: normalizeDesign(source.design),
    }
  }
  if (Array.isArray(source?.layers) && source.layers.length > 0) {
    const picked = source.layers.find((x: any) => x.id === source.selectedLayerId) ?? source.layers[source.layers.length - 1]
    return {
      version: '0.7',
      width: 2000,
      height: 2000,
      autoFit: typeof source.autoFit === 'boolean' ? source.autoFit : true,
      design: normalizeDesign(picked),
    }
  }
  return makeInitialProject()
}

function makeInitialProject(): FrameProject {
  const design = createDesign('ribbon', 'Pink Ribbon Sticker Ring')
  design.radius = 800
  design.pattern.decorationLayout = 'spacing'
  design.pattern.decorationSpacing = 170
  design.pattern.decorationSize = 24
  design.pattern.decorationOffset = 18
  design.pattern.keepUpright = true
  design.pattern.colorCount = 2
  design.pattern.ribbonStyle = 'sticker'
  design.pattern.paletteColors = ['#F8AFCF', '#FBD4E5', '#F8AFCF', '#FBD4E5']
  return { version: '0.7', width: 2000, height: 2000, autoFit: true, design }
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
      return updater(structuredClone(prev))
    })
  }, [])

  const undo = useCallback(() => {
    setProject(prev => {
      const last = undoRef.current.pop()
      if (!last) return prev
      redoRef.current.push(structuredClone(prev))
      return last
    })
  }, [])

  const redo = useCallback(() => {
    setProject(prev => {
      const next = redoRef.current.pop()
      if (!next) return prev
      undoRef.current.push(structuredClone(prev))
      return next
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
      draft.design = design
      return draft
    })
  }

  const updateDesign = (next: FrameDesign) => {
    commit(draft => {
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◯</div>
          <div><h1>Circle Frame Studio</h1><span>v0.7 · Ribbon Style Pack</span></div>
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
          currentAssetName={project.design.kind === 'asset' ? project.design.pattern.customAssetName : ''}
          currentAssetUrl={project.design.kind === 'asset' ? project.design.pattern.customAssetUrl : ''}
        />
        <section className="center-column single-center">
          <CanvasPanel project={project} onSampleColor={sampleColor} />
        </section>
        <PropertyPanel design={project.design} onChange={updateDesign} onSavePreset={saveCurrentPreset} onUploadAsset={uploadAsset} />
      </main>

      <footer className="statusbar">
        <span>프리셋을 누르면 현재 프레임이 교체됩니다 · 레이어 없음 · Alt+클릭 스포이드</span>
        <span>현재 디자인: {project.design.name}</span>
      </footer>
    </div>
  )
}
