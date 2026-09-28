# Circle Frame Studio v0.20 수정 계획서

## 요청 핵심
v0.19의 현재 2색 흐름은 유지한다.
추가로 실제 선택 색상은 **흰색 + 사용자 선택색상** 2개만 사용하지만,
원 둘레에는 다음 순서로 4구간이 보이는 전용 그라데이션을 추가한다.

**흰색 → 선택색상 → 흰색 → 선택색상**

## 왜 별도 전용 모드가 필요한가
기존 일반 Gradient Stop 4개 방식에서도 비슷한 배치는 가능했지만,
흰색 구간 길이를 수정하면 stop 간격이 비대칭이 되거나
연결부가 갑자기 좁아져 그라데이션이 어색해지는 문제가 있었다.

## 구현
- TwoToneFlowSettings에 repeatCount(1 | 2) 추가
- repeatCount=1: 기존 v0.19 2구간 흐름
- repeatCount=2: 신규 v0.20 4구간 반복 흐름
- 한 주기의 색상 비율을 계산한 뒤 원 둘레에 정확히 2회 반복
- 두 흰색 구간 길이 자동 동일
- 두 선택색상 구간 길이 자동 동일
- blendWidth는 남은 색상 구간을 침범하지 않도록 자동 상한 계산
- smoothstep 보간으로 연결부 자연스럽게 유지
- 광택 하이라이트도 흰색 구간마다 동일하게 2회 반복

## UI
2색 흐름 모드 안에 '둘레 색상 구성' 선택 추가:
- 2구간 · 흰색 → 선택색상
- 4구간 · 흰색 → 선택색상 → 흰색 → 선택색상

4구간 선택 시:
- 각 흰색 구간 길이
- 패턴 위치
- 연결 부드러움
- 흐름 회전
- 반짝임
- 안쪽 빛
- 바깥쪽 빛
을 조절 가능하게 유지한다.

## 프리셋
- Lavender 4-Segment Flow
- Lavender 4-Segment Wide White
- Lavender 4-Segment Soft
- Lavender 4-Segment Glossy
- Pink 4-Segment Flow
- Mint 4-Segment Flow
- Sky 4-Segment Flow

## 유지 사항
- v0.19 2구간 Flow
- 일반 2/3/4색 Gradient Stop
- 기존 전체 프레임
- 레이어 시스템
- PNG 반복 프레임
- 패턴 1~4색
- Glow / Shadow / Outline
- 2000×2000 투명 PNG 저장
- 미리보기와 저장 결과 일치
