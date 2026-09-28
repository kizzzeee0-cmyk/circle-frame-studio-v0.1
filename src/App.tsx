import { useEffect, useMemo, useRef, useState } from 'react'
import { PRESETS, STYLE_MAP } from './lib/presets'
import { renderRing, exportPng } from './lib/render'
import type { RingPreset, RingState, RingStyle } from './lib/types'

const LOCAL_KEY = 'circle-frame-studio-v018-state'

function makeInitialState(): RingState {
  const p = PRESETS[0]
  return { ...p, rotation: 0 }
}

function loadState(): RingState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return { ...makeInitialState(), ...JSON.parse(raw) }
  } catch {}
  return makeInitialState()
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="control">
      <div className="label-row"><span>{label}</span><b>{value}{suffix}</b></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="control">
      <div className="label-row"><span>{label}</span><b>{value}</b></div>
      <div className="color-row">
        <input type="color" value={value} onChange={e => onChange(e.target.value.toUpperCase())} />
        <input value={value} onChange={e => onChange(e.target.value.toUpperCase())} maxLength={7} />
      </div>
    </label>
  )
}

function PresetCard({ preset, onClick }: { preset: RingPreset; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (ref.current) renderRing(ref.current, { ...preset, rotation: 0 }, 180)
  }, [preset])
  return (
    <button className="preset-card" onClick={onClick}>
      <canvas ref={ref} width={180} height={180} />
      <div className="preset-name">{preset.name}</div>
      <div className="preset-category">{preset.category}</div>
    </button>
  )
}

export default function App() {
  const [ring, setRing] = useState<RingState>(loadState)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [category, setCategory] = useState('전체')

  useEffect(() => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ring))
    if (canvasRef.current) renderRing(canvasRef.current, ring, 900)
  }, [ring])

  const categories = useMemo(() => ['전체', ...Array.from(new Set(PRESETS.map(p => p.category)))], [])
  const filtered = PRESETS.filter(p => category === '전체' || p.category === category)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Circle Frame Studio <span>v0.18</span></h1>
          <p>2색 그라데이션 원형 프레임 · 흰색 + 한 가지색 자연스러운 연결</p>
        </div>
        <button className="primary" onClick={() => exportPng(ring)}>PNG 저장</button>
      </header>

      <main className="layout">
        <aside className="panel left">
          <h2>프리셋</h2>
          <div className="chips">
            {categories.map(item => (
              <button key={item} className={item === category ? 'chip active' : 'chip'} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
          <div className="preset-grid">
            {filtered.map(p => <PresetCard key={p.id} preset={p} onClick={() => setRing(prev => ({ ...prev, ...p }))} />)}
          </div>
        </aside>

        <section className="panel center">
          <h2>미리보기</h2>
          <div className="checkerboard"><canvas ref={canvasRef} width={900} height={900} /></div>
          <p className="helper">저장 시 2000×2000 투명 PNG로 저장됩니다.</p>
        </section>

        <aside className="panel right">
          <h2>설정</h2>
          <label className="control">
            <div className="label-row"><span>스타일</span><b>{STYLE_MAP[ring.style].label}</b></div>
            <select value={ring.style} onChange={e => setRing(prev => ({ ...prev, style: e.target.value as RingStyle }))}>
              {Object.entries(STYLE_MAP).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>

          <ColorField label="메인 색상" value={ring.baseColor} onChange={v => setRing(prev => ({ ...prev, baseColor: v, glowColor: v }))} />
          <ColorField label="화이트 색상" value={ring.whiteColor} onChange={v => setRing(prev => ({ ...prev, whiteColor: v }))} />
          <Slider label="원 크기" value={ring.radius} min={220} max={880} suffix="px" onChange={n => setRing(prev => ({ ...prev, radius: n }))} />
          <Slider label="두께" value={ring.thickness} min={20} max={240} suffix="px" onChange={n => setRing(prev => ({ ...prev, thickness: n }))} />
          <Slider label="회전" value={ring.rotation} min={-180} max={180} suffix="°" onChange={n => setRing(prev => ({ ...prev, rotation: n }))} />
          <Slider label="불투명도" value={ring.opacity} min={0.1} max={1} step={0.01} onChange={n => setRing(prev => ({ ...prev, opacity: n }))} />

          <label className="toggle"><input type="checkbox" checked={ring.glowEnabled} onChange={e => setRing(prev => ({ ...prev, glowEnabled: e.target.checked }))} /><span>Glow 사용</span></label>
          {ring.glowEnabled && <>
            <ColorField label="Glow 색상" value={ring.glowColor} onChange={v => setRing(prev => ({ ...prev, glowColor: v }))} />
            <Slider label="Glow Blur" value={ring.glowBlur} min={0} max={80} suffix="px" onChange={n => setRing(prev => ({ ...prev, glowBlur: n }))} />
            <Slider label="Glow 강도" value={ring.glowStrength} min={0} max={1} step={0.01} onChange={n => setRing(prev => ({ ...prev, glowStrength: n }))} />
          </>}

          <label className="toggle"><input type="checkbox" checked={ring.outlineEnabled} onChange={e => setRing(prev => ({ ...prev, outlineEnabled: e.target.checked }))} /><span>외곽선 사용</span></label>
          {ring.outlineEnabled && <>
            <ColorField label="외곽선 색상" value={ring.outlineColor} onChange={v => setRing(prev => ({ ...prev, outlineColor: v }))} />
            <Slider label="외곽선 두께" value={ring.outlineWidth} min={1} max={16} suffix="px" onChange={n => setRing(prev => ({ ...prev, outlineWidth: n }))} />
          </>}
        </aside>
      </main>
    </div>
  )
}
