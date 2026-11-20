# Circle Frame Studio v0.40 — Stable Playback & Rendering Optimization

## 이번에 확인한 문제

### 1. 2D 미리보기가 visible canvas에 직접 렌더
renderProject는 시작 시 clearRect를 호출한다.
2D 모드에서는 이 대상이 실제 화면에 보이는 canvas였기 때문에, 프레임 계산이 길어지는 순간 빈 상태가 노출될 가능성이 있었다.

### 2. GPU compositor가 매 프레임 텍스처 재할당
기존 GPU 경로는 매 프레임 texImage2D를 호출해 texture storage를 다시 만들고, 그 전에 color buffer도 clear했다.
고해상도 프레임 업로드가 지연되면 불필요한 stall과 깜빡임 원인이 될 수 있다.

### 3. Orbit 입자 고정값도 매 프레임 재생성
입자 위치는 deterministic이었지만 seeded random 순회를 매 프레임 다시 수행했다.
600~1200 particles에서 동일한 초기 각도/크기/색상/밝기 seed를 계속 재계산했다.

### 4. particle별 save / restore
Orbit 입자 하나마다 ctx.save / ctx.restore를 실행해 고밀도 설정에서 호출 수가 매우 커졌다.

### 5. video preview의 반복 seek
재생 중 currentTime과 target 차이가 0.45초만 넘어도 seek했다.
브라우저가 seek 직후 decoded frame을 준비하는 동안 빈 frame이 생길 수 있다.

---

## v0.40 해결

### Offscreen double buffering
모든 미리보기 렌더는 먼저 숨겨진 canvas에 완성한다.

2D:
1. offscreen surface에 renderProject 실행
2. 렌더 완료 후 visible canvas에 copy drawImage
3. 화면에는 완성된 프레임만 교체

GPU:
1. 같은 offscreen surface 렌더
2. 렌더 완료 후 texture upload
3. full-screen quad로 즉시 표시

### GPU texture reuse
- 해상도가 변할 때만 texImage2D
- 동일 크기에서는 texSubImage2D
- full-screen draw가 화면 전체를 덮으므로 사전 gl.clear 제거

### Adaptive frame pacing
렌더 시간 이동 평균이 18ms 이하:
- 브라우저 RAF 속도로 렌더

18ms 초과:
- 약 32ms 간격으로 제한
- 처리할 수 없는 60FPS 작업을 계속 쌓지 않고 안정적인 약 30FPS 유지

애니메이션 시간은 실제 elapsed time 기준이므로 프레임을 건너뛰어도 속도가 느려지지 않는다.

### Orbit particle cache
캐시 대상:
- angular jitter
- phase
- radial seed
- size seed
- brightness seed
- color
- pre-mixed stroke color
- loop laps

키:
- pattern seed
- particle count
- active palette

최대 20개 세트를 보관하고 오래된 세트를 제거한다.

### Orbit draw batching
기존:
- particle마다 save/restore

변경:
- 전체 입자 배치에 save 1회
- globalCompositeOperation / lineCap / shadowBlur 공통 설정
- particle마다 필요한 alpha / color / lineWidth만 변경

### Twinkle 안정화
기존 밝기 변화 폭을 줄였다.
입자가 거의 사라졌다 켜지는 느낌보다 지속적인 shimmer로 보이도록 밝기와 크기에 바닥값을 둔다.

### Video sync 안정화
재생 중:
- 일반적인 작은 drift는 browser video playback에 맡김
- 1.25초 이상 큰 drift
- loop/trim 경계에서 target이 뒤로 점프
- 명시적인 큰 시간 이동
시에만 seek

정지 상태에서는 기존처럼 정확한 frame 위치로 seek한다.

---

## 다음 성능 최적화 후보

### P0 브라우저 실측 profiler
실제 사용자 환경에서 다음 조합을 측정:
- Orbit 300 / 600 / 900 / 1200
- glow 0 / 중간 / 높음
- 720 / 960 / 1200 preview
- GPU / 2D
- video 0 / 1 / 3

### P1 정적 레이어 합성 캐시
움직이지 않는 프레임과 배경을 static offscreen layer로 합성하고, 애니메이션 요소만 매 프레임 다시 렌더.

### P1 효과 패스 캐시
emboss / outline / static glitter texture와 같이 시간에 따라 변하지 않는 효과는 현재 캐시를 더 세분화해 design 일부 변경 시 필요한 캐시만 무효화.

### P1 성능 진단 표시
개발/진단 모드에서:
- current preview FPS
- render cost ms
- GPU upload ms
- particle count
- active media count

를 표시하면 사용자 환경별 병목을 빠르게 식별할 수 있다.

현재 우선순위는 새 기능 추가보다 재생 중 깜빡임과 편집 체감 렉 제거다.
