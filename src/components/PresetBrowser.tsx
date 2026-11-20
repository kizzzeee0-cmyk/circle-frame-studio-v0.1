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
      const project: FrameProject = { version: '0.35', width: 2000, height: 2000, autoFit: false, design, layers: [{ id: 'thumb', name: design.name, visible: true, design }], selectedLayerId: 'thumb' }
      await preloadProjectAssets(project)
      if (cancelled || !ref.current) return

      if (design.kind !== 'glitter' || !design.glitter.animated) {
        renderProject(ref.current, project, 1)
        return
      }

      let last = 0
      const tick = (time: number) => {
        if (cancelled || !ref.current) return
        // 24fps is still lightweight at 96×96 but looks much less stepped than the old 12fps preview.
        if (time - last > 41) {
          renderProject(ref.current, project, 1, time)
          last = time
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    void run()
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
const PRESET_FAVORITES_KEY = 'circle-frame-studio-preset-favorites-v034'
const PRIMARY_CATEGORY_KEYS = new Set(['all','favorite','mine','basic','minimal','glitter','heart','ribbon','gradient','3d'])

function loadPresetFavorites() {
  try {
    const raw = localStorage.getItem(PRESET_FAVORITES_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch { return [] }
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: 'all', label: '전체' },
  { key: 'favorite', label: '★ 즐겨찾기' },
  { key: 'mine', label: '내 프리셋' },
  { key: 'basic', label: '기본' },
  { key: 'minimal', label: '미니멀' },
  { key: 'triple', label: '트리플' },
  { key: 'broken', label: '끊긴형' },
  { key: 'dot', label: '도트' },
  { key: 'wavy', label: '물결' },
  { key: 'scribble', label: '낙서' },
  { key: 'brush', label: '브러시' },
  { key: 'glitter', label: '글리터' },
  { key: 'decorative', label: '장식' },
  { key: 'heart', label: '하트' },
  { key: 'ribbon', label: '리본' },
  { key: 'flower', label: '꽃' },
  { key: 'star', label: '별/반짝이' },
  { key: 'gradient', label: '그라데이션' },
  { key: 'twotoneflow', label: '2색 흐름' },
  { key: 'twotoneflow4', label: '2색 4구간' },
  { key: 'twotoneflow6', label: '2색 6구간' },
  { key: 'twotoneflow8', label: '2색 8구간' },
  { key: 'glow', label: '글로우' },
  { key: 'emboss', label: '입체감' },
  { key: '3d', label: '3D' },
  { key: 'jelly', label: '젤리 링' },
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
    case 'triple': return preset.category === 'Triple' || kind === 'triple'
    case 'broken': return preset.category === 'Broken'
    case 'dot': return preset.category === 'Dot' || kind === 'dotted'
    case 'wavy': return preset.category === 'Wavy' || kind === 'wavy' || kind === 'scallop'
    case 'scribble': return preset.category === 'Scribble' || kind === 'scribble' || kind === 'rough'
    case 'brush': return preset.category === 'Brush' || kind === 'brush'
    case 'glitter': return preset.category === 'Glitter' || kind === 'glitter'
    case 'decorative': return preset.category === 'Decorative'
    case 'heart': return kind === 'heart' || name.includes('heart')
    case 'ribbon': return kind === 'ribbon' || name.includes('ribbon')
    case 'flower': return kind === 'flower' || name.includes('flower')
    case 'star': return kind === 'star' || kind === 'sparkle' || name.includes('star') || name.includes('sparkle')
    case 'gradient': return preset.category === 'Gradient' || preset.category === 'TwoToneFlow' || preset.category === 'TwoToneFlow4' || preset.category === 'TwoToneFlow6' || preset.category === 'TwoToneFlow8' || preset.design.gradientMode !== 'solid' || name.includes('gradient')
    case 'twotoneflow': return preset.category === 'TwoToneFlow' || preset.category === 'TwoToneFlow4' || preset.category === 'TwoToneFlow6' || preset.category === 'TwoToneFlow8'
    case 'twotoneflow4': return preset.category === 'TwoToneFlow4' || (preset.design.twoToneFlow.enabled && preset.design.twoToneFlow.repeatCount === 2)
    case 'twotoneflow6': return preset.category === 'TwoToneFlow6' || (preset.design.twoToneFlow.enabled && preset.design.twoToneFlow.repeatCount === 3)
    case 'twotoneflow8': return preset.category === 'TwoToneFlow8' || (preset.design.twoToneFlow.enabled && preset.design.twoToneFlow.repeatCount === 4)
    case 'glow': return preset.category === 'Glow' || preset.design.effects.glowEnabled || name.includes('glow') || name.includes('neon')
    case 'emboss': return preset.category === 'Emboss' || preset.design.effects.embossEnabled
    case '3d': return preset.category === '3D' || preset.category === 'Emboss' || preset.design.effects.embossEnabled || kind === 'glossy' || kind === 'jelly' || name.includes('glossy')
    case 'jelly': return kind === 'jelly' || name.includes('jelly')
    case 'abstract': return preset.category === 'Abstract' || name.includes('abstract') || name.includes('organic')
    case 'fourcolor': return colorCount >= 4 || name.includes('four color') || name.includes('4 color')
    default:
      return category === key.toLowerCase()
  }
}

export default function PresetBrowser({ onSelect, userPresets, onUploadAsset, currentAssetName, currentAssetUrl }: Props) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadPresetFavorites)
  useEffect(() => {
    try { localStorage.setItem(PRESET_FAVORITES_KEY, JSON.stringify(favoriteIds)) } catch { /* ignore */ }
  }, [favoriteIds])
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const visibleCategories = useMemo(() => showAllCategories ? CATEGORY_OPTIONS : CATEGORY_OPTIONS.filter(item => PRIMARY_CATEGORY_KEYS.has(item.key)), [showAllCategories])
  const list = useMemo(() => {
    const all = [...userPresets, ...PRESETS]
    const filtered = all.filter(x => {
      const categoryMatch = category === 'favorite' ? favoriteSet.has(x.id) : matchesCategory(x, category)
      return categoryMatch && x.name.toLowerCase().includes(query.toLowerCase())
    })
    return filtered.sort((a,b) => Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id)))
  }, [category, query, userPresets, favoriteSet])
  const toggleFavorite = (id: string) => setFavoriteIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [id, ...prev])

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

      <details className="custom-frame-box compact-toolbox">
        <summary><span>내 PNG 반복 프레임</span><small>하트 · 리본 · 꽃 · 스티커 업로드</small></summary>
        <div className="compact-toolbox-body">
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
        </div>
      </details>

      <input className="search" placeholder="프리셋 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="category-chips compact-categories">
        {visibleCategories.map(c => (
          <button className={c.key === category ? 'chip active' : 'chip'} key={c.key} onClick={() => setCategory(c.key)}>
            {c.label}
          </button>
        ))}
        <button className="chip category-more-button" type="button" onClick={() => setShowAllCategories(value => !value)}>{showAllCategories ? '간단히' : '+ 더보기'}</button>
      </div>
      <div className="preset-result-meta">총 {list.length}개 프리셋</div>
      <div className="preset-grid">
        {list.map(preset => (
          <div className={favoriteSet.has(preset.id) ? 'preset-card favorite' : 'preset-card'} key={preset.id} role="button" tabIndex={0} onClick={() => onSelect(preset)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelect(preset) }} title="현재 프레임으로 사용">
            <span className="preset-favorite" role="button" tabIndex={0} title={favoriteSet.has(preset.id) ? '즐겨찾기 해제' : '즐겨찾기'} onClick={event => { event.stopPropagation(); toggleFavorite(preset.id) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggleFavorite(preset.id) } }}>{favoriteSet.has(preset.id) ? '★' : '☆'}</span>
            <Thumb preset={preset} />
            <span className="preset-name">{preset.name}</span>
            <small>{preset.category}</small>
          </div>
        ))}
      </div>
    </aside>
  )
}
