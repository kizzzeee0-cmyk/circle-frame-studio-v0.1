# Circle Frame Studio v0.13

원형 프레임을 만들고 **테두리 외부는 투명 배경**으로 PNG 저장하는 React/Vite 기반 웹앱입니다.

## v0.13 핵심 수정

### Glow / Shadow 사용 시 프레임 크기가 작아지는 오류 수정
이전 버전에서는 Auto Fit 계산에 Glow, Shadow, Bloom, Soft Blur의 퍼지는 범위까지 포함되어,
효과를 켜는 순간 원형 프레임 본체가 자동으로 축소되는 문제가 있었습니다.

v0.13부터는:
- 프레임의 **실제 구조 크기**를 기준으로 Auto Fit 계산
- Glow ON/OFF 시 원 크기 유지
- Shadow ON/OFF 시 원 크기 유지
- Bloom / Soft Blur를 바꿔도 원 크기 유지
- 미리보기와 PNG 저장 모두 같은 크기 기준 유지
- Outline은 실제 외곽 형상을 넓히므로 최소한의 범위만 Auto Fit에 반영

## 유지 기능
- 3갈래 Long 3-Cut Segments 프리셋
- 모든 디자인 Outline 기능
- 1/2/3/4색 패턴 반복
- PNG 업로드 반복 프레임
- 미리보기 = 저장 결과 일치
- 2000×2000 투명 PNG 저장
- 단일 프레임 구조
- v0.12 ~ v0.3 자동 저장 데이터 불러오기

## 실행 방법

```bash
npm install
npm run dev
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
