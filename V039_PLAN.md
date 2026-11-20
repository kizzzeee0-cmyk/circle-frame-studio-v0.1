# Circle Frame Studio v0.39 — 렉 개선 및 미리보기 렌더 최적화

## 확인된 실제 병목

### 1. 최상단 React 상태가 매 프레임 갱신됨
기존 App의 타임라인 루프가 requestAnimationFrame마다 setTimelineTime을 호출했다.
이 때문에 Canvas만 움직이는 것이 아니라 좌측 프리셋, 우측 속성 패널, 툴바 등 App 하위 전체가 매 프레임 React 재렌더 대상이 되었다.

### 2. 속성 슬라이더가 프로젝트 전체를 복사함
프레임 색상·두께·글리터 값 하나를 바꿀 때 commitCoalesced 내부에서 structuredClone(prev)로 전체 프로젝트를 복사했다.
연속 슬라이더 입력에서는 이 비용이 반복되었다.

### 3. 미디어 드래그도 전체 프로젝트 복사
transformMediaTransient는 포인터 이동마다 프로젝트 전체를 structuredClone했다.

### 4. 캔버스 렌더와 UI 렌더가 같은 업데이트 빈도에 묶임
부드러운 60Hz 애니메이션을 위해 React 전체까지 60Hz로 갱신할 필요가 없는데 서로 분리되어 있지 않았다.

### 5. 애니메이션 프리셋 썸네일이 화면 밖에서도 계속 렌더
각 animated Thumb이 자체 requestAnimationFrame을 계속 돌렸다.

---

## v0.39에서 적용한 해결

### Canvas 전용 60Hz 루프
- 실제 디자인 애니메이션은 CanvasPanel 내부 RAF가 담당한다.
- 현재 프로젝트는 ref로 읽어 최신 값이 다음 프레임에 즉시 반영된다.
- App의 timelineTime은 약 15FPS로만 갱신한다.
- 즉 캔버스는 부드럽게 움직이면서 React 패널 전체는 훨씬 적게 다시 그린다.

### 정적 프로젝트는 애니메이션 루프 정지
다음이 하나도 없으면 타임라인 렌더 루프를 돌리지 않는다.
- 영상 배경
- 영상 미디어
- 미디어 intro/outro/continuous 애니메이션
- 프레임 회전
- 글리터 orbit/twinkle/highlight/animated

### 디자인 편집 경량화
프레임 속성 수정:
- 전체 FrameProject structuredClone 제거
- 선택된 FrameDesign만 복사
- 선택된 레이어 배열 항목만 교체
- Undo는 연속 수정 시작 시점에만 전체 스냅샷 저장

미디어 속성 수정:
- 전체 프로젝트 복사 제거
- mediaLayers 배열과 대상 레이어만 변경

미디어 드래그:
- 포인터 이동마다 전체 프로젝트 복사 제거
- transient update에서는 대상 레이어 값만 교체

### 편집 중 Draft Preview
정지 상태에서 슬라이더를 연속 수정하면:
1. 최대 840px 미리보기를 다음 RAF에서 즉시 표시
2. 마지막 입력 110ms 후 선택한 720/960/1200 원래 품질로 다시 렌더

최종 PNG/영상 출력 품질에는 영향을 주지 않는다.

### 재생 중 자동 해상도
- 성능 우선: 720
- 자동 + 일반 애니메이션/미디어: 960
- 자동 + 고밀도 글리터 또는 미디어 5개 이상: 720
- 정지 상태: 사용자 선택 해상도 복원

### 프리셋 썸네일 최적화
- IntersectionObserver로 화면 밖 썸네일 렌더 중지
- 브라우저 탭이 숨겨지면 렌더 중지
- 보이는 애니메이션 썸네일은 약 20FPS 제한
- Thumb 컴포넌트 memo 적용

---

## 다음 성능 개선 후보

### P0 실제 브라우저 프로파일링
- Orbit 300 / 600 / 900 particles
- 500 / 1000 / 2000px 디자인
- 영상 1 / 3 / 5개
- GPU 표시 ON/OFF
조합별 프레임 시간 측정이 필요하다.

### P1 렌더러 정적 레이어 캐시
애니메이션되지 않는 프레임 레이어를 offscreen canvas에 캐시하고, 움직이는 레이어만 매 프레임 다시 그리면 추가 성능 개선이 가능하다.

### P1 Orbit particle precomputation
현재 deterministic seed를 매 프레임 다시 순회한다.
고정 입자 속성(초기 각도, 크기 seed, radial seed, color index)을 캐시 배열로 만들어 시간에 따른 좌표만 계산하면 고밀도 Orbit 비용을 더 낮출 수 있다.

### P1 Renderer profiling overlay
개발 모드에서만:
- 현재 preview FPS
- frame render ms
- media sync ms
- particle count
를 표시하는 성능 진단 오버레이를 추가할 수 있다.

기능을 더 추가하기 전에 실제 조작 시 렉이 다시 발생하지 않는 것을 우선 검증한다.
