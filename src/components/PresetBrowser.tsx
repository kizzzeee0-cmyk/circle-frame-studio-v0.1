import { useMemo, useState, useEffect, useRef } from 'react'
import type { FramePreset, FrameProject } from '../types'
import { CATEGORIES, PRESETS } from '../presets'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from '../utils/assets'

function Thumb({ preset }: { preset: FramePreset }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!ref.current) return
      const layer = structuredClone(preset.layer)
      layer.radius = 650
      layer.offsetX = 0
      layer.offsetY = 0
      const project: FrameProject = { version: '0.2', width: 2000, height: 2000, autoFit: false, selectedLayerId: layer.id, layers: [layer] }
      await preloadProjectAssets(project)
      if (!cancelled && ref.current) renderProject(ref.current, project)
    }
    run()
    return () => { cancelled = true }
  }, [preset])
  return <canvas ref={ref} width={96} height={96} />
}

export default function PresetBrowser({ onAdd, userPresets }: { onAdd: (preset: FramePreset) => void, userPresets: FramePreset[] }) {
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const all = [...userPresets, ...PRESETS]
    return all.filter(x => (category === '전체' || x.category === category || (category === '내 프리셋' && x.category === '내 프리셋')) && x.name.toLowerCase().includes(query.toLowerCase()))
  }, [category, query, userPresets])
  const cats = ['전체', '내 프리셋', ...CATEGORIES.filter(x => x !== '전체')]

  return (
    <aside className="left-panel panel">
      <div className="panel-title-row">
        <div>
          <strong>프레임 프리셋</strong>
          <small>{PRESETS.length + userPresets.length}개</small>
        </div>
      </div>
      <input className="search" placeholder="프리셋 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="category-chips">
        {cats.map(c => <button className={c === category ? 'chip active' : 'chip'} key={c} onClick={() => setCategory(c)}>{c}</button>)}
      </div>
      <div className="preset-grid">
        {list.map(preset => (
          <button className="preset-card" key={preset.id} onClick={() => onAdd(preset)} title="레이어로 추가">
            <Thumb preset={preset} />
            <span>{preset.name}</span>
            <small>{preset.category}</small>
          </button>
        ))}
      </div>
    </aside>
  )
}
