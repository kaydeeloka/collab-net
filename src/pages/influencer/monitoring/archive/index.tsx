import { useEffect, useState } from 'react'
import { Eye, Heart, MessageCircle, Play, Video } from 'lucide-react'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { FilterSegmentBar } from '@/components/FilterSegmentBar'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import { gasPost } from '@/lib/api'
import { fmtNum } from '@/lib/utils'
import { formatKstDate } from '@/lib/kst-time'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { PLATFORM_BUCKETS, PLATFORM_DISPLAY, platformBadgeStyle, platformBadgeClass, platformBucket } from '@/lib/influencer/content-platforms'
import './monitoring-archive.css'

const PLATFORM_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  ...PLATFORM_BUCKETS.map(key => ({ value: key, label: PLATFORM_DISPLAY[key].label })),
]

function PlatformBadge({ platform }: { platform: string }) {
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
}

function InfluencerAvatar({ url, label, size = 28 }: { url?: string | null; label?: string | null; size?: number }) {
  const fallback = (label || '?').replace(/^@/, '').slice(0, 1).toUpperCase()
  return (
    <div className="mon-arch-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {url
        ? <img src={url} alt="" referrerPolicy="no-referrer" />
        : fallback}
    </div>
  )
}

function StatPill({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="mon-arch-card__stat">
      {icon}
      {value ? fmtNum(value) : '—'}
    </span>
  )
}

function ArchiveCard({ row }: { row: MonitoringRow }) {
  const thumbUrl = resolveMonitoringThumbnailUrl(row.assets)
  const hasVideo = !!(row.assets?.video_url || row.assets?.video_path)
  const account = (row.handle || '').replace(/^@/, '')

  function handleClick() {
    if (row.review_link) window.open(row.review_link, '_blank', 'noopener')
  }

  return (
    <div className="mon-arch-card" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') handleClick() }}>
      <div className="mon-arch-card__thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt={row.display_name || account} />
        ) : (
          <div className="mon-arch-card__thumb-empty">
            <InfluencerAvatar url={row.avatar_url} label={row.display_name || account} size={48} />
            <span className="mon-arch-card__thumb-name">{row.display_name || `@${account}`}</span>
          </div>
        )}
        {hasVideo && (
          <div className="mon-arch-card__play">
            <Play size={16} fill="white" strokeWidth={0} />
          </div>
        )}
        <div className="mon-arch-card__platform">
          <PlatformBadge platform={row.platform} />
        </div>
      </div>

      <div className="mon-arch-card__body">
        <div className="mon-arch-card__creator">
          <InfluencerAvatar url={row.avatar_url} label={row.display_name || account} size={26} />
          <div className="mon-arch-card__creator-info">
            <div className="mon-arch-card__name">{row.display_name || `@${account}`}</div>
            <div className="mon-arch-card__handle">@{account}</div>
          </div>
        </div>

        {row.date && (
          <div className="mon-arch-card__date">{formatKstDate(row.date)}</div>
        )}

        <div className="mon-arch-card__stats">
          <StatPill icon={<Eye size={11} />} value={row.views} />
          <StatPill icon={<Heart size={11} />} value={row.likes} />
          <StatPill icon={<MessageCircle size={11} />} value={row.comments} />
        </div>

        {row.brand && (
          <div className="mon-arch-card__brand">{row.brand}</div>
        )}
      </div>
    </div>
  )
}

export default function MonitoringArchive() {
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const { showToast } = useToast()
  const [rows, setRows] = useState<MonitoringRow[]>([])
  const [loading, setLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [downloading, setDownloading] = useState(false)
  const [dlModal, setDlModal] = useState<{
    open: boolean; urlCount: number; status: 'running' | 'done'; updated?: number; message?: string
  }>({ open: false, urlCount: 0, status: 'running' })

  useEffect(() => {
    if (phaseLoading) return
    if (!viewPhaseId) { setRows([]); setLoading(false); return }
    setLoading(true)
    loadMonitoringData(viewPhaseId)
      .then(({ rows: r }) => setRows(r))
      .catch(e => console.error('archive load error:', e))
      .finally(() => setLoading(false))
  }, [viewPhaseId, phaseLoading])

  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))
  const filteredRows = reviewRows.filter(r =>
    platformFilter === 'all' || platformBucket(r.platform) === platformFilter
  )

  async function handleDownload() {
    const tiktokRows = filteredRows.filter(r => r.review_link?.includes('tiktok.com'))
    if (!tiktokRows.length) { showToast('다운로드할 TikTok URL이 없습니다', 'info'); return }
    setDownloading(true)
    setDlModal({ open: true, urlCount: tiktokRows.length, status: 'running' })
    try {
      const res = await gasPost<{ ok?: boolean; error?: string; message?: string; updated?: number }>({
        action: 'downloadVideoAssets',
        rows: tiktokRows.map(r => ({ id: r.id, review_link: r.review_link })),
      })
      if (res.error) { setDlModal(m => ({ ...m, status: 'done', message: '오류: ' + res.error })); return }
      setDlModal(m => ({ ...m, status: 'done', updated: res.updated ?? 0, message: res.message }))
      if (viewPhaseId) loadMonitoringData(viewPhaseId).then(({ rows: r }) => setRows(r)).catch(() => {})
    } catch (e: unknown) {
      setDlModal(m => ({ ...m, status: 'done', message: '오류: ' + (e as Error).message }))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="리뷰 콘텐츠 아카이브"
          description="업로드된 리뷰 콘텐츠의 썸네일과 영상을 아카이브합니다."
          actions={(
            <button
              className="page-banner-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              disabled={downloading || filteredRows.length === 0}
              onClick={() => { void handleDownload() }}
            >
              {downloading ? <Spinner sm /> : <Video size={14} />}
              영상 다운로드
            </button>
          )}
        />
      </PageHeroBanner>

      <FilterSegmentBar
        label="플랫폼"
        ariaLabel="플랫폼 필터"
        value={platformFilter}
        onChange={setPlatformFilter}
        style={{ marginBottom: 20 }}
        options={PLATFORM_FILTER_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
      />

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && !viewPhaseId && (
        <div style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 48 }}>차수를 선택해 주세요.</div>
      )}

      {!loading && viewPhaseId && filteredRows.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 48 }}>업로드된 리뷰 콘텐츠가 없습니다.</div>
      )}

      {!loading && filteredRows.length > 0 && (
        <div className="mon-arch-grid">
          {filteredRows.map(row => (
            <ArchiveCard key={row.id} row={row} />
          ))}
        </div>
      )}

      <Modal
        open={dlModal.open}
        onClose={() => dlModal.status === 'done' && setDlModal(m => ({ ...m, open: false }))}
        title="영상 다운로드"
      >
        <div style={{ minWidth: 280, padding: '8px 0' }}>
          {dlModal.status === 'running' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-6)', fontSize: 14 }}>
              <Spinner sm /> TikTok 영상 {dlModal.urlCount}개 처리 중…
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--gray-7)' }}>
              {dlModal.message || `${dlModal.updated ?? 0}개 완료`}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
