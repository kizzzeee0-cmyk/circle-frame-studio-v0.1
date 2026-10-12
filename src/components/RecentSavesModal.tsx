import { useEffect, useMemo, useState } from 'react'
import type { RecentSaveRecord } from '../utils/recentSaves'

interface Props {
  open: boolean
  records: RecentSaveRecord[]
  loading: boolean
  onClose: () => void
  onLoad: (record: RecentSaveRecord) => void
  onDelete: (id: string) => void
  onClear: () => void
}

function formatSavedAt(value: number) {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(value))
  } catch {
    return new Date(value).toLocaleString()
  }
}

function getLayerCount(record: RecentSaveRecord) {
  const project = record.project as { layers?: unknown[] }
  return Array.isArray(project?.layers) ? project.layers.length : 1
}

export default function RecentSavesModal({ open, records, loading, onClose, onLoad, onDelete, onClear }: Props) {
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (!open) return
    if (!records.some(item => item.id === selectedId)) setSelectedId(records[0]?.id ?? '')
  }, [open, records, selectedId])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const selected = useMemo(
    () => records.find(item => item.id === selectedId) ?? records[0],
    [records, selectedId],
  )

  if (!open) return null

  return (
    <div className="recent-saves-backdrop" onMouseDown={event => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section className="recent-saves-modal" role="dialog" aria-modal="true" aria-label="최근 저장 내역">
        <div className="recent-saves-header">
          <div>
            <h2>최근 저장 내역</h2>
            <p>파일 저장 시 전체 편집 상태를 자동 기록합니다. 최근 10개까지 이 브라우저에 보관됩니다.</p>
          </div>
          <button className="recent-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="recent-saves-actions">
          <span>{records.length} / 10개 저장됨</span>
          <button
            className="soft-button danger-soft"
            type="button"
            disabled={!records.length}
            onClick={() => {
              if (confirm('최근 저장 내역을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) onClear()
            }}
          >
            전체 삭제
          </button>
        </div>

        {loading ? (
          <div className="recent-empty">최근 저장 내역을 불러오는 중입니다…</div>
        ) : !records.length ? (
          <div className="recent-empty">
            <b>아직 저장 내역이 없습니다.</b>
            <span>PNG 또는 JSON으로 저장하면 현재 레이어와 모든 설정이 자동 기록됩니다.</span>
          </div>
        ) : (
          <div className="recent-saves-body">
            <div className="recent-list">
              {records.map((record, index) => (
                <article className={`recent-card ${selected?.id === record.id ? 'active' : ''}`} key={record.id}>
                  <button className="recent-thumb-button" type="button" onClick={() => setSelectedId(record.id)}>
                    <span className="recent-index">#{index + 1}</span>
                    <span className="recent-thumb-checker">
                      <img src={record.previewDataUrl} alt={`${record.title} 미리보기`} />
                    </span>
                  </button>
                  <div className="recent-card-info">
                    <strong>{record.title}</strong>
                    <span>{formatSavedAt(record.savedAt)}</span>
                    <small>{record.source === 'png' ? 'PNG 저장' : 'JSON 저장'} · 레이어 {getLayerCount(record)}개</small>
                  </div>
                  <div className="recent-card-buttons">
                    <button type="button" className="soft-button" onClick={() => setSelectedId(record.id)}>미리보기</button>
                    <button type="button" className="soft-button" onClick={() => onLoad(record)}>불러오기</button>
                    <button type="button" className="soft-button danger-soft" onClick={() => onDelete(record.id)}>삭제</button>
                  </div>
                </article>
              ))}
            </div>

            <aside className="recent-preview-pane">
              {selected && <>
                <div className="recent-preview-checker">
                  <img src={selected.previewDataUrl} alt="선택한 저장 내역 미리보기" />
                </div>
                <div className="recent-preview-meta">
                  <strong>{selected.title}</strong>
                  <span>{formatSavedAt(selected.savedAt)}</span>
                  <span>{selected.source === 'png' ? 'PNG 저장' : 'JSON 저장'} · 레이어 {getLayerCount(selected)}개 · v{selected.appVersion}</span>
                </div>
                <button className="primary-button recent-load-primary" type="button" onClick={() => onLoad(selected)}>
                  이 작업 상태 불러오기
                </button>
                <p>레이어 ON/OFF·순서, 색상, 그라데이션, 2/4/6/8구간, 입체감, 글로우, 그림자 등 저장 당시의 전체 프로젝트 데이터를 복원합니다.</p>
              </>}
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}
