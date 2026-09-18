import type { FrameDesign, GradientMode } from '../types'
import { PALETTES } from '../presets/palettes'
import { uid } from '../utils/id'

interface Props {
  design: FrameDesign
  onChange: (next: FrameDesign) => void
  onSavePreset: () => void
  onUploadAsset: (file?: File) => void
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
      alert('화면 스포이드는 Chrome/Edge 최신 버전에서 사용할 수 있습니다. 또는 Alt+캔버스 클릭을 사용해 주세요.')
      return
    }
    try {
      const result = await new EyeDropperCtor().open()
      onChange(result.sRGBHex.toUpperCase())
    } catch {
      /* cancelled */
    }
  }
  return (
    <label className="control color-control">
      <span><b>{label}</b></span>
      <div className="color-row">
        <input type="color" value={hexOkay(value) ? value : '#9389DE'} onChange={e => onChange(e.target.value.toUpperCase())} />
        <input className="hex-input" value={value} onChange={e => { const v = e.target.value; if (v.length <= 7) onChange(v.toUpperCase()) }} />
        {eyedrop && <button type="button" className="tiny-button" onClick={pick}>⌾</button>}
      </div>
    </label>
  )
}

export default function PropertyPanel({ design, onChange, onSavePreset, onUploadAsset }: Props) {
  const patch = (partial: Partial<FrameDesign>) => onChange({ ...design, ...partial })
  const nestedEffects = (partial: Partial<FrameDesign['effects']>) => patch({ effects: { ...design.effects, ...partial } })
  const nestedPattern = (partial: Partial<FrameDesign['pattern']>) => patch({ pattern: { ...design.pattern, ...partial } })
  const setStop = (id: string, partial: Partial<FrameDesign['gradientStops'][number]>) => patch({ gradientStops: design.gradientStops.map(s => s.id === id ? { ...s, ...partial } : s) })

  const setPatternColor = (index: number, value: string) => {
    const next = [...design.pattern.paletteColors] as [string, string, string, string]
    next[index] = value
    nestedPattern({ paletteColors: next })
  }

  const applyPalette = (colors: string[]) => {
    const four: [string, string, string, string] = [
      colors[0],
      colors[1] ?? colors[0],
      colors[2] ?? colors[0],
      colors[3] ?? colors[1] ?? colors[0],
    ]
    patch({
      color: colors[0],
      secondaryColor: colors[1] ?? colors[0],
      gradientMode: 'conic',
      gradientStops: [
        { id: uid('stop'), position: 0, color: four[0] },
        { id: uid('stop'), position: .35, color: four[1] },
        { id: uid('stop'), position: .7, color: four[2] },
        { id: uid('stop'), position: 1, color: four[3] },
      ],
      pattern: { ...design.pattern, paletteColors: four, colorCount: ['dotted','sparkle','star','heart','ribbon','flower','asset'].includes(design.kind) ? 4 : design.pattern.colorCount },
    })
  }

  const decorationKinds = ['dotted','sparkle','star','heart','ribbon','flower','asset']
  const isDecoration = decorationKinds.includes(design.kind)

  return (
    <aside className="right-panel panel">
      <div className="panel-title-row sticky-head">
        <div><strong>현재 프레임 설정</strong><small>{design.kind}</small></div>
        <button className="soft-button" onClick={onSavePreset}>내 프리셋 저장</button>
      </div>

      <section className="property-section">
        <h3>기본</h3>
        <label className="control"><span><b>이름</b></span><input value={design.name} onChange={e => patch({ name: e.target.value })} /></label>
        <label className="control"><span><b>프레임 종류</b></span>
          <select value={design.kind} onChange={e => patch({ kind: e.target.value as FrameDesign['kind'] })}>
            <option value="basic">Basic Ring</option><option value="double">Double Ring</option><option value="triple">Triple Ring</option>
            <option value="segmented">Broken / Segmented</option><option value="arc">Arc</option><option value="dotted">Dotted</option>
            <option value="wavy">Wavy</option><option value="scallop">Scallop</option><option value="scribble">Scribble</option>
            <option value="rough">Rough</option><option value="brush">Brush</option><option value="sparkle">Sparkle</option>
            <option value="star">Star</option><option value="heart">Heart</option><option value="ribbon">Ribbon</option>
            <option value="flower">Flower</option><option value="asset">내 PNG 반복 프레임</option><option value="glossy">Glossy</option>
          </select>
        </label>
        <Slider label="원 크기" value={design.radius} min={120} max={930} suffix="px" onChange={n => patch({ radius: n })} />
        <Slider label="선 두께" value={design.thickness} min={1} max={180} suffix="px" onChange={n => patch({ thickness: n })} />
        <Slider label="전체 회전" value={design.rotation} min={-180} max={180} suffix="°" onChange={n => patch({ rotation: n })} />
        <Slider label="X 위치" value={design.offsetX} min={-300} max={300} suffix="px" onChange={n => patch({ offsetX: n })} />
        <Slider label="Y 위치" value={design.offsetY} min={-300} max={300} suffix="px" onChange={n => patch({ offsetY: n })} />
        <Slider label="불투명도" value={design.opacity} min={0} max={1} step={.01} onChange={n => patch({ opacity: n })} />
      </section>

      {isDecoration ? (
        <section className="property-section pattern-color-section">
          <h3>패턴 색상 · 1/2/3/4색 반복</h3>
          {design.kind === 'asset' && (
            <label className="control"><span><b>업로드 PNG 색상 방식</b></span>
              <select value={design.pattern.assetTintMode} onChange={e => nestedPattern({ assetTintMode: e.target.value as 'original' | 'palette' })}>
                <option value="original">원본 이미지 색상 유지</option>
                <option value="palette">투명 모양만 사용해 팔레트 색상 적용</option>
              </select>
            </label>
          )}
          {(design.kind !== 'asset' || design.pattern.assetTintMode === 'palette') && <>
            <div className="color-count-buttons four-up">
              {[1,2,3,4].map(n => <button key={n} type="button" className={design.pattern.colorCount === n ? 'active' : ''} onClick={() => nestedPattern({ colorCount: n as 1|2|3|4 })}>{n}색</button>)}
            </div>
            <ColorField label="색상 1" value={design.pattern.paletteColors[0]} onChange={v => setPatternColor(0, v)} eyedrop />
            {design.pattern.colorCount >= 2 && <ColorField label="색상 2" value={design.pattern.paletteColors[1]} onChange={v => setPatternColor(1, v)} />}
            {design.pattern.colorCount >= 3 && <ColorField label="색상 3" value={design.pattern.paletteColors[2]} onChange={v => setPatternColor(2, v)} />}
            {design.pattern.colorCount >= 4 && <ColorField label="색상 4" value={design.pattern.paletteColors[3]} onChange={v => setPatternColor(3, v)} />}
            <div className="pattern-sequence-preview">
              {Array.from({length: 16}, (_, i) => <i key={i} style={{background: design.pattern.paletteColors[i % design.pattern.colorCount]}} />)}
            </div>
          </>}
          <p className="hint">하트·리본·꽃·도트·업로드 PNG 프레임에 4가지 색상을 순서대로 반복 적용할 수 있습니다.</p>
        </section>
      ) : (
        <section className="property-section">
          <h3>선 색상 · 그라데이션</h3>
          <ColorField label="기본 색상" value={design.color} onChange={v => patch({ color: v })} eyedrop />
          <ColorField label="보조 색상" value={design.secondaryColor} onChange={v => patch({ secondaryColor: v })} />
          <label className="control"><span><b>채우기 방식</b></span>
            <select value={design.gradientMode} onChange={e => patch({ gradientMode: e.target.value as GradientMode })}>
              <option value="solid">Solid</option><option value="linear">Linear Gradient</option><option value="radial">Radial Gradient</option><option value="conic">Angular / Conic</option>
            </select>
          </label>
          {design.gradientMode !== 'solid' && <>
            <Slider label="그라데이션 각도" value={design.gradientAngle} min={-180} max={180} suffix="°" onChange={n => patch({ gradientAngle: n })} />
            <div className="gradient-preview" style={{ background: `linear-gradient(90deg, ${[...design.gradientStops].sort((a,b)=>a.position-b.position).map(s => `${s.color} ${s.position*100}%`).join(',')})` }} />
            <div className="stops">
              {design.gradientStops.map(stop => <div className="stop-row" key={stop.id}>
                <input type="color" value={hexOkay(stop.color) ? stop.color : '#9389DE'} onChange={e => setStop(stop.id, { color: e.target.value.toUpperCase() })} />
                <input className="hex-input" value={stop.color} onChange={e => setStop(stop.id, { color: e.target.value.toUpperCase() })} />
                <input type="range" min={0} max={1} step={.01} value={stop.position} onChange={e => setStop(stop.id, { position: Number(e.target.value) })} />
                <span>{Math.round(stop.position * 100)}%</span>
                <button type="button" disabled={design.gradientStops.length <= 2} onClick={() => patch({ gradientStops: design.gradientStops.filter(s => s.id !== stop.id) })}>×</button>
              </div>)}
            </div>
            <button className="soft-button full" type="button" disabled={design.gradientStops.length >= 8} onClick={() => patch({ gradientStops: [...design.gradientStops, { id: uid('stop'), position: .5, color: design.secondaryColor }] })}>+ Gradient Stop</button>
          </>}
          <div className="palette-list">
            {PALETTES.map(p => <button type="button" key={p.id} className="palette-card" onClick={() => applyPalette(p.colors)} title={p.name}>
              <span>{[0,1,2,3].map(i => <i key={i} style={{ background: p.colors[i] ?? p.colors[p.colors.length - 1] ?? p.colors[0] }} />)}</span><small>{p.name}</small>
            </button>)}
          </div>
        </section>
      )}

      <section className="property-section">
        <h3>글로우 · 블러 · 그림자</h3>
        <label className="toggle"><input type="checkbox" checked={design.effects.glowEnabled} onChange={e => nestedEffects({ glowEnabled: e.target.checked })} /><span>Glow 사용</span></label>
        {design.effects.glowEnabled && <>
          <ColorField label="Glow 색상" value={design.effects.glowColor} onChange={v => nestedEffects({ glowColor: v })} />
          <Slider label="Glow 크기" value={design.effects.glowBlur} min={0} max={160} suffix="px" onChange={n => nestedEffects({ glowBlur: n })} />
          <Slider label="Glow 강도" value={design.effects.glowIntensity} min={0} max={1} step={.01} onChange={n => nestedEffects({ glowIntensity: n })} />
          <Slider label="빛 번짐" value={design.effects.bloom} min={0} max={100} onChange={n => nestedEffects({ bloom: n })} />
        </>}
        <Slider label="Soft Blur" value={design.effects.softBlur} min={0} max={40} suffix="px" onChange={n => nestedEffects({ softBlur: n })} />
        <label className="toggle"><input type="checkbox" checked={design.effects.shadowEnabled} onChange={e => nestedEffects({ shadowEnabled: e.target.checked })} /><span>Shadow 사용</span></label>
        {design.effects.shadowEnabled && <>
          <ColorField label="그림자 색상" value={design.effects.shadowColor} onChange={v => nestedEffects({ shadowColor: v })} />
          <Slider label="그림자 블러" value={design.effects.shadowBlur} min={0} max={120} suffix="px" onChange={n => nestedEffects({ shadowBlur: n })} />
          <Slider label="그림자 X" value={design.effects.shadowOffsetX} min={-100} max={100} suffix="px" onChange={n => nestedEffects({ shadowOffsetX: n })} />
          <Slider label="그림자 Y" value={design.effects.shadowOffsetY} min={-100} max={100} suffix="px" onChange={n => nestedEffects({ shadowOffsetY: n })} />
        </>}
      </section>

      <section className="property-section">
        <h3>패턴 세부 설정</h3>
        {['segmented','arc'].includes(design.kind) && <>
          <Slider label="보이는 조각 길이" value={design.pattern.dash} min={15} max={900} suffix="px" onChange={n => nestedPattern({ dash: n })} />
          <Slider label="빈 공간 길이" value={design.pattern.gap} min={5} max={500} suffix="px" onChange={n => nestedPattern({ gap: n })} />
        </>}
        {['scribble','rough','brush'].includes(design.kind) && <Slider label="거칠기" value={design.pattern.roughness} min={0} max={60} onChange={n => nestedPattern({ roughness: n })} />}
        {['scribble','rough'].includes(design.kind) && <Slider label="겹쳐 그리기" value={design.pattern.strokeCount} min={1} max={9} onChange={n => nestedPattern({ strokeCount: Math.round(n) })} />}
        {['wavy','scallop'].includes(design.kind) && <>
          <Slider label="물결 높이" value={design.pattern.waveAmplitude} min={0} max={80} suffix="px" onChange={n => nestedPattern({ waveAmplitude: n })} />
          <Slider label="물결 개수" value={design.pattern.waveCount} min={3} max={48} onChange={n => nestedPattern({ waveCount: Math.round(n) })} />
        </>}

        {design.kind === 'ribbon' && <>
          <label className="control"><span><b>리본 스타일</b></span>
            <select value={design.pattern.ribbonStyle} onChange={e => nestedPattern({ ribbonStyle: e.target.value as 'rounded' | 'simple' | 'sticker' })}>
              <option value="rounded">Rounded Ribbon</option>
              <option value="simple">Simple Ribbon</option>
              <option value="sticker">Pink Sticker Ribbon</option>
            </select>
          </label>
          <p className="hint">Rounded는 둥글고 귀여운 기본형, Simple은 더 단순한 리본, Sticker는 핑크 스티커 같은 느낌입니다.</p>
        </>}
        {isDecoration && <>
          <label className="control"><span><b>배치 기준</b></span>
            <select value={design.pattern.decorationLayout} onChange={e => nestedPattern({ decorationLayout: e.target.value as 'count' | 'spacing' })}>
              <option value="count">개수 기준</option>
              <option value="spacing">간격(px) 기준</option>
            </select>
          </label>
          {design.pattern.decorationLayout === 'count'
            ? <Slider label="장식 개수" value={design.pattern.decorationCount} min={3} max={120} onChange={n => nestedPattern({ decorationCount: Math.round(n) })} />
            : <Slider label="장식 간격" value={design.pattern.decorationSpacing} min={20} max={300} suffix="px" onChange={n => nestedPattern({ decorationSpacing: n })} />}
          <Slider label="장식 크기" value={design.pattern.decorationSize} min={3} max={90} suffix="px" onChange={n => nestedPattern({ decorationSize: n })} />
          <Slider label="장식 거리" value={design.pattern.decorationOffset} min={-140} max={140} suffix="px" onChange={n => nestedPattern({ decorationOffset: n })} />
          <Slider label="장식 회전 오프셋" value={design.pattern.decorationRotation} min={-180} max={180} suffix="°" onChange={n => nestedPattern({ decorationRotation: n })} />
          <label className="toggle"><input type="checkbox" checked={design.pattern.keepUpright} onChange={e => nestedPattern({ keepUpright: e.target.checked })} /><span>장식 정방향 유지</span></label>
        </>}
        {design.kind === 'brush' && <>
          <Slider label="브러시 조각 길이" value={design.pattern.dash} min={15} max={180} suffix="px" onChange={n => nestedPattern({ dash: n })} />
          <Slider label="브러시 간격" value={design.pattern.gap} min={2} max={80} suffix="px" onChange={n => nestedPattern({ gap: n })} />
        </>}
        {design.kind === 'asset' && <>
          <label className="control"><span><b>투명 PNG 업로드</b></span><input type="file" accept="image/png,image/webp,image/svg+xml" onChange={e => onUploadAsset(e.target.files?.[0])} /></label>
          {design.pattern.customAssetName && <div className="mini-badge">현재 파일: {design.pattern.customAssetName}</div>}
          <p className="hint">하트 PNG, 리본 PNG, 꽃 PNG, 작은 스티커 PNG를 원형 반복 프레임으로 만들 수 있습니다.</p>
        </>}
        <Slider label="랜덤 Seed" value={design.pattern.seed} min={1} max={9999} onChange={n => nestedPattern({ seed: Math.round(n) })} />
      </section>
    </aside>
  )
}
