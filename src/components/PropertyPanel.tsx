import type { GradientMode, RingLayer } from '../types'
import { PALETTES } from '../presets/palettes'
import { uid } from '../utils/id'

interface Props {
  layer: RingLayer | null
  onChange: (next: RingLayer) => void
  onSavePreset: () => void
}

function hexOkay(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string, value: number, min: number, max: number, step?: number, suffix?: string, onChange: (n: number) => void }) {
  return (
    <label className="control slider-control">
      <span><b>{label}</b><em>{Math.round(value * 100) / 100}{suffix}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  )
}

function ColorField({ label, value, onChange, eyedrop = false }: { label: string, value: string, onChange: (s: string) => void, eyedrop?: boolean }) {
  const pick = async () => {
    const EyeDropperCtor = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropperCtor) {
      alert('이 브라우저는 화면 스포이드를 지원하지 않습니다. Chrome/Edge 최신 버전을 사용하거나 Alt+캔버스 클릭을 이용해 주세요.')
      return
    }
    try {
      const result = await new EyeDropperCtor().open()
      onChange(result.sRGBHex.toUpperCase())
    } catch { /* user cancelled */ }
  }
  return (
    <label className="control color-control">
      <span><b>{label}</b></span>
      <div className="color-row">
        <input type="color" value={hexOkay(value) ? value : '#9389DE'} onChange={e => onChange(e.target.value.toUpperCase())} />
        <input className="hex-input" value={value} onChange={e => { const v = e.target.value; if (v.length <= 7) onChange(v.toUpperCase()) }} />
        {eyedrop && <button type="button" className="tiny-button" onClick={pick} title="화면에서 색상 추출">⌾</button>}
      </div>
    </label>
  )
}

export default function PropertyPanel({ layer, onChange, onSavePreset }: Props) {
  if (!layer) return <aside className="right-panel panel"><div className="empty-state">편집할 레이어를 선택하세요.</div></aside>
  const locked = layer.locked
  const patch = (partial: Partial<RingLayer>) => onChange({ ...layer, ...partial })
  const nestedEffects = (partial: Partial<RingLayer['effects']>) => patch({ effects: { ...layer.effects, ...partial } })
  const nestedPattern = (partial: Partial<RingLayer['pattern']>) => patch({ pattern: { ...layer.pattern, ...partial } })
  const setStop = (id: string, partial: Partial<RingLayer['gradientStops'][number]>) => patch({ gradientStops: layer.gradientStops.map(s => s.id === id ? { ...s, ...partial } : s) })

  const applyPalette = (colors: string[]) => patch({
    color: colors[0],
    secondaryColor: colors[1] ?? colors[0],
    gradientMode: 'conic',
    gradientStops: [
      { id: uid('stop'), position: 0, color: colors[0] },
      { id: uid('stop'), position: .5, color: colors[1] ?? colors[0] },
      { id: uid('stop'), position: 1, color: colors[2] ?? colors[0] },
    ],
  })

  return (
    <aside className="right-panel panel">
      <div className="panel-title-row sticky-head">
        <div><strong>선택 레이어 설정</strong><small>{locked ? '잠금됨' : layer.kind}</small></div>
        <button className="soft-button" onClick={onSavePreset}>내 프리셋 저장</button>
      </div>
      <fieldset disabled={locked}>
        <section className="property-section">
          <h3>기본</h3>
          <label className="control"><span><b>이름</b></span><input value={layer.name} onChange={e => patch({ name: e.target.value })} /></label>
          <Slider label="반지름" value={layer.radius} min={120} max={930} suffix="px" onChange={n => patch({ radius: n })} />
          <Slider label="두께" value={layer.thickness} min={1} max={180} suffix="px" onChange={n => patch({ thickness: n })} />
          <Slider label="회전" value={layer.rotation} min={-180} max={180} suffix="°" onChange={n => patch({ rotation: n })} />
          <Slider label="X 위치" value={layer.offsetX} min={-300} max={300} suffix="px" onChange={n => patch({ offsetX: n })} />
          <Slider label="Y 위치" value={layer.offsetY} min={-300} max={300} suffix="px" onChange={n => patch({ offsetY: n })} />
          <Slider label="불투명도" value={layer.opacity} min={0} max={1} step={.01} onChange={n => patch({ opacity: n })} />
          <p className="hint">가로/세로 배율을 분리하지 않아 어떤 설정에서도 정확한 원형을 유지합니다.</p>
        </section>

        <section className="property-section">
          <h3>색상</h3>
          <ColorField label="기본 색상" value={layer.color} onChange={v => patch({ color: v })} eyedrop />
          <ColorField label="보조 색상" value={layer.secondaryColor} onChange={v => patch({ secondaryColor: v })} />
          <label className="control"><span><b>채우기 방식</b></span>
            <select value={layer.gradientMode} onChange={e => patch({ gradientMode: e.target.value as GradientMode })}>
              <option value="solid">Solid</option><option value="linear">Linear Gradient</option><option value="radial">Radial Gradient</option><option value="conic">Angular / Conic</option>
            </select>
          </label>
          {layer.gradientMode !== 'solid' && <>
            <Slider label="그라데이션 각도" value={layer.gradientAngle} min={-180} max={180} suffix="°" onChange={n => patch({ gradientAngle: n })} />
            <div className="gradient-preview" style={{ background: `linear-gradient(90deg, ${[...layer.gradientStops].sort((a,b)=>a.position-b.position).map(s => `${s.color} ${s.position*100}%`).join(',')})` }} />
            <div className="stops">
              {layer.gradientStops.map(stop => <div className="stop-row" key={stop.id}>
                <input type="color" value={hexOkay(stop.color) ? stop.color : '#9389DE'} onChange={e => setStop(stop.id, { color: e.target.value.toUpperCase() })} />
                <input className="hex-input" value={stop.color} onChange={e => setStop(stop.id, { color: e.target.value.toUpperCase() })} />
                <input type="range" min={0} max={1} step={.01} value={stop.position} onChange={e => setStop(stop.id, { position: Number(e.target.value) })} />
                <span>{Math.round(stop.position * 100)}%</span>
                <button type="button" disabled={layer.gradientStops.length <= 2} onClick={() => patch({ gradientStops: layer.gradientStops.filter(s => s.id !== stop.id) })}>×</button>
              </div>)}
            </div>
            <button className="soft-button full" type="button" disabled={layer.gradientStops.length >= 8} onClick={() => patch({ gradientStops: [...layer.gradientStops, { id: uid('stop'), position: .5, color: layer.secondaryColor }] })}>+ Gradient Stop</button>
          </>}
          <div className="palette-list">
            {PALETTES.map(p => <button type="button" key={p.id} className="palette-card" onClick={() => applyPalette(p.colors)} title={p.name}>
              <span>{p.colors.map(c => <i key={c} style={{ background: c }} />)}</span><small>{p.name}</small>
            </button>)}
          </div>
        </section>

        <section className="property-section">
          <h3>글로우 · 블러 · 그림자</h3>
          <label className="toggle"><input type="checkbox" checked={layer.effects.glowEnabled} onChange={e => nestedEffects({ glowEnabled: e.target.checked })} /><span>Glow 사용</span></label>
          {layer.effects.glowEnabled && <>
            <ColorField label="Glow 색상" value={layer.effects.glowColor} onChange={v => nestedEffects({ glowColor: v })} />
            <Slider label="Glow 크기" value={layer.effects.glowBlur} min={0} max={160} suffix="px" onChange={n => nestedEffects({ glowBlur: n })} />
            <Slider label="Glow 강도" value={layer.effects.glowIntensity} min={0} max={1} step={.01} onChange={n => nestedEffects({ glowIntensity: n })} />
            <Slider label="빛 번짐" value={layer.effects.bloom} min={0} max={100} onChange={n => nestedEffects({ bloom: n })} />
          </>}
          <Slider label="Soft Blur" value={layer.effects.softBlur} min={0} max={40} suffix="px" onChange={n => nestedEffects({ softBlur: n })} />
          <label className="toggle"><input type="checkbox" checked={layer.effects.shadowEnabled} onChange={e => nestedEffects({ shadowEnabled: e.target.checked })} /><span>Shadow 사용</span></label>
          {layer.effects.shadowEnabled && <>
            <ColorField label="그림자 색상" value={layer.effects.shadowColor} onChange={v => nestedEffects({ shadowColor: v })} />
            <Slider label="그림자 블러" value={layer.effects.shadowBlur} min={0} max={120} suffix="px" onChange={n => nestedEffects({ shadowBlur: n })} />
            <Slider label="그림자 X" value={layer.effects.shadowOffsetX} min={-100} max={100} suffix="px" onChange={n => nestedEffects({ shadowOffsetX: n })} />
            <Slider label="그림자 Y" value={layer.effects.shadowOffsetY} min={-100} max={100} suffix="px" onChange={n => nestedEffects({ shadowOffsetY: n })} />
          </>}
        </section>

        <section className="property-section">
          <h3>패턴 세부 설정</h3>
          {['segmented','arc'].includes(layer.kind) && <>
            <Slider label="보이는 조각 길이" value={layer.pattern.dash} min={15} max={900} suffix="px" onChange={n => nestedPattern({ dash: n })} />
            <Slider label="빈 공간 길이" value={layer.pattern.gap} min={5} max={500} suffix="px" onChange={n => nestedPattern({ gap: n })} />
          </>}
          {['scribble','rough','brush'].includes(layer.kind) && <Slider label="거칠기" value={layer.pattern.roughness} min={0} max={60} onChange={n => nestedPattern({ roughness: n })} />}
          {['scribble','rough'].includes(layer.kind) && <Slider label="겹쳐 그리기" value={layer.pattern.strokeCount} min={1} max={9} onChange={n => nestedPattern({ strokeCount: Math.round(n) })} />}
          {['wavy','scallop'].includes(layer.kind) && <>
            <Slider label="물결 높이" value={layer.pattern.waveAmplitude} min={0} max={80} suffix="px" onChange={n => nestedPattern({ waveAmplitude: n })} />
            <Slider label="물결 개수" value={layer.pattern.waveCount} min={3} max={48} onChange={n => nestedPattern({ waveCount: Math.round(n) })} />
          </>}
          {['dotted','sparkle','star','heart'].includes(layer.kind) && <>
            <Slider label="장식 개수" value={layer.pattern.decorationCount} min={3} max={120} onChange={n => nestedPattern({ decorationCount: Math.round(n) })} />
            <Slider label="장식 크기" value={layer.pattern.decorationSize} min={3} max={90} suffix="px" onChange={n => nestedPattern({ decorationSize: n })} />
          </>}
          {layer.kind === 'brush' && <>
            <Slider label="브러시 조각 길이" value={layer.pattern.dash} min={15} max={180} suffix="px" onChange={n => nestedPattern({ dash: n })} />
            <Slider label="브러시 간격" value={layer.pattern.gap} min={2} max={80} suffix="px" onChange={n => nestedPattern({ gap: n })} />
          </>}
          <Slider label="랜덤 Seed" value={layer.pattern.seed} min={1} max={9999} onChange={n => nestedPattern({ seed: Math.round(n) })} />
        </section>
      </fieldset>
    </aside>
  )
}
