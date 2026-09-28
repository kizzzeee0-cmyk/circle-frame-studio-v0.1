# Circle Frame Studio v0.19 수정 계획서

## 목표
기존 v0.18의 모든 기능을 그대로 유지하면서,
흰색 + 한 가지 메인색이 **원 둘레를 따라 흐르는** 2색 그라데이션 시스템을 추가한다.

## 핵심 변경
1. `FrameDesign.twoToneFlow` 설정 추가
2. conic gradient 기반 전용 렌더러 추가
3. 흰색 구간의 위치 / 길이 / 연결 부드러움 개별 조절
4. 흐름 회전 조절
5. 반짝임 / 안쪽 하이라이트 / 바깥쪽 하이라이트 조절
6. 기존 v0.18 두께 방향 TwoTone 프리셋을 새 둘레 방향 Flow 프리셋으로 교체
7. 왼쪽 프리셋 카테고리에 **2색 흐름** 추가
8. 기존 레이어 / 리본 / 하트 / 꽃 / 별 / 스파클 / 낙서형 / 브러시 / 끊긴형 / PNG 반복 / 4컬러 / Glow / Shadow / Outline 기능 유지

## 렌더링 로직
- Canvas `createConicGradient()` 사용
- 원 둘레를 96단계로 샘플링해 부드러운 색 전환 생성
- 흰색 중심 구간은 순수 보조색 유지
- 연결부는 smoothstep 보간으로 급격한 경계 방지
- 0/1 seam에서도 같은 색이 계산되도록 circular distance 사용
- 별도 highlight arc를 사용해 샘플 사진처럼 은은한 광택감 제공

## 기본값
- whiteCenter: 0.54
- whiteWidth: 0.24
- blendWidth: 0.12
- rotation: -14°
- glossStrength: 0.16
- innerHighlight: 0.12
- outerHighlight: 0.09

## 추가 프리셋
- Lavender Flow Soft
- Lavender Flow Wide White
- Lavender Flow Glossy
- Lavender Flow Subtle
- Pink Flow Soft
- Mint Flow Soft
- Sky Flow Soft
- Peach Flow Soft

## 호환성
- v0.18 ~ v0.3 자동 저장 데이터 불러오기 유지
- 기존 JSON은 normalize 단계에서 twoToneFlow 기본값을 자동 보완
- 기존 사용자 프리셋 유지
