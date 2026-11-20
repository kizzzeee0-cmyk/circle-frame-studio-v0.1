import { useRef } from 'react'
import type { FrameDesign, FrameLayer, GradientMode } from '../types'
import { useCompactSectionOrganizer } from '../utils/uiPreferences'
import { PALETTES } from '../presets/palettes'
import { uid } from '../utils/id'

interface Props {
  design: FrameDesign
  timelineDuration: number
  onTimelineDurationChange: (duration: number) => void
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
  onReorderLayer: (layerId: string, targetId: string) => void
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
  timelineDuration,
  onTimelineDurationChange,
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
  onReorderLayer,
  onDeleteLayer,
}: Props) {
  const panelRef = useRef<HTMLElement>(null)
  useCompactSectionOrganizer(panelRef, 'frame', {
    defaultFavorites: ['기본', '선 색상 · 그라데이션', '2색 흐름 그라데이션'],
    defaultCollapsed: ['레이어', '프레임 회전 애니메이션', '외곽선 · 입체감 · 글로우 · 블러 · 그림자', '패턴 세부 설정'],
    structureKey: design.kind + ':' + String(design.twoToneFlow.enabled) + ':' + String(design.tripleRing.attached),
  })
  const patch = (partial: Partial<FrameDesign>) => onChange({ ...design, ...partial })
  const nestedEffects = (partial: Partial<FrameDesign['effects']>) => patch({ effects: { ...design.effects, ...partial } })
  const nestedPattern = (partial: Partial<FrameDesign['pattern']>) => patch({ pattern: { ...design.pattern, ...partial } })
  const nestedTwoTone = (partial: Partial<FrameDesign['twoToneFlow']>) => patch({ twoToneFlow: { ...design.twoToneFlow, ...partial } })
  const nestedTriple = (partial: Partial<FrameDesign['tripleRing']>) => patch({ tripleRing: { ...design.tripleRing, ...partial } })
  const nestedGlitter = (partial: Partial<FrameDesign['glitter']>) => patch({ glitter: { ...design.glitter, ...partial } })
  const nestedJelly = (partial: Partial<FrameDesign['jelly']>) => patch({ jelly: { ...design.jelly, ...partial } })
  const nestedRotation = (partial: Partial<FrameDesign['rotationAnimation']>) => patch({ rotationAnimation: { ...design.rotationAnimation, ...partial } })
  const setGlitterColor = (index: number, value: string) => {
    const colors = [...design.glitter.colors] as [string, string, string, string]
    colors[index] = value
    nestedGlitter({ colors })
  }
  const setGlitterMainColor = (value: string) => {
    const colors = [...design.glitter.colors] as [string, string, string, string]
    colors[0] = value
    onChange({ ...design, color: value, glitter: { ...design.glitter, colors } })
  }
  const setGlitterSecondaryColor = (value: string) => {
    const colors = [...design.glitter.colors] as [string, string, string, string]
    colors[1] = value
    onChange({ ...design, secondaryColor: value, glitter: { ...design.glitter, colors } })
  }
  const setGlitterSurfaceStyle = (style: FrameDesign['glitter']['surfaceStyle']) => {
    const glitter = { ...design.glitter, surfaceStyle: style }
    const rotationAnimation = { ...design.rotationAnimation }
    if (style === 'orbit') {
      Object.assign(glitter, {
        animationMode: 'orbit',
        ringVisible: false,
        orbitEnabled: true,
        twinkleEnabled: true,
        highlightSweepEnabled: false,
        animated: true,
        flowEnabled: true,
      })
      rotationAnimation.enabled = false
    } else if (style === 'reflection') {
      Object.assign(glitter, {
        animationMode: 'sweep',
        ringVisible: true,
        orbitEnabled: false,
        twinkleEnabled: false,
        highlightSweepEnabled: true,
        animated: true,
        flowEnabled: true,
      })
      rotationAnimation.enabled = false
    } else if (design.glitter.surfaceStyle === 'orbit' || design.glitter.surfaceStyle === 'reflection') {
      Object.assign(glitter, {
        animationMode: 'twinkle',
        ringVisible: true,
        orbitEnabled: false,
        twinkleEnabled: true,
        highlightSweepEnabled: false,
        animated: true,
        flowEnabled: false,
      })
    }
    onChange({ ...design, glitter, rotationAnimation })
  }

  const setGlitterAnimationMode = (mode: FrameDesign['glitter']['animationMode']) => {
    const rotates = mode === 'rotate' || mode === 'rotate-twinkle'
    const orbit = mode === 'orbit'
    const twinkle = mode === 'twinkle' || mode === 'rotate-twinkle' || mode === 'orbit'
    const sweep = mode === 'sweep'
    onChange({
      ...design,
      glitter: {
        ...design.glitter,
        animationMode: mode,
        animated: mode !== 'none',
        orbitEnabled: orbit,
        twinkleEnabled: twinkle,
        highlightSweepEnabled: sweep,
        flowEnabled: sweep || orbit,
      },
      rotationAnimation: {
        ...design.rotationAnimation,
        enabled: rotates,
        easing: 'linear',
      },
    })
  }
  const setTripleColor = (index: 0 | 1 | 2, value: string) => {
    const colors = [...design.tripleRing.colors] as [string, string, string]
    colors[index] = value
    nestedTriple({ colors })
  }
  const setTripleWidth = (index: 0 | 1 | 2, value: number) => {
    const widths = [...design.tripleRing.widths] as [number, number, number]
    widths[index] = value
    nestedTriple({ widths })
  }
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
    <aside ref={panelRef} className="right-panel panel">
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
              <div
                key={layer.id}
                draggable
                className={active ? 'layer-card active' : 'layer-card'}
                onDragStart={event => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/frame-layer', layer.id)
                }}
                onDragOver={event => {
                  if (event.dataTransfer.types.includes('text/frame-layer')) event.preventDefault()
                }}
                onDrop={event => {
                  event.preventDefault()
                  const sourceId = event.dataTransfer.getData('text/frame-layer')
                  if (sourceId && sourceId !== layer.id) onReorderLayer(sourceId, layer.id)
                }}
              >
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
            <option value="flower">Flower</option><option value="asset">내 PNG 반복 프레임</option><option value="glossy">Glossy</option><option value="glitter">Glitter Ring</option><option value="jelly">Jelly Balloon Ring</option>
          </select>
        </label>
        <Slider label="원 크기" value={design.radius} min={120} max={930} suffix="px" onChange={n => patch({ radius: n })} />
        {!(design.kind === 'triple' && design.tripleRing.attached) && <Slider label="선 두께" value={design.thickness} min={1} max={180} suffix="px" onChange={n => patch({ thickness: n })} />}
        <Slider label="전체 회전" value={design.rotation} min={-180} max={180} suffix="°" onChange={n => patch({ rotation: n })} />
        <Slider label="X 위치" value={design.offsetX} min={-300} max={300} suffix="px" onChange={n => patch({ offsetX: n })} />
        <Slider label="Y 위치" value={design.offsetY} min={-300} max={300} suffix="px" onChange={n => patch({ offsetY: n })} />
        <Slider label="불투명도" value={design.opacity} min={0} max={1} step={.01} onChange={n => patch({ opacity: n })} />
      </section>

      <section className="property-section frame-motion-section">
        <h3>프레임 회전 애니메이션</h3>
        <label className="toggle"><input type="checkbox" checked={design.rotationAnimation.enabled} onChange={e => nestedRotation({ enabled: e.target.checked })} /><span>제자리 회전 ON/OFF</span></label>
        {design.rotationAnimation.enabled && <>
          <label className="control"><span><b>회전 방향</b></span>
            <select value={design.rotationAnimation.direction} onChange={e => nestedRotation({ direction: Number(e.target.value) as 1|-1 })}>
              <option value={1}>시계 방향</option><option value={-1}>반시계 방향</option>
            </select>
          </label>
          <Slider label="1회전 시간" value={design.rotationAnimation.secondsPerTurn} min={.25} max={20} step={.05} suffix="s" onChange={n => nestedRotation({ secondsPerTurn: n })} />
          <Slider label="시작 각도" value={design.rotationAnimation.startAngle} min={-360} max={360} suffix="°" onChange={n => nestedRotation({ startAngle: n })} />
          <label className="control"><span><b>회전 감속 방식</b></span>
            <select value={design.rotationAnimation.easing} onChange={e => nestedRotation({ easing: e.target.value as FrameDesign['rotationAnimation']['easing'] })}>
              <option value="linear">일정 속도</option><option value="ease-in">가속</option><option value="ease-out">감속</option><option value="ease-in-out">가속 + 감속</option>
            </select>
          </label>
          <Slider label="회전 시작 시간" value={design.rotationAnimation.startTime} min={0} max={60} step={.05} suffix="s" onChange={n => nestedRotation({ startTime: n })} />
          <Slider label="회전 종료 시간" value={design.rotationAnimation.endTime} min={0} max={60} step={.05} suffix="s" onChange={n => nestedRotation({ endTime: n })} />
          <p className="hint">회전 중심은 캔버스 정중앙의 현재 프레임 중심을 그대로 사용합니다. 미디어는 별도 레이어이므로 프레임만 회전하고 사진은 고정할 수 있습니다.</p>
        </>}
      </section>

      {design.kind === 'jelly' && (
        <section className="property-section jelly-section">
          <h3>젤리 · 풍선 링</h3>
          <ColorField label="메인 색상" value={design.color} onChange={v => patch({ color: v })} eyedrop />
          <ColorField label="볼륨 보조색" value={design.secondaryColor} onChange={v => patch({ secondaryColor: v })} />
          <ColorField label="곡선 하이라이트" value={design.jelly.highlightColor} onChange={v => nestedJelly({ highlightColor: v })} />
          <ColorField label="그림자 색상" value={design.jelly.shadowColor} onChange={v => nestedJelly({ shadowColor: v })} />
          <Slider label="하이라이트 불투명도" value={Math.round(design.jelly.highlightOpacity * 100)} min={0} max={100} suffix="%" onChange={n => nestedJelly({ highlightOpacity: n / 100 })} />
          <Slider label="하이라이트 두께" value={Math.round(design.jelly.highlightWidth * 100)} min={3} max={30} suffix="%" onChange={n => nestedJelly({ highlightWidth: n / 100 })} />
          <Slider label="하이라이트 길이" value={Math.round(design.jelly.highlightLength * 100)} min={5} max={42} suffix="%" onChange={n => nestedJelly({ highlightLength: n / 100 })} />
          <Slider label="하이라이트 개수" value={design.jelly.highlightCount} min={1} max={8} onChange={n => nestedJelly({ highlightCount: Math.round(n) })} />
          <Slider label="그림자 강도" value={Math.round(design.jelly.shadowOpacity * 100)} min={0} max={100} suffix="%" onChange={n => nestedJelly({ shadowOpacity: n / 100 })} />
          <Slider label="볼륨감" value={Math.round(design.jelly.volume * 100)} min={0} max={100} suffix="%" onChange={n => nestedJelly({ volume: n / 100 })} />
          <p className="hint">참고 이미지처럼 긴 흰색 곡선 하이라이트가 두꺼운 링을 따라 배치됩니다. 색상을 바꿔도 하이라이트와 볼륨 셰이딩은 유지됩니다.</p>
        </section>
      )}

      {design.kind === 'triple' && (
        <section className="property-section triple-ring-section">
          <h3>트리플 테두리 · 개별 선 설정</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={design.tripleRing.attached}
              onChange={e => nestedTriple({ attached: e.target.checked })}
            />
            <span>세 줄을 여백 없이 붙이기</span>
          </label>

          {design.tripleRing.attached ? <>
            <ColorField label="바깥쪽 1줄 색상" value={design.tripleRing.colors[0]} onChange={v => setTripleColor(0, v)} eyedrop />
            <Slider label="바깥쪽 1줄 두께" value={design.tripleRing.widths[0]} min={1} max={120} suffix="px" onChange={n => setTripleWidth(0, n)} />

            <ColorField label="가운데 2줄 색상" value={design.tripleRing.colors[1]} onChange={v => setTripleColor(1, v)} eyedrop />
            <Slider label="가운데 2줄 두께" value={design.tripleRing.widths[1]} min={1} max={120} suffix="px" onChange={n => setTripleWidth(1, n)} />

            <ColorField label="안쪽 3줄 색상" value={design.tripleRing.colors[2]} onChange={v => setTripleColor(2, v)} eyedrop />
            <Slider label="안쪽 3줄 두께" value={design.tripleRing.widths[2]} min={1} max={120} suffix="px" onChange={n => setTripleWidth(2, n)} />

            <div className="pattern-sequence-preview" title="바깥쪽 → 가운데 → 안쪽">
              {design.tripleRing.colors.map((color, index) => <i key={index} style={{ background: color, flex: Math.max(1, design.tripleRing.widths[index]) }} />)}
            </div>
            <p className="hint">세 선은 바깥쪽 → 가운데 → 안쪽 순서입니다. 선 중심 간격을 각 두께의 합으로 자동 계산하고 약 1px 미만으로 살짝 겹쳐 그려서 투명한 틈이 생기지 않습니다. 각 선의 색상과 두께는 완전히 독립적으로 조절됩니다.</p>
          </> : (
            <p className="hint">OFF 상태에서는 기존 Triple Ring처럼 세 선 사이에 여백이 있는 디자인을 유지합니다.</p>
          )}
        </section>
      )}

      {design.kind === 'glitter' && (
        <section className="property-section glitter-ring-section">
          <h3>글리터 · 표면 설정</h3>

          <label className="control"><span><b>글리터 스타일</b></span>
            <select value={design.glitter.surfaceStyle} onChange={e => setGlitterSurfaceStyle(e.target.value as FrameDesign['glitter']['surfaceStyle'])}>
              <option value="fine">글리터 질감형 링 · Fine Pearl</option>
              <option value="orbit">글리터 궤도형 · 링 없이 흐름</option>
              <option value="reflection">흐르는 반사광형 · Reflection</option>
              <option value="twinkle">미세 트윙클형 · Twinkle</option>
              <option value="gradient">Gradient Surface · 그라데이션 글리터</option>
              <option value="holographic">Pastel Holographic · 홀로그램</option>
              <option value="legacy">Legacy Particle · 기존 글리터</option>
            </select>
          </label>

          <ColorField label="메인 색상" value={design.glitter.colors[0] || design.color} onChange={setGlitterMainColor} eyedrop />
          <ColorField label="서브 색상" value={design.glitter.colors[1] || design.secondaryColor} onChange={setGlitterSecondaryColor} />
          <Slider label="링 두께" value={design.thickness} min={12} max={180} suffix="px" onChange={n => patch({ thickness: n })} />
          <Slider label="글리터 밀도" value={design.glitter.surfaceStyle === 'orbit' ? design.glitter.orbitDensity : design.glitter.density} min={80} max={900} onChange={n => design.glitter.surfaceStyle === 'orbit' ? nestedGlitter({ orbitDensity: Math.round(n), density: Math.round(n) }) : nestedGlitter({ density: Math.round(n) })} />
          <Slider label="입자 크기" value={design.glitter.particleSize} min={.4} max={8} step={.1} suffix="px" onChange={n => nestedGlitter({ particleSize: n })} />
          <Slider label="글리터 강도" value={Math.round(design.glitter.textureContrast * 100)} min={0} max={100} suffix="%" onChange={n => nestedGlitter({ textureContrast: n / 100 })} />
          <Slider label="반짝임 강도" value={Math.round(design.glitter.animationStrength * 100)} min={0} max={100} suffix="%" onChange={n => nestedGlitter({ animationStrength: n / 100 })} />
          {design.glitter.surfaceStyle !== 'legacy' && (
            <label className="toggle"><input type="checkbox" checked={design.glitter.ringVisible} onChange={e => nestedGlitter({ ringVisible: e.target.checked })} /><span>기본 원형 링 표시</span></label>
          )}

          <label className="control"><span><b>애니메이션 모드</b><em>{design.glitter.animationMode === 'twinkle' ? '추천' : ''}</em></span>
            <select value={design.glitter.animationMode} onChange={e => setGlitterAnimationMode(e.target.value as FrameDesign['glitter']['animationMode'])}>
              <option value="twinkle">반짝임만 · 추천</option>
              <option value="orbit">글리터 궤도 이동</option>
              <option value="rotate">링 회전만</option>
              <option value="rotate-twinkle">회전 + 반짝임</option>
              <option value="sweep">흐르는 반사광</option>
              <option value="none">정지</option>
            </select>
          </label>

          {(design.glitter.animationMode === 'rotate' || design.glitter.animationMode === 'rotate-twinkle' || design.rotationAnimation.enabled) && (
            <Slider label="링 1회전 시간" value={design.rotationAnimation.secondsPerTurn} min={1} max={20} step={.1} suffix="s" onChange={n => nestedRotation({ secondsPerTurn: n, enabled: true, easing: 'linear' })} />
          )}
          {design.glitter.twinkleEnabled && (
            <Slider label="반짝임 빈도" value={design.glitter.animationSpeed} min={.2} max={2} step={.05} suffix="x" onChange={n => nestedGlitter({ animationSpeed: n })} />
          )}
          <div className="glitter-motion-switches">
            <label className="toggle"><input type="checkbox" checked={design.rotationAnimation.enabled} onChange={e => nestedRotation({ enabled: e.target.checked, easing: 'linear' })} /><span>링 자체 회전</span></label>
            <label className="toggle"><input type="checkbox" checked={design.glitter.orbitEnabled} onChange={e => nestedGlitter({ orbitEnabled: e.target.checked, animated: true })} /><span>글리터 궤도 이동</span></label>
            <label className="toggle"><input type="checkbox" checked={design.glitter.twinkleEnabled} onChange={e => nestedGlitter({ twinkleEnabled: e.target.checked, animated: true })} /><span>입자 밝기 반짝임</span></label>
            <label className="toggle"><input type="checkbox" checked={design.glitter.highlightSweepEnabled} onChange={e => nestedGlitter({ highlightSweepEnabled: e.target.checked, animated: true })} /><span>원둘레 하이라이트 이동</span></label>
          </div>
          <label className="control"><span><b>움직임 방향</b></span>
            <select value={design.glitter.flowDirection} onChange={e => nestedGlitter({ flowDirection: Number(e.target.value) as 1|-1 })}>
              <option value={1}>시계 방향</option><option value={-1}>반시계 방향</option>
            </select>
          </label>

          {design.glitter.surfaceStyle !== 'legacy' && (
            <div className="glitter-engine-note">
              <b>Glitter Engine v0.36</b>
              <span>{design.glitter.surfaceStyle === 'orbit'
                ? '고정 링 없이 입자 자체가 원형을 만들며 원둘레를 따라 연속적으로 흐릅니다.'
                : design.glitter.surfaceStyle === 'reflection'
                  ? '얇은 원형 경로 위를 짧은 반사광이 부드럽게 순환합니다.'
                  : '표면 질감과 궤도·트윙클·하이라이트 애니메이션을 서로 독립적으로 조절할 수 있습니다.'}</span>
            </div>
          )}

          <details className="glitter-advanced">
            <summary>고급 글리터 설정</summary>
            <div className="glitter-advanced-body">
              <div className="color-count-buttons four-up">
                {[1,2,3,4].map(n => <button key={n} type="button" className={design.glitter.colorCount === n ? 'active' : ''} onClick={() => nestedGlitter({ colorCount: n as 1|2|3|4 })}>{n}색</button>)}
              </div>
              <ColorField label="글리터 색상 1" value={design.glitter.colors[0]} onChange={v => setGlitterColor(0, v)} eyedrop />
              {design.glitter.colorCount >= 2 && <ColorField label="글리터 색상 2" value={design.glitter.colors[1]} onChange={v => setGlitterColor(1, v)} />}
              {design.glitter.colorCount >= 3 && <ColorField label="글리터 색상 3" value={design.glitter.colors[2]} onChange={v => setGlitterColor(2, v)} />}
              {design.glitter.colorCount >= 4 && <ColorField label="글리터 색상 4" value={design.glitter.colors[3]} onChange={v => setGlitterColor(3, v)} />}

              <div className="pattern-sequence-preview" title="글리터 팔레트">
                {Array.from({length: 16}, (_, i) => <i key={i} style={{background: design.glitter.colors[i % design.glitter.colorCount]}} />)}
              </div>

              <Slider label="입자 크기 다양성" value={Math.round(design.glitter.particleSizeVariation * 100)} min={0} max={100} suffix="%" onChange={n => nestedGlitter({ particleSizeVariation: n / 100 })} />
              <Slider label="궤도 퍼짐" value={design.glitter.orbitSpread} min={1} max={80} step={.5} suffix="px" onChange={n => nestedGlitter({ orbitSpread: n })} />
              <Slider label="궤도 입자 밀도" value={design.glitter.orbitDensity} min={48} max={1200} onChange={n => nestedGlitter({ orbitDensity: Math.round(n) })} />
              <Slider label="흐름 잔광 길이" value={Math.round(design.glitter.orbitTrail * 100)} min={0} max={100} suffix="%" onChange={n => nestedGlitter({ orbitTrail: n / 100 })} />
              <Slider label="반복 길이" value={design.glitter.loopDuration} min={.5} max={12} step={.1} suffix="s" onChange={n => { nestedGlitter({ loopDuration: n }); onTimelineDurationChange(n) }} />
              <p className="hint">반복 길이를 바꾸면 프로젝트 타임라인도 같은 길이로 맞춰 루프 시작·끝이 자연스럽게 연결되도록 합니다. 현재 타임라인: {timelineDuration.toFixed(1)}s</p>
              <Slider label="강조 반짝임 개수" value={design.glitter.accentSparkleCount} min={0} max={18} onChange={n => nestedGlitter({ accentSparkleCount: Math.round(n) })} />
              <Slider label="강조 반짝임 크기" value={design.glitter.sparkleSize} min={3} max={28} step={.5} suffix="px" onChange={n => nestedGlitter({ sparkleSize: n })} />
              <Slider label="반짝임 유지 폭" value={Math.round(design.glitter.accentSparkleDuration * 100)} min={5} max={60} suffix="%" onChange={n => nestedGlitter({ accentSparkleDuration: n / 100 })} />
              <Slider label="표면 하이라이트" value={Math.round(design.glitter.surfaceHighlight * 100)} min={0} max={100} suffix="%" onChange={n => nestedGlitter({ surfaceHighlight: n / 100 })} />
              <Slider label="안쪽·바깥쪽 림" value={Math.round(design.glitter.rimStrength * 100)} min={0} max={100} suffix="%" onChange={n => nestedGlitter({ rimStrength: n / 100 })} />
              <Slider label="빛 번짐" value={design.glitter.glow} min={0} max={20} suffix="px" onChange={n => nestedGlitter({ glow: n })} />
              {design.glitter.highlightSweepEnabled && <>
                <Slider label="반사광 길이" value={Math.round(design.glitter.sweepWidth * 100)} min={3} max={30} suffix="%" onChange={n => nestedGlitter({ sweepWidth: n / 100 })} />
              </>}

              {design.glitter.surfaceStyle === 'legacy' && <>
                <label className="control"><span><b>기존 입자 스타일</b></span>
                  <select value={design.glitter.particleStyle} onChange={e => nestedGlitter({ particleStyle: e.target.value as FrameDesign['glitter']['particleStyle'] })}>
                    <option value="soft">Soft · 미세 펄</option>
                    <option value="twinkle">Twinkle · 별빛 강조</option>
                    <option value="sugar">Sugar · 작은 결정</option>
                    <option value="luminous">Luminous · 발광 베이스</option>
                  </select>
                </label>
                <Slider label="기존 별 반짝이 비율" value={Math.round(design.glitter.sparkleRatio * 100)} min={0} max={60} suffix="%" onChange={n => nestedGlitter({ sparkleRatio: n / 100 })} />
                <Slider label="기존 링 주변 퍼짐" value={design.glitter.spread} min={2} max={100} suffix="px" onChange={n => nestedGlitter({ spread: n })} />
              </>}

              <ColorField label="포인트 하이라이트" value={design.glitter.highlightColor} onChange={v => nestedGlitter({ highlightColor: v })} />
              <ColorField label="글로우 색상" value={design.glitter.glowColor} onChange={v => nestedGlitter({ glowColor: v })} />

              <label className="control"><span><b>글리터 랜덤 시드</b></span>
                <input type="number" min={0} max={999999} step={1} value={design.pattern.seed} onChange={e => nestedPattern({ seed: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
              </label>
            </div>
          </details>

          <p className="hint">궤도형은 부모 링 전체를 돌리는 방식이 아니라 각 입자의 원형 경로 좌표를 시간 기반으로 계산합니다. 고정 시드와 주기 함수로 같은 시간에는 같은 위치가 재현되며, 마지막 프레임과 첫 프레임의 상태가 이어지도록 설계했습니다.</p>
        </section>
      )}

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
                onChange={e => nestedTwoTone({ repeatCount: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              >
                <option value={1}>2구간 · 흰색 → 선택색상</option>
                <option value={2}>4구간 · 흰색 → 선택색상 → 흰색 → 선택색상</option>
                <option value={3}>6구간 · 흰색 → 선택색상 → 흰색 → 선택색상 → 흰색 → 선택색상</option>
                <option value={4}>8구간 · 흰색 → 선택색상 → 흰색 → 선택색상 → 흰색 → 선택색상 → 흰색 → 선택색상</option>
              </select>
            </label>

            <Slider label={`${design.twoToneFlow.repeatCount * 2}구간 패턴 위치`} value={design.twoToneFlow.whiteCenter} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ whiteCenter: n })} />
            <Slider label={design.twoToneFlow.repeatCount > 1 ? '각 흰색 구간 길이' : '흰색 구간 길이'} value={design.twoToneFlow.whiteWidth} min={.04} max={.70} step={.01} onChange={n => nestedTwoTone({ whiteWidth: n })} />
            <Slider label="연결 부드러움" value={design.twoToneFlow.blendWidth} min={.01} max={.30} step={.01} onChange={n => nestedTwoTone({ blendWidth: n })} />
            <Slider label="흐름 회전" value={design.twoToneFlow.rotation} min={-180} max={180} suffix="°" onChange={n => nestedTwoTone({ rotation: n })} />
            <Slider label="반짝임" value={design.twoToneFlow.glossStrength} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ glossStrength: n })} />
            <Slider label="안쪽 빛" value={design.twoToneFlow.innerHighlight} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ innerHighlight: n })} />
            <Slider label="바깥쪽 빛" value={design.twoToneFlow.outerHighlight} min={0} max={1} step={.01} onChange={n => nestedTwoTone({ outerHighlight: n })} />

            <div className="pattern-sequence-preview" title="둘레 반복 순서 미리보기">
              {Array.from({ length: design.twoToneFlow.repeatCount * 4 + 4 }, (_, i) => {
                const chunk = Math.floor(i / 2)
                const isWhite = chunk % 2 === 0
                return <i key={i} style={{ background: isWhite ? design.twoToneFlow.colorB : design.twoToneFlow.colorA }} />
              })}
            </div>

            <p className="hint">
              {design.twoToneFlow.repeatCount > 1
                ? <>실제 선택 색상은 <b>흰색 + 선택색상 2개</b>지만, 원 둘레에는 <b>{design.twoToneFlow.repeatCount * 2}구간</b>으로 <b>흰색 → 선택색상</b>이 번갈아 반복됩니다. 흰색 길이를 바꿔도 모든 흰색 구간과 모든 선택색상 구간이 서로 같은 길이와 대칭을 유지하도록 자동 계산합니다.</>
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
          <label className="control"><span><b>스타일</b></span>
            <select value={design.effects.embossStyle} onChange={e => nestedEffects({ embossStyle: e.target.value as 'inner-bevel' | 'outer-bevel' })}>
              <option value="inner-bevel">내부 경사</option>
              <option value="outer-bevel">외부 경사</option>
            </select>
          </label>

          <label className="control"><span><b>기법</b></span>
            <select value={design.effects.embossTechnique} onChange={e => nestedEffects({ embossTechnique: e.target.value as 'smooth' | 'chisel-soft' | 'chisel-hard' })}>
              <option value="smooth">매끄럽게</option>
              <option value="chisel-soft">부드럽게 깎기</option>
              <option value="chisel-hard">단단하게 깎기</option>
            </select>
          </label>

          <Slider label="깊이" value={Math.round(design.effects.embossDepth * 100)} min={1} max={300} suffix="%" onChange={n => nestedEffects({ embossDepth: n / 100 })} />

          <label className="control"><span><b>방향</b></span>
            <select value={design.effects.embossDirection} onChange={e => nestedEffects({ embossDirection: e.target.value as 'up' | 'down' })}>
              <option value="up">위로</option>
              <option value="down">아래로</option>
            </select>
          </label>

          <Slider label="크기" value={design.effects.embossSize} min={1} max={100} suffix="px" onChange={n => nestedEffects({ embossSize: n })} />
          <Slider label="부드럽게" value={design.effects.embossSoftness} min={0} max={60} suffix="px" onChange={n => nestedEffects({ embossSoftness: n })} />
          <Slider label="각도" value={design.effects.embossLightAngle < 0 ? design.effects.embossLightAngle + 360 : design.effects.embossLightAngle} min={0} max={360} suffix="°" onChange={n => nestedEffects({ embossLightAngle: n > 180 ? n - 360 : n })} />
          <Slider label="높이" value={design.effects.embossLightAltitude} min={0} max={90} suffix="°" onChange={n => nestedEffects({ embossLightAltitude: n })} />

          <label className="control"><span><b>밝은 영역 모드</b></span>
            <select value={design.effects.embossHighlightBlend} onChange={e => nestedEffects({ embossHighlightBlend: e.target.value as 'screen' | 'soft-light' | 'normal' })}>
              <option value="screen">스크린</option>
              <option value="soft-light">소프트 라이트</option>
              <option value="normal">일반</option>
            </select>
          </label>
          <Slider label="밝은 영역 불투명도" value={Math.round(design.effects.embossHighlightOpacity * 100)} min={0} max={100} suffix="%" onChange={n => nestedEffects({ embossHighlightOpacity: n / 100 })} />
          <ColorField label="밝은 영역 색상" value={design.effects.embossHighlightColor} onChange={v => nestedEffects({ embossHighlightColor: v })} eyedrop />

          <label className="control"><span><b>그림자 모드</b></span>
            <select value={design.effects.embossShadowBlend} onChange={e => nestedEffects({ embossShadowBlend: e.target.value as 'multiply' | 'soft-light' | 'normal' })}>
              <option value="multiply">곱하기</option>
              <option value="soft-light">소프트 라이트</option>
              <option value="normal">일반</option>
            </select>
          </label>
          <Slider label="그림자 불투명도" value={Math.round(design.effects.embossShadowOpacity * 100)} min={0} max={100} suffix="%" onChange={n => nestedEffects({ embossShadowOpacity: n / 100 })} />

          <label className="toggle"><input type="checkbox" checked={design.effects.embossAutoShadowColor} onChange={e => nestedEffects({ embossAutoShadowColor: e.target.checked })} /><span>그림자 색상 자동 추천</span></label>
          {design.effects.embossAutoShadowColor
            ? <Slider label="자동 그림자 어둡기" value={Math.round(design.effects.embossAutoShadowDarkness * 100)} min={0} max={100} suffix="%" onChange={n => nestedEffects({ embossAutoShadowDarkness: n / 100 })} />
            : <ColorField label="그림자 색상" value={design.effects.embossShadowColor} onChange={v => nestedEffects({ embossShadowColor: v })} eyedrop />}

          <label className="control"><span><b>볼록 / 오목</b></span>
            <select value={design.effects.embossMode} onChange={e => nestedEffects({ embossMode: e.target.value as 'convex' | 'concave' })}>
              <option value="convex">볼록</option>
              <option value="concave">오목</option>
            </select>
          </label>

          <Slider label="기존 색상 유지량" value={design.effects.embossBaseRetention} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossBaseRetention: n })} />
          <Slider label="하이라이트 선명도" value={design.effects.embossHighlightSharpness} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossHighlightSharpness: n })} />
          <Slider label="중앙 볼륨" value={design.effects.embossMidtoneStrength} min={0} max={1} step={.01} onChange={n => nestedEffects({ embossMidtoneStrength: n })} />

          <p className="hint">한 번 맞춘 경사·엠보스 값은 다른 프레임 프리셋을 선택해도 유지됩니다. 밝은 면은 Screen, 어두운 면은 Multiply를 기본으로 사용해 단순히 선이 굵어지는 것이 아니라 밝은 면/중앙 볼륨/그림자 면이 분리되도록 했습니다.</p>
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
