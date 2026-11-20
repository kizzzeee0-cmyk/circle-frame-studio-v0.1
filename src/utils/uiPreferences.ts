import { useEffect, type RefObject } from 'react'

const STORAGE_KEY = 'circle-frame-studio-ui-sections-v034'

interface PanelState {
  favorites: string[]
  collapsed: Record<string, boolean>
}

interface UiState { panels: Record<string, PanelState> }

function readState(): UiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { panels: {} }
    const parsed = JSON.parse(raw) as UiState
    return parsed && parsed.panels ? parsed : { panels: {} }
  } catch { return { panels: {} } }
}

function writeState(state: UiState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

function textTitle(heading: HTMLElement) {
  if (heading.dataset.sectionTitle) return heading.dataset.sectionTitle
  const title = Array.from(heading.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent ?? '')
    .join(' ')
    .trim()
  heading.dataset.sectionTitle = title || '설정'
  return heading.dataset.sectionTitle
}

function sectionId(panelKey: string, title: string) {
  return panelKey + ':' + title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '')
}

export function useCompactSectionOrganizer(
  rootRef: RefObject<HTMLElement | null>,
  panelKey: string,
  options: { defaultFavorites?: string[]; defaultCollapsed?: string[] } = {},
) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.classList.add('compact-organized')
    const ui = readState()
    const existing = ui.panels[panelKey]
    const panel: PanelState = existing ?? { favorites: [], collapsed: {} }
    const sections = Array.from(root.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element.classList.contains('property-section'))
    let dirty = !existing
    const cleanups: Array<() => void> = []

    for (const section of sections) {
      const heading = section.querySelector(':scope > h3') as HTMLElement | null
      if (!heading) continue
      const title = textTitle(heading)
      const id = section.dataset.sectionId || sectionId(panelKey, title)
      section.dataset.sectionId = id
      if (!existing && options.defaultFavorites?.includes(title) && !panel.favorites.includes(id)) { panel.favorites.push(id); dirty = true }
      if (!(id in panel.collapsed) && options.defaultCollapsed?.includes(title)) { panel.collapsed[id] = true; dirty = true }
      let actions = heading.querySelector('.section-header-actions') as HTMLDivElement | null
      if (!actions) {
        actions = document.createElement('div')
        actions.className = 'section-header-actions'
        const favoriteButton = document.createElement('button')
        favoriteButton.type = 'button'
        favoriteButton.className = 'section-favorite-button'
        favoriteButton.title = '즐겨찾기 · 별표한 설정은 패널 최상단에 표시됩니다.'
        const collapseButton = document.createElement('button')
        collapseButton.type = 'button'
        collapseButton.className = 'section-collapse-button'
        collapseButton.title = '접기 / 펼치기'
        actions.append(favoriteButton, collapseButton)
        heading.append(actions)
      }
      const favoriteButton = actions.querySelector('.section-favorite-button') as HTMLButtonElement
      const collapseButton = actions.querySelector('.section-collapse-button') as HTMLButtonElement
      const refresh = () => {
        const favorite = panel.favorites.includes(id)
        const collapsed = panel.collapsed[id] === true
        section.classList.toggle('favorite-section', favorite)
        section.classList.toggle('collapsed-section', collapsed)
        favoriteButton.textContent = favorite ? '★' : '☆'
        collapseButton.textContent = collapsed ? '▸' : '▾'
      }
      const toggleFavorite = (event: Event) => {
        event.preventDefault(); event.stopPropagation()
        const index = panel.favorites.indexOf(id)
        if (index >= 0) panel.favorites.splice(index, 1)
        else { panel.favorites.push(id); panel.collapsed[id] = false }
        ui.panels[panelKey] = panel; writeState(ui); refresh()
      }
      const toggleCollapsed = (event: Event) => {
        event.preventDefault(); event.stopPropagation()
        panel.collapsed[id] = panel.collapsed[id] !== true
        ui.panels[panelKey] = panel; writeState(ui); refresh()
      }
      favoriteButton.addEventListener('click', toggleFavorite)
      collapseButton.addEventListener('click', toggleCollapsed)
      cleanups.push(() => { favoriteButton.removeEventListener('click', toggleFavorite); collapseButton.removeEventListener('click', toggleCollapsed) })
      refresh()
    }
    ui.panels[panelKey] = panel
    if (dirty) writeState(ui)
    return () => { for (const cleanup of cleanups) cleanup() }
  })
}
