# Circle Frame Studio v0.29 — Smooth Glitter Motion

## 문제
v0.28은 motion 값이 특정 수치를 넘을 때 십자 광선/작은 하이라이트를 켜는 조건문이 있어
빛이 자연스럽게 밝아지는 대신 갑자기 나타나거나 사라지는 느낌이 있었다.
또 메인 미리보기에서 2000×2000 캔버스를 매 프레임 다시 그려 실제 FPS가 떨어질 수 있었다.

## 수정
1. hard threshold 제거
2. smoothstep 기반 continuous fade
3. 최소 잔광 floor 유지
4. 크기 변화 축소, 밝기 변화 중심
5. Flash의 7제곱 급격한 펄스를 부드러운 envelope로 교체
6. Shimmer / Orbit에 trailing lobe 추가
7. animationSmoothness 설정 추가
8. 메인 미리보기 렌더 캔버스 1200×1200, PNG 출력은 2000×2000 유지
9. 프리셋 썸네일 24fps

## 기대 결과
빛점이 매 프레임 새로 생기는 느낌이 아니라 같은 빛이 천천히 밝아졌다 사라지고,
둘레를 이동하는 빛도 머리와 꼬리가 이어지며 자연스럽게 흐른다.
