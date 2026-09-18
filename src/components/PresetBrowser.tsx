import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
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
      const design = structuredClone(preset.design)
      design.radius = 650
      design.offsetX = 0
      design.offsetY = 0
      const project: FrameProject = { version: '0.10', width: 2000, height: 2000, autoFit: false, design }
      await preloadProjectAssets(project)
      if (!cancelled && ref.current) renderProject(ref.current, project, 1)
    }
    run()
    return () => { cancelled = true }
  }, [preset])
  return <canvas ref={ref} width={96} height={96} />
}

interface Props {
  onSelect: (preset: FramePreset) => void
  userPresets: FramePreset[]
  onUploadAsset: (file?: File) => void
  currentAssetName: string
  currentAssetUrl: string
}

export default function PresetBrowser({ onSelect, userPresets, onUploadAsset, currentAssetName, currentAssetUrl }: Props) {
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const all = [...userPresets, ...PRESETS]
    return all.filter(x => (category === '전체' || x.category === category || (category === '내 프리셋' && x.category === '내 프리셋')) && x.name.toLowerCase().includes(query.toLowerCase()))
  }, [category, query, userPresets])
  const cats = ['전체', '내 프리셋', ...CATEGORIES.filter(x => x !== '전체')]

  const drop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    onUploadAsset(e.dataTransfer.files?.[0])
  }

  return (
    <aside className="left-panel panel">
      <div className="panel-title-row">
        <div>
          <strong>프레임 선택</strong>
          <small>프리셋을 누르면 현재 디자인이 교체됩니다</small>
        </div>
      </div>

      <section className="custom-frame-box">
        <div className="custom-frame-head">
          <div>
            <strong>내 PNG로 반복 프레임 만들기</strong>
            <small>투명 하트 · 리본 · 꽃 · 스티커</small>
          </div>
          <span>NEW</span>
        </div>
        <label className="asset-dropzone" onDragOver={e => e.preventDefault()} onDrop={drop}>
          {currentAssetUrl ? <img src={currentAssetUrl} alt="업로드 장식 미리보기" /> : <div className="asset-placeholder">♡</div>}
          <div>
            <b>{currentAssetName || '투명 PNG / WebP / SVG 선택'}</b>
            <small>클릭하거나 파일을 여기로 드래그하세요</small>
          </div>
          <input type="file" accept="image/png,image/webp,image/svg+xml,.png,.webp,.svg" onChange={e => onUploadAsset(e.target.files?.[0])} />
        </label>
        <p>업로드 즉시 이미지가 원 둘레에 반복 배치된 특수 프레임으로 전환됩니다.</p>
      </section>

      <input className="search" placeholder="프리셋 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="category-chips">
        {cats.map(c => <button className={c === category ? 'chip active' : 'chip'} key={c} onClick={() => setCategory(c)}>{c}</button>)}
      </div>
      <div className="preset-grid">
        {list.map(preset => (
          <button className="preset-card" key={preset.id} onClick={() => onSelect(preset)} title="현재 프레임으로 사용">
            <Thumb preset={preset} />
            <span>{preset.name}</span>
            <small>{preset.category}</small>
          </button>
        ))}
      </div>
    </aside>
  )
}
