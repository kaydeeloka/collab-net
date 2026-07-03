import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Eye, Heart, MessageCircle, Play, Download, DownloadCloud, Film, Archive, Image as ImageIcon, ExternalLink, Clock } from 'lucide-react'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { FilterSegmentBar } from '@/components/FilterSegmentBar'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { fmtNum } from '@/lib/utils'
import { formatKstDate } from '@/lib/kst-time'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { PLATFORM_BUCKETS, PLATFORM_DISPLAY, platformBadgeStyle, platformBadgeClass, platformBucket } from '@/lib/influencer/content-platforms'
import { brandColorForKey, buildBrandKwsFromRows, monitoringBrandKey, MIMUSE_BRAND, type ConfirmedBrandKw } from '@/lib/influencer/monitoring-keywords'
import './monitoring-archive.css'

function sanitizeName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'file'
}

/** Extract MMDD from a YYYY-MM-DD date string (e.g. 2026-02-27 → 0227). */
function mmddFromDate(date: string | null | undefined): string {
  const m = (date || '').match(/\d{4}-(\d{2})-(\d{2})/)
  return m ? `${m[1]}${m[2]}` : ''
}

/** Fetch an asset blob from a direct URL (cover_url/video_url). */
async function fetchAssetBlob(url: string | null): Promise<Blob | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (res.ok) return await res.blob()
  } catch {
    /* CDN URL may be expired or blocked by CORS */
  }
  return null
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Returns days remaining before the 7-day Apify link expiry, or null if unknown. */
function videoLinkDaysLeft(assetsUpdatedAt: string | null | undefined): number | null {
  if (!assetsUpdatedAt) return null
  const daysPassed = Math.floor((Date.now() - new Date(assetsUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, 7 - daysPassed)
}

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

function SummaryStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="mon-arch-summary__item">
      <span className="mon-arch-summary__icon">{icon}</span>
      <span className="mon-arch-summary__value">{value}</span>
      <span className="mon-arch-summary__label">{label}</span>
    </div>
  )
}

function ArchiveCard({ row, brandColor }: { row: MonitoringRow; brandColor: string }) {
  const thumbUrl = resolveMonitoringThumbnailUrl(row.assets)
  const videoUrl = row.assets?.video_url || null
  const isPhoto = !videoUrl && !!row.assets?.image_urls?.length
  const account = (row.handle || '').replace(/^@/, '')
  const [imgFailed, setImgFailed] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoError, setVideoError] = useState(false)

  // Video is temporary (needs saving) if it's still an Apify KV URL.
  const isVideoTemporary = videoUrl?.includes('api.apify.com') ?? false
  const daysLeft = isVideoTemporary ? videoLinkDaysLeft(row.assets?.assets_updated_at) : null

  const thumb = thumbUrl && !imgFailed ? (
    <img src={thumbUrl} alt={row.display_name || account} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
  ) : (
    <div className="mon-arch-card__thumb-empty">
      <InfluencerAvatar url={row.avatar_url} label={row.display_name || account} size={48} />
      <span className="mon-arch-card__thumb-name">{row.display_name || `@${account}`}</span>
    </div>
  )

  return (
    <div className="mon-arch-card">
      <div className="mon-arch-card__thumb">
        {/* Thumbnail is the default view — video loads only when toggled */}
        {showVideo && videoUrl && !videoError ? (
          <div className="mon-arch-card__player">
            <video
              src={videoUrl}
              controls
              playsInline
              autoPlay
              preload="metadata"
              className="mon-arch-card__video"
              onError={() => setVideoError(true)}
            />
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mon-arch-card__video-link"
              title="영상 직접 열기"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <div className="mon-arch-card__thumb-static">{thumb}</div>
        )}

        <div className="mon-arch-card__thumb-top">
          <PlatformBadge platform={row.platform} />
          {row.brand && (
            <span className="mon-arch-card__brand" style={{ color: brandColor, borderColor: `${brandColor}66` }}>
              {row.brand}
            </span>
          )}
        </div>

        {/* D-X badge — only when video is still on Apify CDN (not yet permanently saved) */}
        {daysLeft !== null && (
          <span className={`mon-arch-card__expiry${daysLeft === 0 ? ' mon-arch-card__expiry--expired' : daysLeft <= 2 ? ' mon-arch-card__expiry--warn' : ''}`}>
            {daysLeft === 0 ? '만료됨' : `D-${daysLeft}`}
          </span>
        )}

        {/* Toggle pill: switches between thumbnail and video */}
        {videoUrl ? (
          <button
            className={`mon-arch-card__media-toggle${showVideo ? ' mon-arch-card__media-toggle--video' : ''}`}
            onClick={() => { setShowVideo(v => !v); if (videoError) setVideoError(false) }}
            title={showVideo ? '썸네일 보기' : '영상 보기'}
          >
            {showVideo
              ? <><ImageIcon size={11} strokeWidth={2} /> 썸네일</>
              : <><Play size={11} fill="currentColor" strokeWidth={0} /> 영상</>}
          </button>
        ) : (
          <span className={`mon-arch-card__type mon-arch-card__type--${isPhoto ? 'photo' : 'video'}`}>
            {isPhoto ? <><ImageIcon size={11} strokeWidth={2} /> 사진</> : <><Play size={11} fill="currentColor" strokeWidth={0} /> 영상</>}
          </span>
        )}
      </div>

      <div className="mon-arch-card__body">
        <div className="mon-arch-card__creator">
          <InfluencerAvatar url={row.avatar_url} label={row.display_name || account} size={28} />
          <div className="mon-arch-card__creator-info">
            <div className="mon-arch-card__name">{row.display_name || `@${account}`}</div>
            <div className="mon-arch-card__handle">@{account}</div>
            {row.date && <div className="mon-arch-card__date">{formatKstDate(row.date)}</div>}
          </div>
        </div>
        <div className="mon-arch-card__stats">
          {row.review_link && (
            <a href={row.review_link} target="_blank" rel="noopener noreferrer" className="mon-arch-card__review-btn">
              <ExternalLink size={11} />
              리뷰 보기
            </a>
          )}
          <div className="mon-arch-card__stat-group">
            <StatPill icon={<Eye size={12} />} value={row.views} />
            <StatPill icon={<Heart size={12} />} value={row.likes} />
            <StatPill icon={<MessageCircle size={12} />} value={row.comments} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="mon-arch-card mon-arch-card--skeleton" aria-hidden>
      <div className="mon-arch-card__thumb mon-arch-skel" />
      <div className="mon-arch-card__body">
        <div className="mon-arch-card__creator">
          <div className="mon-arch-skel mon-arch-skel--avatar" />
          <div className="mon-arch-card__creator-info">
            <div className="mon-arch-skel mon-arch-skel--line" style={{ width: '70%' }} />
            <div className="mon-arch-skel mon-arch-skel--line" style={{ width: '45%', marginTop: 6 }} />
          </div>
        </div>
        <div className="mon-arch-skel mon-arch-skel--line" style={{ width: '85%' }} />
      </div>
    </div>
  )
}

export default function MonitoringArchive() {
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const { showToast } = useToast()
  const [rows, setRows] = useState<MonitoringRow[]>([])
  const [brands, setBrands] = useState<ConfirmedBrandKw[]>([])
  const [brandKw, setBrandKw] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [brandFilter, setBrandFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [dlModal, setDlModal] = useState<{
    open: boolean; urlCount: number; status: 'running' | 'done'; updated?: number; message?: string
  }>({ open: false, urlCount: 0, status: 'running' })
  const [zipModal, setZipModal] = useState<{
    open: boolean; total: number; done: number; status: 'running' | 'done'; message?: string
  }>({ open: false, total: 0, done: 0, status: 'running' })
  const [videoUploadModal, setVideoUploadModal] = useState<{
    open: boolean; total: number; done: number; status: 'running' | 'done'; message?: string
  }>({ open: false, total: 0, done: 0, status: 'running' })
  const [uploadingVideos, setUploadingVideos] = useState(false)

  useEffect(() => {
    if (phaseLoading) return
    if (!viewPhaseId) { setRows([]); setBrands([]); setBrandKw({}); setLoading(false); return }
    setLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const [data, brandsRes, kwsRes] = await Promise.all([
          loadMonitoringData(viewPhaseId),
          supabase.from('confirmed_brands').select('brand_name').eq('phase_id', viewPhaseId).order('brand_name'),
          supabase.from('monitoring_keywords').select('brand, keywords, phase_id')
            .or(`and(phase_id.is.null,brand.eq.${MIMUSE_BRAND}),phase_id.eq.${viewPhaseId}`),
        ])
        if (cancelled) return
        setRows(data.rows)
        const confirmed = (brandsRes.data || []).map(b => ({ key: monitoringBrandKey(b.brand_name), name: b.brand_name, en: '' }))
        setBrands(confirmed)
        setBrandKw(buildBrandKwsFromRows(kwsRes.data || [], confirmed).byBrand)
      } catch (e) {
        console.error('archive load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [viewPhaseId, phaseLoading])

  const reviewRows = useMemo(
    () => rows.filter(r => r.review_link?.startsWith('http')),
    [rows],
  )

  const brandOptions = useMemo(() => {
    const seen = new Set<string>()
    reviewRows.forEach(r => { if (r.brand) seen.add(r.brand) })
    return [
      { value: 'all', label: '전체' },
      ...[...seen].sort((a, b) => a.localeCompare(b)).map(b => ({ value: b, label: b })),
    ]
  }, [reviewRows])

  const filteredRows = useMemo(() => {
    const filtered = reviewRows.filter(r =>
      brandFilter === 'all' || r.brand === brandFilter
    )
    const sorted = [...filtered]
    sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    return sorted
  }, [reviewRows, brandFilter])

  const platformGroups = useMemo(() => (
    PLATFORM_BUCKETS
      .map(key => ({
        key,
        label: PLATFORM_DISPLAY[key].label,
        rows: filteredRows.filter(r => platformBucket(r.platform) === key),
      }))
      .filter(g => g.rows.length > 0)
  ), [filteredRows])

  const totals = useMemo(() => filteredRows.reduce(
    (acc, r) => {
      acc.views += r.views
      acc.likes += r.likes
      acc.comments += r.comments
      return acc
    },
    { views: 0, likes: 0, comments: 0 },
  ), [filteredRows])

  const hasData = !loading && filteredRows.length > 0

  async function handleImport() {
    // Read the full review list (모든 업로드된 리뷰), not just the platform-filtered view.
    const tiktokRows = reviewRows.filter(r => r.review_link?.includes('tiktok.com'))
    if (!tiktokRows.length) { showToast('가져올 TikTok URL이 없습니다', 'info'); return }
    setImporting(true)
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
      setImporting(false)
    }
  }

  async function handleDownloadFiles() {
    if (!filteredRows.length) { showToast('다운로드할 콘텐츠가 없습니다', 'info'); return }
    setZipping(true)
    setZipModal({ open: true, total: filteredRows.length, done: 0, status: 'running' })
    try {
      const zip = new JSZip()
      const thumbFolder = zip.folder('썸네일')
      const photoFolder = zip.folder('사진')
      const videoFolder = zip.folder('영상')
      const usedNames = new Set<string>()
      let saved = 0
      let failed = 0

      for (let i = 0; i < filteredRows.length; i += 1) {
        const row = filteredRows[i]
        const account = (row.handle || '').replace(/^@/, '') || 'unknown'
        const prefix = mmddFromDate(row.date) || String(i + 1).padStart(2, '0')
        let base = sanitizeName(`${prefix}_${account}`)
        while (usedNames.has(base)) base = `${base}_`
        usedNames.add(base)

        const imageUrls = row.assets?.image_urls
        if (imageUrls?.length) {
          // Photo post → download every image.
          for (let j = 0; j < imageUrls.length; j += 1) {
            const imgBlob = await fetchAssetBlob(imageUrls[j])
            if (imgBlob) { photoFolder?.file(`${base}_${String(j + 1).padStart(2, '0')}.webp`, imgBlob); saved += 1 }
            else failed += 1
          }
        } else if (row.assets?.cover_url) {
          const thumbBlob = await fetchAssetBlob(row.assets.cover_url)
          if (thumbBlob) { thumbFolder?.file(`${base}.jpg`, thumbBlob); saved += 1 }
          else failed += 1
        }

        if (row.assets?.video_url) {
          const videoBlob = await fetchAssetBlob(row.assets.video_url)
          if (videoBlob) { videoFolder?.file(`${base}.mp4`, videoBlob); saved += 1 }
          else failed += 1
        }

        setZipModal(m => ({ ...m, done: i + 1 }))
      }

      if (saved === 0) {
        setZipModal(m => ({ ...m, status: 'done', message: '저장된 썸네일 · 영상 파일이 없습니다. 먼저 데이터 가져오기를 실행하세요.' }))
        return
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `리뷰_콘텐츠_${stamp}.zip`)
      setZipModal(m => ({
        ...m,
        status: 'done',
        message: failed > 0 ? `${saved}개 파일 저장 (${failed}개 누락)` : `${saved}개 파일 저장 완료`,
      }))
    } catch (e: unknown) {
      setZipModal(m => ({ ...m, status: 'done', message: '오류: ' + (e as Error).message }))
    } finally {
      setZipping(false)
    }
  }

  async function handleUploadVideos() {
    const toUpload = filteredRows.filter(r => r.assets?.video_url?.includes('api.apify.com'))
    if (!toUpload.length) { showToast('영구 저장이 필요한 영상이 없습니다', 'info'); return }
    setUploadingVideos(true)
    setVideoUploadModal({ open: true, total: toUpload.length, done: 0, status: 'running' })
    let uploaded = 0
    let failed = 0
    for (const row of toUpload) {
      try {
        const videoUrl = row.assets!.video_url!
        const fetchRes = await fetch(videoUrl)
        if (!fetchRes.ok) throw new Error(`fetch ${fetchRes.status}`)
        const blob = await fetchRes.blob()
        const path = `${row.id}.mp4`
        const { error: uploadErr } = await supabase.storage
          .from('monitoring-videos')
          .upload(path, blob, { contentType: 'video/mp4', upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('monitoring-videos').getPublicUrl(path)
        await supabase
          .from('monitoring_assets')
          .update({ video_url: urlData.publicUrl, updated_at: new Date().toISOString() })
          .eq('monitoring_id', row.id)
        uploaded++
      } catch (e) {
        console.error('Video upload error:', row.id, e)
        failed++
      }
      setVideoUploadModal(m => ({ ...m, done: m.done + 1 }))
    }
    setVideoUploadModal(m => ({
      ...m,
      status: 'done',
      message: `${uploaded}개 영상 영구 저장 완료` + (failed ? ` · ${failed}개 실패` : ''),
    }))
    setUploadingVideos(false)
    if (viewPhaseId) loadMonitoringData(viewPhaseId).then(({ rows: r }) => setRows(r)).catch(() => {})
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="리뷰 콘텐츠 아카이브"
          description="업로드된 리뷰 콘텐츠의 썸네일과 영상을 아카이브합니다."
          actions={(
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="page-banner-btn page-banner-btn--secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                disabled={importing || reviewRows.length === 0}
                onClick={() => { void handleImport() }}
              >
                {importing ? <Spinner sm /> : <DownloadCloud size={14} />}
                데이터 가져오기
              </button>
              {filteredRows.some(r => r.assets?.video_url?.includes('api.apify.com')) && (
                <button
                  className="page-banner-btn page-banner-btn--secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  disabled={uploadingVideos}
                  onClick={() => { void handleUploadVideos() }}
                >
                  {uploadingVideos ? <Spinner sm /> : <Film size={14} />}
                  영상 저장
                </button>
              )}
            </div>
          )}
        />
      </PageHeroBanner>

      {hasData && (
        <div className="mon-arch-summary">
          <SummaryStat icon={<Film size={15} />} label="콘텐츠" value={`${fmtNum(filteredRows.length)}개`} />
          <SummaryStat icon={<Eye size={15} />} label="조회" value={fmtNum(totals.views)} />
          <SummaryStat icon={<Heart size={15} />} label="좋아요" value={fmtNum(totals.likes)} />
          <SummaryStat icon={<MessageCircle size={15} />} label="댓글" value={fmtNum(totals.comments)} />
        </div>
      )}

      {!loading && filteredRows.some(r => r.assets?.video_url?.includes('api.apify.com')) && (
        <div className="mon-arch-notice">
          <Clock size={13} className="mon-arch-notice__icon" />
          임시 영상 링크가 있습니다. <strong>7일 이내</strong>에 <strong>영상 저장</strong> 버튼을 눌러 영구 보관하세요. 기간이 지나면 Apify에서 다시 가져와야 합니다.
        </div>
      )}

      <FilterSegmentBar
        label="브랜드"
        ariaLabel="브랜드 필터"
        value={brandFilter}
        onChange={setBrandFilter}
        className="mon-arch-filters"
        style={{ marginBottom: 20 }}
        options={brandOptions}
      >
        {hasData && (
          <div className="mon-arch-bar__right">
            <span className="mon-arch-count">
              총 <strong>{fmtNum(filteredRows.length)}</strong>개
            </span>
            <button
              type="button"
              className="cfg-btn"
              disabled={zipping}
              onClick={() => { void handleDownloadFiles() }}
              title="썸네일 · 영상을 폴더로 다운로드"
            >
              {zipping ? <Spinner sm /> : <Download size={13} />}
              다운로드
            </button>
          </div>
        )}
      </FilterSegmentBar>

      {loading && (
        <div className="mon-arch-grid" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && !viewPhaseId && (
        <div className="mon-arch-empty">
          <div className="mon-arch-empty__icon"><Archive size={26} /></div>
          <p className="mon-arch-empty__title">차수를 선택해 주세요</p>
          <p className="mon-arch-empty__desc">상단에서 차수를 선택하면 리뷰 콘텐츠가 표시됩니다.</p>
        </div>
      )}

      {!loading && viewPhaseId && filteredRows.length === 0 && (
        <div className="mon-arch-empty">
          <div className="mon-arch-empty__icon"><Film size={26} /></div>
          <p className="mon-arch-empty__title">업로드된 리뷰 콘텐츠가 없습니다</p>
          <p className="mon-arch-empty__desc">
            {brandFilter === 'all'
              ? '리뷰가 업로드되면 이곳에 모아 볼 수 있습니다.'
              : '선택한 브랜드에 해당하는 콘텐츠가 없습니다. 다른 브랜드를 선택해 보세요.'}
          </p>
        </div>
      )}

      {hasData && platformGroups.map(group => (
        <section key={group.key} className="mon-arch-section">
          <div className="mon-arch-section__head">
            <h3 className="mon-arch-section__title">{group.label}</h3>
            <span className="mon-arch-section__count">{fmtNum(group.rows.length)}개</span>
          </div>
          <div className="mon-arch-grid">
            {group.rows.map(row => (
              <ArchiveCard
                key={row.id}
                row={row}
                brandColor={brandColorForKey(row.brand || '', brands, brandKw)}
              />
            ))}
          </div>
        </section>
      ))}

      <Modal
        open={dlModal.open}
        onClose={() => dlModal.status === 'done' && setDlModal(m => ({ ...m, open: false }))}
        title="데이터 가져오기"
      >
        <div style={{ minWidth: 280, padding: '8px 0' }}>
          {dlModal.status === 'running' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-6)', fontSize: 14 }}>
              <Spinner sm /> TikTok 콘텐츠 {dlModal.urlCount}개 가져오는 중…
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--gray-7)' }}>
              {dlModal.message || `${dlModal.updated ?? 0}개 완료`}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={zipModal.open}
        onClose={() => zipModal.status === 'done' && setZipModal(m => ({ ...m, open: false }))}
        title="콘텐츠 다운로드"
      >
        <div style={{ minWidth: 300, padding: '8px 0' }}>
          {zipModal.status === 'running' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-6)', fontSize: 14, marginBottom: 12 }}>
                <Spinner sm /> 파일 준비 중… ({zipModal.done}/{zipModal.total})
              </div>
              <div className="mon-arch-progress">
                <div
                  className="mon-arch-progress__bar"
                  style={{ width: `${zipModal.total ? (zipModal.done / zipModal.total) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--gray-7)' }}>
              {zipModal.message}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={videoUploadModal.open}
        onClose={() => videoUploadModal.status === 'done' && setVideoUploadModal(m => ({ ...m, open: false }))}
        title="영상 영구 저장"
      >
        <div style={{ minWidth: 300, padding: '8px 0' }}>
          {videoUploadModal.status === 'running' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-6)', fontSize: 14, marginBottom: 12 }}>
                <Spinner sm /> 영상 업로드 중… ({videoUploadModal.done}/{videoUploadModal.total})
              </div>
              <div className="mon-arch-progress">
                <div
                  className="mon-arch-progress__bar"
                  style={{ width: `${videoUploadModal.total ? (videoUploadModal.done / videoUploadModal.total) * 100 : 0}%` }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--gray-7)' }}>
              {videoUploadModal.message}
            </div>
          )}
        </div>
      </Modal>

    </div>
  )
}
