# Circle Frame Studio v0.2 계획서

## 목표
기존 v0.1의 기본/글로우/브러시/낙서형 원형 테두리 편집기를 확장하여,
**귀여운 장식 패턴형 프레임**과 **사용자 업로드 PNG 반복 장식 기능**까지 지원하는 버전으로 업데이트한다.

## 사용자 요청 반영 항목

### 1) 프레임 종류 확장
- 낙서 느낌 프레임 강화
- 네온 사인 느낌 프리셋 확장
- 리본 / 하트 / 꽃 패턴 원형 프레임 추가
- 샘플과 비슷한 귀여운 반복 장식 프레임 강화

### 2) 장식 패턴 커스터마이즈
- 색상 변경
- 보조 색상과 번갈아 적용
- 장식 개수(간격 체감)
- 장식 크기
- 장식이 링에서 얼마나 떨어질지(거리)
- 장식의 회전 오프셋
- 정방향 유지 옵션

### 3) 사용자 업로드 PNG 반복 프레임
- 배경이 투명한 PNG/WebP/SVG 업로드
- 업로드한 이미지를 원 둘레에 반복 배치
- 크기/개수/거리 조절
- 예: 하트 PNG, 리본 PNG, 꽃 PNG, 작은 스티커 PNG

### 4) 편의 기능
- Auto Fit 유지
- JSON 저장/불러오기 유지
- 로컬 자동 저장 유지
- 내 프리셋 저장 유지
- Cloudflare Pages 배포 안정성 보완

## 구현 범위

### 렌더링
- 신규 장식 도형 렌더러: ribbon / flower / asset
- alternate color 렌더링
- asset preload 후 미리보기/PNG 출력

### UI
- 장식 패턴 전용 슬라이더 추가
- asset 업로드 입력 추가
- 종류 선택 select 확장
- v0.2 프리셋군 추가

### 배포/빌드
- `src/vite-env.d.ts`, `src/global.d.ts` 추가
- `npm run build` → `vite build`
- Cloudflare Pages 기준 빌드 단순화

## v0.2 결과물
- 실행 가능한 React/Vite 프로젝트 ZIP
- GitHub 업로드 가능 구조
- Cloudflare Pages 연결 가능 구조
