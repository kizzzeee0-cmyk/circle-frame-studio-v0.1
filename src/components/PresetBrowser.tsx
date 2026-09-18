import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { FramePreset, FrameProject } from '../types'
import { PRESETS } from '../presets'
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
      const project: FrameProject = { version: '0.12', width: 2000, height: 2000, autoFit: false, design }
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

type CategoryOption = { key: string; label: string }

const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: 'all', label: '전체' },
  { key: 'mine', label: '내 프리셋' },
  { key: 'basic', label: '기본' },
  { key: 'minimal', label: '미니멀' },
  { key: 'broken', label: '끊긴형' },
  { key: 'dot', label: '도트' },
  { key: 'wavy', label: '물결' },
  { key: 'scribble', label: '낙서' },
  { key: 'brush', label: '브러시' },
  { key: 'decorative', label: '장식' },
  { key: 'heart', label: '하트' },
  { key: 'ribbon', label: '리본' },
  { key: 'flower', label: '꽃' },
  { key: 'star', label: '별/반짝이' },
  { key: 'gradient', label: '그라데이션' },
  { key: 'glow', label: '글로우' },
  { key: '3d', label: '3D' },
  { key: 'abstract', label: '추상' },
  { key: 'fourcolor', label: '4컬러' },
]

function matchesCategory(preset: FramePreset, key: string) {
  const category = preset.category.toLowerCase()
  const name = preset.name.toLowerCase()
  const kind = preset.design.kind
  const colorCount = preset.design.pattern.colorCount

  switch (key) {
    case 'all': return true
    case 'mine': return preset.category === '내 프리셋'
    case 'basic': return preset.category === 'Basic'
    case 'minimal': return preset.category === 'Minimal'
    case 'broken': return preset.category === 'Broken'
    case 'dot': return preset.category === 'Dot' || kind === 'dotted'
    case 'wavy': return preset.category === 'Wavy' || kind === 'wavy' || kind === 'scallop'
    case 'scribble': return preset.category === 'Scribble' || kind === 'scribble' || kind === 'rough'
    case 'brush': return preset.category === 'Brush' || kind === 'brush'
    case 'decorative': return preset.category === 'Decorative'
    case 'heart': return kind === 'heart' || name.includes('heart')
    case 'ribbon': return kind === 'ribbon' || name.includes('ribbon')
    case 'flower': return kind === 'flower' || name.includes('flower')
    case 'star': return kind === 'star' || kind === 'sparkle' || name.includes('star') || name.includes('sparkle')
    case 'gradient': return preset.category === 'Gradient' || preset.design.gradientMode !== 'solid' || name.includes('gradient')
    case 'glow': return preset.category === 'Glow' || preset.design.effects.glowEnabled || name.includes('glow') || name.includes('neon')
    case '3d': return preset.category === '3D' || kind === 'glossy' || name.includes('glossy')
    case 'abstract': return preset.category === 'Abstract' || name.includes('abstract') || name.includes('organic')
    case 'fourcolor': return colorCount >= 4 || name.includes('four color') || name.includes('4 color')
    default:
      return category === key.toLowerCase()
  }
}

export default function PresetBrowser({ onSelect, userPresets, onUploadAsset, currentAssetName, currentAssetUrl }: Props) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const list = useMemo(() => {
    const all = [...userPresets, ...PRESETS]
    return all.filter(x => matchesCategory(x, category) && x.name.toLowerCase().includes(query.toLowerCase()))
  }, [category, query, userPresets])

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
      <div className="category-chips expanded">
        {CATEGORY_OPTIONS.map(c => (
          <button className={c.key === category ? 'chip active' : 'chip'} key={c.key} onClick={() => setCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="preset-result-meta">총 {list.length}개 프리셋</div>
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
