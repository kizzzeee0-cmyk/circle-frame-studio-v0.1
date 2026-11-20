import type { RingLayer } from '../types'

interface Props {
  layers: RingLayer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisible: (id: string) => void
  onToggleLock: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, direction: -1 | 1) => void
}

export default function LayerPanel(props: Props) {
  const { layers, selectedId } = props
  return (
    <div className="layer-panel panel">
      <div className="panel-title-row">
        <div><strong>레이어</strong><small>{layers.length}개</small></div>
      </div>
      <div className="layer-list">
        {[...layers].reverse().map((layer, reverseIndex) => {
          const index = layers.length - 1 - reverseIndex
          return (
            <div className={layer.id === selectedId ? 'layer-row selected' : 'layer-row'} key={layer.id} onClick={() => props.onSelect(layer.id)}>
              <button title="표시/숨김" onClick={e => { e.stopPropagation(); props.onToggleVisible(layer.id) }}>{layer.visible ? '◉' : '○'}</button>
              <div className="layer-name">
                <strong>{layer.name}</strong>
                <small>{layer.kind}</small>
              </div>
              <button title="잠금" onClick={e => { e.stopPropagation(); props.onToggleLock(layer.id) }}>{layer.locked ? '🔒' : '◇'}</button>
              <button disabled={index === layers.length - 1} title="위로" onClick={e => { e.stopPropagation(); props.onMove(layer.id, 1) }}>↑</button>
              <button disabled={index === 0} title="아래로" onClick={e => { e.stopPropagation(); props.onMove(layer.id, -1) }}>↓</button>
              <button title="복제" onClick={e => { e.stopPropagation(); props.onDuplicate(layer.id) }}>⧉</button>
              <button title="삭제" onClick={e => { e.stopPropagation(); props.onDelete(layer.id) }}>×</button>
            </div>
          )
        })}
        {layers.length === 0 && <div className="empty-state">왼쪽 프리셋을 눌러 레이어를 추가하세요.</div>}
      </div>
    </div>
  )
}
