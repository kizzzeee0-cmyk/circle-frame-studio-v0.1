# Circle Frame Studio v0.24 수정 계획서 / 적용 내역

## 목표
2색 흐름 그라데이션을 2/4구간뿐 아니라 6/8구간까지 확장한다.

## 구현
- repeatCount: 1 | 2 | 3 | 4
- 1 = 2구간
- 2 = 4구간
- 3 = 6구간
- 4 = 8구간

## 렌더링
- conic gradient 반복 횟수를 최대 4까지 지원
- 각 반복 주기를 동일한 비율로 계산
- 모든 흰색 구간과 선택색상 구간의 길이를 균일하게 유지
- 반복 수 증가에 따라 gradient sampling 수 자동 증가

## UI
- 둘레 색상 구성 메뉴에 6구간/8구간 추가
- N구간 패턴 위치 라벨 자동 표시
- 각 흰색 구간 길이 조절 유지
- 미리보기 표시도 반복 수에 맞춰 확장

## 카테고리 / 프리셋
- 2색 6구간
- 2색 8구간
- Lavender 6-Segment Flow
- Pink 6-Segment Flow
- Lavender 8-Segment Flow
- Mint 8-Segment Flow
