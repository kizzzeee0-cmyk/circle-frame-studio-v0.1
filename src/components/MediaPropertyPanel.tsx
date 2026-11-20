import { useRef } from 'react'
import type { FrameLayer, MediaLayer } from '../types'
import { useCompactSectionOrganizer } from '../utils/uiPreferences'

interface Props {
  media: MediaLayer
  selectedMedia: MediaLayer[]
  frameLayers: FrameLayer[]
  duration: number
  onChange: (next: MediaLayer) => void
  onBatchChange: (updates: Array<Partial<MediaLayer> & { id: string }>) => void
  onAlign: (mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'center' | 'distribute-x' | 'distribute-y') => void
  onGroup: () => void
  onUngroup: () => void
  onCustomMask: (file?: File) => void
  onRelink: (file?: File) => void
  onDuplicate: () => void
  onDelete: () => void
  onReturnFrame: () => void
}

function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string, value: number, min: number, max: number, step?: number, suffix?: string, onChange: (value: number) => void }) {
  return <label className="control slider-control">
    <span><b>{label}</b><em>{Math.round(value * 100) / 100}{suffix}</em></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
  </label>
}

export default function MediaPropertyPanel({ media, selectedMedia, frameLayers, duration, onChange, onBatchChange, onAlign, onGroup, onUngroup, onCustomMask, onRelink, onDuplicate, onDelete, onReturnFrame }: Props) {
  const relinkInput = useRef<HTMLInputElement>(null)
  const customMaskInput = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  useCompactSectionOrganizer(panelRef, 'media', {
    defaultFavorites: ['레이어 기본', '마스크 · 클리핑'],
    defaultCollapsed: ['타임라인', '등장 · 퇴장 애니메이션', '지속 애니메이션'],
  })
  const selectedCount = Math.max(1, selectedMedia.length)
  const patch = (partial: Partial<MediaLayer>) => onChange({ ...media, ...partial })
  const animation = (partial: Partial<MediaLayer['animation']>) => patch({ animation: { ...media.animation, ...partial } })

  return <aside ref={panelRef} className="right-panel panel media-property-panel">
    <div className="panel-title-row sticky-head">
      <div><strong>{selectedCount > 1 ? selectedCount + '개 미디어 선택' : '미디어 설정'}</strong><small>{selectedCount > 1 ? '다중 선택 · 일괄 편집' : media.kind === 'video' ? '영상 레이어' : '이미지 · PNG 레이어'}</small></div>
      <button type="button" className="soft-button" onClick={onReturnFrame}>프레임 설정</button>
    </div>

    {selectedCount > 1 && <section className="property-section multi-edit-section">
      <h3>다중 선택 · 정렬 · 그룹</h3>
      <div className="multi-edit-grid alignment-grid">
        <button type="button" onClick={() => onAlign('left')}>왼쪽 맞춤</button>
        <button type="button" onClick={() => onAlign('center-x')}>가로 중앙</button>
        <button type="button" onClick={() => onAlign('right')}>오른쪽 맞춤</button>
        <button type="button" onClick={() => onAlign('top')}>위 맞춤</button>
        <button type="button" onClick={() => onAlign('center-y')}>세로 중앙</button>
        <button type="button" onClick={() => onAlign('bottom')}>아래 맞춤</button>
        <button type="button" onClick={() => onAlign('center')}>선택 전체 정중앙</button>
        <button type="button" onClick={() => onAlign('distribute-x')}>가로 여백 균등</button>
        <button type="button" onClick={() => onAlign('distribute-y')}>세로 여백 균등</button>
      </div>
      <div className="multi-edit-grid match-grid">
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, width: media.width, height: media.height, scale: media.scale })))}>대표 크기 통일</button>
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, rotation: media.rotation })))}>대표 회전 통일</button>
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, startTime: media.startTime, endTime: media.endTime, trimStart: media.trimStart, trimEnd: media.trimEnd })))}>대표 타이밍 통일</button>
        <button type="button" onClick={onGroup}>그룹 만들기</button>
        <button type="button" onClick={onUngroup}>그룹 해제</button>
      </div>
      <label className="control slider-control">
        <span><b>선택 전체 불투명도</b><em>{Math.round(media.opacity * 100)}%</em></span>
        <input type="range" min={0} max={1} step={.01} value={media.opacity} onChange={event => {
          const opacity = Number(event.target.value)
          onBatchChange(selectedMedia.map(layer => ({ id: layer.id, opacity })))
        }} />
      </label>
      <label className="control"><span><b>선택 전체 배치</b></span>
        <select value={media.placement} onChange={event => {
          const placement = event.target.value as MediaLayer['placement']
          onBatchChange(selectedMedia.map(layer => ({ id: layer.id, placement })))
        }}>
          <option value="below">프레임 아래</option><option value="above">프레임 위</option>
        </select>
      </label>
      <label className="control"><span><b>선택 전체 블렌딩</b></span>
        <select value={media.blendMode} onChange={event => {
          const blendMode = event.target.value as MediaLayer['blendMode']
          onBatchChange(selectedMedia.map(layer => ({ id: layer.id, blendMode })))
        }}>
          <option value="normal">일반</option><option value="multiply">곱하기</option><option value="screen">스크린</option><option value="overlay">오버레이</option><option value="soft-light">소프트 라이트</option>
        </select>
      </label>
      <p className="hint">정렬은 회전된 요소의 실제 외곽 크기를 기준으로 계산합니다. 균등 배치는 중심점이 아니라 요소 사이의 실제 여백을 동일하게 맞춥니다.</p>
    </section>}

    <section className="property-section">
      <h3>레이어 기본</h3>
      <label className="control"><span><b>이름</b></span><input value={media.name} onChange={event => patch({ name: event.target.value })} /></label>
      <label className="control"><span><b>배치 위치</b></span>
        <select value={media.placement} onChange={event => patch({ placement: event.target.value as MediaLayer['placement'] })}>
          <option value="below">프레임 아래</option>
          <option value="above">프레임 위</option>
        </select>
      </label>
      <div className="media-inline-buttons">
        <button type="button" className="soft-button" onClick={() => patch({ x: 0, y: 0 })}>중앙 맞춤</button>
        <button type="button" className="soft-button" onClick={() => patch({ fit: 'cover', width: 1500, height: 1500 })}>화면 채우기</button>
        <button type="button" className="soft-button" onClick={() => patch({ fit: 'contain', width: 1500, height: 1500 })}>전체 맞춤</button>
      </div>
      <Slider label="X 위치" value={media.x} min={-1200} max={1200} suffix="px" onChange={value => patch({ x: value })} />
      <Slider label="Y 위치" value={media.y} min={-1200} max={1200} suffix="px" onChange={value => patch({ y: value })} />
      <Slider label="크기" value={media.scale} min={.05} max={3} step={.01} suffix="x" onChange={value => patch({ scale: value })} />
      <Slider label="회전" value={media.rotation} min={-360} max={360} suffix="°" onChange={value => patch({ rotation: value })} />
      <Slider label="불투명도" value={media.opacity} min={0} max={1} step={.01} onChange={value => patch({ opacity: value })} />
      <label className="control"><span><b>블렌딩</b></span>
        <select value={media.blendMode} onChange={event => patch({ blendMode: event.target.value as MediaLayer['blendMode'] })}>
          <option value="normal">일반</option>
          <option value="multiply">곱하기</option>
          <option value="screen">스크린</option>
          <option value="overlay">오버레이</option>
          <option value="soft-light">소프트 라이트</option>
        </select>
      </label>
      <label className="control"><span><b>원본 맞춤 방식</b></span>
        <select value={media.fit} onChange={event => patch({ fit: event.target.value as MediaLayer['fit'] })}>
          <option value="cover">영역 채우기 · 비율 유지</option>
          <option value="contain">전체 보이기 · 비율 유지</option>
        </select>
      </label>
      <div className="media-inline-buttons">
        <button type="button" className="soft-button" onClick={() => relinkInput.current?.click()}>원본 재연결</button>
        <button type="button" className="soft-button" onClick={onDuplicate}>복제</button>
        <button type="button" className="soft-button danger-soft" onClick={onDelete}>삭제</button>
      </div>
      <input ref={relinkInput} hidden type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov" onChange={event => onRelink(event.target.files?.[0])} />
    </section>

    <section className="property-section">
      <h3>마스크 · 클리핑</h3>
      <label className="control"><span><b>클리핑 모드</b></span>
        <select value={media.maskMode} onChange={event => patch({ maskMode: event.target.value as MediaLayer['maskMode'] })}>
          <option value="none">없음 · 원본 그대로</option>
          <option value="circle">원 내부 · 정원 마스크</option>
          <option value="ring">링 영역 · 프레임 실루엣</option>
          <option value="custom">사용자 지정 마스크</option>
        </select>
      </label>

      {media.maskMode === 'circle' && <>
        <Slider label="마스크 원 크기" value={media.maskRadius} min={50} max={950} suffix="px" onChange={value => patch({ maskRadius: value })} />
        <Slider label="마스크 X" value={media.maskX} min={-600} max={600} suffix="px" onChange={value => patch({ maskX: value })} />
        <Slider label="마스크 Y" value={media.maskY} min={-600} max={600} suffix="px" onChange={value => patch({ maskY: value })} />
      </>}

      {media.maskMode === 'custom' && <>
        <button type="button" className="soft-button full" onClick={() => customMaskInput.current?.click()}>
          {media.customMaskFileName ? '마스크 변경 · ' + media.customMaskFileName : '마스크 이미지 선택'}
        </button>
        <input ref={customMaskInput} hidden type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => onCustomMask(event.target.files?.[0])} />
        <label className="toggle"><input type="checkbox" checked={media.customMaskInvert} onChange={event => patch({ customMaskInvert: event.target.checked })} /><span>마스크 반전</span></label>
        <label className="control"><span><b>마스크 맞춤</b></span>
          <select value={media.customMaskFit} onChange={event => patch({ customMaskFit: event.target.value as MediaLayer['customMaskFit'] })}>
            <option value="cover">영역 채우기</option><option value="contain">전체 맞춤</option>
          </select>
        </label>
        <Slider label="마스크 크기" value={media.customMaskScale} min={.05} max={2.5} step={.01} suffix="x" onChange={value => patch({ customMaskScale: value })} />
        <Slider label="마스크 X" value={media.customMaskX} min={-1000} max={1000} suffix="px" onChange={value => patch({ customMaskX: value })} />
        <Slider label="마스크 Y" value={media.customMaskY} min={-1000} max={1000} suffix="px" onChange={value => patch({ customMaskY: value })} />
        <Slider label="마스크 회전" value={media.customMaskRotation} min={-360} max={360} suffix="°" onChange={value => patch({ customMaskRotation: value })} />
        <p className="hint">마스크 이미지의 알파/밝기 형태를 사용해 미디어를 잘라냅니다. 투명 PNG를 사용하면 가장 정확합니다.</p>
      </>}

      {media.maskMode === 'ring' && <>
        <label className="control"><span><b>링 마스크 기준 프레임</b></span>
          <select value={media.maskFrameLayerId} onChange={event => patch({ maskFrameLayerId: event.target.value })}>
            <option value="">직접 지정한 원형 링</option>
            {frameLayers.map(layer => <option value={layer.id} key={layer.id}>{layer.name}</option>)}
          </select>
        </label>
        {!media.maskFrameLayerId && <>
          <Slider label="링 바깥 반지름" value={media.maskRadius} min={50} max={950} suffix="px" onChange={value => patch({ maskRadius: value })} />
          <Slider label="링 두께" value={media.ringThickness} min={2} max={400} suffix="px" onChange={value => patch({ ringThickness: value })} />
        </>}
        <label className="toggle"><input type="checkbox" checked={media.maskSyncRotation} onChange={event => patch({ maskSyncRotation: event.target.checked })} /><span>프레임 회전과 마스크 동기화</span></label>
        <label className="toggle"><input type="checkbox" checked={media.followFrameRotation} onChange={event => patch({ followFrameRotation: event.target.checked, followFrameLayerId: media.followFrameLayerId || media.maskFrameLayerId })} /><span>콘텐츠도 프레임과 함께 회전</span></label>
        {media.followFrameRotation && <label className="control"><span><b>회전 기준 프레임</b></span>
          <select value={media.followFrameLayerId || media.maskFrameLayerId} onChange={event => patch({ followFrameLayerId: event.target.value })}>
            <option value="">현재 링 마스크 기준</option>
            {frameLayers.map(layer => <option value={layer.id} key={layer.id}>{layer.name}</option>)}
          </select>
        </label>}
        <label className="toggle"><input type="checkbox" checked={media.keepFrameAbove} onChange={event => patch({ keepFrameAbove: event.target.checked })} /><span>클리핑 콘텐츠 위에 프레임 광택 유지</span></label>
        <p className="hint">프레임을 선택하면 단순한 원 두께가 아니라 해당 프레임의 실제 알파 실루엣을 마스크로 사용합니다.</p>
      </>}
    </section>

    <section className="property-section">
      <h3>타임라인</h3>
      <Slider label="레이어 시작" value={media.startTime} min={0} max={duration} step={.05} suffix="s" onChange={value => patch({ startTime: Math.min(value, media.endTime - .01) })} />
      <Slider label="레이어 종료" value={media.endTime} min={0} max={duration} step={.05} suffix="s" onChange={value => patch({ endTime: Math.max(value, media.startTime + .01) })} />
      {media.kind === 'video' && <>
        <label className="toggle"><input type="checkbox" checked={media.audioEnabled} onChange={event => patch({ audioEnabled: event.target.checked })} /><span>영상 오디오 출력</span></label>
        {media.audioEnabled && <Slider label="오디오 볼륨" value={Math.round(media.audioVolume * 100)} min={0} max={200} suffix="%" onChange={value => patch({ audioVolume: value / 100 })} />}
        <Slider label="영상 트림 시작" value={media.trimStart} min={0} max={60} step={.05} suffix="s" onChange={value => patch({ trimStart: Math.min(value, media.trimEnd > 0 ? media.trimEnd - .01 : value) })} />
        <Slider label="영상 트림 종료" value={media.trimEnd} min={0} max={60} step={.05} suffix="s" onChange={value => patch({ trimEnd: value })} />
        <p className="hint">트림 종료가 0이면 원본 영상 끝까지 사용합니다. 프로젝트 길이가 더 길면 선택한 트림 구간이 반복됩니다.</p>
      </>}
    </section>

    <section className="property-section quick-animation-section">
      <h3>빠른 애니메이션 프리셋</h3>
      <div className="quick-animation-grid">
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, animation: { ...layer.animation, intro: 'fade', introStart: layer.startTime, introDuration: .35, ease: 'ease-out', continuous: 'none' } })))}>부드럽게 등장</button>
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, animation: { ...layer.animation, intro: 'popup', introStart: layer.startTime, introDuration: .42, ease: 'ease-out', bounceStrength: .8 } })))}>통통 팝업</button>
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, animation: { ...layer.animation, continuous: 'float', speed: .32, strength: .55 } })))}>잔잔한 둥실</button>
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, animation: { ...layer.animation, continuous: 'pulse', speed: .55, strength: .45 } })))}>미세 펄스</button>
        <button type="button" onClick={() => onBatchChange(selectedMedia.map(layer => ({ id: layer.id, animation: { ...layer.animation, intro: 'none', outro: 'none', continuous: 'none' } })))}>애니메이션 제거</button>
      </div>
      <p className="hint">현재 선택된 모든 미디어에 한 번에 적용됩니다. 세부 시간·강도는 아래에서 다시 조절할 수 있습니다.</p>
    </section>

    <section className="property-section">
      <h3>등장 · 퇴장 애니메이션</h3>
      <label className="control"><span><b>등장</b></span>
        <select value={media.animation.intro} onChange={event => animation({ intro: event.target.value as MediaLayer['animation']['intro'] })}>
          <option value="none">없음</option><option value="fade">페이드 인</option><option value="popup">팝업 등장</option>
          <option value="bounce">바운스 등장</option><option value="zoom">확대 등장</option><option value="rotate">회전 등장</option>
          <option value="rotate-zoom">회전 + 확대</option><option value="jump">점프 등장</option><option value="slide-left">왼쪽에서 슬라이드</option>
          <option value="slide-right">오른쪽에서 슬라이드</option><option value="slide-up">위에서 슬라이드</option><option value="slide-down">아래에서 슬라이드</option>
          <option value="shake">흔들리며 등장</option><option value="spring">스프링 등장</option>
        </select>
      </label>
      <Slider label="등장 시작" value={media.animation.introStart} min={0} max={duration} step={.05} suffix="s" onChange={value => animation({ introStart: value })} />
      <Slider label="등장 지속" value={media.animation.introDuration} min={.05} max={3} step={.05} suffix="s" onChange={value => animation({ introDuration: value })} />

      <label className="control"><span><b>퇴장</b></span>
        <select value={media.animation.outro} onChange={event => animation({ outro: event.target.value as MediaLayer['animation']['outro'] })}>
          <option value="none">없음</option><option value="fade">페이드 아웃</option><option value="shrink">축소 퇴장</option><option value="zoom">확대 퇴장</option>
          <option value="rotate">회전 퇴장</option><option value="rotate-shrink">회전 + 축소</option><option value="slide-left">왼쪽 퇴장</option>
          <option value="slide-right">오른쪽 퇴장</option><option value="slide-up">위로 퇴장</option><option value="slide-down">아래로 퇴장</option>
          <option value="bounce">바운스 퇴장</option><option value="shake">흔들리며 퇴장</option><option value="throw">튕겨 나가기</option>
        </select>
      </label>
      <Slider label="퇴장 시작" value={media.animation.outroStart} min={0} max={duration} step={.05} suffix="s" onChange={value => animation({ outroStart: value })} />
      <Slider label="퇴장 지속" value={media.animation.outroDuration} min={.05} max={3} step={.05} suffix="s" onChange={value => animation({ outroDuration: value })} />
    </section>

    <section className="property-section">
      <h3>지속 애니메이션</h3>
      <label className="control"><span><b>반복 움직임</b></span>
        <select value={media.animation.continuous} onChange={event => animation({ continuous: event.target.value as MediaLayer['animation']['continuous'] })}>
          <option value="none">없음</option><option value="sway">좌우 흔들림</option><option value="float">상하 둥실거림</option>
          <option value="pulse">미세 펄스</option><option value="bounce">반복 바운스</option><option value="rotate">부드러운 회전</option>
          <option value="heartbeat">심장박동</option><option value="brightness">밝기 변화</option>
        </select>
      </label>
      <Slider label="속도" value={media.animation.speed} min={.05} max={4} step={.05} suffix="x" onChange={value => animation({ speed: value })} />
      <Slider label="강도" value={media.animation.strength} min={0} max={2} step={.05} suffix="x" onChange={value => animation({ strength: value })} />
      <label className="control"><span><b>이징</b></span>
        <select value={media.animation.ease} onChange={event => animation({ ease: event.target.value as MediaLayer['animation']['ease'] })}>
          <option value="linear">Linear</option><option value="ease-in">Ease In</option><option value="ease-out">Ease Out</option><option value="ease-in-out">Ease In Out</option>
        </select>
      </label>
      <Slider label="이동 거리" value={media.animation.moveDistance} min={0} max={1000} suffix="px" onChange={value => animation({ moveDistance: value })} />
      <Slider label="회전 각도" value={media.animation.rotateAngle} min={0} max={720} suffix="°" onChange={value => animation({ rotateAngle: value })} />
      <Slider label="확대·축소 비율" value={media.animation.scaleAmount} min={0} max={1.5} step={.01} onChange={value => animation({ scaleAmount: value })} />
      <Slider label="바운스 강도" value={media.animation.bounceStrength} min={0} max={2} step={.05} onChange={value => animation({ bounceStrength: value })} />
    </section>
  </aside>
}
