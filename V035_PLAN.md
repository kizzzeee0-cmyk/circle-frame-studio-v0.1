# Circle Frame Studio v0.35 — Surface Glitter Engine 구현 보고서

## 1. 기존 코드에서 실제 확인한 문제
- 기존 drawGlitter는 반투명 원형 stroke 위에 density 수만큼 개별 입자를 직접 배치한다.
- sparkleRatio에 따라 여러 입자가 4갈래 별 glint로 전환된다.
- 입자 위치는 고정 seed라 frame마다 완전히 랜덤 재생성되지는 않았지만, 링 회전 시 수많은 별/점이 원주를 따라 모두 이동해 시각적 움직임이 지나치게 커진다.
- mixed/orbit/shimmer 모드는 입자별 밝기 변화와 이동 light band가 동시에 적용되어 sparkleRatio가 높을수록 부산스러울 수 있다.
- 기본 ring과 particle이 별도 draw이므로 표면 자체가 글리터 재질이라기보다 ring 위에 별/점을 올린 인상이 강했다.

## 2. 새 렌더링 구조
- 기존 renderer는 Legacy Particle로 보존한다.
- 신규 Surface Glitter renderer를 추가한다.
- 실제 inner/outer radius를 사용한 annulus clip 내부에만 surface texture를 만든다.
- base gradient, micro reflective particle, localized surface highlight, inner/outer rim 순으로 정적 texture를 생성한다.
- 정적 texture는 설정/해상도 key로 캐싱하며 최대 14개를 유지한다.
- 시간에 따라 변하는 accent sparkle과 moving reflection만 매 frame 별도로 그린다.

## 3. 신규 스타일
- Gradient Surface Glitter: 따뜻한 white/peach와 pink/lavender가 원주를 따라 연결되는 다층 글리터.
- Fine Pearl Glitter: 큰 별을 거의 쓰지 않고 매우 작은 펄 입자를 촘촘하게 배치.
- Elegant Twinkle Surface: 고정된 미세 texture 위 제한된 위치만 천천히 반짝임.
- Pastel Holographic Glitter: 작은 반사 조각과 짧은 moving reflection을 사용하는 파스텔 홀로그램.

각 스타일은 단순 색상 차이가 아니라 particle shape, density, accent count, surface highlight, rim, animation mode가 다르다.

## 4. 회전/반짝임 분리
- none: 완전 정지.
- twinkle: ring은 고정하고 fixed accent 위치의 밝기만 변화.
- rotate: accent 밝기 animation 없이 완성된 ring texture 전체를 회전.
- rotate-twinkle: texture 전체 회전과 fixed accent 밝기 변화만 병행.
- sweep: ring은 고정하고 짧은 reflection arc만 이동.

animationMode가 twinkle 또는 sweep이면 기존 rotationAnimation이 켜져 있어도 Surface Glitter ring의 motion rotation을 적용하지 않는다.
rotate 또는 rotate-twinkle을 선택할 때만 rotationAnimation 값을 사용한다.

## 5. 반복 안정성
- micro texture 위치는 project seed에서 결정되고 매 frame 재배치되지 않는다.
- accent 위치 역시 고정 seed로 매 frame 동일하게 재생성된다.
- preview에서는 time 기반 cycle을 사용한다.
- export에서 animationProgress가 전달되면 정확한 0~1 cycle을 사용해 처음과 끝의 위상을 맞춘다.

## 6. UI 변경
- 기본 노출: style, main color, sub color, ring thickness, glitter strength, animation mode, speed.
- 고급 접힘: 1~4 color palette, density, particle size, size variation, accent count, accent size, accent duration, surface highlight, rim, glow, reflection direction, random seed.
- 신규 Surface Glitter는 설명 badge를 표시한다.
- Legacy Particle은 기존 particle style, sparkle ratio, spread 값을 계속 수정할 수 있다.

## 7. 기존 데이터 호환
- 기존 preset은 삭제하지 않는다.
- surfaceStyle이 없는 기존 project는 createDesign의 legacy default를 기준으로 normalize한다.
- 기존 glitter preset은 Legacy Particle renderer를 그대로 사용한다.
- 신규 preset만 새 Surface Glitter renderer를 사용한다.

## 8. 검증
- GitHub Actions TypeScript typecheck 대상.
- GitHub Actions Vite production build 대상.
- v0.34 autosave와 user preset을 v0.35 legacy key로 읽도록 migration 경로 유지.

## 9. 추가 시각 QA가 필요한 항목
- 배포된 실제 브라우저 화면에서 참고 영상과 비교한 최종 density/brightness 미세 조정.
- Chrome/Edge의 Canvas anti-aliasing 및 display scale 차이.
- 3000~4000px 장시간 animation export 시 사용자 PC별 memory/encoding 성능.

이 항목들은 코드가 없는 상태를 완료로 표시하지 않고 실제 브라우저 비교가 필요한 QA 항목으로 남긴다.
