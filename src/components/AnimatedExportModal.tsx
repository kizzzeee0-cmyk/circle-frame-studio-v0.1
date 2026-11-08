import { useEffect, useMemo, useRef, useState } from 'react'
import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from '../utils/assets'
import {
  estimateAnimatedRawMemory,
  exportAnimatedFrame,
  getAnimatedFrameCount,
  type AnimatedExportFormat,
  type AnimatedExportOptions,
  type AnimatedExportProgress,
  type AnimatedLoopCount,
} from '../utils/export'

interface Props {
  open: boolean
  project: FrameProject
  onClose: () => void
  onExported?: () => void
}

const DEFAULT_OPTIONS: AnimatedExportOptions = {
  format: 'webp',
  resolution: 1000,
  fps: 20,
  duration: 2,
  loopCount: 0,
  webpQuality: 88,
}

function mb(bytes: number) {
  return bytes / 1024 / 1024
}

function hasAnimatedLayer(project: FrameProject) {
  const designs = project.layers?.length
    ? project.layers.filter(layer => layer.visible !== false).map(layer => layer.design)
    : [project.design]
  return designs.some(design => design.kind === 'glitter' && design.glitter.animated)
}

export default function AnimatedExportModal({ open, project, onClose, onExported }: Props) {
  const [options, setOptions] = useState<AnimatedExportOptions>(DEFAULT_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<AnimatedExportProgress | null>(null)
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLCanvasElement>(null)

  const frames = getAnimatedFrameCount(options)
  const rawMb = mb(estimateAnimatedRawMemory(options))
  const memoryHeavy = options.format !== 'gif' && rawMb > 320
  const animated = hasAnimatedLayer(project)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let raf = 0
    let start = performance.now()

    const run = async () => {
      await preloadProjectAssets(project)
      if (cancelled || !previewRef.current) return
      const tick = (time: number) => {
        if (cancelled || !previewRef.current) return
        const durationMs = options.duration * 1000
        const cycle = ((time - start) % durationMs) / durationMs
        renderProject(previewRef.current, project, undefined, 0, cycle)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    void run()
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open, project, options.duration])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  const presetLabel = useMemo(() => {
    if (options.duration >= 2.8) return '잔잔한 쉬머'
    if (options.duration <= 1.1) return '빠른 스파클'
    if (options.fps >= 24) return '화려한 반짝임'
    return '부드러운 글리터'
  }, [options.duration, options.fps])

  if (!open) return null

  const set = <K extends keyof AnimatedExportOptions>(key: K, value: AnimatedExportOptions[K]) =>
    setOptions(prev => ({ ...prev, [key]: value }))

  const applyPreset = (name: string) => {
    if (name === '부드러운 글리터') setOptions(prev => ({ ...prev, fps: 20, duration: 2.4, webpQuality: 88 }))
    if (name === '화려한 반짝임') setOptions(prev => ({ ...prev, fps: 24, duration: 1.5, webpQuality: 90 }))
    if (name === '잔잔한 쉬머') setOptions(prev => ({ ...prev, fps: 20, duration: 3, webpQuality: 88 }))
    if (name === '빠른 스파클') setOptions(prev => ({ ...prev, fps: 24, duration: 1, webpQuality: 86 }))
  }

  const startExport = async () => {
    if (memoryHeavy) return
    setBusy(true)
    setError('')
    setProgress({ stage: 'render', current: 0, total: frames, message: '내보내기 준비 중' })
    try {
      await exportAnimatedFrame(project, options, setProgress)
      onExported?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '움직이는 파일을 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const progressPercent = progress
    ? progress.stage === 'done'
      ? 100
      : Math.round((progress.current / Math.max(1, progress.total)) * (progress.stage === 'encode' ? 90 : 82))
    : 0

  const formatName = options.format === 'webp' ? 'Animated WebP' : options.format === 'apng' ? 'APNG' : 'GIF'

  return (
    <div className="animated-export-backdrop" onMouseDown={event => {
      if (event.currentTarget === event.target && !busy) onClose()
    }}>
      <section className="animated-export-modal" role="dialog" aria-modal="true" aria-label="움직이는 파일 내보내기">
        <div className="animated-export-header">
          <div>
            <h2>움직이는 파일 내보내기</h2>
            <p>현재 글리터 움직임을 투명 애니메이션 파일로 저장합니다.</p>
          </div>
          <button type="button" className="recent-close" disabled={busy} onClick={onClose}>×</button>
        </div>

        <div className="animated-export-body">
          <div className="animated-preview-column">
            <div className="animated-preview-checker">
              <canvas ref={previewRef} width={420} height={420} />
            </div>
            <div className="animated-preview-badges">
              <span>{options.resolution}×{options.resolution}</span>
              <span>{options.fps}fps</span>
              <span>{options.duration}초</span>
              <span>{frames}프레임</span>
            </div>

            {!animated && <div className="animated-warning">현재 프로젝트에 ON 상태의 애니메이션 글리터가 없습니다. 파일은 저장되지만 움직임이 거의 없을 수 있습니다.</div>}

            <div className="animated-format-note">
              {options.format === 'gif' && <>GIF는 호환성이 가장 좋지만 <b>256색 + 1bit 투명도</b>라 반투명 글로우가 단순화될 수 있습니다.</>}
              {options.format === 'webp' && <>Animated WebP는 <b>투명 배경과 부드러운 색상</b>을 유지하면서 용량도 비교적 작아 기본 추천입니다.</>}
              {options.format === 'apng' && <>APNG는 <b>반투명 글로우를 무손실</b>로 가장 잘 보존하지만 파일 용량이 커질 수 있습니다.</>}
            </div>
          </div>

          <div className="animated-export-controls">
            <div className="animated-preset-row">
              {['부드러운 글리터','화려한 반짝임','잔잔한 쉬머','빠른 스파클'].map(name =>
                <button key={name} type="button" className={presetLabel === name ? 'active' : ''} disabled={busy} onClick={() => applyPreset(name)}>{name}</button>
              )}
            </div>

            <label className="control"><span><b>파일 형식</b></span>
              <select disabled={busy} value={options.format} onChange={e => set('format', e.target.value as AnimatedExportFormat)}>
                <option value="webp">Animated WebP · 추천</option>
                <option value="apng">APNG · 고화질 투명</option>
                <option value="gif">GIF · 호환성</option>
              </select>
            </label>

            <label className="control"><span><b>해상도</b></span>
              <select disabled={busy} value={options.resolution} onChange={e => set('resolution', Number(e.target.value) as AnimatedExportOptions['resolution'])}>
                <option value={500}>500 × 500 · 가벼움</option>
                <option value={1000}>1000 × 1000 · 추천</option>
                <option value={2000}>2000 × 2000 · 고화질</option>
              </select>
            </label>

            <label className="control"><span><b>FPS</b></span>
              <select disabled={busy} value={options.fps} onChange={e => set('fps', Number(e.target.value) as AnimatedExportOptions['fps'])}>
                {[12,15,20,24,30].map(value => <option key={value} value={value}>{value} fps</option>)}
              </select>
            </label>

            <label className="control"><span><b>한 바퀴 루프 길이</b></span>
              <select disabled={busy} value={options.duration} onChange={e => set('duration', Number(e.target.value) as AnimatedExportOptions['duration'])}>
                {[1,1.5,2,2.4,3,4].map(value => <option key={value} value={value}>{value}초</option>)}
              </select>
            </label>

            <label className="control"><span><b>반복</b></span>
              <select
                disabled={busy || options.format !== 'gif'}
                value={options.format === 'gif' ? options.loopCount : 0}
                onChange={e => set('loopCount', Number(e.target.value) as AnimatedLoopCount)}
              >
                <option value={0}>무한 반복</option>
                <option value={1}>1회</option>
                <option value={2}>2회</option>
              </select>
            </label>
            {options.format !== 'gif' && <p className="animated-small-note">Animated WebP와 APNG는 현재 무한 반복으로 저장됩니다.</p>}

            {options.format === 'webp' && <label className="control">
              <span><b>WebP 품질</b><em>{options.webpQuality}%</em></span>
              <input disabled={busy} type="range" min={50} max={100} value={options.webpQuality} onChange={e => set('webpQuality', Number(e.target.value))} />
            </label>}

            <div className={'animated-memory ' + (memoryHeavy ? 'danger' : '')}>
              <span>프레임 원본 메모리 예상</span>
              <strong>약 {rawMb.toFixed(0)} MB</strong>
            </div>
            {memoryHeavy && <div className="animated-warning">이 조합은 브라우저 메모리 사용량이 너무 큽니다. 해상도·FPS·길이를 낮추거나 GIF를 선택해 주세요.</div>}

            {progress && <div className="animated-progress">
              <div><i style={{ width: String(progressPercent) + '%' }} /></div>
              <span>{progress.message}</span>
            </div>}
            {error && <div className="animated-error">{error}</div>}

            <button className="primary-button animated-export-submit" type="button" disabled={busy || memoryHeavy} onClick={() => void startExport()}>
              {busy ? '파일 생성 중…' : formatName + '로 저장'}
            </button>

            <p className="animated-loop-note">내보내기는 0→1의 정확한 순환 좌표를 사용해 마지막 프레임 다음에 첫 프레임이 자연스럽게 이어집니다.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
