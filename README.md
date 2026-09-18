# Circle Frame Studio v0.8

원형 프레임을 만들고 **테두리 외부는 투명 배경**으로 PNG 저장하는 React/Vite 기반 웹앱입니다.

## v0.8 핵심 업데이트

### 1) 리본 모양 재수정
첨부해주신 리본 예시를 참고하여 Rounded Ribbon 디자인을 다시 다듬었습니다.

- **리본 아래 꼬리를 양옆으로 더 벌어진 형태**로 수정
- **꼬리 끝부분을 더 둥글게** 정리
- **윗부분 루프와 매듭의 두께를 조금 더 얇게** 조정
- **윗 루프 안쪽은 색을 채우지 않고 비워진 형태**로 변경
- 전체적으로 더 **심플하고 깔끔한 리본 아이콘 느낌**으로 정리

### 2) 리본 스타일 정리
- 기존 Ribbon 스타일 세분화 기능은 제거
- 사용성이 가장 좋았던 **Rounded Ribbon 계열 중심**으로 정리
- 불필요했던 Simple / Sticker 스타일 선택 UI 제거

### 3) 기존 기능 유지
- 1/2/3/4색 패턴 반복 유지
- PNG 업로드 반복 프레임 유지
- 미리보기 = 저장 결과 일치 유지
- 2000×2000 투명 PNG 저장 유지
- 단일 프레임 구조 유지

### 4) 호환성 유지
- v0.7 / v0.6 / v0.5 / v0.4 / v0.3 자동 저장 데이터 불러오기 유지
- 기존 JSON 불러오기 유지

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
