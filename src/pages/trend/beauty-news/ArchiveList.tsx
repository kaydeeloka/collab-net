import { Archive, ChevronRight } from 'lucide-react'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import {
  type ArchiveItem,
  ARCHIVE_MEDIA_BG,
  ARCHIVE_MEDIA_FG,
  archiveItemCardMeta,
  archiveMonthLabel,
} from './archive-shared'

export default function ArchiveList({
  items,
  allItems,
  loading,
  filterMonth,
  onSelect,
}: {
  items: ArchiveItem[]
  allItems: ArchiveItem[]
  loading: boolean
  filterMonth: string | null
  onSelect: (windowsStart: string) => void
}) {
  if (loading) {
    return (
      <div className="bn-archive-cards-wrap">
        <div className="bn-archive-brand-loading"><Spinner sm /> 불러오는 중...</div>
      </div>
    )
  }

  if (!allItems.length) {
    return (
      <div className="bn-archive-empty-panel">
        <Archive size={28} strokeWidth={1.5} className="bn-archive-empty-icon" />
        <span>저장된 아카이브가 없습니다.</span>
        <span className="bn-archive-empty-sub">Claude 루틴이 실행되면 자동으로 저장됩니다.</span>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="bn-archive-empty-panel">
        {filterMonth ? `${archiveMonthLabel(filterMonth)} 아카이브가 없습니다.` : '표시할 아카이브가 없습니다.'}
      </div>
    )
  }

  return (
    <div className="bn-archive-cards-wrap">
      <div className="brand-archive-grid bn-archive-cards-grid">
        {items.map(item => {
          const meta = archiveItemCardMeta(item)
          return (
            <button
              key={item.windows_start}
              type="button"
              className="brand-archive-card bn-archive-brand-card"
              onClick={() => onSelect(item.windows_start)}
            >
              <div
                className="brand-archive-card__media bn-archive-card__media"
                style={{ background: ARCHIVE_MEDIA_BG, color: ARCHIVE_MEDIA_FG }}
              >
                <span className="bn-archive-card__count">{meta.count}건</span>
                <div className="bn-archive-card__hero">
                  <span className="bn-archive-card__hero-line1">{meta.heroLines.line1}</span>
                  <span className="bn-archive-card__hero-line2">{meta.heroLines.line2}</span>
                </div>
              </div>

              <div className="brand-archive-card__body bn-archive-card__body">
                {meta.windowBasis && (
                  <div className="brand-archive-card__product">{meta.windowBasis}</div>
                )}
                <div className="bn-archive-card-keywords">
                  {meta.keywords.slice(0, 5).map(kw => (
                    <span key={kw.tag} className="bn-archive-card-kw">{kw.tag}</span>
                  ))}
                </div>
                <div className="brand-archive-card__footer">
                  <span className="brand-archive-card__cta">
                    상세 보기
                    <ChevronRight size={15} />
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
