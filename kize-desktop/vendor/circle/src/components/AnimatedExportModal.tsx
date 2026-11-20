import { useEffect, useMemo, useRef, useState } from 'react'
import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from '../utils/assets'
import { preloadProjectMedia, syncProjectMediaPreview } from '../utils/media'
import {
  estimateAnimatedRawMemory,
  exportAnimatedFrame,
  getAnimatedFrameCount,
  isRealtimeVideoFormatSupported,
  isVideoFormatSupported,
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
  videoBitrateMbps: 12,
  includeAudio: true,
}

function mb(bytes: number) {
  return bytes / 1024 / 1024
}

function hasAnimatedLayer(project: FrameProject) {
  const designs = project.layers?.length
    ? project.layers.filter(layer => layer.visible !== false).map(layer => layer.design)
    : [project.design]
  const frameMotion = designs.some(design =>
    (design.kind === 'glitter' && design.glitter.animated) ||
    design.rotationAnimation.enabled
  )
  const mediaMotion = (project.mediaLayers ?? []).some(layer =>
    layer.visible && (
      layer.kind === 'video' ||
      layer.animation.intro !== 'none' ||
      layer.animation.outro !== 'none' ||
      layer.animation.continuous !== 'none'
    )
  )
  return frameMotion || mediaMotion || project.background?.type === 'video'
}

export default function AnimatedExportModal({ open, project, onClose, onExported }: Props) {
  const [options, setOptions] = useState<AnimatedExportOptions>(DEFAULT_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<AnimatedExportProgress | null>(null)
  const [error, setError] = useState('')
  const previewRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const frames = getAnimatedFrameCount(options)
  const rawMb = mb(estimateAnimatedRawMemory(options))
  const videoFormat = options.format === 'webm' || options.format === 'mp4'
  const movFormat = options.format === 'mov'
  const memoryHeavy = !['gif','webm','mp4','mov'].includes(options.format) && rawMb > 320
  const movHeavy = movFormat && rawMb > 1600
  const animated = hasAnimatedLayer(project)
  const glitterLoopDuration = (project.layers ?? [])
    .filter(layer => layer.visible && layer.design.kind === 'glitter' && layer.design.glitter.surfaceStyle !== 'legacy')
    .map(layer => Math.max(.5, Number(layer.design.glitter.loopDuration || project.timeline?.duration || 3)))[0] ?? 0
  const loopRatio = glitterLoopDuration > 0 ? options.duration / glitterLoopDuration : 1
  const loopMismatch = glitterLoopDuration > 0 && Math.abs(loopRatio - Math.round(loopRatio)) > .001
  const estimatedVideoMb = videoFormat ? ((options.videoBitrateMbps ?? 12) * options.duration / 8) : 0
  const audioLayers = (project.mediaLayers ?? []).filter(layer => layer.kind === 'video' && layer.visible && layer.audioEnabled && layer.audioVolume > 0).length
  const needsRealtimeAudio = videoFormat && options.includeAudio !== false && audioLayers > 0
  const videoSupported = options.format === 'webm'
    ? (needsRealtimeAudio ? isRealtimeVideoFormatSupported('webm') : isVideoFormatSupported('webm'))
    : options.format === 'mp4'
      ? (needsRealtimeAudio ? isRealtimeVideoFormatSupported('mp4') : isVideoFormatSupported('mp4'))
      : true

  useEffect(() => {
    if (!open) return
    setOptions(prev => ({ ...prev, duration: Math.max(.5, Math.min(30, project.timeline?.duration ?? prev.duration)) }))
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let raf = 0
    let start = performance.now()

    const run = async () => {
      await Promise.all([preloadProjectAssets(project), preloadProjectMedia(project)])
      if (cancelled || !previewRef.current) return
      const tick = (time: number) => {
        if (cancelled || !previewRef.current) return
        const durationMs = options.duration * 1000
        const cycle = ((time - start) % durationMs) / durationMs
        syncProjectMediaPreview(project, cycle * options.duration, true)
        renderProject(previewRef.current, project, undefined, cycle * durationMs, cycle)
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
    const duration = Math.max(.5, Math.min(30, project.timeline?.duration ?? options.duration))
    if (name === '부드러운 글리터') setOptions(prev => ({ ...prev, fps: 20, duration, webpQuality: 88 }))
    if (name === '화려한 반짝임') setOptions(prev => ({ ...prev, fps: 30, duration, webpQuality: 90 }))
    if (name === '잔잔한 쉬머') setOptions(prev => ({ ...prev, fps: 20, duration, webpQuality: 88 }))
    if (name === '빠른 스파클') setOptions(prev => ({ ...prev, fps: 30, duration, webpQuality: 86 }))
  }

  const applyExportPreset = (name: string) => {
    const duration = Math.max(.5, Math.min(30, project.timeline?.duration ?? options.duration))
    if (name === '프로필 WebP') setOptions(prev => ({ ...prev, format: 'webp', resolution: 500, fps: 20, duration, webpQuality: 90, includeAudio: false }))
    if (name === '투명 MOV') setOptions(prev => ({ ...prev, format: 'mov', resolution: 1000, fps: 30, duration, includeAudio: false }))
    if (name === '방송 MP4') setOptions(prev => ({ ...prev, format: 'mp4', resolution: 2000, fps: 30, duration, videoBitrateMbps: 28, includeAudio: true }))
    if (name === '고품질 WebM') setOptions(prev => ({ ...prev, format: 'webm', resolution: 1000, fps: 30, duration, videoBitrateMbps: 18, includeAudio: false }))
  }

  const startExport = async () => {
    if (memoryHeavy || movHeavy || !videoSupported) return
    setBusy(true)
    setError('')
    setProgress({ stage: 'render', current: 0, total: frames, message: '내보내기 준비 중' })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await exportAnimatedFrame(project, options, setProgress, controller.signal)
      onExported?.()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProgress(null)
        setError('내보내기를 취소했습니다.')
      } else {
        setError(err instanceof Error ? err.message : '움직이는 파일을 저장하지 못했습니다.')
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  const progressPercent = progress
    ? progress.stage === 'done'
      ? 100
      : Math.round((progress.current / Math.max(1, progress.total)) * (progress.stage === 'encode' ? 90 : 82))
    : 0

  const formatName = options.format === 'webp' ? 'Animated WebP' : options.format === 'apng' ? 'APNG' : options.format === 'gif' ? 'GIF' : options.format === 'webm' ? 'WebM' : options.format === 'mov' ? 'Alpha MOV' : 'MP4'

  return (
    <div className="animated-export-backdrop" onMouseDown={event => {
      if (event.currentTarget === event.target && !busy) onClose()
    }}>
      <section className="animated-export-modal" role="dialog" aria-modal="true" aria-label="움직이는 파일 내보내기">
        <div className="animated-export-header">
          <div>
            <h2>움직이는 파일 내보내기</h2>
            <p>프레임·글리터·사진·영상·PNG 애니메이션과 오디오까지 현재 타임라인 그대로 합성합니다.</p>
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

            {!animated && <div className="animated-warning">현재 프로젝트에 영상·프레임 회전·글리터·PNG 애니메이션이 없습니다. 움직이는 형식으로 저장해도 정적인 결과가 반복될 수 있습니다.</div>}

            <div className="animated-format-note">
              {options.format === 'gif' && <>GIF는 호환성이 가장 좋지만 <b>256색 + 1bit 투명도</b>라 반투명 글로우가 단순화될 수 있습니다.</>}
              {options.format === 'webp' && <>Animated WebP는 <b>투명 배경과 부드러운 색상</b>을 유지하면서 용량도 비교적 작아 기본 추천입니다.</>}
              {options.format === 'apng' && <>APNG는 <b>반투명 글로우를 무손실</b>로 가장 잘 보존하지만 파일 용량이 커질 수 있습니다.</>}
              {options.format === 'webm' && <>{needsRealtimeAudio ? <>WebM + 오디오는 브라우저 MediaRecorder로 실시간 합성합니다.</> : <>WebM은 WebCodecs 오프라인 프레임 인코딩을 우선 사용하며 <b>VP9 알파를 유지</b>하도록 출력합니다.</>} 지원 환경에 따라 코덱 사용 가능 여부가 달라질 수 있습니다.</>}
              {options.format === 'mp4' && <>{needsRealtimeAudio ? <>MP4 + 오디오는 H.264 MediaRecorder 지원 환경에서 실시간 합성합니다.</> : <>MP4는 WebCodecs 오프라인 프레임 인코딩을 우선 사용해 타임스탬프를 정확히 맞춥니다.</>} MP4는 알파 투명을 지원하지 않습니다.</>}
              {options.format === 'mov' && <>Alpha MOV는 각 프레임을 <b>투명 PNG로 보존한 QuickTime MOV</b>입니다. 파일은 크지만 반투명 글로우와 알파 가장자리를 정확하게 유지합니다.</>}
            </div>
          </div>

          <div className="animated-export-controls">
            <div className="animated-export-preset-row">
              {['프로필 WebP','투명 MOV','방송 MP4','고품질 WebM'].map(name =>
                <button key={name} type="button" disabled={busy} onClick={() => applyExportPreset(name)}>{name}</button>
              )}
            </div>
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
                <option value="webm">WebM · 영상 합성</option>
                <option value="mp4">MP4 · 브라우저 지원 시</option>
                <option value="mov">Alpha MOV · 투명 고품질</option>
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
                {[12,15,20,24,30,60].map(value => <option key={value} value={value}>{value} fps</option>)}
              </select>
            </label>

            <label className="control"><span><b>출력 길이</b><em>{options.duration}s</em></span>
              <input disabled={busy} type="number" min={.5} max={30} step={.1} value={options.duration} onChange={event => set('duration', Math.max(.5, Math.min(30, Number(event.target.value) || .5)))} />
            </label>
            {loopMismatch && <p className="hint">현재 출력 길이는 글리터 반복 길이 {glitterLoopDuration.toFixed(1)}s의 정수 배수가 아니어서 반복 경계가 어색할 수 있습니다. 자연스러운 무한 루프는 {glitterLoopDuration.toFixed(1)}s 또는 그 정수 배수로 출력해 주세요.</p>}

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
            {options.format !== 'gif' && !videoFormat && !movFormat && <p className="animated-small-note">Animated WebP와 APNG는 현재 무한 반복으로 저장됩니다.</p>}

            {options.format === 'webp' && <label className="control">
              <span><b>WebP 품질</b><em>{options.webpQuality}%</em></span>
              <input disabled={busy} type="range" min={50} max={100} value={options.webpQuality} onChange={e => set('webpQuality', Number(e.target.value))} />
            </label>}

            {videoFormat && <label className="control">
              <span><b>영상 비트레이트</b><em>{options.videoBitrateMbps ?? 12} Mbps</em></span>
              <input disabled={busy} type="range" min={2} max={50} step={1} value={options.videoBitrateMbps ?? 12} onChange={e => set('videoBitrateMbps', Number(e.target.value))} />
            </label>}

            {videoFormat && <label className="toggle export-audio-toggle">
              <input type="checkbox" disabled={busy || audioLayers === 0} checked={options.includeAudio !== false} onChange={e => set('includeAudio', e.target.checked)} />
              <span>영상 레이어 오디오 함께 출력 {audioLayers > 0 ? '(' + audioLayers + '개)' : '· 오디오 레이어 없음'}</span>
            </label>}
            {videoFormat && <p className="animated-small-note">{needsRealtimeAudio ? '오디오 포함 모드: 실시간 합성 경로 · PC 성능에 따라 프레임 기록이 달라질 수 있습니다.' : '오디오 없음 모드: WebCodecs 오프라인 인코딩을 우선 사용해 정확한 프레임 타이밍을 유지합니다.'}</p>}

            {videoFormat && !videoSupported && <div className="animated-error">
              현재 브라우저에서 이 영상 코덱을 지원하지 않습니다. WebM/MP4 중 지원되는 형식을 선택하거나 APNG/Animated WebP를 사용해 주세요.
            </div>}

            <div className={'animated-memory ' + (memoryHeavy ? 'danger' : '')}>
              <span>{videoFormat ? '예상 영상 파일 크기' : movFormat ? 'MOV 처리 기준 원본량' : '프레임 원본 메모리 예상'}</span>
              <strong>{videoFormat ? '약 ' + estimatedVideoMb.toFixed(1) + ' MB' : '약 ' + rawMb.toFixed(0) + ' MB'}</strong>
            </div>
            {videoFormat && <p className="animated-small-note">영상은 전체 RGBA 프레임을 한꺼번에 메모리에 적재하지 않고 브라우저 MediaRecorder로 순차 인코딩합니다. 실제 파일 크기는 장면 복잡도와 브라우저 인코더에 따라 달라질 수 있습니다.</p>}
            {memoryHeavy && <div className="animated-warning">이 조합은 브라우저 메모리 사용량이 너무 큽니다. 해상도·FPS·길이를 낮추거나 GIF를 선택해 주세요.</div>}
            {movHeavy && <div className="animated-warning">Alpha MOV는 PNG 프레임을 보존하므로 이 설정에서는 메모리/파일 크기가 지나치게 커질 수 있습니다. 해상도·FPS·길이를 낮춰 주세요.</div>}

            {progress && <div className="animated-progress">
              <div><i style={{ width: String(progressPercent) + '%' }} /></div>
              <span>{progress.message}</span>
            </div>}
            {error && <div className="animated-error">{error}</div>}

            {busy ? (
              <button className="animated-export-cancel" type="button" onClick={() => abortRef.current?.abort()}>내보내기 취소</button>
            ) : (
              <button className="primary-button animated-export-submit" type="button" disabled={memoryHeavy || movHeavy || !videoSupported} onClick={() => void startExport()}>
                {formatName + '로 저장'}
              </button>
            )}

            <p className="animated-loop-note">내보내기는 0→1의 정확한 순환 좌표를 사용해 마지막 프레임 다음에 첫 프레임이 자연스럽게 이어집니다.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
