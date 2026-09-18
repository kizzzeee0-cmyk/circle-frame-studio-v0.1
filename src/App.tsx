import { useCallback, useEffect, useRef, useState } from 'react'
import CanvasPanel from './components/CanvasPanel'
import LayerPanel from './components/LayerPanel'
import PresetBrowser from './components/PresetBrowser'
import PropertyPanel from './components/PropertyPanel'
import { createLayer } from './presets'
import type { FramePreset, FrameProject, RingLayer } from './types'
import { downloadProject, exportPng } from './utils/export'
import { uid } from './utils/id'
import './styles.css'

const AUTOSAVE_KEY = 'circle-frame-studio-project-v01'
const USER_PRESETS_KEY = 'circle-frame-studio-user-presets-v01'

function makeInitialProject(): FrameProject {
  const base = createLayer('glossy', 'Lavender Glossy')
  base.radius = 715
  base.thickness = 62
  base.gradientMode = 'conic'
  base.gradientStops = [
    { id: uid('stop'), position: 0, color: '#7F78C9' },
    { id: uid('stop'), position: .34, color: '#B0A6EB' },
    { id: uid('stop'), position: .68, color: '#E3B9DB' },
    { id: uid('stop'), position: 1, color: '#7F78C9' },
  ]
  base.effects.glowEnabled = true
  base.effects.glowColor = '#A99BEF'
  base.effects.glowBlur = 34
  base.effects.glowIntensity = .28

  const sparkle = createLayer('sparkle', 'Soft Sparkles')
  sparkle.radius = 815
  sparkle.color = '#FFFFFF'
  sparkle.opacity = .82
  sparkle.pattern.decorationCount = 16
  sparkle.pattern.decorationSize = 22
  sparkle.rotation = 7

  return { version: '0.1', width: 2000, height: 2000, autoFit: true, selectedLayerId: base.id, layers: [base, sparkle] }
}

function loadInitialProject() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FrameProject
      if (parsed.version === '0.1' && Array.isArray(parsed.layers)) return parsed
    }
  } catch { /* ignore corrupted autosave */ }
  return makeInitialProject()
}

function loadUserPresets(): FramePreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
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
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project))
  }, [project])

  useEffect(() => {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(userPresets))
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

  const selected = project.layers.find(x => x.id === project.selectedLayerId) ?? null

  const addPreset = (preset: FramePreset) => {
    commit(draft => {
      const layer = structuredClone(preset.layer)
      layer.id = uid('layer')
      layer.name = preset.name
      layer.locked = false
      draft.layers.push(layer)
      draft.selectedLayerId = layer.id
      return draft
    })
  }

  const updateSelected = (next: RingLayer) => {
    commit(draft => {
      const index = draft.layers.findIndex(x => x.id === next.id)
      if (index >= 0 && !draft.layers[index].locked) draft.layers[index] = structuredClone(next)
      return draft
    })
  }

  const patchLayer = (id: string, fn: (layer: RingLayer) => void) => commit(draft => {
    const layer = draft.layers.find(x => x.id === id)
    if (layer) fn(layer)
    return draft
  })

  const duplicateLayer = (id: string) => commit(draft => {
    const index = draft.layers.findIndex(x => x.id === id)
    if (index < 0) return draft
    const copy = structuredClone(draft.layers[index])
    copy.id = uid('layer')
    copy.name = `${copy.name} Copy`
    copy.offsetX += 18
    copy.offsetY += 18
    copy.locked = false
    draft.layers.splice(index + 1, 0, copy)
    draft.selectedLayerId = copy.id
    return draft
  })

  const deleteLayer = (id: string) => commit(draft => {
    const index = draft.layers.findIndex(x => x.id === id)
    if (index < 0 || draft.layers[index].locked) return draft
    draft.layers.splice(index, 1)
    if (draft.selectedLayerId === id) draft.selectedLayerId = draft.layers[Math.max(0, index - 1)]?.id ?? null
    return draft
  })

  const moveLayer = (id: string, direction: -1 | 1) => commit(draft => {
    const index = draft.layers.findIndex(x => x.id === id)
    const next = index + direction
    if (index < 0 || next < 0 || next >= draft.layers.length || draft.layers[index].locked) return draft
    const [item] = draft.layers.splice(index, 1)
    draft.layers.splice(next, 0, item)
    return draft
  })

  const saveSelectedPreset = () => {
    if (!selected) return
    const preset: FramePreset = {
      id: uid('user-preset'),
      category: '내 프리셋',
      name: `${selected.name} 저장`,
      layer: { ...structuredClone(selected), id: uid('preset-layer'), locked: false },
    }
    setUserPresets(prev => [preset, ...prev].slice(0, 100))
  }

  const sampleColor = (hex: string) => {
    if (!selected || selected.locked) return
    const next = structuredClone(selected)
    next.color = hex
    if (next.gradientMode !== 'solid' && next.gradientStops[0]) next.gradientStops[0].color = hex
    updateSelected(next)
  }

  const importProject = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as FrameProject
      if (parsed.version !== '0.1' || parsed.width !== 2000 || parsed.height !== 2000 || !Array.isArray(parsed.layers)) throw new Error('invalid')
      commit(() => parsed)
    } catch {
      alert('Circle Frame Studio v0.1 프로젝트 JSON 파일이 아닙니다.')
    }
  }

  const reset = () => {
    if (!confirm('현재 작업을 초기화할까요? 자동 저장된 작업도 새 프로젝트로 바뀝니다.')) return
    commit(() => makeInitialProject())
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">◯</div>
          <div><h1>Circle Frame Studio</h1><span>v0.1 · 2000×2000 Transparent PNG</span></div>
        </div>
        <div className="toolbar">
          <button onClick={reset}>새 프로젝트</button>
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

      <main className="workspace">
        <PresetBrowser onAdd={addPreset} userPresets={userPresets} />
        <section className="center-column">
          <CanvasPanel project={project} onSampleColor={sampleColor} />
          <LayerPanel
            layers={project.layers}
            selectedId={project.selectedLayerId}
            onSelect={id => setProject(prev => ({ ...prev, selectedLayerId: id }))}
            onToggleVisible={id => patchLayer(id, layer => { layer.visible = !layer.visible })}
            onToggleLock={id => patchLayer(id, layer => { layer.locked = !layer.locked })}
            onDuplicate={duplicateLayer}
            onDelete={deleteLayer}
            onMove={moveLayer}
          />
        </section>
        <PropertyPanel layer={selected} onChange={updateSelected} onSavePreset={saveSelectedPreset} />
      </main>
      <footer className="statusbar">
        <span>배경은 편집 화면에서만 체크무늬로 표시되며 PNG에는 투명하게 저장됩니다.</span>
        <span>레이어 {project.layers.length} · {project.autoFit ? 'Auto Fit ON' : '원본 크기 출력'}</span>
      </footer>
    </div>
  )
}
