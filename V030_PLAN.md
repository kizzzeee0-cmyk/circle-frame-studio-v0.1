# Circle Frame Studio v0.30 — Animated Export

## 목표
사이트 안에서만 보이던 글리터 애니메이션을 실제 투명 애니메이션 파일로 저장한다.

## 포맷
- Animated WebP: wasm-webp 기반, 알파 투명도, 기본 추천
- APNG: UPNG 기반, RGBA 무손실, 반투명 글로우 보존
- GIF: gifenc 기반, 높은 호환성, 256색/1bit transparency

## 내보내기 UI
- 포맷
- 500/1000/2000px
- 12/15/20/24/30fps
- 1~4초 루프 길이
- GIF 반복 횟수
- WebP 품질
- 4가지 빠른 설정 프리셋
- 실제 루프 미리보기
- 프레임 수 / 예상 raw memory / 진행률

## 완벽한 루프
내보내기 렌더링은 frameIndex/frameCount의 0..1 progress를 사용한다.
Twinkle과 Shimmer 계산도 sin(time), sin(2*time), sweepAngle=time의 정수 주기 기반으로 보정한다.

## 메모리 보호
APNG/WebP의 raw frame 예상 메모리가 320MB를 넘으면 내보내기를 막고 설정 축소를 안내한다.
GIF는 frame-by-frame으로 즉시 quantize/encode한다.

## 최근 저장
움직이는 파일 저장 성공 후에도 현재 FrameProject 전체 상태를 최근 저장 내역에 새 기록으로 추가한다.
