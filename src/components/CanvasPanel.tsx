import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import type { ComposerSettings, FrameProject, MediaLayer } from '../types'
import { getProjectFitScale, renderProject } from '../render/renderer'
import { canUseGpuCompositor, presentCanvasWithGpu } from '../render/gpuCompositor'
import { preloadProjectAssets } from '../utils/assets'
import { preloadProjectMedia, syncProjectMediaPreview } from '../utils/media'

interface Props {
  project: FrameProject
  timeSec?: number
  playing?: boolean
  selectedMediaIds?: string[]
  primaryMediaId?: string
  settings: ComposerSettings
  onSampleColor?: (hex: string) => void
  onSelectMedia?: (id: string, additive: boolean) => void
  onBeginTransform?: () => void
  onTransformMedia?: (updates: Array<Partial<MediaLayer> & { id: string }>) => void
  onSettingsChange?: (next: ComposerSettings) => void
  onMoveMedia?: (id: string, x: number, y: number) => void
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function rotatedBounds(layer: MediaLayer) {
  const width = Math.max(1, layer.width * layer.scale)
  const height = Math.max(1, layer.height * layer.scale)
  const hw = width / 2
  const hh = height / 2
  const angle = layer.rotation * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const corners = [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y]) => ({
    x: layer.x + x * cos - y * sin,
    y: layer.y + x * sin + y * cos,
  }))
  return {
    left: Math.min(...corners.map(p => p.x)),
    right: Math.max(...corners.map(p => p.x)),
    top: Math.min(...corners.map(p => p.y)),
    bottom: Math.max(...corners.map(p => p.y)),
  }
}

function selectionBounds(layers: MediaLayer[]) {
  if (!layers.length) return null
  const all = layers.map(rotatedBounds)
  const left = Math.min(...all.map(v => v.left))
  const right = Math.max(...all.map(v => v.right))
  const top = Math.min(...all.map(v => v.top))
  const bottom = Math.max(...all.map(v => v.bottom))
  return { left, right, top, bottom, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top }
}

function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number) {
  const dx = x - cx
  const dy = y - cy
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

export default function CanvasPanel({
  project,
  timeSec = 0,
  playing = false,
  selectedMediaIds = [],
  primaryMediaId = '',
  settings,
  onSampleColor,
  onSelectMedia,
  onBeginTransform,
  onTransformMedia,
  onSettingsChange,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const gpuRef = useRef<HTMLCanvasElement>(null)
  const renderSurfaceRef = useRef<HTMLCanvasElement | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const checkerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [guide, setGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const transformRef = useRef<{
    mode: 'move' | 'resize' | 'rotate'
    startX: number
    startY: number
    centerX: number
    centerY: number
    startDistance: number
    startAngle: number
    layers: MediaLayer[]
  } | null>(null)

  const gpuAvailable = useMemo(() => canUseGpuCompositor(), [])
  const useGpu = gpuAvailable && settings.performanceMode !== 'quality'
  const effectiveResolution = settings.performanceMode === 'performance'
    ? 720
    : settings.performanceMode === 'auto' && playing && (project.mediaLayers?.length ?? 0) > 4
      ? 960
      : settings.previewResolution
  const selectedLayers = (project.mediaLayers ?? []).filter(layer => selectedMediaIds.includes(layer.id) && layer.visible)
  const bounds = selectionBounds(selectedLayers)
  const fitScale = getProjectFitScale(project)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await Promise.all([preloadProjectAssets(project), preloadProjectMedia(project)])
      if (cancelled) return
      syncProjectMediaPreview(project, timeSec, playing)
      const duration = Math.max(.5, project.timeline?.duration ?? 3)
      const progress = (timeSec % duration) / duration
      if (useGpu && gpuRef.current) {
        const surface = renderSurfaceRef.current ?? document.createElement('canvas')
        renderSurfaceRef.current = surface
        surface.width = effectiveResolution
        surface.height = effectiveResolution
        renderProject(surface, project, undefined, timeSec * 1000, progress)
        presentCanvasWithGpu(gpuRef.current, surface)
      } else if (ref.current) {
        renderProject(ref.current, project, undefined, timeSec * 1000, progress)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [project, effectiveResolution, useGpu])

  useEffect(() => {
    syncProjectMediaPreview(project, timeSec, playing)
    const duration = Math.max(.5, project.timeline?.duration ?? 3)
    const progress = (timeSec % duration) / duration
    if (useGpu && gpuRef.current) {
      const surface = renderSurfaceRef.current ?? document.createElement('canvas')
      renderSurfaceRef.current = surface
      if (surface.width !== effectiveResolution) surface.width = effectiveResolution
      if (surface.height !== effectiveResolution) surface.height = effectiveResolution
      renderProject(surface, project, undefined, timeSec * 1000, progress)
      presentCanvasWithGpu(gpuRef.current, surface)
    } else if (ref.current) {
      renderProject(ref.current, project, undefined, timeSec * 1000, progress)
    }
  }, [project, timeSec, playing, effectiveResolution, useGpu])

  const sampleAt = (clientX: number, clientY: number) => {
    if (!onSampleColor) return
    const display = useGpu ? gpuRef.current : ref.current
    const source = useGpu ? renderSurfaceRef.current : ref.current
    if (!display || !source) return
    const rect = display.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left) * (source.width / rect.width))
    const y = Math.floor((clientY - rect.top) * (source.height / rect.height))
    const data = source.getContext('2d')?.getImageData(x, y, 1, 1).data
    if (data && data[3] > 0) onSampleColor(rgbToHex(data[0], data[1], data[2]))
  }

  const sample = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!event.altKey) return
    sampleAt(event.clientX, event.clientY)
  }

  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom(value => Math.max(.25, Math.min(4, value * (event.deltaY > 0 ? .90 : 1.10))))
  }

  const projectPerScreen = () => {
    const rect = checkerRef.current?.getBoundingClientRect()
    if (!rect) return 1
    return project.width / Math.max(1, rect.width * fitScale)
  }

  const screenPointForProject = (x: number, y: number) => {
    const rect = checkerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const factor = rect.width * fitScale / project.width
    return {
      x: rect.left + rect.width / 2 + x * factor,
      y: rect.top + rect.height / 2 + y * factor,
    }
  }

  const beginTransform = (event: PointerEvent, mode: 'move' | 'resize' | 'rotate', overrideLayers?: MediaLayer[]) => {
    const transformLayers = overrideLayers ?? selectedLayers
    if (!transformLayers.length || transformLayers.some(layer => layer.locked)) return
    const currentBounds = selectionBounds(transformLayers)
    if (!currentBounds) return
    event.preventDefault()
    event.stopPropagation()
    const center = screenPointForProject(currentBounds.x, currentBounds.y)
    const dx = event.clientX - center.x
    const dy = event.clientY - center.y
    onBeginTransform?.()
    transformRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      centerX: currentBounds.x,
      centerY: currentBounds.y,
      startDistance: Math.max(8, Math.hypot(dx, dy)),
      startAngle: Math.atan2(dy, dx),
      layers: transformLayers.map(layer => ({ ...layer })),
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const snapMoveDelta = (
    axis: 'x' | 'y',
    proposedDelta: number,
    original: NonNullable<ReturnType<typeof selectionBounds>>,
  ) => {
    if (!settings.snapEnabled) return proposedDelta
    const threshold = 14 * projectPerScreen()
    const selectedIds = new Set(selectedMediaIds)
    const otherBounds = (project.mediaLayers ?? [])
      .filter(layer => layer.visible && !selectedIds.has(layer.id))
      .map(rotatedBounds)

    const moving = axis === 'x'
      ? [original.left + proposedDelta, original.x + proposedDelta, original.right + proposedDelta]
      : [original.top + proposedDelta, original.y + proposedDelta, original.bottom + proposedDelta]

    const targets = axis === 'x'
      ? [0, ...otherBounds.flatMap(item => [item.left, (item.left + item.right) / 2, item.right])]
      : [0, ...otherBounds.flatMap(item => [item.top, (item.top + item.bottom) / 2, item.bottom])]

    let bestDiff = Infinity
    let bestTarget = NaN
    for (const movingValue of moving) {
      for (const target of targets) {
        const diff = target - movingValue
        if (Math.abs(diff) < Math.abs(bestDiff)) {
          bestDiff = diff
          bestTarget = target
        }
      }
    }

    if (Math.abs(bestDiff) <= threshold) {
      setGuide(prev => ({ ...prev, [axis]: bestTarget }))
      return proposedDelta + bestDiff
    }

    const size = Math.max(1, settings.snapSize)
    const center = axis === 'x' ? original.x : original.y
    const snappedCenter = Math.round((center + proposedDelta) / size) * size
    return proposedDelta + snappedCenter - (center + proposedDelta)
  }

  const transformMove = (event: PointerEvent) => {
    const session = transformRef.current
    if (!session || !onTransformMedia) return
    setGuide({ x: null, y: null })

    if (session.mode === 'move') {
      const factor = projectPerScreen()
      let dx = (event.clientX - session.startX) * factor
      let dy = (event.clientY - session.startY) * factor
      const original = selectionBounds(session.layers)
      if (original) {
        dx = snapMoveDelta('x', dx, original)
        dy = snapMoveDelta('y', dy, original)
      }
      onTransformMedia(session.layers.map(layer => ({ id: layer.id, x: layer.x + dx, y: layer.y + dy })))
      return
    }

    const center = screenPointForProject(session.centerX, session.centerY)
    const dx = event.clientX - center.x
    const dy = event.clientY - center.y

    if (session.mode === 'resize') {
      const ratio = Math.max(.03, Math.hypot(dx, dy) / session.startDistance)
      onTransformMedia(session.layers.map(layer => ({
        id: layer.id,
        x: session.centerX + (layer.x - session.centerX) * ratio,
        y: session.centerY + (layer.y - session.centerY) * ratio,
        scale: Math.max(.02, layer.scale * ratio),
      })))
      return
    }

    const angle = Math.atan2(dy, dx)
    const delta = angle - session.startAngle
    const degrees = delta * 180 / Math.PI
    onTransformMedia(session.layers.map(layer => {
      const point = rotatePoint(layer.x, layer.y, session.centerX, session.centerY, delta)
      return { id: layer.id, x: point.x, y: point.y, rotation: layer.rotation + degrees }
    }))
  }

  const endTransform = (event: PointerEvent) => {
    if (!transformRef.current) return
    transformRef.current = null
    setGuide({ x: null, y: null })
    try { (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId) } catch { /* ignore */ }
  }

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1) return
    event.preventDefault()
    panRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      setPan({
        x: panRef.current.panX + event.clientX - panRef.current.startX,
        y: panRef.current.panY + event.clientY - panRef.current.startY,
      })
    }
    transformMove(event)
  }

  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    panRef.current = null
    endTransform(event)
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
  }

  const overlayStyle = (() => {
    if (!bounds) return undefined
    if (selectedLayers.length === 1) {
      const layer = selectedLayers[0]
      const widthPct = layer.width * layer.scale * fitScale / project.width * 100
      const heightPct = layer.height * layer.scale * fitScale / project.height * 100
      const leftPct = 50 + layer.x * fitScale / project.width * 100 - widthPct / 2
      const topPct = 50 + layer.y * fitScale / project.height * 100 - heightPct / 2
      return {
        left: leftPct + '%',
        top: topPct + '%',
        width: widthPct + '%',
        height: heightPct + '%',
        transform: 'rotate(' + layer.rotation + 'deg)',
      }
    }
    return {
      left: (50 + bounds.left * fitScale / project.width * 100) + '%',
      top: (50 + bounds.top * fitScale / project.height * 100) + '%',
      width: (bounds.width * fitScale / project.width * 100) + '%',
      height: (bounds.height * fitScale / project.height * 100) + '%',
    }
  })()

  return (
    <div className="canvas-stage">
      <div className="canvas-meta">
        <span>{project.width} × {project.height} 출력 기준</span>
        <span>{selectedLayers.length ? selectedLayers.length + '개 선택' : 'Alt + 클릭: 스포이드'}</span>
        <span>휠 확대 · 휠 클릭 이동 · 핸들 직접 편집</span>
      </div>

      <div className="canvas-view-controls">
        <button type="button" onClick={() => setZoom(value => Math.max(.25, value - .1))}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.min(4, value + .1))}>＋</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>전체 보기</button>
        <label className="canvas-mini-toggle"><input type="checkbox" checked={settings.snapEnabled} onChange={event => onSettingsChange?.({ ...settings, snapEnabled: event.target.checked })} /> 스냅</label>
        {settings.snapEnabled && <select title="스냅 간격" value={settings.snapSize} onChange={event => onSettingsChange?.({ ...settings, snapSize: Number(event.target.value) })}>
          <option value={5}>5px</option><option value={10}>10px</option><option value={20}>20px</option>
        </select>}
        <label className="canvas-mini-toggle"><input type="checkbox" checked={settings.showGuides} onChange={event => onSettingsChange?.({ ...settings, showGuides: event.target.checked })} /> 가이드</label>
        <select title="미리보기 해상도" value={settings.previewResolution} onChange={event => onSettingsChange?.({ ...settings, previewResolution: Number(event.target.value) as ComposerSettings['previewResolution'] })}>
          <option value={720}>720</option><option value={960}>960</option><option value={1200}>1200</option>
        </select>
        <select value={settings.performanceMode} onChange={event => onSettingsChange?.({ ...settings, performanceMode: event.target.value as ComposerSettings['performanceMode'] })}>
          <option value="auto">자동 품질</option>
          <option value="quality">고품질</option>
          <option value="performance">성능 우선</option>
        </select>
        <span className={useGpu ? 'gpu-status active' : 'gpu-status'}>{useGpu ? 'GPU' : '2D'}</span>
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
        <div ref={checkerRef} className="checkerboard" style={{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' }}>
          <canvas ref={ref} className={useGpu ? 'preview-canvas hidden' : 'preview-canvas'} width={effectiveResolution} height={effectiveResolution} onClick={sample} />
          <canvas ref={gpuRef} className={useGpu ? 'preview-canvas gpu' : 'preview-canvas gpu hidden'} width={effectiveResolution} height={effectiveResolution} onClick={sample} />

          {settings.showGuides && guide.x !== null && <div className="smart-guide vertical" style={{ left: (50 + guide.x * fitScale / project.width * 100) + '%' }} />}
          {settings.showGuides && guide.y !== null && <div className="smart-guide horizontal" style={{ top: (50 + guide.y * fitScale / project.height * 100) + '%' }} />}

          {(project.mediaLayers ?? []).slice().reverse().filter(layer =>
            layer.visible && timeSec >= layer.startTime && timeSec <= layer.endTime
          ).map(layer => {
            const widthPct = layer.width * layer.scale * fitScale / project.width * 100
            const heightPct = layer.height * layer.scale * fitScale / project.height * 100
            const groupLayers = layer.groupId
              ? (project.mediaLayers ?? []).filter(item => item.groupId === layer.groupId && item.visible)
              : [layer]
            return <button
              key={'hit-' + layer.id}
              type="button"
              className={'canvas-layer-hitbox ' + (selectedMediaIds.includes(layer.id) ? 'selected' : '')}
              style={{
                left: (50 + layer.x * fitScale / project.width * 100 - widthPct / 2) + '%',
                top: (50 + layer.y * fitScale / project.height * 100 - heightPct / 2) + '%',
                width: widthPct + '%',
                height: heightPct + '%',
                transform: 'rotate(' + layer.rotation + 'deg)',
              }}
              title={layer.name}
              onPointerDown={event => {
                if (event.altKey) {
                  event.preventDefault()
                  event.stopPropagation()
                  sampleAt(event.clientX, event.clientY)
                  return
                }
                const additive = event.ctrlKey || event.metaKey || event.shiftKey
                const alreadySelected = selectedMediaIds.includes(layer.id)
                onSelectMedia?.(layer.id, additive)
                if (!additive) beginTransform(event, 'move', alreadySelected ? selectedLayers : groupLayers)
              }}
            />
          })}

          {overlayStyle && (
            <div className={'transform-box ' + (selectedLayers.length > 1 ? 'multi' : 'single')} style={overlayStyle} onPointerDown={event => beginTransform(event, 'move')}>
              <button className="transform-handle nw" type="button" onPointerDown={event => beginTransform(event, 'resize')} />
              <button className="transform-handle ne" type="button" onPointerDown={event => beginTransform(event, 'resize')} />
              <button className="transform-handle sw" type="button" onPointerDown={event => beginTransform(event, 'resize')} />
              <button className="transform-handle se" type="button" onPointerDown={event => beginTransform(event, 'resize')} />
              <button className="transform-rotate-handle" type="button" title="드래그해서 회전" onPointerDown={event => beginTransform(event, 'rotate')}>↻</button>
              {selectedLayers.length > 1 && <span className="transform-count">{selectedLayers.length}</span>}
            </div>
          )}

          {(project.mediaLayers ?? []).filter(layer => selectedMediaIds.includes(layer.id)).map(layer => (
            <button
              key={layer.id}
              type="button"
              className={'canvas-selection-chip ' + (layer.id === primaryMediaId ? 'primary' : '')}
              style={{ left: (50 + layer.x * fitScale / project.width * 100) + '%', top: (50 + layer.y * fitScale / project.height * 100) + '%' }}
              onClick={event => {
                event.stopPropagation()
                onSelectMedia?.(layer.id, event.ctrlKey || event.metaKey || event.shiftKey)
              }}
              title={layer.name}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
