import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Eye, Heart, MessageCircle, Play, Download, DownloadCloud, Film, Archive, Image as ImageIcon, ExternalLink, Clock, CheckCircle2, Circle, ChevronDown, ChevronUp, X, Upload, Camera, Star } from 'lucide-react'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
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
import { type ReportPage, type PageContent } from '@/pages/archive/season/report-slides/types'
import { uploadReportSlideImage } from '@/pages/archive/season/report-slides/report-image-upload'
import { PLATFORM_BUCKETS, PLATFORM_DISPLAY, platformBadgeStyle, platformBadgeClass, platformBucket } from '@/lib/influencer/content-platforms'
import { brandColorForKey, buildBrandKwsFromRows, monitoringBrandKey, MIMUSE_BRAND, type ConfirmedBrandKw } from '@/lib/influencer/monitoring-keywords'
import './monitoring-archive.css'

type BrandMentionPageMin = { id: string; brand_name: string; content: { bmOverrides?: string; bmRowIds?: string } }

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

/** Returns days remaining before the 3-day Apify link expiry, or null if unknown. */
function videoLinkDaysLeft(assetsUpdatedAt: string | null | undefined): number | null {
  if (!assetsUpdatedAt) return null
  const daysPassed = Math.floor((Date.now() - new Date(assetsUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, 3 - daysPassed)
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

function SummaryStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="mon-arch-summary__item" style={{ '--accent': accent } as React.CSSProperties}>
      <span className="mon-arch-summary__icon">{icon}</span>
      <div className="mon-arch-summary__text">
        <span className="mon-arch-summary__value">{value}</span>
        <span className="mon-arch-summary__label">{label}</span>
      </div>
    </div>
  )
}

function ArchiveCard({
  row,
  brandColor,
  phaseId,
  reportBmGroupNames,
  onSaveToReportSlot,
  onToggleBestReview,
  brandMentionPages,
  brandAutoCount,
  onSaveToBrandReportSlot,
}: {
  row: MonitoringRow
  brandColor: string
  phaseId?: string
  reportBmGroupNames?: string[]
  onSaveToReportSlot?: (brandKey: string, ti: number, url: string) => Promise<boolean>
  onToggleBestReview?: (row: MonitoringRow) => void
  brandMentionPages?: BrandMentionPageMin[]
  brandAutoCount?: Record<string, number>
  onSaveToBrandReportSlot?: (brandName: string, url: string, rowId: string) => Promise<boolean>
}) {
  const { showToast } = useToast()
  const thumbUrl = resolveMonitoringThumbnailUrl(row.assets)
  const videoUrl = row.assets?.video_url || null
  const isPhoto = !videoUrl && !!row.assets?.image_urls?.length
  const account = (row.handle || '').replace(/^@/, '')
  const [imgFailed, setImgFailed] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [localThumbUrl, setLocalThumbUrl] = useState<string | null>(null)
  const [thumbUploading, setThumbUploading] = useState(false)
  const [currentImageIdx, setCurrentImageIdx] = useState(() => {
    const cover = row.assets?.cover_url ?? null
    const imgs = row.assets?.image_urls ?? null
    if (!cover || !imgs) return 0
    const idx = imgs.indexOf(cover)
    return idx >= 0 ? idx : 0
  })
  const [photoViewMode, setPhotoViewMode] = useState<'photo' | 'thumb'>('photo')
  // Tracks the cover_url actually saved (updated on save so the carousel can jump to it)
  const [savedCoverUrl, setSavedCoverUrl] = useState<string | null>(row.assets?.cover_url ?? null)
  const [reportCapture, setReportCapture] = useState<{
    uploading: boolean; url: string | null; slotKey: string | null
  } | null>(null)
  const [reportSaving, setReportSaving] = useState(false)
  const [brandReportSaved, setBrandReportSaved] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const imageUrls = row.assets?.image_urls ?? null
  const imageCount = imageUrls?.length ?? 0
  const hasCarousel = isPhoto && imageCount > 1
  // Index of the saved cover inside imageUrls (−1 if not found)
  const savedCoverIdx = savedCoverUrl ? (imageUrls?.indexOf(savedCoverUrl) ?? -1) : -1

  function handleCapture() {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      showToast('영상이 아직 준비되지 않았습니다. 잠시 후 시도하세요.', 'info')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (!blob) {
          showToast('캡처 실패 — 잠시 후 다시 시도하세요.', 'error')
          return
        }
        void handleThumbUpload(new File([blob], 'capture.jpg', { type: 'image/jpeg' }), true)
      }, 'image/jpeg', 0.92)
    } catch {
      showToast('캡처 실패 — 잠시 후 다시 시도하세요.', 'error')
    }
  }

  async function handleThumbUpload(file: File, isCaptured = false) {
    setThumbUploading(true)
    try {
      const path = `${row.id}.jpg`
      const { error: uploadErr } = await supabase.storage
        .from('monitoring-thumbnails')
        .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true })
      if (uploadErr) throw uploadErr
      const { data: urlData } = supabase.storage.from('monitoring-thumbnails').getPublicUrl(path)
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: updateErr } = await supabase
        .from('monitoring_assets')
        .update({ cover_url: newUrl, updated_at: new Date().toISOString() })
        .eq('monitoring_id', row.id)
      if (updateErr) throw updateErr
      setLocalThumbUrl(newUrl)
      setImgFailed(false)
      showToast(isCaptured ? '프레임 캡처 완료 — 썸네일이 저장되었습니다.' : '썸네일이 업로드되었습니다.', 'success')
    } catch (e) {
      console.error('Thumbnail upload error:', e)
      showToast('썸네일 저장에 실패했습니다.', 'error')
    } finally {
      setThumbUploading(false)
    }
  }

  async function handleReportCapture() {
    if (!phaseId) { showToast('차수를 선택해 주세요.', 'info'); return }
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      showToast('영상이 아직 준비되지 않았습니다. 잠시 후 시도하세요.', 'info'); return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      setReportCapture({ uploading: true, url: null, slotKey: null })
      canvas.toBlob(async blob => {
        if (!blob) { showToast('캡처 실패', 'error'); setReportCapture(null); return }
        const file = new File([blob], 'report-capture.jpg', { type: 'image/jpeg' })
        const url = await uploadReportSlideImage(phaseId, file)
        if (url) { setReportCapture({ uploading: false, url, slotKey: null }) }
        else { showToast('캡처 업로드 실패', 'error'); setReportCapture(null) }
      }, 'image/jpeg', 0.92)
    } catch { showToast('캡처 실패', 'error'); setReportCapture(null) }
  }

  async function handleSlotSelect(gi: number, ti: number, brandKey: string, brandName: string) {
    if (!reportCapture?.url || !onSaveToReportSlot) return
    setReportSaving(true)
    const ok = await onSaveToReportSlot(brandKey, ti, reportCapture.url)
    setReportSaving(false)
    if (ok) {
      const key = `${brandKey}_${ti}`
      setReportCapture(rc => rc ? { ...rc, slotKey: key } : null)
      showToast(`${brandName} ${ti + 1}번 슬롯에 저장되었습니다`, 'success')
      setTimeout(() => setReportCapture(null), 1500)
    } else { showToast('저장 실패', 'error') }
  }

  async function handleBrandReportSave(brandName: string) {
    if (!reportCapture?.url || !onSaveToBrandReportSlot) return
    setReportSaving(true)
    const ok = await onSaveToBrandReportSlot(brandName, reportCapture.url, row.id)
    setReportSaving(false)
    if (ok) {
      setBrandReportSaved(brandName)
      showToast(`${brandName} 브랜드 리포트에 저장되었습니다`, 'success')
      setTimeout(() => { setBrandReportSaved(null); setReportCapture(null) }, 1500)
    } else {
      showToast('저장 실패', 'error')
    }
  }

  // Video is temporary (needs saving) if it's still an Apify KV URL.
  const isVideoTemporary = videoUrl?.includes('api.apify.com') ?? false
  const daysLeft = isVideoTemporary ? videoLinkDaysLeft(row.assets?.assets_updated_at) : null

  // In 사진 mode: always show the current carousel image.
  // In 썸네일 mode: show localThumbUrl (just confirmed) or the current carousel image.
  // Non-carousel cards: localThumbUrl overrides for immediate feedback after upload.
  const displayThumbUrl = hasCarousel
    ? (photoViewMode === 'thumb' && localThumbUrl ? localThumbUrl : imageUrls![currentImageIdx])
    : (localThumbUrl ?? thumbUrl)
  const thumb = displayThumbUrl && !imgFailed ? (
    <img src={displayThumbUrl} alt={row.display_name || account} loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} />
  ) : (
    <div className="mon-arch-card__thumb-empty">
      <InfluencerAvatar url={row.avatar_url} label={row.display_name || account} size={48} />
      <span className="mon-arch-card__thumb-name">{row.display_name || `@${account}`}</span>
    </div>
  )

  return (
    <div className="mon-arch-card" data-platform={platformBucket(row.platform)}>
      <div className="mon-arch-card__thumb">
        {/* Thumbnail is the default view — video loads only when toggled */}
        {showVideo && videoUrl && !videoError ? (
          <div className="mon-arch-card__player">
            <video
              key={videoUrl}
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              controls
              playsInline
              autoPlay
              preload="metadata"
              className="mon-arch-card__video"
              onError={() => setVideoError(true)}
            />
            <button
              className="mon-arch-card__capture-btn"
              onClick={handleCapture}
              title="현재 프레임을 썸네일로 캡처"
              disabled={thumbUploading || !!reportCapture}
            >
              {thumbUploading ? <Spinner sm /> : <Camera size={12} />}
              캡처
            </button>
            {((reportBmGroupNames && reportBmGroupNames.length > 0) || (brandMentionPages && brandMentionPages.length > 0)) && phaseId && (
              <button
                className="mon-arch-card__report-btn"
                onClick={handleReportCapture}
                title="리포트 슬롯에 캡처 저장"
                disabled={thumbUploading || !!reportCapture}
              >
                <Camera size={11} />
                리포트
              </button>
            )}
            {/* Slot picker overlay */}
            {reportCapture && (
              <div className="mon-arch-card__report-picker">
                {reportCapture.uploading ? (
                  <div className="mon-arch-card__report-picker__uploading">
                    <Spinner sm /> 캡처 업로드 중…
                  </div>
                ) : (
                  <>
                    <div className="mon-arch-card__report-picker__header">
                      <span className="mon-arch-card__report-picker__title">결과 리포트</span>
                      <button className="mon-arch-card__report-picker__close" onClick={() => setReportCapture(null)}>
                        <X size={12} />
                      </button>
                    </div>
                    {(reportBmGroupNames ?? []).slice(0, 4).map((name, gi) => {
                      const brandKey = monitoringBrandKey(name)
                      return (
                        <div key={gi} className="mon-arch-card__report-picker__group">
                          <span className="mon-arch-card__report-picker__brand">{gi + 1}. {name}</span>
                          <div className="mon-arch-card__report-picker__slots">
                            {Array.from({ length: 4 }).map((_, ti) => {
                              const key = `${brandKey}_${ti}`
                              const saved = reportCapture.slotKey === key
                              return (
                                <button
                                  key={ti}
                                  className={`mon-arch-card__report-picker__slot${saved ? ' mon-arch-card__report-picker__slot--saved' : ''}`}
                                  disabled={reportSaving}
                                  onClick={() => void handleSlotSelect(gi, ti, brandKey, name)}
                                >
                                  {ti + 1}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    {brandMentionPages && brandMentionPages.length > 0 && (
                      <>
                        <div className="mon-arch-card__report-picker__divider" />
                        <div className="mon-arch-card__report-picker__section-label">브랜드별 리포트</div>
                        <div className="mon-arch-card__report-picker__brand-btns">
                          {brandMentionPages.map(page => {
                            const overrides: Record<string, string> = (() => { try { return JSON.parse(page.content.bmOverrides ?? '{}') } catch { return {} } })()
                            const rowIds: Record<string, string> = (() => { try { return JSON.parse(page.content.bmRowIds ?? '{}') } catch { return {} } })()
                            const alreadyCaptured = Object.values(rowIds).includes(row.id)
                            const filled = Object.values(overrides).filter(Boolean).length
                            const autoFilled = brandAutoCount?.[page.brand_name] ?? 0
                            const totalFilled = autoFilled + filled
                            const isSaved = brandReportSaved === page.brand_name
                            return (
                              <button
                                key={page.id}
                                type="button"
                                className={`mon-arch-card__report-picker__brand-btn${isSaved ? ' mon-arch-card__report-picker__brand-btn--saved' : alreadyCaptured ? ' mon-arch-card__report-picker__brand-btn--recapture' : ''}`}
                                disabled={reportSaving}
                                onClick={() => void handleBrandReportSave(page.brand_name)}
                              >
                                {isSaved ? '✓ 저장됨' : alreadyCaptured ? `↺ ${page.brand_name}` : page.brand_name}
                                {!isSaved && <span className="mon-arch-card__report-picker__brand-count">{totalFilled}/14</span>}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mon-arch-card__thumb-static">{thumb}</div>
            {hasCarousel && (
              <>
                <button
                  className="mon-arch-card__carousel-btn mon-arch-card__carousel-btn--prev"
                  onClick={e => { e.stopPropagation(); setLocalThumbUrl(null); setCurrentImageIdx(i => Math.max(0, i - 1)) }}
                  disabled={currentImageIdx === 0}
                >
                  <ChevronUp size={14} style={{ transform: 'rotate(-90deg)' }} />
                </button>
                <button
                  className="mon-arch-card__carousel-btn mon-arch-card__carousel-btn--next"
                  onClick={e => { e.stopPropagation(); setLocalThumbUrl(null); setCurrentImageIdx(i => Math.min(imageCount - 1, i + 1)) }}
                  disabled={currentImageIdx === imageCount - 1}
                >
                  <ChevronUp size={14} style={{ transform: 'rotate(90deg)' }} />
                </button>
                <span className="mon-arch-card__carousel-counter">{currentImageIdx + 1}/{imageCount}</span>
                {photoViewMode === 'thumb' && (
                  <button
                    className="mon-arch-card__carousel-set-thumb"
                    disabled={thumbUploading}
                    onClick={async e => {
                      e.stopPropagation()
                      const url = imageUrls![currentImageIdx]
                      if (!url) return
                      setThumbUploading(true)
                      try {
                        const { error } = await supabase
                          .from('monitoring_assets')
                          .update({ cover_url: url, updated_at: new Date().toISOString() })
                          .eq('monitoring_id', row.id)
                        if (error) throw error
                        setLocalThumbUrl(url)
                        setSavedCoverUrl(url)
                        showToast('썸네일이 저장되었습니다.', 'success')
                      } catch (e) {
                        console.error('썸네일 설정 오류:', e)
                        showToast('썸네일 저장에 실패했습니다.', 'error')
                      } finally {
                        setThumbUploading(false)
                      }
                    }}
                    title="이 사진을 썸네일로 설정"
                  >
                    {thumbUploading ? <Spinner sm /> : <ImageIcon size={11} />}
                    썸네일 설정
                  </button>
                )}
              </>
            )}
          </>
        )}

        <div className="mon-arch-card__thumb-top">
          {/* Toggle moved here — left slot replaces platform badge */}
          {videoUrl ? (
            <button
              className={`mon-arch-card__media-toggle${showVideo ? ' mon-arch-card__media-toggle--video' : ''}`}
              onClick={() => { setShowVideo(v => !v); if (videoError) setVideoError(false) }}
              title={showVideo ? '썸네일로 전환' : '영상으로 전환'}
            >
              {showVideo
                ? <><Play size={11} fill="currentColor" strokeWidth={0} /> 영상</>
                : <><ImageIcon size={11} strokeWidth={2} /> 썸네일</>}
            </button>
          ) : hasCarousel ? (
            <button
              className={`mon-arch-card__media-toggle${photoViewMode === 'thumb' ? ' mon-arch-card__media-toggle--video' : ''}`}
              onClick={() => {
                if (photoViewMode === 'photo') {
                  if (savedCoverIdx >= 0) setCurrentImageIdx(savedCoverIdx)
                  setLocalThumbUrl(null)
                  setPhotoViewMode('thumb')
                } else {
                  setPhotoViewMode('photo')
                }
              }}
              title={photoViewMode === 'photo' ? '썸네일 편집 모드로 전환' : '사진 보기로 전환'}
            >
              {photoViewMode === 'photo'
                ? <><ImageIcon size={11} strokeWidth={2} /> 사진 {imageCount}장</>
                : <><Camera size={11} /> 썸네일</>}
            </button>
          ) : (
            <span className={`mon-arch-card__type mon-arch-card__type--${isPhoto ? 'photo' : 'video'}`}>
              {isPhoto
                ? <><ImageIcon size={11} strokeWidth={2} /> 사진</>
                : <><Play size={11} fill="currentColor" strokeWidth={0} /> 영상</>}
            </span>
          )}
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

        {/* Hidden file input for thumbnail replacement */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handleThumbUpload(file)
            e.target.value = ''
          }}
        />

        {/* Upload overlay — only for video cards (photo cards use carousel 썸네일 설정) */}
        {!showVideo && !!videoUrl && (
          <button
            className={`mon-arch-card__thumb-upload${thumbUploading ? ' mon-arch-card__thumb-upload--loading' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            title="썸네일 변경"
            disabled={thumbUploading}
          >
            {thumbUploading
              ? <Spinner sm />
              : <><Upload size={13} /> 썸네일 변경</>}
          </button>
        )}
      </div>

      <div className="mon-arch-card__body">
        <div className="mon-arch-card__creator">
          <InfluencerAvatar url={row.avatar_url} label={row.display_name || account} size={28} />
          <div className="mon-arch-card__creator-info">
            <div className="mon-arch-card__name">
              {row.display_name || `@${account}`}
              {row.best_review_picks && <Star size={10} fill="currentColor" className="mon-arch-card__name-star" />}
            </div>
            <div className="mon-arch-card__handle-row">
              <span className="mon-arch-card__handle">@{account}</span>
              {onToggleBestReview && (
                <button
                  className={`mon-arch-card__star-btn${row.best_review_picks ? ' mon-arch-card__star-btn--active' : ''}`}
                  onClick={() => onToggleBestReview(row)}
                  title={row.best_review_picks ? '베스트 리뷰 해제' : '베스트 리뷰로 선택'}
                >
                  <Star size={11} fill={row.best_review_picks ? 'currentColor' : 'none'} />
                  베스트
                </button>
              )}
            </div>
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
  const [sortBy, setSortBy] = useState<'date' | 'views' | 'engagement'>('date')
  const [showBestFirst, setShowBestFirst] = useState(false)
  const [importing, setImporting] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [dlModal, setDlModal] = useState<{
    open: boolean; urlCount: number; status: 'running' | 'done'; step: 'scraping' | 'saving'; updated?: number; message?: string
  }>({ open: false, urlCount: 0, status: 'running', step: 'scraping' })
  const [zipModal, setZipModal] = useState<{
    open: boolean; total: number; done: number; status: 'running' | 'done'; message?: string
  }>({ open: false, total: 0, done: 0, status: 'running' })
  const [videoUploadModal, setVideoUploadModal] = useState<{
    open: boolean
    videoTotal: number; videoDone: number
    imageTotal: number; imageDone: number
    status: 'running' | 'done'; message?: string; minimized: boolean
  }>({ open: false, videoTotal: 0, videoDone: 0, imageTotal: 0, imageDone: 0, status: 'running', minimized: false })
  const [uploadingVideos, setUploadingVideos] = useState(false)
  const [reportBmPage, setReportBmPage] = useState<ReportPage | null>(null)
  const [brandMentionPages, setBrandMentionPages] = useState<BrandMentionPageMin[]>([])
  useEffect(() => {
    if (videoUploadModal.status !== 'done' || !videoUploadModal.open) return
    const t = setTimeout(() => setVideoUploadModal(m => ({ ...m, open: false })), 3000)
    return () => clearTimeout(t)
  }, [videoUploadModal.status, videoUploadModal.open])

  useEffect(() => {
    if (phaseLoading) return
    if (!viewPhaseId) { setRows([]); setBrands([]); setBrandKw({}); setLoading(false); return }
    setLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const [data, brandsRes, kwsRes, bmPageRes, bmBrandPagesRes] = await Promise.all([
          loadMonitoringData(viewPhaseId),
          supabase.from('confirmed_brands').select('brand_name, brand_en').eq('phase_id', viewPhaseId).order('brand_name'),
          supabase.from('monitoring_keywords').select('brand, keywords, phase_id')
            .or(`and(phase_id.is.null,brand.eq.${MIMUSE_BRAND}),phase_id.eq.${viewPhaseId}`),
          supabase.from('report_pages').select('*').eq('phase_id', viewPhaseId).eq('type', 'brand_mention').maybeSingle(),
          supabase.from('brand_report_pages').select('id, brand_name, content').eq('phase_id', viewPhaseId).eq('type', 'brand_mention'),
        ])
        if (cancelled) return
        setRows(data.rows)
        const confirmed = (brandsRes.data || []).map(b => ({ key: monitoringBrandKey(b.brand_name), name: b.brand_name, en: (b.brand_en as string | null) ?? '' }))
        setBrands(confirmed)
        setBrandKw(buildBrandKwsFromRows(kwsRes.data || [], confirmed).byBrand)
        setReportBmPage(bmPageRes.data as ReportPage | null)
        setBrandMentionPages((bmBrandPagesRes.data as BrandMentionPageMin[]) ?? [])
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
    const sorted = [...seen].sort((a, b) => {
      if (a === 'mimuse') return -1
      if (b === 'mimuse') return 1
      return a.localeCompare(b)
    })
    return [
      { value: 'all', label: '전체' },
      ...sorted.map(b => ({ value: b, label: b })),
    ]
  }, [reviewRows])

  const filteredRows = useMemo(() => {
    const filtered = reviewRows.filter(r =>
      brandFilter === 'all' || r.brand === brandFilter
    )
    const sorted = [...filtered]
    if (sortBy === 'date') {
      sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    } else if (sortBy === 'views') {
      sorted.sort((a, b) => b.views - a.views)
    } else if (sortBy === 'engagement') {
      const eng = (r: MonitoringRow) => r.views > 0 ? (r.likes + r.comments) / r.views : 0
      sorted.sort((a, b) => eng(b) - eng(a))
    }
    if (showBestFirst) {
      const best = sorted.filter(r => r.best_review_picks)
      const rest  = sorted.filter(r => !r.best_review_picks)
      return [...best, ...rest]
    }
    return sorted
  }, [reviewRows, brandFilter, sortBy, showBestFirst])

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
    setDlModal({ open: true, urlCount: tiktokRows.length, status: 'running', step: 'scraping' })
    const stepTimer = setTimeout(() => {
      setDlModal(m => m.status === 'running' ? { ...m, step: 'saving' } : m)
    }, 20000)
    try {
      const res = await gasPost<{ ok?: boolean; error?: string; message?: string; updated?: number }>({
        action: 'downloadVideoAssets',
        rows: tiktokRows.map(r => ({ id: r.id, review_link: r.review_link })),
      })
      clearTimeout(stepTimer)
      if (res.error) { setDlModal(m => ({ ...m, status: 'done', step: 'saving', message: '오류: ' + res.error })); return }
      setDlModal(m => ({ ...m, status: 'done', step: 'saving', updated: res.updated ?? 0, message: res.message }))
      if (viewPhaseId) loadMonitoringData(viewPhaseId).then(({ rows: r }) => setRows(r)).catch(() => {})
    } catch (e: unknown) {
      clearTimeout(stepTimer)
      setDlModal(m => ({ ...m, status: 'done', step: 'saving', message: '오류: ' + (e as Error).message }))
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
    const needsVideo = (r: MonitoringRow) => !!r.assets?.video_url?.includes('api.apify.com')
    const needsImage = (r: MonitoringRow) => { const u = r.assets?.image_urls?.[0]; return !!u && !u.includes('monitoring-photos') }

    const videoRows = filteredRows.filter(needsVideo)
    const imageRows = filteredRows.filter(r => needsImage(r) && !needsVideo(r))
    const bothRows  = filteredRows.filter(r => needsVideo(r) && needsImage(r))

    const totalVideos = videoRows.length + bothRows.length
    const totalImages = imageRows.length + bothRows.length

    if (!totalVideos && !totalImages) { showToast('저장할 콘텐츠가 없습니다', 'info'); return }
    setUploadingVideos(true)
    setVideoUploadModal({ open: true, videoTotal: totalVideos, videoDone: 0, imageTotal: totalImages, imageDone: 0, status: 'running', minimized: false })

    let savedVideos = 0; let failedVideos = 0
    let savedImages = 0; let failedImages = 0

    // Process rows that need video (+ possibly image too)
    for (const row of [...videoRows, ...bothRows]) {
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

      // Save video
      try {
        const fetchRes = await fetch(row.assets!.video_url!)
        if (!fetchRes.ok) throw new Error(`fetch ${fetchRes.status}`)
        const blob = await fetchRes.blob()
        const path = `${row.id}.mp4`
        const { error: uploadErr } = await supabase.storage.from('monitoring-videos').upload(path, blob, { contentType: 'video/mp4', upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('monitoring-videos').getPublicUrl(path)
        updatePayload.video_url = urlData.publicUrl
        savedVideos++
      } catch (e) {
        console.error('Video upload error:', row.id, e)
        failedVideos++
      }
      setVideoUploadModal(m => ({ ...m, videoDone: m.videoDone + 1 }))

      // Save all images if needed
      if (needsImage(row)) {
        try {
          const cdnUrls = row.assets!.image_urls!.filter(u => u && !u.includes('supabase'))
          const savedUrls: string[] = []
          for (let i = 0; i < cdnUrls.length; i++) {
            try {
              const imgRes = await fetch(cdnUrls[i])
              if (!imgRes.ok) continue
              const imgBlob = await imgRes.blob()
              const imgPath = `${row.id}_${i}.jpg`
              await supabase.storage.from('monitoring-photos').upload(imgPath, imgBlob, { contentType: imgBlob.type || 'image/jpeg', upsert: true })
              const { data: imgUrlData } = supabase.storage.from('monitoring-photos').getPublicUrl(imgPath)
              savedUrls.push(`${imgUrlData.publicUrl}?t=${Date.now()}`)
            } catch {
              // skip individual image failures, keep going
            }
          }
          if (savedUrls.length) updatePayload.image_urls = savedUrls
          savedImages++
        } catch (e) {
          console.warn('Image upload error:', row.id, e)
          failedImages++
        }
        setVideoUploadModal(m => ({ ...m, imageDone: m.imageDone + 1 }))
      }

      await supabase.from('monitoring_assets').update(updatePayload).eq('monitoring_id', row.id)
    }

    // Process image-only rows
    for (const row of imageRows) {
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
      try {
        const cdnUrls = row.assets!.image_urls!.filter(u => u && !u.includes('supabase'))
        const savedUrls: string[] = []
        for (let i = 0; i < cdnUrls.length; i++) {
          try {
            const imgRes = await fetch(cdnUrls[i])
            if (!imgRes.ok) continue
            const imgBlob = await imgRes.blob()
            const imgPath = `${row.id}_${i}.jpg`
            await supabase.storage.from('monitoring-photos').upload(imgPath, imgBlob, { contentType: imgBlob.type || 'image/jpeg', upsert: true })
            const { data: imgUrlData } = supabase.storage.from('monitoring-photos').getPublicUrl(imgPath)
            savedUrls.push(`${imgUrlData.publicUrl}?t=${Date.now()}`)
          } catch {
            // skip individual image failures, keep going
          }
        }
        if (savedUrls.length) updatePayload.image_urls = savedUrls
        savedImages++
      } catch (e) {
        console.warn('Image upload error:', row.id, e)
        failedImages++
      }
      setVideoUploadModal(m => ({ ...m, imageDone: m.imageDone + 1 }))
      await supabase.from('monitoring_assets').update(updatePayload).eq('monitoring_id', row.id)
    }

    const msg = [
      totalVideos ? `영상 ${savedVideos}개` + (failedVideos ? ` (${failedVideos}개 실패)` : '') : null,
      totalImages ? `사진 ${savedImages}개` + (failedImages ? ` (${failedImages}개 실패)` : '') : null,
    ].filter(Boolean).join(' · ') + ' 저장 완료'
    setVideoUploadModal(m => ({ ...m, status: 'done', message: msg }))
    setUploadingVideos(false)
    if (viewPhaseId) loadMonitoringData(viewPhaseId).then(({ rows: r }) => setRows(r)).catch(() => {})
  }

  async function handleSaveToBrandReportSlot(brandName: string, url: string, rowId: string): Promise<boolean> {
    const page = brandMentionPages.find(p => p.brand_name === brandName)
    if (!page) return false
    const overrides: Record<string, string> = (() => {
      try { return JSON.parse(page.content.bmOverrides ?? '{}') } catch { return {} }
    })()
    const rowIds: Record<string, string> = (() => {
      try { return JSON.parse(page.content.bmRowIds ?? '{}') } catch { return {} }
    })()
    // Reuse the same slot if this video already has one, otherwise find next empty
    const existingSlot = Object.entries(rowIds).find(([, rid]) => rid === rowId)?.[0]
    let targetSlot = existingSlot
    if (targetSlot === undefined) {
      for (let i = 0; i < 14; i++) {
        if (!overrides[String(i)]) { targetSlot = String(i); break }
      }
      targetSlot ??= String(13)
    }
    const newOverrides = { ...overrides, [targetSlot]: url }
    const newRowIds = { ...rowIds, [targetSlot]: rowId }
    const { error } = await supabase
      .from('brand_report_pages')
      .update({ content: { ...page.content, bmOverrides: JSON.stringify(newOverrides), bmRowIds: JSON.stringify(newRowIds) } })
      .eq('id', page.id)
    if (!error) {
      setBrandMentionPages(prev => prev.map(p =>
        p.id === page.id
          ? { ...p, content: { ...p.content, bmOverrides: JSON.stringify(newOverrides), bmRowIds: JSON.stringify(newRowIds) } }
          : p
      ))
      return true
    }
    return false
  }

  // How many slots each brand's auto-thumbnails occupy (brandRows with thumbnails)
  const brandAutoCount = useMemo(() => {
    const result: Record<string, number> = {}
    const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))
    for (const page of brandMentionPages) {
      const b = brands.find(br => br.name === page.brand_name)
      const brandKey = b?.key ?? monitoringBrandKey(page.brand_name)
      const brandEn = b?.en ?? ''
      const brandVariants = new Set([
        page.brand_name.trim().toLowerCase(),
        brandKey,
        page.brand_name.trim().toLowerCase().replace(/\s+/g, ''),
        ...(brandEn ? [brandEn.toLowerCase()] : []),
      ])
      const bRows = reviewRows.filter(r => r.brand && brandVariants.has(r.brand.toLowerCase()))
      result[page.brand_name] = Math.min(
        bRows.filter(r => resolveMonitoringThumbnailUrl(r.assets)).length,
        14,
      )
    }
    return result
  }, [brandMentionPages, rows, brands])

  const reportBmGroupNames = useMemo(
    () => brands.slice(0, 4).map(b => b.name),
    [brands],
  )

  async function handleSaveToReportSlot(brandKey: string, ti: number, url: string): Promise<boolean> {
    if (!reportBmPage) return false
    const currentOverrides: Record<string, string> = (() => {
      try { return JSON.parse(reportBmPage.content.bmOverrides ?? '{}') } catch { return {} }
    })()
    const key = `${brandKey}_${ti}`
    const newContent: PageContent = {
      ...reportBmPage.content,
      bmOverrides: JSON.stringify({ ...currentOverrides, [key]: url }),
    }
    const { error } = await supabase.from('report_pages').update({ content: newContent }).eq('id', reportBmPage.id)
    if (!error) { setReportBmPage({ ...reportBmPage, content: newContent }); return true }
    return false
  }

  async function handleToggleBestReview(row: MonitoringRow) {
    const nowOn = !row.best_review_picks
    if (nowOn && rows.filter(r => r.best_review_picks).length >= 3) {
      showToast('베스트 리뷰는 최대 3개까지 선택할 수 있습니다', 'info')
      return
    }
    const { error } = await supabase.from('monitoring').update({ best_review_picks: nowOn }).eq('id', row.id)
    if (error) { showToast('저장 실패', 'error'); return }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, best_review_picks: nowOn } : r))
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
              {filteredRows.some(r =>
                r.assets?.video_url?.includes('api.apify.com') ||
                (!!r.assets?.image_urls?.[0] && !r.assets.image_urls[0].includes('monitoring-photos'))
              ) && (
                <button
                  className="page-banner-btn page-banner-btn--secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  disabled={uploadingVideos}
                  onClick={() => { void handleUploadVideos() }}
                >
                  {uploadingVideos ? <Spinner sm /> : <Film size={14} />}
                  리뷰 저장
                </button>
              )}
            </div>
          )}
        />
      </PageHeroBanner>


{hasData && (
        <div className="mon-arch-summary">
          <SummaryStat icon={<Film size={15} />}         label="콘텐츠" value={`${fmtNum(filteredRows.length)}개`} accent="#0d9488" />
          <SummaryStat icon={<Eye size={15} />}          label="조회"   value={fmtNum(totals.views)}              accent="#2563eb" />
          <SummaryStat icon={<Heart size={15} />}        label="좋아요" value={fmtNum(totals.likes)}              accent="#e11d48" />
          <SummaryStat icon={<MessageCircle size={15} />} label="댓글"  value={fmtNum(totals.comments)}           accent="#d97706" />
        </div>
      )}

      {!loading && filteredRows.some(r =>
        r.assets?.video_url?.includes('api.apify.com') ||
        (!!r.assets?.image_urls?.[0] && !r.assets.image_urls[0].includes('supabase'))
      ) && (
        <div className="mon-arch-notice">
          <Clock size={13} className="mon-arch-notice__icon" />
          임시 CDN 링크가 있습니다. <strong>3일 이내</strong>에 <strong>리뷰 저장</strong> 버튼을 눌러 영구 보관하세요. 기간이 지나면 Apify에서 다시 가져와야 합니다.
        </div>
      )}

      <div className="filters mon-arch-filters" style={{ marginBottom: 20 }}>
        <label htmlFor="mon-brand-select">브랜드</label>
        <select
          id="mon-brand-select"
          value={brandFilter}
          onChange={e => setBrandFilter(e.target.value)}
        >
          {brandOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="mon-arch-divider" />

        <label htmlFor="mon-sort-select">정렬</label>
        <select
          id="mon-sort-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'date' | 'views' | 'engagement')}
        >
          <option value="date">최신순</option>
          <option value="views">조회순</option>
          <option value="engagement">참여율순</option>
        </select>

        <button
          type="button"
          className={`mon-arch-best-filter-btn${showBestFirst ? ' mon-arch-best-filter-btn--active' : ''}`}
          onClick={() => setShowBestFirst(v => !v)}
          title="베스트 리뷰 상단 고정"
        >
          <Star size={12} fill={showBestFirst ? 'currentColor' : 'none'} />
          베스트
        </button>

        {hasData && (
          <>
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
          </>
        )}
      </div>

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
                phaseId={viewPhaseId || undefined}
                reportBmGroupNames={reportBmGroupNames}
                onSaveToReportSlot={handleSaveToReportSlot}
                onToggleBestReview={handleToggleBestReview}
                brandMentionPages={brandMentionPages}
                brandAutoCount={brandAutoCount}
                onSaveToBrandReportSlot={handleSaveToBrandReportSlot}
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
        <div style={{ minWidth: 300, padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {([
              { key: 'scraping', label: 'Apify 스크래핑' },
              { key: 'saving',   label: '데이터베이스 저장' },
              { key: 'done',     label: '완료' },
            ] as const).map(({ key, label }, i) => {
              const currentIdx = dlModal.status === 'done' ? 2 : (dlModal.step === 'saving' ? 1 : 0)
              const isDone   = i < currentIdx || (i === currentIdx && dlModal.status === 'done')
              const isActive = i === currentIdx && dlModal.status === 'running'
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isDone
                    ? <CheckCircle2 size={16} color="var(--teal-5)" />
                    : isActive
                      ? <Spinner sm />
                      : <Circle size={16} color="var(--gray-3)" />
                  }
                  <span style={{ fontSize: 14, color: isDone ? 'var(--gray-7)' : isActive ? 'var(--gray-7)' : 'var(--gray-4)', fontWeight: isActive ? 500 : 400 }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          {dlModal.status === 'done' && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--gray-2)', fontSize: 12, color: 'var(--gray-5)' }}>
              {dlModal.message || `저장 완료 ${dlModal.updated ?? 0}개`}
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

      {videoUploadModal.open && (
        <div className="mon-upload-toast">
          <div className="mon-upload-toast__header">
            <span className="mon-upload-toast__title">
              {videoUploadModal.status === 'running' ? '리뷰 저장 중…' : '리뷰 저장 완료'}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="mon-upload-toast__btn" onClick={() => setVideoUploadModal(m => ({ ...m, minimized: !m.minimized }))}>
                {videoUploadModal.minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {videoUploadModal.status === 'done' && (
                <button className="mon-upload-toast__btn" onClick={() => setVideoUploadModal(m => ({ ...m, open: false }))}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          {!videoUploadModal.minimized && (
            <div className="mon-upload-toast__body">
              {videoUploadModal.status === 'running' ? (
                <>
                  <div className="mon-arch-progress" style={{ marginBottom: 8 }}>
                    <div
                      className="mon-arch-progress__bar"
                      style={{ width: `${(videoUploadModal.videoTotal + videoUploadModal.imageTotal) > 0
                        ? ((videoUploadModal.videoDone + videoUploadModal.imageDone) / (videoUploadModal.videoTotal + videoUploadModal.imageTotal)) * 100
                        : 0}%` }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-5)', display: 'flex', gap: 12 }}>
                    {videoUploadModal.videoTotal > 0 && <span>영상 {videoUploadModal.videoDone}/{videoUploadModal.videoTotal}개</span>}
                    {videoUploadModal.imageTotal > 0 && <span>사진 {videoUploadModal.imageDone}/{videoUploadModal.imageTotal}개</span>}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-6)' }}>
                  <CheckCircle2 size={15} color="var(--teal-5)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{videoUploadModal.message}</span>
                  <button
                    onClick={() => setVideoUploadModal(m => ({ ...m, open: false }))}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'transparent', color: 'var(--gray-4)', cursor: 'pointer', borderRadius: 4, flexShrink: 0 }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
