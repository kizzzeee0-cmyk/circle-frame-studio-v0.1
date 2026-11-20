import { useRef, useState, type DragEvent } from 'react'
import type { BackgroundSettings, MediaGroup, MediaLayer } from '../types'

interface Props {
  mediaLayers: MediaLayer[]
  selectedMediaIds: string[]
  primaryMediaId: string
  groups: MediaGroup[]
  background: BackgroundSettings
  onSelectMedia: (id: string, additive: boolean) => void
  onAddMedia: (file?: File, mode?: 'media' | 'decoration') => void
  onToggleMedia: (id: string) => void
  onToggleLock: (id: string) => void
  onMoveMedia: (id: string, direction: -1 | 1) => void
  onReorderMedia: (id: string, targetId: string) => void
  onDuplicateMedia: (id: string) => void
  onDeleteMedia: (id: string) => void
  onGroupSelected: () => void
  onUngroupSelected: () => void
  onRenameGroup: (id: string, name: string) => void
  onToggleGroupLock: (id: string) => void
  onSelectAllMedia: () => void
  onClearSelection: () => void
  onSetSelectedVisibility: (visible: boolean) => void
  onSetSelectedLock: (locked: boolean) => void
  onDuplicateSelected: () => void
  onDeleteSelected: () => void
  onBackgroundChange: (next: BackgroundSettings) => void
  onBackgroundFile: (file?: File) => void
}

export default function MediaPanel(props: Props) {
  const imageInput = useRef<HTMLInputElement>(null)
  const decorationInput = useRef<HTMLInputElement>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const [dragId, setDragId] = useState('')
  const [query, setQuery] = useState('')
  const selectedSet = new Set(props.selectedMediaIds)
  const selectedGroups = new Set(props.mediaLayers.filter(layer => selectedSet.has(layer.id) && layer.groupId).map(layer => layer.groupId))
  const activeGroupId = selectedGroups.size === 1 ? [...selectedGroups][0] : ''
  const activeGroup = activeGroupId ? props.groups.find(group => group.id === activeGroupId) : undefined
  const normalizedQuery = query.trim().toLowerCase()
  const visibleLayers = normalizedQuery
    ? props.mediaLayers.filter(layer => {
        const groupName = layer.groupId ? props.groups.find(group => group.id === layer.groupId)?.name ?? '' : ''
        return layer.name.toLowerCase().includes(normalizedQuery) ||
          layer.kind.toLowerCase().includes(normalizedQuery) ||
          groupName.toLowerCase().includes(normalizedQuery)
      })
    : props.mediaLayers

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    props.onAddMedia(event.dataTransfer.files?.[0], 'media')
  }

  return (
    <section className="media-panel panel">
      <div className="panel-title-row">
        <div><strong>요소 · 미디어</strong><small>사진 · 영상 · PNG 글자 · 배경</small></div>
      </div>

      <div className="media-add-grid">
        <button type="button" onClick={() => imageInput.current?.click()}>
          <b>＋ 사진·영상</b>
          <span>PNG · JPG · WebP · MP4 · WebM · MOV</span>
        </button>
        <button type="button" onClick={() => decorationInput.current?.click()}>
          <b>＋ PNG·글자</b>
          <span>투명 로고 · 스티커 · 타이포</span>
        </button>
      </div>
      <input
        ref={imageInput}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
        onChange={event => props.onAddMedia(event.target.files?.[0], 'media')}
      />
      <input
        ref={decorationInput}
        hidden
        type="file"
        accept="image/png,image/webp,.png,.webp"
        onChange={event => props.onAddMedia(event.target.files?.[0], 'decoration')}
      />

      <div className="media-dropzone" onDragOver={event => event.preventDefault()} onDrop={drop}>
        파일을 여기로 드래그해서 레이어 추가
      </div>

      <div className="media-subhead media-selection-head">
        <div><strong>미디어 레이어</strong><span>{props.mediaLayers.length}개</span></div>
        <div className="media-selection-actions">
          <button type="button" onClick={props.onSelectAllMedia}>전체 선택</button>
          {props.selectedMediaIds.length > 0 && <button type="button" onClick={props.onClearSelection}>선택 해제</button>}
        </div>
      </div>
      {props.mediaLayers.length > 3 && <div className="media-search-row">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="레이어 이름·그룹 검색" />
        {query && <button type="button" onClick={() => setQuery('')}>×</button>}
      </div>}
      {props.selectedMediaIds.length > 0 && (
        <div className="multi-selection-bar">
          <strong>{props.selectedMediaIds.length}개 선택</strong>
          <div className="selection-batch-actions">
            <button type="button" onClick={() => props.onSetSelectedVisibility(true)}>보이기</button>
            <button type="button" onClick={() => props.onSetSelectedVisibility(false)}>숨기기</button>
            <button type="button" onClick={() => props.onSetSelectedLock(true)}>잠금</button>
            <button type="button" onClick={() => props.onSetSelectedLock(false)}>잠금 해제</button>
            <button type="button" onClick={props.onDuplicateSelected}>복제</button>
            <button type="button" className="danger-mini" onClick={props.onDeleteSelected}>삭제</button>
          </div>
          {props.selectedMediaIds.length > 1 && !activeGroup && <button type="button" onClick={props.onGroupSelected}>그룹 만들기</button>}
          {selectedGroups.size > 0 && <button type="button" onClick={props.onUngroupSelected}>그룹 해제</button>
          {activeGroup ? (
            <div className="active-group-controls">
              <input value={activeGroup.name} onChange={event => props.onRenameGroup(activeGroup.id, event.target.value)} aria-label="그룹 이름" />
              <button type="button" onClick={() => props.onToggleGroupLock(activeGroup.id)}>{activeGroup.locked ? '잠금 해제' : '그룹 잠금'}</button>
            </div>
          ) : <small>Ctrl/⌘ 또는 Shift + 클릭으로 여러 개를 선택할 수 있습니다.</small>}
        </div>
      )}

      <div className="media-layer-list">
        {visibleLayers.map(layer => {
          const index = props.mediaLayers.findIndex(item => item.id === layer.id)
          return (
          <article
            key={layer.id}
            draggable
            className={selectedSet.has(layer.id) ? (layer.id === props.primaryMediaId ? 'media-layer-card active primary' : 'media-layer-card active') : 'media-layer-card'}
            onClick={event => props.onSelectMedia(layer.id, event.ctrlKey || event.metaKey || event.shiftKey)}
            onDragStart={event => {
              setDragId(layer.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', layer.id)
            }}
            onDragOver={event => {
              if (dragId) {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }
            }}
            onDrop={event => {
              event.preventDefault()
              const sourceId = dragId || event.dataTransfer.getData('text/plain')
              if (sourceId && sourceId !== layer.id) props.onReorderMedia(sourceId, layer.id)
              setDragId('')
            }}
            onDragEnd={() => setDragId('')}
          >
            <div className="media-select-box" aria-hidden="true">{selectedSet.has(layer.id) ? '✓' : ''}</div>
            <div className="media-layer-icon">{layer.kind === 'video' ? '▶' : '▧'}</div>
            <div className="media-layer-text">
              <strong>{layer.name}</strong>
              <small>{layer.maskMode === 'circle' ? '원 내부' : layer.maskMode === 'ring' ? '링 영역' : layer.maskMode === 'custom' ? '사용자 마스크' : '마스크 없음'} · {layer.placement === 'below' ? '프레임 아래' : '프레임 위'}</small>
              {layer.groupId && <em className="media-group-badge">그룹 · {props.groups.find(group => group.id === layer.groupId)?.name ?? '그룹'}</em>}
            </div>
            <div className="media-layer-mini-actions">
              <button title="표시/숨김" onClick={event => { event.stopPropagation(); props.onToggleMedia(layer.id) }}>{layer.visible ? '◉' : '○'}</button>
              <button title="잠금" onClick={event => { event.stopPropagation(); props.onToggleLock(layer.id) }}>{layer.locked ? '🔒' : '◇'}</button>
              <button disabled={index === 0} title="위로" onClick={event => { event.stopPropagation(); props.onMoveMedia(layer.id, -1) }}>↑</button>
              <button disabled={index === props.mediaLayers.length - 1} title="아래로" onClick={event => { event.stopPropagation(); props.onMoveMedia(layer.id, 1) }}>↓</button>
              <button title="복제" onClick={event => { event.stopPropagation(); props.onDuplicateMedia(layer.id) }}>⧉</button>
              <button title="삭제" onClick={event => { event.stopPropagation(); props.onDeleteMedia(layer.id) }}>×</button>
            </div>
          </article>
        )})}
        {!props.mediaLayers.length && <div className="media-empty">사진이나 영상을 추가하면 여기에 레이어가 표시됩니다.</div>}
        {!!props.mediaLayers.length && !visibleLayers.length && <div className="media-empty">검색 결과가 없습니다.</div>}
      </div>

      <div className="media-subhead background-head"><strong>배경</strong></div>
      <label className="control">
        <span><b>배경 방식</b></span>
        <select value={props.background.type} onChange={event => props.onBackgroundChange({ ...props.background, type: event.target.value as BackgroundSettings['type'] })}>
          <option value="transparent">완전 투명</option>
          <option value="color">단색</option>
          <option value="image">이미지</option>
          <option value="video">영상</option>
        </select>
      </label>

      {props.background.type === 'color' && <div className="background-color-row">
        <input type="color" value={props.background.color} onChange={event => props.onBackgroundChange({ ...props.background, color: event.target.value.toUpperCase() })} />
        <input value={props.background.color} onChange={event => props.onBackgroundChange({ ...props.background, color: event.target.value.toUpperCase() })} />
      </div>}

      {props.background.type !== 'transparent' && <label className="control slider-control">
        <span><b>배경 불투명도</b><em>{Math.round(props.background.opacity * 100)}%</em></span>
        <input type="range" min={0} max={1} step={.01} value={props.background.opacity} onChange={event => props.onBackgroundChange({ ...props.background, opacity: Number(event.target.value) })} />
      </label>}

      {['image','video'].includes(props.background.type) && <>
        <button type="button" className="soft-button full" onClick={() => backgroundInput.current?.click()}>
          {props.background.fileName ? '배경 원본 변경 · ' + props.background.fileName : '배경 파일 선택'}
        </button>
        <input
          ref={backgroundInput}
          hidden
          type="file"
          accept={props.background.type === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp'}
          onChange={event => props.onBackgroundFile(event.target.files?.[0])}
        />
        <label className="control"><span><b>배경 맞춤</b></span>
          <select value={props.background.fit} onChange={event => props.onBackgroundChange({ ...props.background, fit: event.target.value as BackgroundSettings['fit'] })}>
            <option value="cover">화면 채우기</option>
            <option value="contain">전체 맞춤</option>
          </select>
        </label>
        <div className="background-transform-grid">
          <label><span>X</span><input type="number" value={Math.round(props.background.x)} onChange={event => props.onBackgroundChange({ ...props.background, x: Number(event.target.value) || 0 })} /></label>
          <label><span>Y</span><input type="number" value={Math.round(props.background.y)} onChange={event => props.onBackgroundChange({ ...props.background, y: Number(event.target.value) || 0 })} /></label>
          <label><span>크기</span><input type="number" min={.05} max={5} step={.05} value={props.background.scale} onChange={event => props.onBackgroundChange({ ...props.background, scale: Math.max(.05, Number(event.target.value) || 1) })} /></label>
          <label><span>회전</span><input type="number" min={-360} max={360} step={1} value={Math.round(props.background.rotation)} onChange={event => props.onBackgroundChange({ ...props.background, rotation: Number(event.target.value) || 0 })} /></label>
        </div>
        <button type="button" className="soft-button full" onClick={() => props.onBackgroundChange({ ...props.background, x: 0, y: 0, scale: 1, rotation: 0 })}>배경 위치·크기 초기화</button>
      </>}
    </section>
  )
}
