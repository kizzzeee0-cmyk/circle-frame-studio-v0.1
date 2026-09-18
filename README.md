# Circle Frame Studio v0.6

원형 프레임을 만들고 **테두리 외부는 투명 배경**으로 PNG 저장하는 React/Vite 기반 웹앱입니다.

## v0.6 핵심 업데이트

### 1) 리본 디자인 전면 수정
- 사용자가 첨부한 예시처럼 **넓고 둥근 보우(bow) 형태**로 리본 실루엣 개선
- 기존보다 더 **귀엽고 통통하고 정돈된 느낌**의 리본으로 변경
- 중앙 매듭과 좌우 루프 비율을 더 크게 조정
- 꼬리 부분은 짧고 두툼하게 정리
- 안쪽 접힘은 투명 컷이 아닌 **부드러운 하이라이트 방식**으로 표현

### 2) 기존 기능 유지
- 1/2/3/4색 패턴 반복 유지
- 하트 / 리본 / 꽃 / 도트 / 별 / 반짝이 / 업로드 PNG 반복 프레임 유지
- 미리보기 = 저장 결과 일치 구조 유지
- 단일 프레임 구조 유지
- 2000×2000 투명 PNG 저장 유지

### 3) 호환성 유지
- v0.5 / v0.4 / v0.3 자동 저장 데이터 불러오기 유지
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
