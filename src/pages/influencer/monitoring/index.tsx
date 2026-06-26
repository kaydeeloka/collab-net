import { useLocation, useNavigate } from 'react-router-dom'
import { Copy, Download, ExternalLink, RefreshCw, Video } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import { formatKstDate } from '@/lib/kst-time'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import Modal from '@/components/Modal'
import HeaderFilterMenu from '@/components/HeaderFilterMenu'
import { PageTabs, StatCard, StatCards } from '@/components/ui'
import { FilterSegmentBar } from '@/components/FilterSegmentBar'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { PLATFORM_BUCKETS, PLATFORM_DISPLAY, platformBadgeClass, platformBadgeStyle, platformBucket } from '@/lib/influencer/content-platforms'
import type { MonitoringAssets } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import {
  MIMUSE_BRAND,
  MIMUSE_COLOR,
  type BrandKwsState,
  type ConfirmedBrandKw,
  brandKeywordIndex,
  buildBrandKwsFromRows,
  emptyBrandKws,
  isMimuseKeyword,
  monitoringBrandKey,
} from '@/lib/influencer/monitoring-keywords'

const MONITORING_UPLOAD_PATH = '/influencer/monitoring'
const MONITORING_LIST_PATH = '/influencer/monitoring-list'

const BRANDS_KW_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316', '#06b6d4', '#3b82f6', '#e11d48']

const MEDIA_OPTIONS   = ['photo', 'video']
const CONTENT_OPTIONS = ['review video', 'unboxing', 'other']

function PlatformBadge({ platform }: { platform: string }) {
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
}

interface MonRow {
  id:                      string
  influencer_platform_id:  string | null
  confirmed_influencer_id: string | null  // from join chain
  seq:                     number | null  // fixed number from confirmed_influencers
  platform:                string
  handle:                  string
  display_name:            string | null  // from influencers join
  avatar_url:              string | null
  date:                    string | null
  media:                   string | null
  content:                 string | null
  brand:                   string | null
  repost:                  string | null  // from confirmed_influencers (read-only)
  review_link:             string | null
  assets:                  MonitoringAssets | null
  views:                   number
  likes:                   number
  comments:                number
  keywords:                string | null
  updated:                 string | null
  isPlaceholder?:          boolean
}

const MON_SCRAPE_LIMIT = 50

function isPlaceholderRow(r: MonRow): boolean {
  return !!r.isPlaceholder || r.id.startsWith('placeholder-')
}

interface MonStats {
  totalInfluencers: number
  totalReviews:     number
  brandCounts:      Record<string, number>
  lastRun:          string
}

function fmtDate(val: string | null): string {
  return formatKstDate(val) ?? (val || '—')
}

function ViewField({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-8)', fontWeight: 500, wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

function ReviewLinkBox({ link, onCopy, compact }: { link: string; onCopy: () => void; compact?: boolean }) {
  return (
    <div className={`review-link-box${compact ? ' review-link-box--compact' : ''}`}>
      <div className="review-link-box__url">{link}</div>
      <div className="review-link-box__actions">
        <button type="button" className="review-link-box__icon-btn" onClick={onCopy} aria-label="링크 복사" title="복사">
          <Copy size={compact ? 14 : 15} />
        </button>
        <a href={link} target="_blank" rel="noopener" className="review-link-box__btn">
          <ExternalLink size={13} />
          보기
        </a>
      </div>
    </div>
  )
}

function ModalStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mon-review-modal__stat">
      <div className="mon-review-modal__stat-label">{label}</div>
      <div className="mon-review-modal__stat-value">{value}</div>
    </div>
  )
}

function modalTitle(r: MonRow): string {
  return r.display_name || `@${(r.handle || '').replace(/^@/, '')}`
}

function InfluencerAvatar({ url, label, size = 36 }: { url?: string | null; label?: string | null; size?: number }) {
  const fallback = (label || '?').replace(/^@/, '').slice(0, 1).toUpperCase() || '?'
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--gray-2)',
        border: '1px solid var(--gray-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        color: 'var(--gray-5)',
      }}
    >
      {url
        ? <img src={url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : fallback}
    </div>
  )
}

function brandBadge(brand: string | null) {
  if (!brand) return '—'
  const key = brand.toLowerCase()
  const color = key === MIMUSE_BRAND ? MIMUSE_COLOR : 'var(--gray-6)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}44` }}>
      {brand}
    </span>
  )
}

export default function Monitoring() {
  const { showConfirm, showToast } = useToast()
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab: 'upload' | 'list' = location.pathname === MONITORING_LIST_PATH ? 'list' : 'upload'

  function setActiveTab(tab: 'upload' | 'list') {
    navigate(tab === 'list' ? MONITORING_LIST_PATH : MONITORING_UPLOAD_PATH)
  }
  const [rows,           setRows]           = useState<MonRow[]>([])
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [loading,        setLoading]        = useState(true)

  const [brandKws,         setBrandKws]         = useState<BrandKwsState>(emptyBrandKws())
  const [confirmedBrands,  setConfirmedBrands]  = useState<ConfirmedBrandKw[]>([])
  const [showKwModal,      setShowKwModal]      = useState(false)
  const [newMimuseKw,      setNewMimuseKw]      = useState('')
  const [newBrandKwByKey,  setNewBrandKwByKey]  = useState<Record<string, string>>({})
  const [kwSaving,         setKwSaving]         = useState(false)

  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeMsg,     setScrapeMsg]     = useState('')
  const [runPending,    setRunPending]    = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [manualRunId,   setManualRunId]   = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualMsg,     setManualMsg]     = useState('')

  const [modalRow,       setModalRow]       = useState<MonRow | null>(null)
  const [modalGroupRows, setModalGroupRows] = useState<MonRow[]>([])
  const [modalEditing,   setModalEditing]   = useState(false)
  const [editForm,       setEditForm]       = useState<{
    date: string; media: string; content: string; brand: string
    review_link: string; views: number; likes: number; comments: number
  } | null>(null)
  const [editSaving,     setEditSaving]     = useState(false)
  const [uploadPage,     setUploadPage]     = useState(1)
  const [listPage,       setListPage]       = useState(1)
  const MON_PAGE_SIZE = 25

  const [searchQuery,      setSearchQuery]      = useState('')
  const [uploadFilter,     setUploadFilter]     = useState('all')
  const [platformFilter,   setPlatformFilter]   = useState('all')
  const [brandFilter,      setBrandFilter]      = useState('all')
  const [listPlatformFilter, setListPlatformFilter] = useState('all')
  const [listBrandFilter,    setListBrandFilter]    = useState('all')
  const [statusFilter,     setStatusFilter]     = useState('all')
  const [openFilter,       setOpenFilter]       = useState<'platform' | 'brand' | 'status' | null>(null)
  const [openListFilter,   setOpenListFilter]   = useState<'platform' | 'brand' | null>(null)
  const [metaUpdating,     setMetaUpdating]     = useState(false)
  const [metaModal,        setMetaModal]        = useState<{ open: boolean; urlCount: number; status: 'running' | 'done'; updated?: number; message?: string }>({ open: false, urlCount: 0, status: 'running' })
  const [assetDownloading, setAssetDownloading] = useState(false)
  const [assetModal,       setAssetModal]       = useState<{ open: boolean; urlCount: number; status: 'running' | 'done'; updated?: number; message?: string }>({ open: false, urlCount: 0, status: 'running' })

  useEffect(() => { setUploadPage(1) }, [searchQuery, uploadFilter, platformFilter, brandFilter, statusFilter])
  useEffect(() => { setListPage(1) }, [activeTab, listPlatformFilter, listBrandFilter])

  useEffect(() => {
    if (phaseLoading) return
    loadKeywords()
    if (viewPhaseId) loadMonitoring()
    else {
      setRows([])
      setConfirmedCount(0)
      setLoading(false)
    }
  }, [viewPhaseId, phaseLoading])

function mapMonitoringAssets(raw: any): MonitoringAssets | null {
  if (!raw) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  if (!row) return null
  return {
    thumbnail_source_url: row.thumbnail_source_url ?? null,
    thumbnail_path:       row.thumbnail_path ?? null,
    video_path:           row.video_path ?? null,
    cover_url:            row.cover_url ?? null,
    video_url:            row.video_url ?? null,
  }
}

  function mapMonitoringRecord(m: any): MonRow {
    const ip = m.influencer_platform
    const ci = ip?.confirmed_influencers
    return {
      id:                      m.id,
      influencer_platform_id:  m.influencer_platform_id,
      confirmed_influencer_id: ci?.id  || null,
      seq:                     ci?.seq  ?? null,
      platform:                ip?.platform || '',
      handle:                  ip?.handle   || '',
      display_name:            ci?.influencers?.display_name || null,
      avatar_url:              ci?.influencers?.avatar_url || null,
      date:                    m.date,
      media:                   m.media,
      content:                 m.content,
      brand:                   m.brand,
      repost:                  ci?.repost || null,
      review_link:             m.review_link,
      assets:                  mapMonitoringAssets(m.monitoring_assets),
      views:                   m.views    || 0,
      likes:                   m.likes    || 0,
      comments:                m.comments || 0,
      keywords:                m.keywords,
      updated:                 m.updated,
    }
  }

  function buildPlaceholder(ci: any, ip: { id: string; platform: string; handle: string } | null): MonRow {
    return {
      id:                      `placeholder-${ip?.id || ci.id}`,
      influencer_platform_id:  ip?.id ?? null,
      confirmed_influencer_id: ci.id,
      seq:                     ci.seq ?? null,
      platform:                ip?.platform || '',
      handle:                  ip?.handle || '',
      display_name:            ci.influencers?.display_name ?? null,
      avatar_url:              ci.influencers?.avatar_url ?? null,
      date:                    null,
      media:                   null,
      content:                 null,
      brand:                   null,
      repost:                  ci.repost ?? null,
      review_link:             null,
      assets:                  null,
      views:                   0,
      likes:                   0,
      comments:                0,
      keywords:                null,
      updated:                 null,
      isPlaceholder:           true,
    }
  }

  async function loadMonitoring() {
    if (!viewPhaseId) return
    setLoading(true)
    try {
      const monitoringSelect = `
        id, date, media, content, brand, review_link, views, likes, comments, keywords, updated,
        monitoring_assets(thumbnail_source_url, thumbnail_path, video_path, cover_url, video_url),
        influencer_platform_id,
        influencer_platform!monitoring_influencer_platform_id_fkey(
          platform, handle,
          confirmed_influencers(
            id, seq, repost,
            influencers(display_name, avatar_url)
          )
        )
      `

      const [confirmedRes, monitoringRes] = await Promise.all([
        supabase
          .from('confirmed_influencers')
          .select(`
            id, seq, repost,
            influencers(display_name, avatar_url),
            influencer_platform(id, platform, handle)
          `)
          .eq('phase_id', viewPhaseId)
          .order('seq', { ascending: true, nullsFirst: false }),
        supabase
          .from('monitoring')
          .select(monitoringSelect)
          .order('date', { ascending: false }),
      ])

      if (confirmedRes.error) throw confirmedRes.error
      if (monitoringRes.error) throw monitoringRes.error

      const confirmed = (confirmedRes.data || []).slice(0, MON_SCRAPE_LIMIT)
      setConfirmedCount(confirmed.length)

      const confirmedById = new Map<string, any>()
      const platformToConfirmed = new Map<string, any>()
      for (const ci of confirmed) {
        confirmedById.set(ci.id, ci)
        for (const ip of ci.influencer_platform || []) {
          platformToConfirmed.set(ip.id, ci)
        }
      }

      const monitoringByConfirmedId = new Map<string, MonRow[]>()
      for (const m of monitoringRes.data || []) {
        const row = mapMonitoringRecord(m)
        let ciId = row.confirmed_influencer_id
        if (!ciId && row.influencer_platform_id) {
          const ci = platformToConfirmed.get(row.influencer_platform_id)
          if (ci) {
            ciId = ci.id
            row.confirmed_influencer_id = ci.id
            row.seq = ci.seq ?? null
            row.display_name = ci.influencers?.display_name ?? null
            row.repost = ci.repost ?? null
            if (!row.avatar_url) row.avatar_url = ci.influencers?.avatar_url ?? null
          }
        }
        if (!ciId || !confirmedById.has(ciId)) continue

        const list = monitoringByConfirmedId.get(ciId) || []
        list.push(row)
        monitoringByConfirmedId.set(ciId, list)
      }

      const merged: MonRow[] = []
      for (const ci of confirmed) {
        const monRows = monitoringByConfirmedId.get(ci.id)
        if (monRows?.length) {
          merged.push(...sortGroupRows(monRows))
        } else {
          const platforms = ci.influencer_platform || []
          const primary = platforms.find((p: any) => (p.platform || '').toLowerCase().includes('tiktok')) || platforms[0]
          merged.push(buildPlaceholder(ci, primary ?? null))
        }
      }

      setRows(merged)
    } catch (e: unknown) {
      console.error('loadMonitoring error:', e)
    }
    setLoading(false)
  }

  async function loadKeywords() {
    if (!viewPhaseId) return
    try {
      const [brandsRes, kwsRes] = await Promise.all([
        supabase.from('confirmed_brands').select('brand_name').eq('phase_id', viewPhaseId).order('brand_name'),
        supabase.from('monitoring_keywords').select('brand, keywords, phase_id')
          .or(`and(phase_id.is.null,brand.eq.${MIMUSE_BRAND}),phase_id.eq.${viewPhaseId}`),
      ])
      const confirmed: ConfirmedBrandKw[] = (brandsRes.data || []).map(b => ({
        key: monitoringBrandKey(b.brand_name),
        name: b.brand_name,
      }))
      setConfirmedBrands(confirmed)
      const rows = kwsRes.data || []
      const state = buildBrandKwsFromRows(rows, confirmed)
      setBrandKws(state)

      // Auto-sync: if any confirmed brand has no row keyed by brand.key (derived from confirmed_brands),
      // save via GAS (service role key) so RLS doesn't block the write and rows get the correct brand key
      const hasMismatch = confirmed.length > 0 && confirmed.some(b =>
        !rows.some(r => r.phase_id && r.brand === b.key)
      )
      if (hasMismatch) {
        await gasPost<{ ok?: boolean }>({ action: 'saveMonitoringKeywords', phaseId: viewPhaseId, brandKeywords: state })
          .catch(e => console.error('keyword auto-sync error:', e))
      }
    } catch (e) {
      console.error('loadKeywords error:', e)
    }
  }

  async function saveKeywords(next: BrandKwsState) {
    if (!viewPhaseId) return
    setKwSaving(true)
    try {
      await gasPost<{ ok?: boolean; error?: string }>({
        action: 'saveMonitoringKeywords',
        phaseId: viewPhaseId,
        brandKeywords: next,
      })
    } catch (e) {
      console.error('saveKeywords error:', e)
    }
    setKwSaving(false)
  }

  function addKeyword(brandKey: string, kw: string, clear: () => void) {
    const trimmed = kw.trim()
    if (!trimmed) { clear(); return }
    let next: BrandKwsState
    if (brandKey === MIMUSE_BRAND) {
      const current = brandKws.mimuse || []
      if (current.includes(trimmed)) { clear(); return }
      next = { ...brandKws, mimuse: [...current, trimmed] }
    } else {
      const current = brandKws.byBrand[brandKey] || []
      if (current.includes(trimmed)) { clear(); return }
      next = {
        ...brandKws,
        byBrand: { ...brandKws.byBrand, [brandKey]: [...current, trimmed] },
      }
    }
    setBrandKws(next)
    clear()
    saveKeywords(next)
  }

  function removeKeyword(brandKey: string, kw: string) {
    let next: BrandKwsState
    if (brandKey === MIMUSE_BRAND) {
      next = { ...brandKws, mimuse: (brandKws.mimuse || []).filter(k => k !== kw) }
    } else {
      next = {
        ...brandKws,
        byBrand: {
          ...brandKws.byBrand,
          [brandKey]: (brandKws.byBrand[brandKey] || []).filter(k => k !== kw),
        },
      }
    }
    setBrandKws(next)
    saveKeywords(next)
  }

  function brandColorForKey(key: string): string {
    const normalized = key.toLowerCase()
    if (normalized === MIMUSE_BRAND) return MIMUSE_COLOR
    // exact key match
    let idx = confirmedBrands.findIndex(b => b.key === normalized)
    // fall back to name match (e.g. stored 'nesh' vs brand name 'Nesh')
    if (idx < 0) idx = confirmedBrands.findIndex(b => b.name.toLowerCase() === normalized)
    // fall back to keyword match (e.g. if 'nesh' is a keyword for 네쉬 brand)
    if (idx < 0) idx = confirmedBrands.findIndex(b =>
      (brandKws.byBrand[b.key] || []).some(kw => kw.toLowerCase() === normalized)
    )
    if (idx >= 0) return BRANDS_KW_COLORS[idx % BRANDS_KW_COLORS.length]
    return '#94a3b8'
  }

  function groupKey(r: MonRow): string {
    return r.confirmed_influencer_id || r.influencer_platform_id || r.id
  }

  function rowToEditForm(r: MonRow) {
    return {
      date:        r.date || '',
      media:       r.media || '',
      content:     r.content || '',
      brand:       (r.brand || '').toLowerCase(),
      review_link: r.review_link || '',
      views:       r.views || 0,
      likes:       r.likes || 0,
      comments:    r.comments || 0,
    }
  }

  function sortGroupRows(group: MonRow[]): MonRow[] {
    return group.slice().sort((a, b) => {
      const da = a.date || ''
      const db = b.date || ''
      if (da !== db) return db.localeCompare(da)
      return a.id.localeCompare(b.id)
    })
  }

  function getGroupRows(r: MonRow): MonRow[] {
    const key = groupKey(r)
    return sortGroupRows(rows.filter(row => groupKey(row) === key))
  }

  function selectModalRow(r: MonRow, editing = modalEditing) {
    setModalRow(r)
    if (editing) setEditForm(rowToEditForm(r))
  }

  function openModal(r: MonRow, groupRows?: MonRow[], editing = false) {
    const group = sortGroupRows(groupRows?.length ? groupRows : getGroupRows(r))
    setModalGroupRows(group)
    setModalEditing(editing)
    setModalRow(r)
    setEditForm(editing ? rowToEditForm(r) : null)
  }

  function closeModal() {
    setModalRow(null)
    setModalGroupRows([])
    setModalEditing(false)
    setEditForm(null)
  }

  function startEditing(r?: MonRow) {
    const target = r || modalRow
    if (!target) return
    setModalRow(target)
    setModalEditing(true)
    setEditForm(rowToEditForm(target))
  }

  function renderKeywordBadges(keywords: string | null) {
    if (!keywords) return '—'
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => {
          const isMimuse = isMimuseKeyword(kw, brandKws.mimuse || [])
          const brandIdx = brandKeywordIndex(kw, brandKws.byBrand, confirmedBrands)
          const c        = isMimuse ? MIMUSE_COLOR : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : 'var(--gray-5)'
          return (
            <span key={kw} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>{kw}</span>
          )
        })}
      </div>
    )
  }

  function reviewEditLabel(r: MonRow, index: number): string {
    const parts = [`Review ${index + 1}`]
    if (r.brand) parts.push(r.brand)
    if (r.date) parts.push(fmtDate(r.date))
    return parts.join(' · ')
  }

  function copyReviewLink(link: string) {
    void navigator.clipboard.writeText(link).then(
      () => showToast('링크가 복사되었습니다', 'success'),
      () => showToast('복사에 실패했습니다', 'error'),
    )
  }

  function cancelEditing() {
    setModalEditing(false)
    setEditForm(null)
  }

  async function saveEdit() {
    if (!modalRow || !editForm) return
    setEditSaving(true)
    try {
      const payload = {
        date:        editForm.date || null,
        media:       editForm.media || null,
        content:     editForm.content || null,
        brand:       editForm.brand || null,
        review_link: editForm.review_link || null,
        views:       editForm.views || 0,
        likes:       editForm.likes || 0,
        comments:    editForm.comments || 0,
      }
      if (isPlaceholderRow(modalRow)) {
        if (!modalRow.influencer_platform_id) throw new Error('platform id missing')
        const { data, error } = await supabase
          .from('monitoring')
          .insert({ influencer_platform_id: modalRow.influencer_platform_id, ...payload })
          .select('id')
          .single()
        if (error) throw error
        const updated = { ...modalRow, ...payload, id: data.id, isPlaceholder: false }
        setRows(prev => prev.map(r => r.id === modalRow.id ? updated : r))
        setModalGroupRows(prev => prev.map(r => r.id === modalRow.id ? updated : r))
        setModalRow(updated)
      } else {
        const { error } = await supabase.from('monitoring').update(payload).eq('id', modalRow.id)
        if (error) throw error
        setRows(prev => prev.map(r => r.id === modalRow.id ? { ...r, ...payload } : r))
        setModalGroupRows(prev => prev.map(r => r.id === modalRow.id ? { ...r, ...payload } : r))
        setModalRow(prev => prev ? { ...prev, ...payload } : prev)
      }
      setModalEditing(false)
      setEditForm(null)
    } catch (e: unknown) {
      console.error('saveEdit error:', e)
    }
    setEditSaving(false)
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  async function pollOnce() {
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; status?: string }>({ action: 'checkMonitoringRun' })
      if (r.error) { stopPolling(); setRunPending(false); setScrapeMsg('오류: ' + r.error); return }
      if (r.status && r.status !== 'SUCCEEDED') {
        setScrapeMsg('스크래핑 중… (' + r.status + ') — 자동으로 결과를 확인합니다.')
        return
      }
      stopPolling(); setRunPending(false)
      setScrapeMsg(r.message || '완료')
      await loadMonitoring()
    } catch {
      setScrapeMsg('스크래핑 중… — 결과를 기다리는 중입니다.')
    }
  }

  function startPolling() {
    stopPolling()
    pollOnce()
    pollRef.current = setInterval(pollOnce, 30000)
  }

  useEffect(() => {
    if (runPending) startPolling()
    else stopPolling()
    return stopPolling
  }, [runPending])

  async function startScrape() {
    if (!viewPhaseId) {
      setScrapeMsg('오류: 페이즈를 선택하세요.')
      return
    }
    setScrapeLoading(true); setScrapeMsg('')
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; profiles?: number; handles?: string[] }>({
        action: 'runMonitoringScrape',
        phaseId: viewPhaseId,
      })
      if (r.error) { setScrapeMsg('오류: ' + r.error); return }
      const handleList = r.handles?.length ? ` (${r.handles.join(', ')})` : ''
      setScrapeMsg((r.message || '') + handleList + ' — 자동으로 결과를 확인합니다.')
      setRunPending(true)
    } catch (e: unknown) {
      setScrapeMsg('오류: ' + (e as Error).message)
    } finally {
      setScrapeLoading(false)
    }
  }

  async function resetScrape() {
    try { await gasPost({ action: 'resetMonitoringRun' }) } catch { /* ignore */ }
    stopPolling(); setRunPending(false); setScrapeMsg('')
  }

  async function handleUpdateMetadata(targetRows: MonRow[]) {
    const tiktokRows = targetRows.filter(r => r.review_link?.includes('tiktok.com'))
    if (!tiktokRows.length) {
      showToast('업데이트할 TikTok URL이 없습니다', 'info')
      return
    }
    setMetaUpdating(true)
    setMetaModal({ open: true, urlCount: tiktokRows.length, status: 'running' })
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; updated?: number }>({
        action: 'updateVideoMetadata',
        rows: tiktokRows.map(row => ({ id: row.id, review_link: row.review_link })),
      })
      if (r.error) {
        setMetaModal(m => ({ ...m, status: 'done', message: '오류: ' + r.error }))
        return
      }
      setMetaModal(m => ({ ...m, status: 'done', updated: r.updated ?? 0, message: r.message }))
      await loadMonitoring()
    } catch (e: unknown) {
      setMetaModal(m => ({ ...m, status: 'done', message: '오류: ' + (e as Error).message }))
    } finally {
      setMetaUpdating(false)
    }
  }

  async function handleDownloadAssets(targetRows: MonRow[]) {
    const tiktokRows = targetRows.filter(r => r.review_link?.includes('tiktok.com'))
    if (!tiktokRows.length) {
      showToast('다운로드할 TikTok URL이 없습니다', 'info')
      return
    }
    setAssetDownloading(true)
    setAssetModal({ open: true, urlCount: tiktokRows.length, status: 'running' })
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; updated?: number }>({
        action: 'downloadVideoAssets',
        rows: tiktokRows.map(row => ({ id: row.id, review_link: row.review_link })),
      })
      if (r.error) {
        setAssetModal(m => ({ ...m, status: 'done', message: '오류: ' + r.error }))
        return
      }
      setAssetModal(m => ({ ...m, status: 'done', updated: r.updated ?? 0, message: r.message }))
      await loadMonitoring()
    } catch (e: unknown) {
      setAssetModal(m => ({ ...m, status: 'done', message: '오류: ' + (e as Error).message }))
    } finally {
      setAssetDownloading(false)
    }
  }

  async function processManualRun() {
    const id = manualRunId.trim()
    if (!id) return
    if (!viewPhaseId) {
      setManualMsg('오류: 페이즈를 선택하세요.')
      return
    }
    setManualLoading(true); setManualMsg('')
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; matched?: number }>({
        action: 'processApifyRunById',
        runId: id,
        phaseId: viewPhaseId,
      })
      if (r.error) { setManualMsg('오류: ' + r.error) }
      else { setManualMsg(r.message || '완료'); await loadMonitoring() }
    } catch (e: unknown) {
      setManualMsg('오류: ' + (e as Error).message)
    } finally {
      setManualLoading(false)
    }
  }

  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))

  const uploadGroupMap = new Map<string, MonRow[]>()
  rows.forEach(r => {
    const key = r.confirmed_influencer_id || r.influencer_platform_id || r.id
    const list = uploadGroupMap.get(key) || []
    list.push(r)
    uploadGroupMap.set(key, list)
  })
  const uploadGroups = Array.from(uploadGroupMap.values())
  const uploadedInfluencers = uploadGroups.filter(g => g.some(r => r.review_link?.startsWith('http'))).length
  const noUploadInfluencers = uploadGroups.filter(g => !g.some(r => r.review_link?.startsWith('http'))).length
  const uploadTotal = confirmedCount || uploadGroups.length

  const stats: MonStats = {
    totalInfluencers: confirmedCount || new Set(rows.map(r => r.confirmed_influencer_id).filter(Boolean)).size,
    totalReviews:     reviewRows.length,
    brandCounts:      reviewRows.reduce((acc, r) => {
      const b = (r.brand || '').toLowerCase()
      if (b) acc[b] = (acc[b] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    lastRun: rows.find(r => r.updated)?.updated || '',
  }
  const mimuseReviewCount = stats.brandCounts.mimuse ?? 0
  const brandReviewCount = Object.entries(stats.brandCounts).reduce(
    (sum, [key, count]) => (key === 'mimuse' ? sum : sum + count),
    0,
  )
  const platformReviewCounts = Object.fromEntries(
    PLATFORM_BUCKETS.map(key => [
      key,
      reviewRows.filter(r => platformBucket(r.platform) === key).length,
    ]),
  ) as Record<(typeof PLATFORM_BUCKETS)[number], number>
  const photoCount = reviewRows.filter(r => (r.media || '').toLowerCase() === 'photo').length
  const videoCount = reviewRows.filter(r => (r.media || '').toLowerCase() === 'video').length
  const mediaTotal   = photoCount + videoCount

  const filteredRows = rows.filter(r => {
    if (brandFilter !== 'all' && (r.brand || '').toLowerCase() !== brandFilter.toLowerCase()) return false
    const hasLink = !!r.review_link?.startsWith('http')
    if (statusFilter === 'matched' && !hasLink) return false
    if (statusFilter === 'pending' && hasLink) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (![r.handle, r.display_name, r.brand, r.keywords, r.review_link].join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const thBase: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 1,
    background: 'var(--table-head-bg)',
    padding: '13px 18px',
    textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--table-head-fg)', textTransform: 'uppercase', letterSpacing: '.8px',
    borderBottom: '2px solid var(--table-head-border)', whiteSpace: 'nowrap',
  }

  const UPLOAD_FILTER_OPTIONS = [
    { value: 'all',          label: '전체' },
    { value: 'uploaded',     label: '완료' },
    { value: 'not_uploaded', label: '미업로드' },
  ] as const

  const PLATFORM_FILTER_OPTIONS = [
    { value: 'all', label: '전체' },
    ...PLATFORM_BUCKETS.map(key => ({ value: key, label: PLATFORM_DISPLAY[key].label })),
  ]

  const BRAND_FILTER_OPTIONS = [
    { value: 'all', label: '전체' },
    { value: MIMUSE_BRAND, label: 'MiMuse' },
    ...confirmedBrands.map(b => ({ value: b.key, label: b.name })),
  ]

  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: '전체' },
    { value: 'matched', label: '데이터 있음' },
    { value: 'pending', label: '대기중' },
  ]

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="인플루언서 리뷰 모니터링"
          description={(
            <>
              Apify로 최대 50명의 인플루언서 콘텐츠를 스캔하여 키워드 감지 결과를 실시간 추적합니다.
              {stats.lastRun && stats.lastRun !== '-' && (
                <span style={{ marginLeft: 10, color: 'var(--gray-5)', fontSize: 11 }}>
                  마지막 실행: {stats.lastRun}
                </span>
              )}
            </>
          )}
          actions={(
            <>
              {runPending && (
                <button className="page-banner-btn" onClick={resetScrape}
                  style={{ background: 'var(--yellow)', color: 'var(--yellow-text)', borderColor: 'var(--yellow-md)' }}>
                  취소
                </button>
              )}
              <button className="page-banner-btn" onClick={startScrape} disabled={scrapeLoading || runPending}
                style={{ background: 'var(--teal)', color: '#fff', borderColor: 'var(--teal)' }}>
                {scrapeLoading && !runPending ? '실행 중…' : '모니터링 실행'}
              </button>
              <button className="page-banner-btn page-banner-btn--secondary" onClick={loadMonitoring}>
                <span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침
              </button>
            </>
          )}
        />
      </PageHeroBanner>

      {scrapeMsg && (
        <div style={{
          background: scrapeMsg.startsWith('오류') ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${scrapeMsg.startsWith('오류') ? '#fca5a5' : '#86efac'}`,
          borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 12,
          fontSize: 13, color: scrapeMsg.startsWith('오류') ? '#b91c1c' : '#166534',
        }}>{scrapeMsg}</div>
      )}
      {/* Stats */}
      <StatCards columns="minmax(0, 1fr) minmax(0, 0.78fr) minmax(0, 0.8fr) minmax(0, 1.15fr)">
        <StatCard
          highlight
          label="모니터링 인플루언서"
          variant="split"
          columns={[
            {
              value: uploadedInfluencers,
              unit: '명',
              valueColor: '#14532d',
              label: '완료',
              labelColor: '#16a34a',
              sub: `${uploadTotal ? Math.round(uploadedInfluencers / uploadTotal * 100) : 0}% 완료율`,
            },
            {
              value: noUploadInfluencers,
              unit: '명',
              valueColor: '#991b1b',
              label: '미업로드',
              labelColor: '#dc2626',
            },
          ]}
        />
        <StatCard
          highlight
          label="리뷰 업로드"
          variant="metric"
          align="left"
          style={{ padding: '22px 16px' }}
          value={stats.totalReviews}
          valueColor="var(--blue-dk)"
          caption={(
            <>
              <span style={{ color: MIMUSE_COLOR, fontWeight: 700 }}>MiMuse</span>
              <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{mimuseReviewCount}</strong>
              <span style={{ margin: '0 6px', color: 'var(--gray-3)' }}>·</span>
              <span style={{ color: 'var(--gray-6)', fontWeight: 700 }}>브랜드별</span>
              <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{brandReviewCount}</strong>
            </>
          )}
        />
        <StatCard
          label="미디어"
          variant="split"
          style={{ padding: '22px 16px' }}
          columns={[
            {
              value: photoCount,
              unit: '건',
              valueColor: '#14532d',
              label: 'photo',
              labelColor: '#16a34a',
            },
            {
              value: videoCount,
              unit: '건',
              valueColor: '#1e40af',
              label: 'video',
              labelColor: '#2563eb',
            },
          ]}
        />
        <StatCard
          label="플랫폼별 리뷰"
          variant="split"
          columns={PLATFORM_BUCKETS.map(key => ({
            value: platformReviewCounts[key],
            unit: '건',
            label: PLATFORM_DISPLAY[key].label,
            valueColor: PLATFORM_DISPLAY[key].statColor,
            labelColor: PLATFORM_DISPLAY[key].statColor,
          }))}
        />
      </StatCards>

      {/* Keywords + brand counts */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '14px 20px', minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>브랜드 횟수</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'mimuse', label: 'MiMuse', count: mimuseReviewCount, color: MIMUSE_COLOR },
              { key: 'brand', label: '브랜드별', count: brandReviewCount, color: '#64748b' },
            ].map(row => (
              <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                  background: row.color + '18', color: row.color,
                  border: `1px solid ${row.color}44`,
                }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: row.count > 0 ? 'var(--gray-7)' : 'var(--gray-3)' }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>키워드 설정</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {kwSaving && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>저장 중…</span>}
              {!showKwModal
                ? <button className="cfg-btn" onClick={() => setShowKwModal(true)}>편집</button>
                : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {(brandKws.mimuse || []).map(kw => (
                <span key={kw} style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  background: MIMUSE_COLOR + '18', color: MIMUSE_COLOR,
                  border: `1px solid ${MIMUSE_COLOR}44`,
                }}>
                  {kw}
                </span>
              ))}
            </div>
            {confirmedBrands.map((brand, idx) => {
              const c = BRANDS_KW_COLORS[idx % BRANDS_KW_COLORS.length]
              const kws = brandKws.byBrand[brand.key] || []
              if (!kws.length) return null
              return (
                <div key={brand.key} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {kws.map(kw => (
                    <span key={kw} style={{
                      display: 'inline-flex', alignItems: 'center',
                      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                      background: c + '18', color: c, border: `1px solid ${c}44`,
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <PageTabs
        tabs={[
          { id: 'upload', label: '리뷰 업로드' },
          { id: 'list', label: '리뷰 리스트' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {/* Review list tab */}
      {activeTab === 'list' && (() => {
        const allUploadedRows = rows.filter(r => r.review_link?.startsWith('http'))
        const uploadedRows    = allUploadedRows.filter(r => {
          if (listPlatformFilter !== 'all' && platformBucket(r.platform) !== listPlatformFilter) return false
          if (listBrandFilter !== 'all' && (r.brand || '').toLowerCase() !== listBrandFilter.toLowerCase()) return false
          return true
        })
        const listTotalPages = Math.max(1, Math.ceil(uploadedRows.length / MON_PAGE_SIZE))
        const listSafePage   = Math.min(listPage, listTotalPages)
        const listStartIdx   = (listSafePage - 1) * MON_PAGE_SIZE
        const pagedListRows  = uploadedRows.slice(listStartIdx, listStartIdx + MON_PAGE_SIZE)
        const listEmptyMsg   = allUploadedRows.length === 0
          ? '업로드된 리뷰가 없습니다'
          : uploadedRows.length === 0
            ? '필터 결과가 없습니다.'
            : ''
        function downloadListExcel() {
          const wsData = [
            ['no.', '플랫폼', '인플루언서명', '업로드일', '조회수', '좋아요 수', '댓글 수', '리뷰 링크', '브랜드', '감지된 키워드'],
            ...uploadedRows.map((r, i) => [
              i + 1,
              r.platform || '',
              r.display_name || r.handle || '',
              r.date ? fmtDate(r.date) : '',
              r.views ?? '',
              r.likes ?? '',
              r.comments ?? '',
              r.review_link || '',
              r.brand || '',
              r.keywords || '',
            ]),
          ]
          const ws = XLSX.utils.aoa_to_sheet(wsData)
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, '리뷰 리스트')
          XLSX.writeFile(wb, `리뷰리스트_${new Date().toISOString().slice(0, 10)}.xlsx`)
        }

        return (
          <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, margin: '8px 0' }}>
            <button className="cfg-btn" onClick={() => { void handleDownloadAssets(uploadedRows) }}
              disabled={assetDownloading || uploadedRows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {assetDownloading ? <Spinner sm /> : <Video size={13} />}영상 다운로드
            </button>
            <button className="cfg-btn" onClick={downloadListExcel} disabled={uploadedRows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Download size={13} />엑셀 다운로드
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 36, textAlign: 'center' }}>no.</th>
                  <th style={thBase}>
                    <HeaderFilterMenu
                      label="인플루언서"
                      value={listPlatformFilter}
                      options={PLATFORM_FILTER_OPTIONS}
                      onChange={setListPlatformFilter}
                      open={openListFilter === 'platform'}
                      onOpenChange={open => setOpenListFilter(open ? 'platform' : null)}
                    />
                  </th>
                  <th style={thBase}>업로드일</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>조회수</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>좋아요 수</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>댓글 수</th>
                  <th style={{ ...thBase, minWidth: 180 }}>리뷰 링크</th>
                  <th style={{ ...thBase, width: 72, textAlign: 'center' }}>썸네일</th>
                  <th style={{ ...thBase, width: 72, textAlign: 'center' }}>영상</th>
                  <th style={thBase}>
                    <HeaderFilterMenu
                      label="브랜드"
                      value={listBrandFilter}
                      options={BRAND_FILTER_OPTIONS}
                      onChange={setListBrandFilter}
                      open={openListFilter === 'brand'}
                      onOpenChange={open => setOpenListFilter(open ? 'brand' : null)}
                    />
                  </th>
                  <th style={thBase}>감지된 키워드</th>
                </tr>
              </thead>
              <tbody>
                {uploadedRows.length === 0
                  ? <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>{listEmptyMsg}</td></tr>
                  : pagedListRows.map((r, i) => {
                      const account  = (r.handle || '').replace(/^@/, '')
                      const link     = r.review_link || ''
                      const profileUrl  = platformBucket(r.platform) === 'tiktok'
                        ? `https://www.tiktok.com/@${account}`
                        : platformBucket(r.platform) === 'instagram'
                          ? `https://www.instagram.com/${account}`
                          : ''
                      return (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--gray-4)', fontSize: 11, textAlign: 'center' }}>{listStartIdx + i + 1}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <InfluencerAvatar url={r.avatar_url} label={r.display_name || account} size={32} />
                              <div>
                                <div style={{ marginBottom: 3 }}>
                                  <PlatformBadge platform={r.platform} />
                                </div>
                                {r.display_name && (
                                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-7)' }}>{r.display_name}</div>
                                )}
                                {profileUrl
                                  ? <a href={profileUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--gray-5)', textDecoration: 'none' }}>@{account}</a>
                                  : <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{account || '—'}</span>}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                          <td style={{ fontSize: 12, textAlign: 'right', color: r.views ? 'var(--gray-7)' : 'var(--gray-3)' }}>{r.views ? fmtNum(r.views) : '—'}</td>
                          <td style={{ fontSize: 12, textAlign: 'right', color: r.likes ? 'var(--gray-7)' : 'var(--gray-3)' }}>{r.likes ? fmtNum(r.likes) : '—'}</td>
                          <td style={{ fontSize: 12, textAlign: 'right', color: r.comments ? 'var(--gray-7)' : 'var(--gray-3)' }}>{r.comments ? fmtNum(r.comments) : '—'}</td>
                          <td style={{ whiteSpace: 'normal', verticalAlign: 'middle' }}>
                            <ReviewLinkBox link={link} onCopy={() => copyReviewLink(link)} compact />
                          </td>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            {(() => {
                              const thumb = resolveMonitoringThumbnailUrl(r.assets)
                              if (thumb) {
                                return (
                                  <img
                                    src={thumb}
                                    alt=""
                                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--gray-2)' }}
                                  />
                                )
                              }
                              return <span style={{ color: 'var(--gray-3)' }}>—</span>
                            })()}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-6)' }}>
                            {r.assets?.video_url
                              ? <a href={r.assets.video_url} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600, color: '#065f46', textDecoration: 'none' }}><ExternalLink size={11} />보기</a>
                              : r.assets?.video_path
                                ? <span style={{ fontWeight: 600, color: '#065f46' }}>저장됨</span>
                                : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                          </td>
                          <td>{(() => {
                            if (!r.brand) return <span style={{ color: 'var(--gray-3)' }}>—</span>
                            const c = brandColorForKey(r.brand.toLowerCase())
                            return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}44` }}>{r.brand}</span>
                          })()}</td>
                          <td>
                            {r.keywords ? (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {r.keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => {
                                  const isMimuse = isMimuseKeyword(kw, brandKws.mimuse || [])
                                  const brandIdx = brandKeywordIndex(kw, brandKws.byBrand, confirmedBrands)
                                  const c = isMimuse ? MIMUSE_COLOR : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : '#94a3b8'
                                  return (
                                    <span key={kw} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>{kw}</span>
                                  )
                                })}
                              </div>
                            ) : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
          <Pagination page={listSafePage} totalPages={listTotalPages} total={uploadedRows.length}
            startIdx={listStartIdx} endIdx={listStartIdx + pagedListRows.length}
            onPrev={() => setListPage(p => Math.max(1, p - 1))}
            onNext={() => setListPage(p => Math.min(listTotalPages, p + 1))} />
          </>
        )
      })()}

      {/* Upload tab */}
      {activeTab === 'upload' && <>
        <FilterSegmentBar
          label="업로드"
          ariaLabel="업로드 필터"
          value={uploadFilter}
          onChange={setUploadFilter}
          style={{ marginBottom: 16 }}
          options={UPLOAD_FILTER_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
        >
          <input type="text" placeholder="인플루언서명, 핸들 검색..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 180, maxWidth: 320 }} />
          <button
            type="button"
            className="cfg-btn cfg-btn--ghost"
            style={{ marginLeft: 'auto' }}
            disabled={metaUpdating || reviewRows.length === 0}
            onClick={() => { void handleUpdateMetadata(reviewRows) }}
          >
            {metaUpdating ? <Spinner sm /> : <RefreshCw size={13} />}
            {metaUpdating ? '업데이트 중…' : '메타데이터 업데이트'}
          </button>
        </FilterSegmentBar>

        {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

        {!loading && (() => {
          type Group = { key: string; rows: MonRow[] }
          const groupMap = new Map<string, Group>()
          filteredRows.forEach(r => {
            const key = r.confirmed_influencer_id || r.influencer_platform_id || r.id
            if (!groupMap.has(key)) groupMap.set(key, { key, rows: [] })
            groupMap.get(key)!.rows.push(r)
          })
          const groups = Array.from(groupMap.values())
            .filter(g => {
              if (uploadFilter !== 'all') {
                const anyLink = g.rows.some(r => r.review_link?.startsWith('http'))
                if (uploadFilter === 'uploaded' && !anyLink) return false
                if (uploadFilter === 'not_uploaded' && anyLink) return false
              }
              if (platformFilter !== 'all') {
                const bucket = platformBucket(g.rows[0]?.platform || '')
                if (bucket !== platformFilter) return false
              }
              return true
            })
            .sort((a, b) => {
            const seqA = a.rows[0]?.seq ?? 9999
            const seqB = b.rows[0]?.seq ?? 9999
            if (seqA !== seqB) return seqA - seqB
            return a.key.localeCompare(b.key)
          })

          const uploadTotalPages = Math.max(1, Math.ceil(groups.length / MON_PAGE_SIZE))
          const uploadSafePage   = Math.min(uploadPage, uploadTotalPages)
          const uploadStartIdx   = (uploadSafePage - 1) * MON_PAGE_SIZE
          const pagedGroups      = groups.slice(uploadStartIdx, uploadStartIdx + MON_PAGE_SIZE)
          const emptyMsg = confirmedCount === 0
            ? '확정된 인플루언서가 없습니다.'
            : rows.length === 0
              ? '감지된 리뷰가 없습니다.'
              : '검색 결과가 없습니다.'

          return (
            <>
            <div className="table-wrap">
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...thBase, width: 36, textAlign: 'center' }}>no.</th>
                    <th style={thBase}>
                      <HeaderFilterMenu
                        label="플랫폼"
                        value={platformFilter}
                        options={PLATFORM_FILTER_OPTIONS}
                        onChange={setPlatformFilter}
                        open={openFilter === 'platform'}
                        onOpenChange={open => setOpenFilter(open ? 'platform' : null)}
                      />
                    </th>
                    <th style={thBase}>업로드일</th>
                    <th style={thBase}>미디어</th>
                    <th style={thBase}>콘텐츠</th>
                    <th style={thBase}>
                      <HeaderFilterMenu
                        label="브랜드"
                        value={brandFilter}
                        options={BRAND_FILTER_OPTIONS}
                        onChange={setBrandFilter}
                        open={openFilter === 'brand'}
                        onOpenChange={open => setOpenFilter(open ? 'brand' : null)}
                      />
                    </th>
                    <th style={thBase}>
                      <HeaderFilterMenu
                        label="리뷰 링크"
                        value={statusFilter}
                        options={STATUS_FILTER_OPTIONS}
                        onChange={setStatusFilter}
                        open={openFilter === 'status'}
                        onOpenChange={open => setOpenFilter(open ? 'status' : null)}
                      />
                    </th>
                    <th style={{ ...thBase, textAlign: 'right' }} className="num">조회수</th>
                    <th style={{ ...thBase, textAlign: 'right' }} className="num">좋아요 수</th>
                    <th style={{ ...thBase, textAlign: 'right' }} className="num">댓글 수</th>
                    <th style={thBase}>감지된 키워드</th>
                    <th style={thBase}>모니터링 실행일</th>
                    <th style={{ ...thBase, width: 52, textAlign: 'center', padding: '13px 6px' }}>편집</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0
                    ? (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40, whiteSpace: 'normal' }}>
                          {emptyMsg}
                        </td>
                      </tr>
                    )
                    : pagedGroups.map((group, gi) => {
                      const groupIdx = uploadStartIdx + gi
                      const isLastGroup = gi === pagedGroups.length - 1
                      const account  = (group.rows[0].handle || '').replace(/^@/, '')
                      const anyLink  = group.rows.some(r => r.review_link?.startsWith('http'))
                      const bucket   = platformBucket(group.rows[0].platform)
                      const profileUrl  = bucket === 'tiktok'
                        ? `https://www.tiktok.com/@${account}`
                        : bucket === 'instagram'
                          ? `https://www.instagram.com/${account}`
                          : ''
                      const groupBorderStyle = !isLastGroup ? { borderBottom: '2px solid var(--gray-2)' } : {}

                      return group.rows.map((r, ri) => {
                        const isFirst  = ri === 0
                        const isLast   = ri === group.rows.length - 1
                        const link     = r.review_link || ''
                        const hasLink  = !!link.startsWith('http')
                        const rowBrand = (r.brand || '').toLowerCase()
                        const rowColor = brandColorForKey(rowBrand)
                        const rowStyle = isLast ? groupBorderStyle : {}

                        return (
                          <tr key={r.id} style={{ opacity: hasLink ? 1 : 0.65, ...rowStyle }}>

                            {/* no. — only on first row of group, spans all rows */}
                            {isFirst && (
                              <td rowSpan={group.rows.length} style={{ color: 'var(--gray-4)', fontSize: 11, textAlign: 'center', verticalAlign: 'middle', ...groupBorderStyle }}>
                                {group.rows[0].seq ?? groupIdx + 1}
                              </td>
                            )}

                            {/* account — rowspan so handle shows once per influencer */}
                            {isFirst && (
                              <td rowSpan={group.rows.length} onClick={() => openModal(r, group.rows, false)}
                                style={{ verticalAlign: 'middle', cursor: 'pointer', ...groupBorderStyle }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                  <InfluencerAvatar
                                    url={group.rows[0].avatar_url}
                                    label={group.rows[0].display_name || account}
                                    size={40}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                  <PlatformBadge platform={group.rows[0].platform} />
                                  {anyLink
                                    ? <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>완료</span>
                                    : <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>미업로드</span>}
                                  {group.rows.length > 1 && (
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid var(--blue)' }}>
                                      {group.rows.length}개
                                    </span>
                                  )}
                                </div>
                                {group.rows[0].display_name && (
                                  <div style={{ marginTop: 3, fontSize: 12, fontWeight: 600, color: 'var(--gray-7)' }}>
                                    {group.rows[0].display_name}
                                  </div>
                                )}
                                {account && (
                                  <div style={{ marginTop: 2 }}>
                                    {profileUrl
                                      ? <a href={profileUrl} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                                          style={{ fontSize: 11, color: 'var(--gray-5)', textDecoration: 'none' }}>@{account}</a>
                                      : <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{account}</span>}
                                  </div>
                                )}
                                  </div>
                                </div>
                              </td>
                            )}

                            <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>
                              {fmtDate(r.date)}
                            </td>

                            <td>
                              <span style={{ fontSize: 12, color: 'var(--gray-6)' }}>{r.media || '—'}</span>
                            </td>

                            <td>
                              <span style={{ fontSize: 12, color: 'var(--gray-6)' }}>{r.content || '—'}</span>
                            </td>

                            <td>
                              {rowBrand
                                ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: rowColor + '18', color: rowColor, border: `1px solid ${rowColor}44` }}>{rowBrand}</span>
                                : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                            </td>

                            <td>
                              {link
                                ? <a href={link} target="_blank" rel="noopener" className="video-link">↗ 보기</a>
                                : '—'}
                            </td>

                            <td className="num">
                              {r.views ? fmtNum(r.views) : '—'}
                            </td>

                            <td className="num">
                              {r.likes ? fmtNum(r.likes) : '—'}
                            </td>

                            <td className="num">
                              {r.comments ? fmtNum(r.comments) : '—'}
                            </td>

                            <td>
                              {r.keywords
                                ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {r.keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => {
                                      const isMimuse = isMimuseKeyword(kw, brandKws.mimuse || [])
                                      const brandIdx = brandKeywordIndex(kw, brandKws.byBrand, confirmedBrands)
                                      const c        = isMimuse ? MIMUSE_COLOR : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : '#94a3b8'
                                      return (
                                        <span key={kw} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>{kw}</span>
                                      )
                                    })}
                                  </div>
                                : '—'}
                            </td>

                            <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>
                              {r.updated ? fmtDate(r.updated) : '—'}
                            </td>

                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => openModal(r, group.rows, true)}
                                style={{ fontSize: 12, padding: '2px 8px', background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                                ✎
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    })}
                </tbody>
              </table>
            </div>
            {groups.length > 0 && (
              <Pagination page={uploadSafePage} totalPages={uploadTotalPages} total={groups.length}
                startIdx={uploadStartIdx} endIdx={uploadStartIdx + pagedGroups.length}
                onPrev={() => setUploadPage(p => Math.max(1, p - 1))}
                onNext={() => setUploadPage(p => Math.min(uploadTotalPages, p + 1))} />
            )}
            </>
          )
        })()}
      </>}

      {/* ── Keyword Edit Modal ── */}
      <Modal open={showKwModal} onClose={() => setShowKwModal(false)} title="키워드 설정">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: MIMUSE_COLOR, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>MiMuse (전 페이즈 공통)</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {(brandKws.mimuse || []).map(kw => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: MIMUSE_COLOR + '18', color: MIMUSE_COLOR,
                border: `1px solid ${MIMUSE_COLOR}44`,
              }}>
                {kw}
                <button onClick={() => showConfirm(`"${kw}" 키워드를 삭제할까요?`, () => removeKeyword(MIMUSE_BRAND, kw))}
                  style={{ background: 'none', border: 'none', color: MIMUSE_COLOR, cursor: 'pointer', fontSize: 12, padding: '0 1px', lineHeight: 1 }}>×</button>
              </span>
            ))}
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <input className="modal-input" placeholder="키워드 추가" value={newMimuseKw}
                onChange={e => setNewMimuseKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(MIMUSE_BRAND, newMimuseKw, () => setNewMimuseKw('')) } }}
                style={{ width: 140, padding: '8px 12px', fontSize: 12 }} />
              <button className="cfg-btn" onClick={() => addKeyword(MIMUSE_BRAND, newMimuseKw, () => setNewMimuseKw(''))}>+</button>
            </span>
          </div>
        </div>

        {confirmedBrands.length > 0 ? confirmedBrands.map((brand, idx) => {
          const c = BRANDS_KW_COLORS[idx % BRANDS_KW_COLORS.length]
          const kws = brandKws.byBrand[brand.key] || []
          const draft = newBrandKwByKey[brand.key] || ''
          return (
            <div key={brand.key} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>{brand.name}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {kws.map(kw => (
                  <span key={kw} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                    background: c + '18', color: c, border: `1px solid ${c}44`,
                  }}>
                    {kw}
                    <button onClick={() => showConfirm(`"${kw}" 키워드를 삭제할까요?`, () => removeKeyword(brand.key, kw))}
                      style={{ background: 'none', border: 'none', color: c, cursor: 'pointer', fontSize: 12, padding: '0 1px', lineHeight: 1 }}>×</button>
                  </span>
                ))}
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input className="modal-input" placeholder="키워드 추가" value={draft}
                    onChange={e => setNewBrandKwByKey(prev => ({ ...prev, [brand.key]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addKeyword(brand.key, draft, () => setNewBrandKwByKey(prev => ({ ...prev, [brand.key]: '' })))
                      }
                    }}
                    style={{ width: 140, padding: '8px 12px', fontSize: 12 }} />
                  <button className="cfg-btn" onClick={() => addKeyword(brand.key, draft, () => setNewBrandKwByKey(prev => ({ ...prev, [brand.key]: '' })))}>+</button>
                </span>
              </div>
            </div>
          )
        }) : (
          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--gray-5)' }}>
            이 페이즈에 확정 브랜드가 없습니다. 브랜드 확정 후 키워드를 설정할 수 있습니다.
          </div>
        )}

        {kwSaving && <div className="modal-status">저장 중…</div>}

        <div className="modal-actions">
          <button className="modal-btn-confirm" onClick={() => setShowKwModal(false)}>완료</button>
        </div>
      </Modal>

      {/* ── Metadata Update Modal ── */}
      <Modal
        open={metaModal.open}
        onClose={() => setMetaModal(m => ({ ...m, open: false }))}
        title="메타데이터 업데이트"
      >
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          {metaModal.status === 'running' ? (
            <>
              <Spinner lg />
              <div style={{ marginTop: 16, fontSize: 14, color: 'var(--gray-6)' }}>
                TikTok 영상 <strong>{metaModal.urlCount}개</strong> 메타데이터 수집 중…
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-4)' }}>Apify 실행 중, 잠시 기다려 주세요.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>
                {metaModal.message?.startsWith('오류') ? '❌' : '✅'}
              </div>
              {!metaModal.message?.startsWith('오류') && (
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-8)', marginBottom: 6 }}>
                  {metaModal.updated ?? 0} / {metaModal.urlCount}
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--gray-6)' }}>
                {metaModal.message || '완료'}
              </div>
            </>
          )}
        </div>
        {metaModal.status === 'done' && (
          <div className="modal-actions">
            <button className="modal-btn-confirm" onClick={() => setMetaModal(m => ({ ...m, open: false }))}>확인</button>
          </div>
        )}
      </Modal>

      {/* ── Asset Download Modal ── */}
      <Modal
        open={assetModal.open}
        onClose={() => setAssetModal(m => ({ ...m, open: false }))}
        title="영상 다운로드"
      >
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          {assetModal.status === 'running' ? (
            <>
              <Spinner lg />
              <div style={{ marginTop: 16, fontSize: 14, color: 'var(--gray-6)' }}>
                TikTok 영상 <strong>{assetModal.urlCount}개</strong> 다운로드 중…
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gray-4)' }}>썸네일 및 영상 URL 수집 중, 잠시 기다려 주세요.</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>
                {assetModal.message?.startsWith('오류') ? '❌' : '✅'}
              </div>
              {!assetModal.message?.startsWith('오류') && (
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-8)', marginBottom: 6 }}>
                  {assetModal.updated ?? 0} / {assetModal.urlCount}
                </div>
              )}
              <div style={{ fontSize: 13, color: 'var(--gray-6)' }}>
                {assetModal.message || '완료'}
              </div>
            </>
          )}
        </div>
        {assetModal.status === 'done' && (
          <div className="modal-actions">
            <button className="modal-btn-confirm" onClick={() => setAssetModal(m => ({ ...m, open: false }))}>확인</button>
          </div>
        )}
      </Modal>

      {/* ── Review View / Edit Modal ── */}
      <Modal
        open={!!modalRow}
        onClose={closeModal}
        size="lg"
        title={modalRow ? `${modalEditing ? '리뷰 데이터 편집' : '리뷰 정보'} · ${modalTitle(modalRow)}` : ''}
      >
        {modalRow && (
          <div className="mon-review-modal">
            <div className="mon-review-modal__hero">
              <InfluencerAvatar url={modalRow.avatar_url} label={modalRow.display_name || modalRow.handle} size={56} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  {modalRow.platform && <PlatformBadge platform={modalRow.platform} />}
                  {modalRow.brand && brandBadge(modalRow.brand)}
                </div>
                {modalRow.display_name && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-8)' }}>{modalRow.display_name}</div>
                )}
                {modalRow.handle && (
                  <div style={{ fontSize: 12, color: 'var(--gray-5)', marginTop: 2 }}>@{modalRow.handle.replace(/^@/, '')}</div>
                )}
              </div>
            </div>

            {modalGroupRows.length > 1 && (
              <div className="mon-review-modal__selector">
                <label className="modal-label" style={{ marginTop: 0 }}>리뷰 선택</label>
                <select className="modal-input" value={modalRow.id}
                  onChange={e => {
                    const next = modalGroupRows.find(row => row.id === e.target.value)
                    if (next) selectModalRow(next)
                  }}>
                  {modalGroupRows.map((row, i) => (
                    <option key={row.id} value={row.id}>
                      Review {i + 1}
                      {row.brand ? ` · ${row.brand}` : ''}
                      {row.date ? ` · ${fmtDate(row.date)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!modalEditing ? (
              <>
                <div className="mon-review-modal__grid">
                  <ViewField label="업로드일">{fmtDate(modalRow.date)}</ViewField>
                  <ViewField label="미디어">{modalRow.media || '—'}</ViewField>
                  <ViewField label="콘텐츠">{modalRow.content || '—'}</ViewField>
                  <ViewField label="모니터링 실행일">{modalRow.updated ? fmtDate(modalRow.updated) : '—'}</ViewField>
                </div>

                <div className="mon-review-modal__section">
                  <div className="mon-review-modal__section-label">감지된 키워드</div>
                  {modalRow.keywords
                    ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {modalRow.keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => {
                          const isMimuse = isMimuseKeyword(kw, brandKws.mimuse || [])
                          const brandIdx = brandKeywordIndex(kw, brandKws.byBrand, confirmedBrands)
                          const c        = isMimuse ? MIMUSE_COLOR : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : '#94a3b8'
                          return (
                            <span key={kw} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>{kw}</span>
                          )
                        })}
                      </div>
                    )
                    : <span style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</span>}
                </div>

                <div className="mon-review-modal__section">
                  <div className="mon-review-modal__section-label">리뷰 링크</div>
                  {modalRow.review_link?.startsWith('http')
                    ? <ReviewLinkBox link={modalRow.review_link} onCopy={() => copyReviewLink(modalRow.review_link!)} />
                    : <span style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</span>}
                </div>

                <div className="mon-review-modal__stats">
                  <ModalStat label="조회수" value={modalRow.views ? fmtNum(modalRow.views) : '—'} />
                  <ModalStat label="좋아요 수" value={modalRow.likes ? fmtNum(modalRow.likes) : '—'} />
                  <ModalStat label="댓글 수" value={modalRow.comments ? fmtNum(modalRow.comments) : '—'} />
                </div>
              </>
            ) : editForm && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>업로드일</label>
                  <input type="date" className="modal-input" value={editForm.date}
                    onChange={e => setEditForm(f => f ? { ...f, date: e.target.value } : f)} />
                </div>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>브랜드</label>
                  <select className="modal-input" value={editForm.brand}
                    onChange={e => setEditForm(f => f ? { ...f, brand: e.target.value } : f)}>
                    <option value="">—</option>
                    <option value={MIMUSE_BRAND}>MiMuse</option>
                    {confirmedBrands.map(b => <option key={b.key} value={b.key}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>미디어</label>
                  <select className="modal-input" value={editForm.media}
                    onChange={e => setEditForm(f => f ? { ...f, media: e.target.value } : f)}>
                    <option value="">—</option>
                    {MEDIA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>콘텐츠</label>
                  <select className="modal-input" value={editForm.content}
                    onChange={e => setEditForm(f => f ? { ...f, content: e.target.value } : f)}>
                    <option value="">—</option>
                    {CONTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="modal-label" style={{ marginTop: 0 }}>리뷰 링크</label>
                  <input type="url" className="modal-input" placeholder="https://…" value={editForm.review_link}
                    onChange={e => setEditForm(f => f ? { ...f, review_link: e.target.value } : f)} />
                </div>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>조회수</label>
                  <input type="number" min={0} className="modal-input" value={editForm.views || ''}
                    onChange={e => setEditForm(f => f ? { ...f, views: parseInt(e.target.value) || 0 } : f)} />
                </div>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>좋아요 수</label>
                  <input type="number" min={0} className="modal-input" value={editForm.likes || ''}
                    onChange={e => setEditForm(f => f ? { ...f, likes: parseInt(e.target.value) || 0 } : f)} />
                </div>
                <div>
                  <label className="modal-label" style={{ marginTop: 0 }}>댓글 수</label>
                  <input type="number" min={0} className="modal-input" value={editForm.comments || ''}
                    onChange={e => setEditForm(f => f ? { ...f, comments: parseInt(e.target.value) || 0 } : f)} />
                </div>
              </div>
            )}

            <div className="modal-actions">
              {!modalEditing ? (
                <>
                  <button className="modal-btn-cancel" onClick={closeModal}>닫기</button>
                  <button className="modal-btn-confirm" onClick={() => startEditing()}>편집</button>
                </>
              ) : (
                <>
                  <button className="modal-btn-cancel" onClick={cancelEditing}>취소</button>
                  <button className="modal-btn-confirm" onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? '저장 중...' : '저장'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
