# Circle Frame Studio v0.25 — 최근 저장 내역 10개

## 목표
디자인 파일 저장 → 최근 저장 내역 자동 기록 → 브라우저 재접속 →
이전 작업 선택 → 전체 설정 복원 → 이어서 편집 흐름을 제공한다.

## 저장 구조
브라우저 IndexedDB의 `recent-saves` object store에 저장한다.
각 기록에는:
- 고유 ID
- 저장 시각
- 저장 방식(PNG / JSON)
- 앱 버전
- 디자인명
- 320×320 WebP 미리보기
- 전체 FrameProject 스냅샷
을 기록한다.

## 전체 상태 복원
FrameProject 자체를 구조화 복제로 보관하므로 다음을 포함한다:
- 모든 레이어와 순서
- 레이어 visible 상태
- 현재 선택 레이어
- 모든 FrameDesign 설정
- Gradient Stops
- TwoTone 2/4/6/8 구간
- Emboss / Bevel 전체 세팅
- Glow / Shadow / Outline
- Custom PNG / WebP / SVG 반복 프레임 data URL
- Auto Fit

불러올 때는 저장된 객체를 그대로 setState하지 않고 기존 `normalizeProject()`를 통과시켜
향후 새 옵션이 생기더라도 빠진 값은 현재 버전 기본값으로 보완한다.

## 관리
- 최신순
- 최대 10개
- 초과 시 가장 오래된 기록 자동 삭제
- 같은 디자인도 다시 저장하면 새 기록
- 개별 삭제
- 전체 삭제 + 확인창
- 불러오기 + 현재 작업 변경 확인창

## UI
상단 툴바에 `최근 저장 내역` 버튼 추가.
기존 UI 배치는 유지하고 modal overlay만 추가한다.
왼쪽에는 저장 기록 목록, 오른쪽에는 선택 항목의 큰 미리보기를 표시한다.

## 저장 트리거
- PNG 내보내기 완료 후 기록
- JSON 저장 후 기록
- Ctrl/Cmd + S JSON 저장도 기록
