# Circle Frame Studio v0.13 수정 계획서

## 문제
Glow 또는 Shadow를 활성화하면 Auto Fit이 효과의 퍼지는 범위까지 프레임 크기로 계산하면서,
프레임 본체가 갑자기 축소되는 문제가 발생했다.

## 원인
기존 `estimateDesignExtent()`가 아래 항목을 모두 외곽 크기에 포함했다.
- Glow Blur
- Bloom
- Soft Blur
- Shadow Blur
- Shadow Offset

그 결과 효과를 켜거나 강도를 올릴수록 `getProjectFitScale()`이 더 작은 scale을 반환했다.

## 수정 방향
Auto Fit은 **프레임 본체의 구조적 크기**만 기준으로 계산한다.

### Auto Fit에 반영
- 원 반지름
- 선 두께
- Double / Triple 바깥 링
- Wave / Scallop 진폭
- Scribble / Rough / Brush 구조
- 장식 크기 및 장식 위치
- X/Y 위치 이동
- Outline은 실제 형상을 넓히므로 최소 범위만 반영

### Auto Fit에서 제외
- Glow
- Shadow
- Bloom
- Soft Blur

## 결과
- Glow ON/OFF 전후 프레임 본체 크기 동일
- Shadow ON/OFF 전후 프레임 본체 크기 동일
- 미리보기와 저장 PNG에서 동일한 크기 유지
