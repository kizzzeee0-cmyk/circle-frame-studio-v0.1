# Circle Frame Studio v0.2

원형 프레임을 조합·수정하고 **테두리 이외의 부분을 모두 투명 배경 PNG**로 추출하는 React/Vite 기반 웹앱입니다.

## v0.2 핵심 업데이트

- 낙서 / 러프 / 브러시 / 네온 사인 느낌 프리셋 확장
- 하트 / 리본 / 꽃 패턴 원형 프레임 추가
- 장식 개수(간격), 크기, 거리, 회전 오프셋 조절
- 기본 색상 + 보조 색상을 **번갈아 반복**하는 장식 패턴 지원
- **투명 PNG 업로드 → 원형 반복 배치** 기능 추가
  - 예: 하트, 리본, 꽃, 캐릭터 스티커 등을 원형 프레임으로 둘러 배치
- Auto Fit 유지 + 2000×2000 투명 PNG 출력
- JSON 저장/불러오기, 로컬 자동 저장, 내 프리셋 저장 유지
- Cloudflare Pages 배포 시 빌드가 더 쉽게 되도록 `build` 스크립트를 `vite build`로 조정

## 추천 사용 예시

- 프로필 사진 원형 테두리
- 움짤 프사용 네온 링
- 귀여운 리본/하트 도트 링
- 꽃/리본 레이스형 프레임
- 업로드한 투명 PNG를 이용한 커스텀 장식 프레임

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

## 프로젝트 구조

```text
src/
├─ components/
├─ presets/
├─ render/
├─ utils/
├─ App.tsx
├─ styles.css
├─ global.d.ts
└─ vite-env.d.ts
```

## 참고 사항

- `asset` 종류 레이어를 선택하면 투명 PNG/WebP/SVG를 업로드할 수 있습니다.
- 업로드한 이미지는 데이터 URL 형태로 프로젝트 JSON에 저장될 수 있으므로, 파일 크기가 너무 크면 JSON도 커질 수 있습니다.
- 프리셋은 단일 레이어 추가 방식입니다. 여러 레이어를 조합해 더 복잡한 프레임을 만들 수 있습니다.
