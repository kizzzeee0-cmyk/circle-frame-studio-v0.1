# KIZE DESIGN TOOL v0.11.0 — 설정이 필요 없는 업데이트 알림

v0.11부터 공식 **KIZE GitHub Releases**만 조회합니다.
`kize-vX.Y.Z` 정식 버전의 설치 ZIP/EXE가 실제로 업로드된 경우에만 새 버전으로 표시합니다.

## 사용자 동작
1. 프로그램 시작 시 비차단형으로 GitHub 공개 Releases 목록을 확인합니다.
2. 최신 KIZE 버전이 설치된 버전보다 높으면 상단에 작은 NEW와 버전 정보를 표시합니다.
3. NEW 강조는 해당 버전의 알림을 처음 클릭한 이후 로컬 설정에 기록하여 다시 표시하지 않습니다.
4. 변경사항 보기 → '설치 ZIP 다운로드'를 직접 클릭하면 기본 브라우저가 공식 GitHub ZIP을 엽니다.
5. 사용자가 프로젝트 저장, 프로그램 종료, 새 EXE 실행으로 설치합니다. 백그라운드 다운로드/설치하지 않습니다.

> 기존 v0.10.0 앱은 이 알림 기능을 갖고 있지 않으므로 v0.11.0은 **한 번 수동 설치**해야 합니다.

## KIZE 개발자 배포
- KIZE 편집기 개발 브랜치: `kize-v0.9.0-group-vector-mask` (예전 명칭이지만 KIZE 전용).
- 다음 기능 업데이트 시 `kize-desktop/package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `release-feed.mjs`, `index.html`의 버전을 같은 X.Y.Z로 올립니다.
- 같은 버전의 `kize-desktop/RELEASE_NOTES_KR.md` 내용도 갱신합니다.
- 브랜치에 병합하면 Windows Actions가 테스트·설치 빌드를 통과한 뒤 **서명키 없이** GitHub Release `kize-vX.Y.Z`에 EXE, ZIP, SHA-256 체크섬을 게시합니다.
- 기존 버전으로는 릴리스를 덮어쓰지 않습니다. 다음 업데이트를 게시하려면 반드시 버전 번호를 올립니다.
- GitHub 저장소가 공개 상태여야 인증 없는 앱에서도 Releases API와 설치 파일을 받을 수 있습니다.

## 보안/제약
- 수신한 URL은 `github.com/kizzzeee0-cmyk/circle-frame-studio-v0.1/releases/download/kize-v.../` 경로만 허용합니다.
- 임의 사이트 URL, 관련 없는 Circle Frame Studio 릴리스, 자산이 없는 릴리스, prerelease는 무시합니다.
- `@tauri-apps/plugin-opener`는 허용된 KIZE Release URL만 기본 브라우저로 엽니다.
- 실패 시 편집 기능을 막지 않고 '업데이트 확인 불가'를 표시합니다.
- 키 없이 실행되는 EXE이므로 Windows SmartScreen은 신뢰도에 따라 경고할 수 있습니다.
- 기존의 공식 서명 자동 설치 방식과 다르게 최신 ZIP을 스스로 실행하는 기능은 **구현하지 않습니다**.
