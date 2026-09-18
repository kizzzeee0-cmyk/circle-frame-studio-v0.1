# Circle Frame Studio v0.5

원형 프레임을 만들고 **테두리 외부는 전부 투명 배경**으로 PNG 저장하는 React/Vite 기반 웹앱입니다.

## v0.5 핵심 업데이트

### 1) 리본 모양 개선
- 기존 리본보다 더 **둥글고 귀엽고 아기자기한 리본 실루엣**으로 변경
- 루프(윗부분)가 더 말랑하고 둥글게 보이도록 수정
- 꼬리 부분도 딱딱한 삼각형 느낌보다 더 부드럽게 정리
- 리본 하이라이트를 아주 약하게 넣어 입체감 개선

### 2) 패턴 프레임 4색 지원
- 하트 / 리본 / 꽃 / 별 / 반짝이 / 도트 / 사용자 PNG 반복 프레임에서
  **1색 / 2색 / 3색 / 4색 반복** 지원
- 4번째 색상 컬러피커 추가
- 색상 순환 미리보기 강화

### 3) 프리셋 확장
- Four Color Heart Ring
- Four Color Ribbon Ring
- Four Color Flower Ring
- Four Color Dots
- 둥근 리본 기반 프리셋 강화

### 4) 기타 보완 사항
- v0.4, v0.3 자동 저장 데이터 호환
- 기존 JSON도 가능한 범위에서 불러오기 유지
- 단일 프레임 편집 구조 유지
- 2000×2000 투명 PNG 저장 유지
- 미리보기 = 저장 결과 기준 유지

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/` 접속.

## 빌드

```bash
npm run build
```

## Cloudflare Pages 권장 설정

- Framework preset: **Vite** 또는 **None**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: 비워두기

## 주요 조작
- 프리셋 클릭: 현재 프레임 교체
- Alt + 캔버스 클릭: 스포이드 색상 추출
- `내 PNG로 반복 프레임 만들기`: 투명 PNG/WebP/SVG 업로드
- JSON 저장/불러오기 지원

