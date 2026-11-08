import { useEffect, useRef, type MouseEvent } from 'react'
import type { FrameProject } from '../types'
import { renderProject } from '../render/renderer'
import { preloadProjectAssets } from '../utils/assets'

interface Props {
  project: FrameProject
  onSampleColor?: (hex: string) => void
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export default function CanvasPanel({ project, onSampleColor }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    let frame = 0

    const hasAnimatedGlitter = () => {
      const layers = Array.isArray(project.layers) && project.layers.length
        ? project.layers.filter(layer => layer.visible !== false).map(layer => layer.design)
        : [project.design]
      return layers.some(design => design.kind === 'glitter' && design.glitter.animated)
    }

    const run = async () => {
      if (!ref.current) return
      await preloadProjectAssets(project)
      if (cancelled || !ref.current) return

      if (!hasAnimatedGlitter()) {
        renderProject(ref.current, project)
        return
      }

      const tick = (time: number) => {
        if (cancelled || !ref.current) return
        renderProject(ref.current, project, undefined, time)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    void run()
    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
    }
  }, [project])

  const sample = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!e.altKey || !onSampleColor || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * (ref.current.width / rect.width))
    const y = Math.floor((e.clientY - rect.top) * (ref.current.height / rect.height))
    const data = ref.current.getContext('2d')?.getImageData(x, y, 1, 1).data
    if (data && data[3] > 0) onSampleColor(rgbToHex(data[0], data[1], data[2]))
  }

  return (
    <div className="canvas-stage">
      <div className="canvas-meta">
        <span>2000 × 2000 PNG</span>
        <span>Alt + 클릭: 캔버스 스포이드</span>
        <span>글리터는 부드러운 실시간 미리보기 · PNG는 2000×2000 한 프레임 저장</span>
      </div>
      <div className="checkerboard">
        <canvas ref={ref} width={1200} height={1200} onClick={sample} />
      </div>
    </div>
  )
}
