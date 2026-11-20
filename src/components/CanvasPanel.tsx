import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from '../utils/assets'
import { preloadProjectMedia, syncProjectMediaPreview } from '../utils/media'

interface Props {
  project: FrameProject
  timeSec?: number
  playing?: boolean
  selectedMediaId?: string
  onSampleColor?: (hex: string) => void
  onMoveMedia?: (id: string, x: number, y: number) => void
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export default function CanvasPanel({
  project,
  timeSec = 0,
  playing = false,
  selectedMediaId = '',
  onSampleColor,
  onMoveMedia,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<
    | { type: 'pan'; startX: number; startY: number; panX: number; panY: number }
    | { type: 'media'; id: string; startX: number; startY: number; mediaX: number; mediaY: number }
    | null
  >(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await Promise.all([preloadProjectAssets(project), preloadProjectMedia(project)])
      if (cancelled) return
      syncProjectMediaPreview(project, timeSec, playing)
      if (ref.current) {
        const duration = Math.max(.5, project.timeline?.duration ?? 3)
        renderProject(ref.current, project, undefined, timeSec * 1000, (timeSec % duration) / duration)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [project])

  useEffect(() => {
    syncProjectMediaPreview(project, timeSec, playing)
    if (!ref.current) return
    const duration = Math.max(.5, project.timeline?.duration ?? 3)
    renderProject(ref.current, project, undefined, timeSec * 1000, (timeSec % duration) / duration)
  }, [project, timeSec, playing])

  const sample = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!event.altKey || !onSampleColor || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left) * (ref.current.width / rect.width))
    const y = Math.floor((event.clientY - rect.top) * (ref.current.height / rect.height))
    const data = ref.current.getContext('2d')?.getImageData(x, y, 1, 1).data
    if (data && data[3] > 0) onSampleColor(rgbToHex(data[0], data[1], data[2]))
  }

  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom(value => Math.max(.35, Math.min(3, value * (event.deltaY > 0 ? .90 : 1.10))))
  }

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      event.preventDefault()
      dragRef.current = { type: 'pan', startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (event.button === 0 && selectedMediaId && !event.altKey) {
      const layer = (project.mediaLayers ?? []).find(item => item.id === selectedMediaId)
      if (!layer || layer.locked) return
      dragRef.current = { type: 'media', id: layer.id, startX: event.clientX, startY: event.clientY, mediaX: layer.x, mediaY: layer.y }
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.type === 'pan') {
      setPan({ x: drag.panX + event.clientX - drag.startX, y: drag.panY + event.clientY - drag.startY })
      return
    }
    if (!onMoveMedia || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const projectPerScreenX = project.width / Math.max(1, rect.width)
    const projectPerScreenY = project.height / Math.max(1, rect.height)
    onMoveMedia(
      drag.id,
      drag.mediaX + (event.clientX - drag.startX) * projectPerScreenX,
      drag.mediaY + (event.clientY - drag.startY) * projectPerScreenY,
    )
  }

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
  }

  return (
    <div className="canvas-stage">
      <div className="canvas-meta">
        <span>2000 × 2000 출력 기준</span>
        <span>Alt + 클릭: 스포이드</span>
        <span>휠 확대 · 휠 클릭 이동 · 미디어 좌클릭 이동</span>
      </div>

      <div className="canvas-view-controls">
        <button type="button" onClick={() => setZoom(value => Math.max(.35, value - .1))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.min(3, value + .1))}>＋</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>전체 보기</button>
      </div>

      <div
        ref={viewportRef}
        className="canvas-viewport"
        onWheel={wheel}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onAuxClick={event => event.preventDefault()}
      >
        <div className="checkerboard" style={{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' }}>
          <canvas ref={ref} width={1200} height={1200} onClick={sample} />
        </div>
      </div>
    </div>
  )
}
