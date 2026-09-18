# Circle Frame Studio v0.1

브라우저에서 다양한 원형 테두리를 조합·편집하고 **2000×2000 투명 PNG**로 저장하는 React/Vite 기반 도구입니다.

## v0.1 포함 기능

- 약 50개 이상의 절차형 원형 프레임 프리셋
- Basic / Double / Triple / Broken / Arc / Dot / Wavy / Scallop / Scribble / Rough / Brush / Sparkle / Star / Heart / Glow / Gradient / Glossy / Abstract
- 모든 프레임 색상 변경
- HEX 입력 + 브라우저 EyeDropper + Alt+캔버스 클릭 색 추출
- 12종 파스텔 계열 색상 팔레트
- Solid / Linear / Radial / Angular(Conic) Gradient
- Gradient Stop 2~8개 및 각 위치 조절
- 반지름 / 두께 / 회전 / X,Y 위치 / 불투명도
- 정확한 원 비율 유지
- Glow / Bloom / Soft Blur / Shadow
- Broken/Segmented 조각 길이·빈 공간 조절
- Scribble/Rough 거칠기·겹 수·Seed
- Wavy/Scallop 물결 높이·개수
- Dot/Star/Sparkle/Heart 개수·크기
- 레이어 추가 / 숨김 / 잠금 / 순서 / 복제 / 삭제
- 실행취소 / 다시실행 (Ctrl+Z / Ctrl+Y)
- 내 프리셋 저장 (LocalStorage)
- 작업 자동 저장 (LocalStorage)
- 프로젝트 JSON 저장 / 불러오기
- 투명 PNG 2000×2000 출력
- Auto Fit: 글로우/장식까지 고려하여 PNG 가장자리가 잘리지 않도록 자동 크기 맞춤

## 로컬 실행

Node.js 22 권장.

```bash
npm install
npm run dev
```

브라우저에 표시되는 로컬 주소로 접속합니다.

## 프로덕션 빌드

```bash
npm run build
```

결과는 `dist/`에 생성됩니다.

## Cloudflare Workers Static Assets 배포

`wrangler.jsonc`가 이미 포함되어 있습니다.

1. Cloudflare 계정에 로그인합니다.
2. 프로젝트 폴더에서 의존성을 설치합니다.
3. Wrangler 인증을 진행합니다.
4. 배포합니다.

```bash
npm install
npx wrangler login
npm run deploy
```

`wrangler.jsonc`의 핵심 설정:

```jsonc
{
  "name": "circle-frame-studio",
  "compatibility_date": "2026-09-19",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

원하는 Workers 프로젝트 이름이 있으면 `name` 값만 변경하세요.

## GitHub에 업로드

새 GitHub 저장소를 만든 뒤 이 ZIP의 **폴더 안 내용 전체**를 저장소 루트에 올립니다.

```bash
git init
git add .
git commit -m "Circle Frame Studio v0.1"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## GitHub Pages 사용

`.github/workflows/deploy-pages.yml`도 포함했습니다.

GitHub 저장소에서:

1. **Settings → Pages**
2. Source를 **GitHub Actions**로 선택
3. `main` 브랜치에 push
4. Actions의 `Deploy to GitHub Pages`가 완료되면 접속 가능

`vite.config.ts`의 `base: './'` 설정 덕분에 사용자/조직 페이지뿐 아니라 일반 프로젝트 저장소 Pages 경로에서도 정적 asset 경로가 깨지지 않도록 구성되어 있습니다.

## 사용 팁

- 프리셋 클릭: 새 레이어로 추가
- Alt + 캔버스 클릭: 현재 캔버스에 보이는 색을 선택 레이어 기본 색상으로 추출
- 색상 옆 `⌾`: 지원 브라우저에서 화면 전체 EyeDropper 사용
- `Conic Gradient`: 원 둘레를 따라 색이 흐르는 링 제작에 가장 적합
- `Auto Fit`: 큰 Glow/Shadow/Decoration을 사용한다면 켜두는 것을 권장
- JSON 저장: 나중에 완전히 같은 레이어 설정으로 다시 작업 가능

## 구조

```text
src/
├─ components/
│  ├─ CanvasPanel.tsx
│  ├─ LayerPanel.tsx
│  ├─ PresetBrowser.tsx
│  └─ PropertyPanel.tsx
├─ presets/
│  ├─ index.ts
│  └─ palettes.ts
├─ render/
│  └─ renderer.ts
├─ utils/
│  ├─ export.ts
│  └─ id.ts
├─ App.tsx
├─ main.tsx
├─ styles.css
└─ types.ts
```

## v0.2 후보

- SVG/PNG 사용자 장식 업로드
- 장식을 원 둘레에 자동 반복 배치
- 외부 PNG/SVG의 색상 재매핑
- 프리셋 즐겨찾기
- 개별 Segment를 타임라인처럼 직접 편집
- 레이어 그룹 / 마스크 / Blend Mode
- Reference Image에서 팔레트 자동 추출
- 사용자 프리셋 JSON 공유
- 고해상도 4000×4000 및 임의 크기 출력
- SVG 벡터 출력
