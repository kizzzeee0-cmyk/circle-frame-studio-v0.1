# Circle Frame Studio v0.31 — Profile Composer 구현 상태

이 문서는 확장 업데이트 체크리스트를 기준으로 v0.31에서 실제 구현된 기능과 브라우저 환경상 아직 제한되는 기능을 구분합니다.

## 완료

### 프레임
- 4가지 차별화 글리터 프리셋: Soft / Twinkle / Sugar / Luminous
- 글리터 색상, 입자 스타일, 밀도/크기/분산/글로우/반짝임, 흐르는 빛 방향
- Jelly Balloon Pink 프리셋과 젤리 링 전용 볼륨/하이라이트/그림자 조절
- 기존 프레임/프리셋/레이어 유지
- 프레임 회전 ON/OFF, 방향, 1회전 시간, 시작 각도, easing, 시작/종료 시간

### 미디어 레이어
- PNG/JPG/JPEG/WebP 이미지
- MP4/WebM/MOV: 브라우저가 해당 코덱을 실제 디코딩할 수 있을 때
- 드래그앤드롭 추가
- 여러 이미지/영상 레이어
- 원본 종횡비 유지
- 표시/숨김, 잠금, 복제, 삭제, 이름, 순서 버튼, 드래그 순서 변경
- 프레임 위/아래 배치
- 위치/크기/회전/불투명도
- 캔버스에서 선택 미디어 직접 이동

### 마스크
- 정원 마스크
- cover/contain
- 내부 콘텐츠 위치/크기/회전
- 링 영역 마스크
- 선택한 실제 프레임 알파 실루엣 기반 클리핑
- 링 프레임 변경 시 다음 렌더에서 마스크 자동 갱신
- 마스크 회전 동기화
- 콘텐츠 자체도 프레임 회전을 따라가는 옵션
- 프레임을 클리핑 콘텐츠 위에 다시 그리는 옵션

### PNG/장식 애니메이션
- 등장: fade/popup/bounce/zoom/rotate/rotate+zoom/jump/4-direction slide/shake/spring
- 퇴장: fade/shrink/zoom/rotate/rotate+shrink/4-direction slide/bounce/shake/throw
- 지속: sway/float/pulse/bounce/rotate/heartbeat/brightness
- 시간, 속도, 강도, easing, 이동/회전/스케일/바운스 조절
- 여러 레이어가 서로 다른 애니메이션을 동시에 사용 가능

### 타임라인
- 프로젝트 길이
- 재생/일시정지/처음으로
- 현재 시간
- 스크럽
- 반복
- 레이어별 구간 시각화
- 등장/유지/퇴장 구간 색상 구분
- 레이어 시작/종료 시간
- 영상 트림 시작/종료

### 배경 / 캔버스
- 투명/단색/이미지/영상 배경
- 배경 색/불투명도/cover/contain
- 편집용 체크보드만 표시, 출력에는 미포함
- 휠 확대·축소
- 휠 클릭 드래그 pan
- 전체 보기
- Alt+클릭 스포이드

### 저장 / 복구
- 기존 JSON 프로젝트 호환 normalize
- v0.31 미디어/배경/타임라인 설정 저장
- 미디어 원본은 IndexedDB Blob으로 별도 저장
- 재접속 시 asset ID로 Blob URL 재생성
- 원본 재연결
- 최근 저장 내역의 프로젝트 스냅샷 유지

### 출력
- 사용자 지정 PNG: 500/1000/2000/3000/4000px
- 프레임만 PNG
- 전체 합성 PNG
- GIF / Animated WebP / APNG
- WebM / MP4 MediaRecorder (브라우저 코덱 지원 시)
- 12/15/20/24/30/60fps
- 영상 비트레이트
- 프로젝트 길이 기반 출력
- 영상 레이어를 출력 시간에 맞춰 seek 후 합성
- 진행률 / 취소
- APNG/WebP 메모리 보호
- 영상 예상 용량 안내

## 부분 구현 또는 제약

- MOV 입력은 확장자만으로 보장하지 않고 브라우저 canPlayType()을 통과한 코덱만 허용합니다.
- MP4 출력은 H.264 MediaRecorder를 지원하는 브라우저에서만 활성화됩니다.
- WebM 투명 알파는 브라우저 VP9 encoder 구현에 따라 달라져 보장하지 않습니다.
- MP4는 알파 채널을 지원하지 않습니다.
- WebM/MP4는 브라우저 MediaRecorder 실시간 인코딩이므로 무손실이나 모든 하드웨어의 정확한 60fps를 보장하지 않습니다.
- 대용량 미디어는 Blob을 메모리에 반복 복사하지 않고 IndexedDB/object URL을 사용하지만 브라우저 자체 디코더의 메모리 사용은 남습니다.
- JSON을 다른 브라우저/PC로 옮기면 IndexedDB 원본 Blob은 같이 이동하지 않으므로 재연결이 필요합니다.

## 아직 미구현

- 다중 선택 및 그룹화
- 캔버스 transform box의 직접 resize/rotate handles
- 타임라인 클립의 직접 drag/resize handles
- 사용자 지정 마스크 파일
- 알파 MOV(ProRes 4444 등) export
- 영상 오디오 믹싱/출력
- WebCodecs/FFmpeg 기반 결정론적 offline MP4 encoder
- GPU/WebGL/WebGPU 전용 compositor

이 항목들은 UI만 추가한 것으로 표시하지 않으며, 후속 버전에서 실제 렌더링/저장까지 연결한 뒤 완료 처리해야 합니다.
