import type { UpdateRelease } from '../updateNotes'

interface Props {
  open: boolean
  update: UpdateRelease
  onClose: () => void
  onTryPreset: (presetId: string) => void
}

export default function UpdateSpotlight({ open, update, onClose, onTryPreset }: Props) {
  if (!open) return null

  return (
    <div className="update-spotlight-backdrop" role="presentation">
      <section className="update-spotlight" role="dialog" aria-modal="true" aria-labelledby="update-spotlight-title">
        <div className="update-spotlight-top">
          <div>
            <span className="update-spotlight-eyebrow">{update.eyebrow}</span>
            <h2 id="update-spotlight-title">v{update.version} · {update.title}</h2>
            <p>{update.summary}</p>
          </div>
          <span className="update-version-pill">UPDATE {update.version}</span>
        </div>

        <div className="update-highlight-grid">
          {update.highlights.map(item => (
            <article className="update-highlight-card" key={item.title}>
              <div className="update-highlight-card-head">
                {item.badge && <span>{item.badge}</span>}
                <b>{item.title}</b>
              </div>
              <p>{item.description}</p>
            </article>
          ))}
        </div>

        <div className="update-try-section">
          <div>
            <b>새 기능을 바로 확인해 보세요</b>
            <span>아래 버튼은 현재 선택된 프레임에 신규 프리셋을 적용하고 안내를 닫습니다.</span>
          </div>
          <div className="update-action-grid">
            {update.actions.map(action => (
              <button type="button" key={action.presetId} onClick={() => onTryPreset(action.presetId)}>
                <b>{action.label}</b>
                <span>{action.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="update-spotlight-footer">
          <span>확인하면 이 버전에서는 자동으로 다시 표시되지 않습니다.</span>
          <button type="button" className="primary-button update-confirm-button" onClick={onClose}>확인했어요</button>
        </div>
      </section>
    </div>
  )
}
