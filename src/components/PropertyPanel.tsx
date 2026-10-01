import type { FrameDesign, FrameLayer, GradientMode } from '../types'
import { PALETTES } from '../presets/palettes'
import { uid } from '../utils/id'

interface Props {
  design: FrameDesign
  layers: FrameLayer[]
  selectedLayerId: string
  onChange: (next: FrameDesign) => void
  onSavePreset: () => void
  onUploadAsset: (file?: File) => void
  onAddLayer: () => void
  onSelectLayer: (layerId: string) => void
  onRenameLayer: (layerId: string, name: string) => void
  onToggleLayerVisibility: (layerId: string) => void
  onMoveLayer: (layerId: string, direction: -1 | 1) => void
  onDeleteLayer: (layerId: string) => void
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

export default function PropertyPanel({
  design,
  layers,
  selectedLayerId,
  onChange,
  onSavePreset,
  onUploadAsset,
  onAddLayer,
  onSelectLayer,
  onRenameLayer,
  onToggleLayerVisibility,
  onMoveLayer,
  onDeleteLayer,
}: Props) {
  const patch = (partial: Partial<FrameDesign>) => onChange({ ...design, ...partial })
  const nestedEffects = (partial: Partial<FrameDesign['effects']>) => patch({ effects: { ...design.effects, ...partial } })
  const nestedPattern = (partial: Partial<FrameDesign['pattern']>) => patch({ pattern: { ...design.pattern, ...partial } })
  const nestedTwoTone = (partial: Partial<FrameDesign['twoToneFlow']>) => patch({ twoToneFlow: { ...design.twoToneFlow, ...partial } })
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
        <h3>레이어</h3>
        <div className="layer-actions">
          <button type="button" className="soft-button" onClick={onAddLayer}>+ 레이어 추가</button>
        </div>
        <div className="layer-list">
          {layers.map((layer, index) => {
            const active = layer.id === selectedLayerId
            return (
              <div key={layer.id} className={active ? 'layer-card active' : 'layer-card'}>
                <div className="layer-row-top">
                  <button type="button" className="layer-select" onClick={() => onSelectLayer(layer.id)} title="이 레이어 편집">
                    <strong>#{index + 1}</strong>
                    <span>{layer.visible ? '보임' : '숨김'}</span>
                  </button>
                  <input
                    className="layer-name-input"
                    value={layer.name}
                    onChange={e => onRenameLayer(layer.id, e.target.value)}
                    onFocus={() => onSelectLayer(layer.id)}
                  />
                </div>
                <div className="layer-row-actions">
                  <button type="button" className="tiny-button" onClick={() => onToggleLayerVisibility(layer.id)}>{layer.visible ? '숨기기' : '보이기'}</button>
                  <button type="button" className="tiny-button" disabled={index === 0} onClick={() => onMoveLayer(layer.id, -1)}>위로</button>
                  <button type="button" className="tiny-button" disabled={index === layers.length - 1} onClick={() => onMoveLayer(layer.id, 1)}>아래로</button>
                  <button type="button" className="tiny-button" disabled={layers.length <= 1} onClick={() => onDeleteLayer(layer.id)}>삭제</button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="hint">위에 있는 레이어가 더 앞쪽에 그려집니다. 서로 다른 프레임 2개를 추가해 겹쳐서 하나의 원형 프레임처럼 만들 수 있습니다.</p>
      </section>

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
                <option value="original">원본 색상 유지</option>
                <option value="palette">팔레트 색상으로 재색칠</option>
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
          <h3>{design.twoToneFlow.enabled ? '2색 흐름 그라데이션' : '선 색상 · 그라데이션'}</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={design.twoToneFlow.enabled}
              onChange={e => nestedTwoTone({
                enabled: e.target.checked,
                colorA: design.color,
                colorB: design.twoToneFlow.colorB || '#FFFFFF',
              })}
            />
            <span>2색 흐름 모드</span>
          </label>

          {design.twoToneFlow.enabled ? <>
            <ColorField
              label="선택 색상"
              value={design.twoToneFlow.colorA}
              onChange={v => patch({ color: v, twoToneFlow: { ...design.twoToneFlow, colorA: v } })}
              eyedrop
            />
            <ColorField
              label="흰색 / 보조 색상"
              value={design.twoToneFlow.colorB}
              onChange={v => patch({ secondaryColor: v, twoToneFlow: { ...design.twoToneFlow, colorB: v } })}
            />

            <label className="control"><span><b>둘레 색상 구성</b></span>
              <select
                value={design.twoToneFlow.repeatCount}
                onChange={e => nestedTwoTone({ repeatCount: Number(e.target.value) as 1 | 2 })}
              >
                <option value={1}>2구간 · 흰색 → 선택색상</option>
                <option value={2}>4구간 · 흰색 → 선택색상 → 흰색 → 선택색상</option>
              </select>
            </label>

            <Slider label={design.twoToneFlow.repeatCount === 2 ? '4구간 패턴 위치' : '흰색 구간 위치'} value={design.twoToneFlow.whiteCenter} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ whiteCenter: n })} />
            <Slider label={design.twoToneFlow.repeatCount === 2 ? '각 흰색 구간 길이' : '흰색 구간 길이'} value={design.twoToneFlow.whiteWidth} min={.04} max={.70} step={.01} onChange={n => nestedTwoTone({ whiteWidth: n })} />
            <Slider label="연결 부드러움" value={design.twoToneFlow.blendWidth} min={.01} max={.30} step={.01} onChange={n => nestedTwoTone({ blendWidth: n })} />
            <Slider label="흐름 회전" value={design.twoToneFlow.rotation} min={-180} max={180} suffix="°" onChange={n => nestedTwoTone({ rotation: n })} />
            <Slider label="반짝임" value={design.twoToneFlow.glossStrength} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ glossStrength: n })} />
            <Slider label="안쪽 빛" value={design.twoToneFlow.innerHighlight} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ innerHighlight: n })} />
            <Slider label="바깥쪽 빛" value={design.twoToneFlow.outerHighlight} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ outerHighlight: n })} />

            <div className="pattern-sequence-preview" title="둘레 반복 순서 미리보기">
              {Array.from({ length: design.twoToneFlow.repeatCount === 2 ? 12 : 8 }, (_, i) => {
                const isWhite = design.twoToneFlow.repeatCount === 2 ? Math.floor(i / 3) % 2 === 0 : i < 4
                return <i key={i} style={{ background: isWhite ? design.twoToneFlow.colorB : design.twoToneFlow.colorA }} />
              })}
            </div>

            <p className="hint">
              {design.twoToneFlow.repeatCount === 2
                ? <>실제 선택 색상은 <b>흰색 + 선택색상 2개</b>지만, 원 둘레에는 <b>흰색 → 선택색상 → 흰색 → 선택색상</b>의 4구간으로 반복됩니다. 흰색 길이를 바꿔도 두 흰색 구간과 두 선택색상 구간이 서로 대칭을 유지하도록 자동 계산합니다.</>
                : <>흰색과 선택색상이 원의 두께 방향이 아니라 <b>원 둘레를 따라</b> 한 번씩 흐릅니다.</>}
            </p>
          </> : <>
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
          </>}
        </section>
      )}

      <section className="property-section">
        <h3>외곽선 · 입체감 · 글로우 · 블러 · 그림자</h3>

        <label className="toggle"><input type="checkbox" checked={design.effects.outlineEnabled} onChange={e => nestedEffects({ outlineEnabled: e.target.checked })} /><span>외곽선 사용</span></label>
        {design.effects.outlineEnabled && <>
          <ColorField label="외곽선 색상" value={design.effects.outlineColor} onChange={v => nestedEffects({ outlineColor: v })} eyedrop />
          <Slider label="외곽선 두께" value={design.effects.outlineWidth} min={1} max={40} suffix="px" onChange={n => nestedEffects({ outlineWidth: n })} />
        </>}

        <label className="toggle"><input type="checkbox" checked={design.effects.embossEnabled} onChange={e => nestedEffects({ embossEnabled: e.target.checked })} /><span>입체감 사용 (경사 · 엠보스)</span></label>
        {design.effects.embossEnabled && <>
          <Slider label="입체감 크기" value={design.effects.embossSize} min={1} max={80} suffix="px" onChange={n => nestedEffects({ embossSize: n })} />
          <Slider label="입체감 깊이" value={design.effects.embossDepth} min={0} max={1.5} step={.01} onChange={n => nestedEffects({ embossDepth: n })} />
          <Slider label="부드러움" value={design.effects.embossSoftness} min={0} max={60} suffix="px" onChange={n => nestedEffects({ embossSoftness: n })} />
          <Slider label="빛 방향" value={design.effects.embossLightAngle} min={-180} max={180} suffix="°" onChange={n => nestedEffects({ embossLightAngle: n })} />
          <Slider label="빛 높이" value={design.effects.embossLightAltitude} min={0} max={90} suffix="°" onChange={n => nestedEffects({ embossLightAltitude: n })} />

          <label className="control"><span><b>입체 타입</b></span>
            <select value={design.effects.embossMode} onChange={e => nestedEffects({ embossMode: e.target.value as 'convex' | 'concave' })}>
              <option value="convex">볼록</option>
              <option value="concave">오목</option>
            </select>
          </label>

          <ColorField label="밝은 부분 색상" value={design.effects.embossHighlightColor} onChange={v => nestedEffects({ embossHighlightColor: v })} eyedrop />
          <Slider label="밝은 부분 불투명도" value={design.effects.embossHighlightOpacity} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossHighlightOpacity: n })} />

          <label className="control"><span><b>하이라이트 혼합</b></span>
            <select value={design.effects.embossHighlightBlend} onChange={e => nestedEffects({ embossHighlightBlend: e.target.value as 'screen' | 'soft-light' | 'normal' })}>
              <option value="screen">Screen · 광택형</option>
              <option value="soft-light">Soft Light · 자연스러운 타입</option>
              <option value="normal">Normal · 선명한 타입</option>
            </select>
          </label>

          <Slider label="기존 색상 유지량" value={design.effects.embossBaseRetention} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossBaseRetention: n })} />
          <Slider label="하이라이트 선명도" value={design.effects.embossHighlightSharpness} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossHighlightSharpness: n })} />
          <Slider label="중앙 볼륨" value={design.effects.embossMidtoneStrength} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossMidtoneStrength: n })} />

          <label className="toggle"><input type="checkbox" checked={design.effects.embossAutoShadowColor} onChange={e => nestedEffects({ embossAutoShadowColor: e.target.checked })} /><span>그림자 색상 자동 추천</span></label>
          {design.effects.embossAutoShadowColor
            ? <Slider label="자동 그림자 어둡기" value={design.effects.embossAutoShadowDarkness} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossAutoShadowDarkness: n })} />
            : <ColorField label="그림자 부분 색상" value={design.effects.embossShadowColor} onChange={v => nestedEffects({ embossShadowColor: v })} eyedrop />}
          <Slider label="그림자 부분 불투명도" value={design.effects.embossShadowOpacity} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossShadowOpacity: n })} />

          <p className="hint">v0.22는 한 줄짜리 하이라이트가 아니라 여러 단계의 밝은 면·중간톤·부드러운 그림자를 겹쳐 튜브 단면이 둥글게 보이도록 합니다. 얇은 링에서는 효과 폭을 자동으로 줄이고, 입체감 깊이는 위치 이동보다 명암 대비에 더 크게 반영됩니다.</p>
        </>}

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
        {['scribble','rough','brush'].includes(design.kind) && <Slider label="볼록한 정도" value={design.pattern.bulgeAmplitude} min={0} max={40} suffix="px" onChange={n => nestedPattern({ bulgeAmplitude: n })} />}
        {['scribble','rough','brush'].includes(design.kind) && <Slider label="볼록 개수" value={design.pattern.bulgeCount} min={0} max={36} onChange={n => nestedPattern({ bulgeCount: Math.round(n) })} />}
        {['scribble','rough'].includes(design.kind) && <Slider label="겹쳐 그리기" value={design.pattern.strokeCount} min={1} max={9} onChange={n => nestedPattern({ strokeCount: Math.round(n) })} />}
        {['wavy','scallop'].includes(design.kind) && <>
          <Slider label="물결 높이" value={design.pattern.waveAmplitude} min={0} max={80} suffix="px" onChange={n => nestedPattern({ waveAmplitude: n })} />
          <Slider label="물결 개수" value={design.pattern.waveCount} min={3} max={48} onChange={n => nestedPattern({ waveCount: Math.round(n) })} />
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
