# Circle Frame Studio v0.26 — 붙어있는 트리플 테두리

## 목표
Triple Ring에서 세 개의 선 사이를 비우지 않고 하나의 연속 밴드처럼 완전히 붙여 배치하며,
각 선의 색상과 두께를 독립적으로 편집할 수 있게 한다.

## 데이터 구조
FrameDesign에 tripleRing 설정 추가:
- attached
- colors: [바깥, 가운데, 안쪽]
- widths: [바깥, 가운데, 안쪽]

## 렌더링
세 선의 전체 두께 합을 기준으로 design.radius 중심에 밴드를 배치한다.
각 선의 중심 반지름은 이전 선의 두께만큼 안쪽으로 이동한다.
Canvas anti-aliasing으로 1px 미만 투명 틈이 생기는 것을 방지하기 위해 각 선은 소량 겹쳐 그린다.

## UI
Triple Ring 선택 시 전용 설정 섹션 표시:
- 세 줄을 여백 없이 붙이기 ON/OFF
- 1줄 색상 / 두께
- 2줄 색상 / 두께
- 3줄 색상 / 두께
- 색상/두께 비율 미리보기

붙이기 ON일 때 기존 공통 '선 두께' 슬라이더는 숨기고 개별 두께 설정을 사용한다.

## 호환성
normalizeDesign에서 이전 프로젝트에 tripleRing 기본값을 자동 보완한다.
따라서 v0.25 이하 저장 내역도 정상적으로 불러오며 기존 Triple Ring은 여백형 상태를 유지한다.
최근 저장 내역/JSON에는 새 설정이 FrameProject에 포함되어 그대로 복원된다.
