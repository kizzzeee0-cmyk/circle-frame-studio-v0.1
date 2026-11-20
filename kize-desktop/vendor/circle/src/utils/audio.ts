import type { FrameProject, MediaLayer } from '../types'
import { getStoredMediaBlob } from './media'

async function layerBlob(layer: MediaLayer) {
  if (layer.assetId) return await getStoredMediaBlob(layer.assetId)
  if (!layer.sourceUrl) return undefined
  try {
    return await (await fetch(layer.sourceUrl)).blob()
  } catch {
    return undefined
  }
}

export interface ProjectAudioMix {
  stream: MediaStream
  warnings: string[]
  start: () => Promise<void>
  stop: () => void
}

export async function createProjectAudioMix(project: FrameProject, duration: number): Promise<ProjectAudioMix | null> {
  const layers = (project.mediaLayers ?? []).filter(layer =>
    layer.visible &&
    layer.kind === 'video' &&
    layer.audioEnabled &&
    layer.audioVolume > 0 &&
    layer.startTime < duration &&
    layer.endTime > 0,
  )
  if (!layers.length || typeof AudioContext === 'undefined') return null

  const context = new AudioContext()
  const destination = context.createMediaStreamDestination()
  const sources: AudioBufferSourceNode[] = []
  const warnings: string[] = []

  for (const layer of layers) {
    try {
      const blob = await layerBlob(layer)
      if (!blob) {
        warnings.push(layer.name + ': 오디오 원본을 찾지 못했습니다.')
        continue
      }
      const data = await blob.arrayBuffer()
      const buffer = await context.decodeAudioData(data.slice(0))
      const trimStart = Math.max(0, Math.min(buffer.duration - .001, layer.trimStart || 0))
      const trimEnd = layer.trimEnd > trimStart ? Math.min(buffer.duration, layer.trimEnd) : buffer.duration
      const segmentDuration = Math.max(.01, trimEnd - trimStart)
      const activeStart = Math.max(0, layer.startTime)
      const activeEnd = Math.min(duration, layer.endTime)
      if (activeEnd <= activeStart) continue

      const gain = context.createGain()
      gain.gain.value = Math.max(0, Math.min(2, layer.audioVolume))
      gain.connect(destination)

      for (let cursor = activeStart; cursor < activeEnd - .005; cursor += segmentDuration) {
        const playDuration = Math.min(segmentDuration, activeEnd - cursor)
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(gain)
        source.start(context.currentTime + cursor, trimStart, playDuration)
        sources.push(source)
      }
    } catch {
      warnings.push(layer.name + ': 브라우저가 이 영상의 오디오 트랙을 디코딩하지 못했습니다.')
    }
  }

  if (!sources.length) {
    await context.close().catch(() => {})
    return warnings.length ? {
      stream: new MediaStream(),
      warnings,
      start: async () => {},
      stop: () => {},
    } : null
  }

  return {
    stream: destination.stream,
    warnings,
    start: async () => {
      if (context.state !== 'running') await context.resume()
    },
    stop: () => {
      for (const source of sources) {
        try { source.stop() } catch { /* already ended */ }
      }
      void context.close().catch(() => {})
    },
  }
}
