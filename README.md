# Circle Frame Studio v0.7

원형 프레임을 만들고 **테두리 외부는 투명 배경**으로 PNG 저장하는 React/Vite 기반 웹앱입니다.

## v0.7 핵심 업데이트

### 1) 리본 아래 꼬리 디자인 수정
- 기존 리본 밑부분이 너무 뾰족하게 보이던 문제 수정
- **리본 아래 꼬리도 더 둥글고 귀엽게** 변경
- 전체적으로 말랑하고 스티커 같은 인상 강화

### 2) 리본 스타일 세분화
리본 프레임에서 이제 스타일을 직접 고를 수 있습니다.
- **Rounded Ribbon**: 둥글고 귀여운 기본형
- **Simple Ribbon**: 더 단순하고 정리된 리본
- **Pink Sticker Ribbon**: 핑크 리본 스티커 느낌

### 3) 리본 프리셋 강화
- Rounded Ribbon Ring
- Mini Simple Ribbon Ring
- Pink Sticker Ribbon Ring
- Simple Pastel Ribbon Ring
- Neon Ribbon Ring 유지

### 4) 기존 기능 유지
- 1/2/3/4색 패턴 반복 유지
- 하트 / 리본 / 꽃 / 도트 / 별 / 반짝이 / 업로드 PNG 반복 프레임 유지
- 미리보기 = 저장 결과 일치 구조 유지
- 2000×2000 투명 PNG 저장 유지
- 단일 프레임 구조 유지

### 5) 호환성 유지
- v0.6 / v0.5 / v0.4 / v0.3 자동 저장 데이터 불러오기 유지
- 이전 JSON 불러오기 유지

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
