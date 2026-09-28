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
    const run = async () => {
      if (!ref.current) return
      await preloadProjectAssets(project)
      if (cancelled || !ref.current) return
      renderProject(ref.current, project)
    }
    run()
    return () => { cancelled = true }
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
        <span>미리보기 = PNG 출력 1:1 렌더 기준</span>
      </div>
      <div className="checkerboard">
        <canvas ref={ref} width={2000} height={2000} onClick={sample} />
      </div>
    </div>
  )
}
