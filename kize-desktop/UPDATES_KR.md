# KIZE DESIGN TOOL v0.4 — 구현 현황 / 배포 가이드

## 제작 범위
- 기존 원형 테두리 / 큐트 패턴 UI 삭제 (원본 저장소와 Cloudflare Pages 사이트는 삭제하지 않음).
- PSD 레이어 추출: 8bit PSD 한정, 레이어별 개별 위치/불투명도 및 기본 합성 지원.
- PSD/PNG/JPG/WebP/BMP 가져오기, 레이어 선택 및 레이어 내부 연결된 색상 영역만 변경.
- 같은 색상의 분리된 도형도 [인접 영역만]으로 분리. 모든 레이어에서 일괄 변경하지 않음.
- 확대·축소 10~800%, 화면 맞춤, 중앙 정렬, 스마트 가이드, 좌우/상하 반전, 90도 회전.
- 이미지 교체: 선택 레이어 위치와 크기를 보존한 사진 배치, 이미지 내부 이동/확대.
- 카메라 RAW 스타일의 간단한 노출/대비/채도/색온도/하이라이트/그림자 조정 (Adobe Camera Raw 기술 동일 아님).
- PSD의 텍스트 메타데이터를 읽어 문구/폰트/크기/색상 미리보기 변경 (포토샵 효과·타이포그래피 동일 재현 불가).
- PNG 및 KIZE 프로젝트 저장. 원본 PSD 직접 재저장 및 전체 스마트 오브젝트 편집은 미지원.

## 정확도/제한
1. 읽는 도중 원본 PSD는 덮어쓰지 않습니다. PNG 출력은 원본 캔버스 해상도를 유지하나 벡터 정보·스마트 오브젝트와 PSD 효과의 픽셀 동일 복원은 보장하지 않습니다.
2. PSD 8bit, 8500px 이하, 총 2600만 픽셀, 90MB 이하, 최대 120개 레이어 기준으로 보호 제한을 둡니다.
3. 일부 혼합모드/마스크/그룹 조합은 Photoshop과 다르게 합성될 수 있습니다.
4. 텍스트는 미리보기용 Canvas 재렌더링이며 원래 폰트가 설치되지 않으면 스타일이 달라질 수 있습니다.
5. 여러 레이어의 포토샵 자체 효과를 그대로 수정·복원하거나 원본 PSD 구조로 되돌리는 기능은 향후 개발 대상입니다.

## Windows 빌드
GitHub 저장소: kizzzeee0-cmyk/circle-frame-studio-v0.1
개발 브랜치: kize-editor-v0.4-development
워크플로: .github/workflows/kize-editor-v04-build.yml
Actions 성공 후 Artifacts의 'KIZE-DESIGN-TOOL-v0.4.0-Windows'에서 설치 EXE를 다운로드합니다.
Windows PC에는 Rust/Node.js/C++ 빌드 도구가 필요 없습니다. WebView2가 없으면 설치될 수 있습니다.

## 자동 업데이트 안전 설정 (중요)
Tauri 공식 플러그인을 사용한 **서명된 인앱 업데이트 구조**가 프로젝트에 존재합니다. 그러나 서명 키와 배포가 설정되지 않으면 자동 업데이트는 동작하지 않습니다.

기존 v0.3.0 설치본은 업데이트 엔진이 없으므로, v0.4 계열의 **업데이트가 활성화된 서명된 빌드**를 1회 직접 설치해야 합니다.

설치 이후 업데이트 순서:
- 사용자: ChatGPT 대화에서 요청 -> GitHub 코드 수정 / 테스트 -> 서명된 릴리스 승인.
- GitHub Actions: 새 빌드에 private signing key로 서명하고 최신 버전 메타데이터 발표.
- 앱: 실행 중/시작 시 HTTPS latest.json 확인, Tauri 공개키로 서명 검증, 파일 다운로드 및 자체 설치, 문서 보호를 위한 재시작 확인.

**서명 키**는 GitHub 공개 저장소나 대화의 코드에 넣으면 안 됩니다.
GitHub 저장소의 Settings > Secrets and variables > Actions에서 아래를 설정할 수 있습니다:
- Repository variable 'KIZE_UPDATER_PUBLIC_KEY': 공식 `tauri signer generate`에서 나온 공개키 전체 문자열
- Repository secret 'KIZE_UPDATER_PRIVATE_KEY': 같은 쌍의 비밀키 전체 내용
- Repository secret 'KIZE_UPDATER_PASSWORD': 선택적 비밀키 암호

키를 등록한 뒤 빌드 워크플로를 수동 실행하며 `publish_update=true`를 사용하면 서명된 설치파일과 latest.json을 GitHub Releases로 배포하도록 준비되어 있습니다. 미설정 상태의 빌드는 **일반 EXE만 만들며** 인앱 자동 업데이트를 광고하지 않습니다.

주의: 키를 분실하거나 변경하면 이전 설치본이 업데이트 서명을 검증하지 못할 수 있습니다. 개인 키의 안전한 백업이 필요합니다.

## 추가 테스트 필요
- 사용자 실제 방송용 배너 PSD 샘플들로 레이어/텍스트/마스크/블렌딩 일치 여부 검증
- Windows에 설치 후 앱 실행·이미지 교체·프로젝트 복원 UI 검사
- 서명키 설정 후 v0.4 -> v0.4.1 실제 자동 업데이트 경로 E2E 테스트

