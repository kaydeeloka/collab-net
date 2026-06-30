import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Camera, Eye, Heart, MessageCircle, Image as ImageIcon } from 'lucide-react'
import Spinner from '@/components/Spinner'
import { fmtNum } from '@/lib/utils'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { platformBadgeClass, platformBadgeStyle } from '@/lib/influencer/content-platforms'
import { useArchivePhase } from '@/pages/archive/use-archive-phase'
import './capture.css'

function PlatformBadge({ platform }: { platform: string }) {
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
}

function CaptureCard({ row }: { row: MonitoringRow }) {
  const thumbUrl = resolveMonitoringThumbnailUrl(row.assets)
  const isPhoto = !row.assets?.video_url && !!row.assets?.image_urls?.length
  const account = (row.handle || '').replace(/^@/, '')
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="cap-card">
      <div className="cap-card__thumb">
        {thumbUrl && !imgFailed ? (
          <img
            src={thumbUrl}
            alt={account}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="cap-card__no-thumb">
            <ImageIcon size={28} strokeWidth={1.5} />
            <span>@{account}</span>
          </div>
        )}

        <div className="cap-card__badges">
          <PlatformBadge platform={row.platform} />
          {row.brand && <span className="cap-card__brand">{row.brand}</span>}
        </div>

        {isPhoto && (
          <span className="cap-card__type">
            <ImageIcon size={10} strokeWidth={2} /> 사진
          </span>
        )}
      </div>

      <div className="cap-card__info">
        <div className="cap-card__name">{row.display_name || `@${account}`}</div>
        <div className="cap-card__handle">@{account}</div>
        <div className="cap-card__stats">
          <span><Eye size={10} />{fmtNum(row.views)}</span>
          <span><Heart size={10} />{fmtNum(row.likes)}</span>
          <span><MessageCircle size={10} />{fmtNum(row.comments)}</span>
        </div>
      </div>
    </div>
  )
}

export default function ArchiveCapture() {
  const { phase, phasesLoading } = useArchivePhase()
  const [rows, setRows] = useState<MonitoringRow[]>([])
  const [loading, setLoading] = useState(true)
  const [capturing, setCapturing] = useState(false)
  const [brandFilter, setBrandFilter] = useState('all')
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phasesLoading || !phase) return
    setLoading(true)
    void loadMonitoringData(phase.id)
      .then(({ rows: r }) => setRows(r))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [phase, phasesLoading])

  const reviewRows = useMemo(
    () => rows.filter(r => r.review_link?.startsWith('http')),
    [rows],
  )

  const brands = useMemo(() => {
    const seen = new Set<string>()
    reviewRows.forEach(r => { if (r.brand) seen.add(r.brand) })
    return [...seen].sort()
  }, [reviewRows])

  const filtered = useMemo(() =>
    brandFilter === 'all'
      ? reviewRows
      : reviewRows.filter(r => r.brand === brandFilter),
    [reviewRows, brandFilter],
  )

  async function handleCapture() {
    if (!gridRef.current) return
    setCapturing(true)
    try {
      const canvas = await html2canvas(gridRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      })
      const link = document.createElement('a')
      link.download = `리뷰_캡처_${phase?.name ?? ''}_${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('capture failed', e)
    } finally {
      setCapturing(false)
    }
  }

  if (phasesLoading || loading) {
    return (
      <div className="cap-loading">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="cap-page">
      {/* toolbar — not part of the captured image */}
      <div className="cap-toolbar">
        <div className="cap-toolbar__left">
          <span className="cap-toolbar__title">리뷰 콘텐츠 캡처</span>
          {phase && <span className="cap-toolbar__phase">{phase.name}</span>}
        </div>
        <div className="cap-toolbar__filters">
          <button
            className={`cap-filter-btn${brandFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => setBrandFilter('all')}
          >
            전체
          </button>
          {brands.map(b => (
            <button
              key={b}
              className={`cap-filter-btn${brandFilter === b ? ' is-active' : ''}`}
              onClick={() => setBrandFilter(b)}
            >
              {b}
            </button>
          ))}
        </div>
        <button
          className="cap-capture-btn"
          disabled={capturing || filtered.length === 0}
          onClick={() => { void handleCapture() }}
        >
          {capturing ? <Spinner sm /> : <Camera size={14} />}
          캡처 다운로드
        </button>
      </div>

      {/* capture target */}
      <div className="cap-sheet" ref={gridRef}>
        <div className="cap-sheet__header">
          <div className="cap-sheet__logo">Mi Muse</div>
          {phase && <div className="cap-sheet__phase">{phase.name} · 리뷰 콘텐츠</div>}
          <div className="cap-sheet__count">{fmtNum(filtered.length)}건</div>
        </div>
        {filtered.length === 0 ? (
          <div className="cap-empty">리뷰 콘텐츠가 없습니다.</div>
        ) : (
          <div className="cap-grid">
            {filtered.map(row => (
              <CaptureCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
