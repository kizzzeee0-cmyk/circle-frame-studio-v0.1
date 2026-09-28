# Circle Frame Studio v0.16 계획서

## 업데이트 목표
끊긴형(segmented) 프레임에서 gap 값을 변경했을 때
모든 선 조각 길이가 동일하게 유지되도록 렌더링 로직을 수정한다.

## 문제
기존에는 `setLineDash([dash, gap])`를 원형 전체에 적용했기 때문에
원의 둘레 길이와 dash/gap 패턴이 딱 맞아떨어지지 않으면
마지막에 남는 길이가 특정 조각에 몰려서
**한 조각만 더 길어지는 현상**이 발생했다.

## 해결 방식
1. segmented 타입에 대해 lineDash 방식 대신 **직접 세그먼트 계산 방식** 사용
2. 현재 반지름 기준 원 둘레를 계산
3. 기존 dash/gap 값을 참고해 세그먼트 개수를 결정
4. `segmentLength = (circumference - gap * count) / count` 공식을 사용해
   모든 조각 길이를 동일하게 재계산
5. 각 조각을 arc로 개별 stroke하여 균등하게 표시

## 기대 결과
- gap을 좁혀도 모든 선 길이가 같음
- gap을 넓혀도 모든 선 길이가 같음
- Broken Circle / Wide Broken / Rounded Segments / Long 3-Cut Segments 등에서
  더 안정적인 결과 제공
