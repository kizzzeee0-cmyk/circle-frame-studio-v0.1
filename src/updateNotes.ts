export const APP_VERSION = '0.37'

export const UPDATE_SEEN_KEY = `circle-frame-studio-update-seen-v${APP_VERSION}`

export interface UpdateHighlight {
  title: string
  description: string
  badge?: string
}

export interface UpdateAction {
  label: string
  presetId: string
  description: string
}

export interface UpdateRelease {
  version: string
  eyebrow: string
  title: string
  summary: string
  highlights: UpdateHighlight[]
  actions: UpdateAction[]
}

export const CURRENT_UPDATE: UpdateRelease = {
  version: APP_VERSION,
  eyebrow: '이번 업데이트 핵심',
  title: '새로 생긴 기능을 첫 화면에서 바로 확인할 수 있어요',
  summary: '이 안내는 이 버전에서 처음 한 번만 강조 표시됩니다. 확인 후에는 기존 작업 화면으로 돌아가며, 필요할 때 도움말 메뉴에서 다시 열 수 있습니다.',
  highlights: [
    {
      badge: 'NEW',
      title: '링 없는 Orbit Glitter',
      description: '단단한 원형 링 없이 글리터 입자 자체가 원형 테두리를 만들고 원둘레를 따라 흐릅니다.',
    },
    {
      badge: 'NEW',
      title: 'Flowing Reflection Ring',
      description: '별 파티클을 줄 세우는 방식이 아니라 얇은 원형 경로 위로 제한된 길이의 반사광이 순환합니다.',
    },
    {
      badge: 'CONTROL',
      title: '움직임을 따로 켜고 끄기',
      description: '링 회전, 글리터 궤도 이동, 밝기 트윙클, 하이라이트 이동을 서로 독립적으로 조절할 수 있습니다.',
    },
    {
      badge: 'SMOOTH',
      title: '미리보기와 출력 시간 흐름 개선',
      description: '미리보기의 30ms 갱신 제한을 없애고, 출력 기록의 누적 시간 오차도 줄였습니다.',
    },
  ],
  actions: [
    {
      label: 'Orbit Glitter 바로 적용',
      presetId: 'glitter-orbit-flow-v036',
      description: '기본 링이 꺼진 글리터 궤도형을 현재 프레임에 바로 적용합니다.',
    },
    {
      label: 'Reflection Ring 바로 적용',
      presetId: 'glitter-reflection-flow-v036',
      description: '얇은 링 위로 반사광이 흐르는 신규 스타일을 바로 적용합니다.',
    },
  ],
}
