import { useState } from 'react'
import type { MediaLayer } from '../types'

interface Props {
  duration: number
  currentTime: number
  playing: boolean
  loop: boolean
  mediaLayers: MediaLayer[]
  selectedMediaId: string
  onTimeChange: (value: number) => void
  onTogglePlay: () => void
  onToStart: () => void
  onDurationChange: (value: number) => void
  onLoopChange: (value: boolean) => void
  onSelectMedia: (id: string) => void
}

export default function TimelinePanel(props: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const duration = Math.max(.5, props.duration)
  const pct = Math.min(100, Math.max(0, (props.currentTime / duration) * 100))

  return <section className={collapsed ? 'timeline-panel panel collapsed' : 'timeline-panel panel'}>
    <div className="timeline-header">
      <div className="timeline-play-controls">
        <button type="button" onClick={props.onToStart}>|◀</button>
        <button type="button" className="timeline-play" onClick={props.onTogglePlay}>{props.playing ? 'Ⅱ' : '▶'}</button>
        <strong>{props.currentTime.toFixed(2)}s / {duration.toFixed(2)}s</strong>
      </div>
      <div className="timeline-project-controls">
        <label>길이 <input type="number" min={.5} max={60} step={.5} value={duration} onChange={event => props.onDurationChange(Number(event.target.value))} /> s</label>
        <label><input type="checkbox" checked={props.loop} onChange={event => props.onLoopChange(event.target.checked)} /> 반복</label>
        <button type="button" onClick={() => setCollapsed(value => !value)}>{collapsed ? '펼치기' : '접기'}</button>
      </div>
    </div>

    {!collapsed && <>
      <div className="timeline-scrubber">
        <input type="range" min={0} max={duration} step={.01} value={props.currentTime} onChange={event => props.onTimeChange(Number(event.target.value))} />
        <i style={{ left: pct + '%' }} />
      </div>
      <div className="timeline-tracks">
        {props.mediaLayers.map(layer => {
          const left = Math.max(0, Math.min(100, (layer.startTime / duration) * 100))
          const right = Math.max(left, Math.min(100, (layer.endTime / duration) * 100))
          const width = right - left
          const introEnd = Math.min(layer.endTime, layer.animation.introStart + layer.animation.introDuration)
          const introWidth = Math.max(0, Math.min(width, ((introEnd - layer.startTime) / duration) * 100))
          const outroLeft = Math.max(left, (layer.animation.outroStart / duration) * 100)
          return <button type="button" key={layer.id} className={layer.id === props.selectedMediaId ? 'timeline-track active' : 'timeline-track'} onClick={() => props.onSelectMedia(layer.id)}>
            <span>{layer.name}</span>
            <div className="timeline-track-rail">
              <b className="timeline-clip" style={{ left: left + '%', width: width + '%' }}>
                <i className="timeline-intro" style={{ width: introWidth + '%' }} />
                <i className="timeline-outro" style={{ left: Math.max(0, outroLeft - left) + '%', width: Math.max(0, right - outroLeft) + '%' }} />
              </b>
            </div>
          </button>
        })}
        {!props.mediaLayers.length && <div className="timeline-empty">미디어 레이어를 추가하면 등장·유지·퇴장 구간이 여기에 표시됩니다.</div>}
      </div>
    </>}
  </section>
}
