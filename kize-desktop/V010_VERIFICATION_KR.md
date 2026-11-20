# KIZE DESIGN TOOL v0.10.0 — 구현·검증 상태

## v0.9.0에서 이어지는 개선
- 선택 마스크 중복 알파 곱 적용 해소, 캔버스 경계 선택 축소 수정.
- PSD 클리핑 베이스의 회전/반전 좌표 반영, 미지원 마스크의 원시 픽셀 노출 차단.
- 위쪽 레이어가 보이는 영역에 아래쪽 레이어를 잘못 덮어쓰지 않도록 보수적 가림 제한.
- 스마트 다색 색감 변경. 여러 채도/색상의 개성을 유지하고, 선택한 옵션에 따라 중성 흰색·검정선을 보호한다.
- 100% 보기(원본 이미지 픽셀:CSS 픽셀 1:1). 모니터 하드웨어 물리 픽셀과 동일하다고 주장하지 않는다.
- PNG 색상별 2~6종 시안 ZIP. 기존 레이어와 실행취소 기록을 변경하지 않는 별도 계산. 대용량 안전을 위해 800만 픽셀 이하로 제한.
- PSD 헤더 선검사, worker import 취소, 안전한 기존 문서 유지.
- 작업 저장 전 업데이트 다운로드/설치 차단. 비밀키와 서명 배포 없이 자동 업데이트 활성화하지 않는다.

## 검증 명령
- `cd kize-desktop && npm install && npm test && npm run build`
- Windows + Edge: `node tests/browser-variants.mjs` 와 기존 `browser-*.mjs` 테스트
- Windows: GitHub Actions의 KIZE DESIGN TOOL Windows Build & Startup Check에서 installer/실행 검사
- 실제 600MB PSD:
  `node --max-old-space-size=4096 tests/manual-real-psd.mjs "C:\\actual\\large.psd" "C:\\actual\\photoshop-reference.png"`

## 완료로 표시하지 않는 항목
- **600MB PSD 실물 검증:** 실제 PSD와 Photoshop 출력 PNG가 없으면 미완료. 파일 크기 700MiB 허용만으로 호환성을 증명할 수 없다.
- **포토샵 완전 재현:** 고급 그룹 혼합/조정 레이어/스마트 오브젝트/비표준 벡터 마스크/폰트 효과/ICC 등은 아직 제한적.
- **자동 업데이트:** GitHub Secrets와 실제 서명 릴리스, 설치·롤백, 구버전 프로젝트 호환 테스트를 통과하기 전 미완료.
- **고화질:** 원본 캔버스 PNG 출력은 제공하되, PSD의 모든 특수 효과가 포토샵과 픽셀 일치한다는 보장은 없다.
- **성능:** PNG 시안 ZIP은 메모리 보호 제한을 둔다. 제한 초과의 대형 PSD는 저장/미리보기/레이어 편집의 안정성을 별도 검증해야 한다.

실제 디자인 PSD를 확보하면 마스크/조정/텍스트/스마트 오브젝트 유형별로 테스트를 추가한 뒤에만 범위를 확장한다.
