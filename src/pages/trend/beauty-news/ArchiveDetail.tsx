import { ArrowLeft, Newspaper } from 'lucide-react'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import ReportBody from './ReportBody'
import {
  type ArchiveItem,
  type ReportData,
  ARCHIVE_MEDIA_BG,
  ARCHIVE_MEDIA_FG,
  archiveItemSidebarLines,
} from './archive-shared'

export default function ArchiveDetail({
  item,
  report,
  loading,
  onBack,
}: {
  item: ArchiveItem | null
  report: ReportData | null
  loading: boolean
  onBack: () => void
}) {
  const header = item ? archiveItemSidebarLines(item) : null

  return (
    <div className="brand-archive-detail bn-archive-detail">
      <div className="brand-archive-detail__header">
        <div className="brand-archive-detail__header-row">
          <button type="button" className="brand-archive-detail__back" onClick={onBack}>
            <ArrowLeft size={14} />
            목록
          </button>
        </div>
      </div>

      <div className="brand-archive-detail__body">
        {header && (
          <div className="brand-archive-detail__brand-bar">
            <div
              className="brand-archive-detail__avatar"
              style={{ background: ARCHIVE_MEDIA_BG, color: ARCHIVE_MEDIA_FG }}
            >
              <Newspaper size={20} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="brand-archive-detail__name">{header.primary}</div>
              <div className="brand-archive-detail__product">{header.secondary}</div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 56 }}>
            <Spinner />
          </div>
        )}

        {!loading && !report && (
          <div className="brand-archive-empty" style={{ marginTop: 8 }}>
            리포트를 불러올 수 없습니다.
          </div>
        )}

        {!loading && report && (
          report.ok === false
            ? <div style={{ color: 'var(--red)', padding: 16 }}>{report.error}</div>
            : <ReportBody data={report} />
        )}
      </div>
    </div>
  )
}
