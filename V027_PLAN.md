# Circle Frame Studio v0.27 — Glitter Ring Studio

## 목표
참고 이미지처럼 원형 테두리 자체는 부드럽고 얇게 유지하면서,
원 둘레에 작은 광점, 미세 글리터, 4갈래 반짝이를 함께 배치해
과도한 네온이 아닌 실제 반짝이 코팅 같은 링을 만든다.

## 구조
새 RingKind: glitter
새 GlitterSettings:
- density
- particleSize
- sparkleSize
- sparkleRatio
- spread
- glow
- baseOpacity
- edgeHighlight
- colorCount
- colors[4]

## 렌더링
1. 현재 색상/그라데이션으로 반투명 기본 링 렌더
2. 안쪽과 바깥쪽에 얇은 펄 하이라이트 라인 추가
3. Seed 기반으로 원 둘레에 작은 원형 글리터 입자 배치
4. 일부 입자는 4갈래 별 반짝이로 교체
5. 각 입자에 개별 색상과 약한 shadowBlur 적용
6. 동일 Seed를 사용해 미리보기와 PNG 출력 일치

## 프리셋
- Champagne Glitter: 크림/복숭아/골드 계열
- Pink Sugar Glitter
- Lavender Fairy Glitter
- Mint Pearl Glitter
- Ice Diamond Glitter
- Rose Gold Glitter

## 호환성
normalizeDesign에서 v0.26 이하 프로젝트는 기본 GlitterSettings를 자동 보완.
최근 저장 내역과 JSON에 FrameDesign.glitter가 함께 저장되어 그대로 복원된다.
