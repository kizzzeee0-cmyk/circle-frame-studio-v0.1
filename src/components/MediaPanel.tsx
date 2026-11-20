import { useRef, useState, type DragEvent } from 'react'
import type { BackgroundSettings, MediaLayer } from '../types'

interface Props {
  mediaLayers: MediaLayer[]
  selectedMediaId: string
  background: BackgroundSettings
  onSelectMedia: (id: string) => void
  onAddMedia: (file?: File) => void
  onToggleMedia: (id: string) => void
  onToggleLock: (id: string) => void
  onMoveMedia: (id: string, direction: -1 | 1) => void
  onReorderMedia: (id: string, targetId: string) => void
  onDuplicateMedia: (id: string) => void
  onDeleteMedia: (id: string) => void
  onBackgroundChange: (next: BackgroundSettings) => void
  onBackgroundFile: (file?: File) => void
}

export default function MediaPanel(props: Props) {
  const imageInput = useRef<HTMLInputElement>(null)
  const backgroundInput = useRef<HTMLInputElement>(null)
  const [dragId, setDragId] = useState('')

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    props.onAddMedia(event.dataTransfer.files?.[0])
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
        <button type="button" onClick={() => imageInput.current?.click()}>
          <b>＋ PNG·글자</b>
          <span>투명 로고 · 스티커 · 타이포</span>
        </button>
      </div>
      <input
        ref={imageInput}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
        onChange={event => props.onAddMedia(event.target.files?.[0])}
      />

      <div className="media-dropzone" onDragOver={event => event.preventDefault()} onDrop={drop}>
        파일을 여기로 드래그해서 레이어 추가
      </div>

      <div className="media-subhead">
        <strong>미디어 레이어</strong>
        <span>{props.mediaLayers.length}개</span>
      </div>

      <div className="media-layer-list">
        {props.mediaLayers.map((layer, index) => (
          <article
            key={layer.id}
            draggable
            className={layer.id === props.selectedMediaId ? 'media-layer-card active' : 'media-layer-card'}
            onClick={() => props.onSelectMedia(layer.id)}
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
            <div className="media-layer-icon">{layer.kind === 'video' ? '▶' : '▧'}</div>
            <div className="media-layer-text">
              <strong>{layer.name}</strong>
              <small>{layer.maskMode === 'circle' ? '원 내부' : layer.maskMode === 'ring' ? '링 영역' : '마스크 없음'} · {layer.placement === 'below' ? '프레임 아래' : '프레임 위'}</small>
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
        ))}
        {!props.mediaLayers.length && <div className="media-empty">사진이나 영상을 추가하면 여기에 레이어가 표시됩니다.</div>}
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
      </>}
    </section>
  )
}
