# Circle Frame Studio v0.4

원형 프레임을 하나씩 선택·편집하고 2000×2000 투명 PNG로 저장하는 React/Vite 웹앱입니다.

## v0.4 핵심 수정

- **미리보기와 PNG 저장 렌더 해상도를 모두 2000×2000으로 통일**
- 편집 화면에서 보이던 프레임과 저장 결과의 크기/배치를 동일하게 유지
- Auto Fit 외곽 계산 강화
- Glow / Shadow / Bloom / Soft Blur의 확산 범위를 안전 영역 계산에 반영
- Double / Triple / Wavy / Scribble / Brush 등 프레임 종류별 실제 외곽 범위 계산
- 하트 / 리본 / 꽃 / 도트 / 사용자 PNG 반복 장식의 외곽 범위 계산 개선
- 사용자 PNG는 **가장 긴 변을 기준으로 장식 크기 적용**하여 가로로 긴 이미지가 과도하게 튀어나오지 않도록 수정
- Auto Fit ON 기준 약 50px의 투명 안전 여백 확보
- v0.3 자동 저장 및 내 프리셋 마이그레이션 지원

기존 v0.3의 단일 프레임 편집, 1~3색 반복 팔레트, PNG/WebP/SVG 업로드 반복 프레임, 낙서/네온/브러시/리본/꽃 프리셋 기능은 그대로 유지됩니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/`로 접속합니다.

## 빌드

```bash
npm run build
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: 비워두기

## 파일

- `V04_PLAN.md`: v0.4 수정 계획서
- `src/render/renderer.ts`: 프레임 렌더링 및 Safe Fit 계산
- `src/components/CanvasPanel.tsx`: 2000×2000 실제 미리보기 캔버스
- `src/utils/export.ts`: 2000×2000 투명 PNG 저장
