import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ListFilter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import Modal from '@/components/Modal'
import { PageTabs } from '@/components/ui'

const BRANDS = ['mimuse', 'aesthen', 'joodoc', 'nesh', 'varuza'] as const
type Brand = typeof BRANDS[number]

const BRANDS_KW_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316', '#06b6d4', '#3b82f6', '#e11d48']

const BRAND_COLORS: Record<Brand, string> = {
  mimuse:  '#3b82f6',
  aesthen: '#8b5cf6',
  joodoc:  '#ec4899',
  nesh:    '#f59e0b',
  varuza:  '#10b981',
}

const MEDIA_OPTIONS   = ['photo', 'video']
const CONTENT_OPTIONS = ['review video', 'unboxing', 'other']

interface MonRow {
  id:                      string
  influencer_platform_id:  string | null
  confirmed_influencer_id: string | null  // from join chain
  seq:                     number | null  // fixed number from confirmed_influencers
  platform:                string
  handle:                  string
  display_name:            string | null  // from influencers join
  date:                    string | null
  media:                   string | null
  content:                 string | null
  brand:                   string | null
  repost:                  string | null  // from confirmed_influencers (read-only)
  review_link:             string | null
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
  totalViews:       number
  totalLikes:       number
  totalComments:    number
  brandCounts:      Record<string, number>
  lastRun:          string
}

function fmtDate(val: string | null): string {
  if (!val) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function ViewField({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-8)', fontWeight: 500, wordBreak: 'break-word' }}>{children}</div>
    </div>
  )
}

function modalTitle(r: MonRow): string {
  return r.display_name || `@${(r.handle || '').replace(/^@/, '')}`
}

function brandBadge(brand: string | null) {
  if (!brand) return '—'
  const key = brand.toLowerCase() as Brand
  const color = BRAND_COLORS[key] || 'var(--gray-4)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}44` }}>
      {brand}
    </span>
  )
}

export default function Monitoring() {
  const { showConfirm } = useToast()
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const [rows,           setRows]           = useState<MonRow[]>([])
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [loading,        setLoading]        = useState(true)

  const [brandKws,      setBrandKws]      = useState<Record<string, string[]>>({
    mimuse: ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', 'MiMuse Beauty'],
    brands: ['aesthen', 'joodoc', 'nesh', 'varuza'],
  })
  const [showKwModal,   setShowKwModal]   = useState(false)
  const [newMimuseKw,   setNewMimuseKw]  = useState('')
  const [newBrandsKw,   setNewBrandsKw]  = useState('')
  const [kwSaving,      setKwSaving]     = useState(false)

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
  const [activeTab,      setActiveTab]      = useState<'upload' | 'list'>('upload')
  const [uploadPage,     setUploadPage]     = useState(1)
  const [listPage,       setListPage]       = useState(1)
  const MON_PAGE_SIZE = 25

  const [searchQuery,      setSearchQuery]      = useState('')
  const [accountFilter,    setAccountFilter]    = useState('all')
  const [brandFilter,      setBrandFilter]      = useState('all')
  const [statusFilter,     setStatusFilter]     = useState('all')
  const [showAccountFilter, setShowAccountFilter] = useState(false)
  const [showBrandFilter,    setShowBrandFilter]    = useState(false)
  const [showStatusFilter,   setShowStatusFilter]   = useState(false)
  const accountFilterRef = useRef<HTMLDivElement>(null)
  const brandFilterRef    = useRef<HTMLDivElement>(null)
  const statusFilterRef   = useRef<HTMLDivElement>(null)

  useEffect(() => { setUploadPage(1) }, [searchQuery, accountFilter, brandFilter, statusFilter])
  useEffect(() => { setListPage(1) }, [activeTab])

  useEffect(() => {
    if (!showAccountFilter && !showBrandFilter && !showStatusFilter) return
    const handler = (e: MouseEvent) => {
      if (accountFilterRef.current && !accountFilterRef.current.contains(e.target as Node)) setShowAccountFilter(false)
      if (brandFilterRef.current    && !brandFilterRef.current.contains(e.target as Node))    setShowBrandFilter(false)
      if (statusFilterRef.current   && !statusFilterRef.current.contains(e.target as Node))   setShowStatusFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAccountFilter, showBrandFilter, showStatusFilter])

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
      date:                    m.date,
      media:                   m.media,
      content:                 m.content,
      brand:                   m.brand,
      repost:                  ci?.repost || null,
      review_link:             m.review_link,
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
      date:                    null,
      media:                   null,
      content:                 null,
      brand:                   null,
      repost:                  ci.repost ?? null,
      review_link:             null,
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
        influencer_platform_id,
        influencer_platform!monitoring_influencer_platform_id_fkey(
          platform, handle,
          confirmed_influencers(
            id, seq, repost,
            influencers(display_name)
          )
        )
      `

      const [confirmedRes, monitoringRes] = await Promise.all([
        supabase
          .from('confirmed_influencers')
          .select(`
            id, seq, repost,
            influencers(display_name),
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
    try {
      const { data } = await supabase
        .from('monitoring_keywords')
        .select('brand, keywords')
        .in('brand', ['mimuse', 'brands'])
      if (!data?.length) return
      const mimuseRow = data.find(r => r.brand === 'mimuse')
      const brandsRow = data.find(r => r.brand === 'brands')
      setBrandKws({
        mimuse: mimuseRow?.keywords?.length ? mimuseRow.keywords : brandKws.mimuse,
        brands: brandsRow?.keywords?.length ? brandsRow.keywords : brandKws.brands,
      })
    } catch {
      // keep defaults
    }
  }

  async function saveKeywords(next: Record<string, string[]>) {
    setKwSaving(true)
    try {
      await supabase.from('monitoring_keywords').upsert([
        { brand: 'mimuse', keywords: next.mimuse || [] },
        { brand: 'brands', keywords: next.brands || [] },
      ], { onConflict: 'brand' })
    } catch {
      // silently fail
    }
    setKwSaving(false)
  }

  function addKeyword(brand: string, kw: string, clear: () => void) {
    const trimmed = kw.trim()
    if (!trimmed) { clear(); return }
    const current = brandKws[brand] || []
    if (current.includes(trimmed)) { clear(); return }
    const next = { ...brandKws, [brand]: [...current, trimmed] }
    setBrandKws(next)
    clear()
    saveKeywords(next)
  }

  function removeKeyword(brand: string, kw: string) {
    const next = { ...brandKws, [brand]: (brandKws[brand] || []).filter(k => k !== kw) }
    setBrandKws(next)
    saveKeywords(next)
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
          const kwLow    = kw.toLowerCase()
          const isMimuse = (brandKws.mimuse || []).some(k => k.toLowerCase() === kwLow)
          const brandIdx = (brandKws.brands || []).findIndex(k => k.toLowerCase() === kwLow)
          const c        = isMimuse ? BRAND_COLORS.mimuse : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : 'var(--gray-5)'
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

  const editingReviewIndex = modalRow ? modalGroupRows.findIndex(r => r.id === modalRow.id) : -1

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
    setScrapeLoading(true); setScrapeMsg('')
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; profiles?: number; handles?: string[] }>({ action: 'runMonitoringScrape' })
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

  async function processManualRun() {
    const id = manualRunId.trim()
    if (!id) return
    setManualLoading(true); setManualMsg('')
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; matched?: number }>({ action: 'processApifyRunById', runId: id })
      if (r.error) { setManualMsg('오류: ' + r.error) }
      else { setManualMsg(r.message || '완료'); await loadMonitoring() }
    } catch (e: unknown) {
      setManualMsg('오류: ' + (e as Error).message)
    } finally {
      setManualLoading(false)
    }
  }

  const reviewRows = rows.filter(r => r.review_link?.startsWith('http'))

  const stats: MonStats = {
    totalInfluencers: confirmedCount || new Set(rows.map(r => r.confirmed_influencer_id).filter(Boolean)).size,
    totalReviews:     reviewRows.length,
    totalViews:       reviewRows.reduce((s, r) => s + r.views, 0),
    totalLikes:       reviewRows.reduce((s, r) => s + r.likes, 0),
    totalComments:    reviewRows.reduce((s, r) => s + r.comments, 0),
    brandCounts:      reviewRows.reduce((acc, r) => {
      const b = (r.brand || '').toLowerCase()
      if (b) acc[b] = (acc[b] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    lastRun: rows.find(r => r.updated)?.updated || '',
  }

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
    background: '#f0f5f8',
    padding: '13px 18px',
    textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--teal-dk)', textTransform: 'uppercase', letterSpacing: '.8px',
    borderBottom: '2px solid var(--teal-lt)', whiteSpace: 'nowrap',
  }

  const ACCOUNT_FILTER_OPTIONS = [
    { value: 'all',          label: '전체' },
    { value: 'uploaded',     label: '완료' },
    { value: 'not_uploaded', label: '미업로드' },
  ]

  const BRAND_FILTER_OPTIONS = [
    { value: 'all', label: '전체' },
    ...BRANDS.map(b => ({ value: b, label: b })),
  ]

  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: '전체' },
    { value: 'matched', label: '데이터 있음' },
    { value: 'pending', label: '대기중' },
  ]

  return (
    <div className="page page--fill">
      {/* Banner */}
      <div className="page-banner">
        <div>
          <div className="page-banner-title">인플루언서 리뷰 모니터링</div>
          <div className="page-banner-desc">
            Apify로 최대 50명의 인플루언서 콘텐츠를 스캔하여 키워드 감지 결과를 실시간 추적합니다.
            {stats.lastRun && stats.lastRun !== '-' && (
              <span style={{ marginLeft: 10, color: 'var(--gray-5)', fontSize: 11 }}>
                마지막 실행: {stats.lastRun}
              </span>
            )}
          </div>
        </div>
        <div className="page-banner-actions">
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
        </div>
      </div>

      {scrapeMsg && (
        <div style={{
          background: scrapeMsg.startsWith('오류') ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${scrapeMsg.startsWith('오류') ? '#fca5a5' : '#86efac'}`,
          borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 12,
          fontSize: 13, color: scrapeMsg.startsWith('오류') ? '#b91c1c' : '#166534',
        }}>{scrapeMsg}</div>
      )}
      {/* Stats */}
      <div className="cards">
        <div className="card">
          <div className="card-label">모니터링 인플루언서</div>
          <div className="card-value">{stats.totalInfluencers}</div>
        </div>
        <div className="card highlight">
          <div className="card-label">리뷰 감지됨</div>
          <div className="card-value" style={{ color: 'var(--blue-dk)' }}>{stats.totalReviews}</div>
        </div>
        <div className="card">
          <div className="card-label">총 조회수</div>
          <div className="card-value">{fmtNum(stats.totalViews)}</div>
        </div>
        <div className="card">
          <div className="card-label">총 좋아요수</div>
          <div className="card-value">{fmtNum(stats.totalLikes)}</div>
        </div>
        <div className="card">
          <div className="card-label">총 댓글수</div>
          <div className="card-value">{fmtNum(stats.totalComments)}</div>
        </div>
      </div>

      {/* Keywords + brand counts */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '14px 20px', minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>브랜드 횟수</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BRANDS.map(brand => {
              const count = stats.brandCounts?.[brand] ?? 0
              return (
                <div key={brand} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                    background: BRAND_COLORS[brand] + '18', color: BRAND_COLORS[brand],
                    border: `1px solid ${BRAND_COLORS[brand]}44`,
                  }}>{brand}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? 'var(--gray-7)' : 'var(--gray-3)' }}>{count}</span>
                </div>
              )
            })}
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

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BRAND_COLORS.mimuse, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>MiMuse</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {(brandKws.mimuse || []).map(kw => (
                <span key={kw} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  background: BRAND_COLORS.mimuse + '18', color: BRAND_COLORS.mimuse,
                  border: `1px solid ${BRAND_COLORS.mimuse}44`,
                }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>브랜드</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {(brandKws.brands || []).map((kw, idx) => {
                const c = BRANDS_KW_COLORS[idx % BRANDS_KW_COLORS.length]
                return (
                  <span key={kw} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                    background: c + '18', color: c, border: `1px solid ${c}44`,
                  }}>
                    {kw}
                  </span>
                )
              })}
            </div>
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
        const uploadedRows   = rows.filter(r => r.review_link?.startsWith('http'))
        const listTotalPages = Math.max(1, Math.ceil(uploadedRows.length / MON_PAGE_SIZE))
        const listSafePage   = Math.min(listPage, listTotalPages)
        const listStartIdx   = (listSafePage - 1) * MON_PAGE_SIZE
        const pagedListRows  = uploadedRows.slice(listStartIdx, listStartIdx + MON_PAGE_SIZE)
        return (
          <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>no.</th>
                  <th>플랫폼</th>
                  <th>인플루언서명</th>
                  <th>업로드일</th>
                  <th>리뷰 링크</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {uploadedRows.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>업로드된 리뷰가 없습니다</td></tr>
                  : pagedListRows.map((r, i) => {
                      const account  = (r.handle || '').replace(/^@/, '')
                      const platform = (r.platform || '').toLowerCase()
                      const link     = r.review_link || ''
                      const isTikTok    = platform.includes('tiktok') || link.toLowerCase().includes('tiktok.com')
                      const isInstagram = platform.includes('instagram') || link.toLowerCase().includes('instagram.com')
                      const profileUrl  = isTikTok ? `https://www.tiktok.com/@${account}` : isInstagram ? `https://www.instagram.com/${account}` : ''
                      return (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--gray-4)', fontSize: 11, textAlign: 'center' }}>{listStartIdx + i + 1}</td>
                          <td>
                            {isTikTok
                              ? <span className="platform-badge platform-tiktok">TikTok</span>
                              : isInstagram
                                ? <span className="platform-badge platform-instagram">Instagram</span>
                                : <span className="platform-badge" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>Blog</span>}
                          </td>
                          <td>
                            {r.display_name && (
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-7)' }}>{r.display_name}</div>
                            )}
                            {profileUrl
                              ? <a href={profileUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--gray-5)', textDecoration: 'none' }}>@{account}</a>
                              : <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{account || '—'}</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                          <td><a href={link} target="_blank" rel="noopener" className="video-link">↗ 보기</a></td>
                          <td><span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' }}>완료</span></td>
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
        <div className="filters" style={{ marginBottom: 16 }}>
          <input type="text" placeholder="인플루언서명, 핸들 검색..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 180, maxWidth: 280 }} />
        </div>

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
              if (accountFilter === 'all') return true
              const anyLink = g.rows.some(r => r.review_link?.startsWith('http'))
              if (accountFilter === 'uploaded') return anyLink
              if (accountFilter === 'not_uploaded') return !anyLink
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
                      <div ref={accountFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                        <span>account</span>
                        <button onClick={() => { setShowAccountFilter(p => !p); setShowBrandFilter(false); setShowStatusFilter(false) }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: accountFilter !== 'all' ? 'var(--teal-dk)' : 'transparent', color: accountFilter !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                          <ListFilter size={13} />
                        </button>
                        {showAccountFilter && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                            {ACCOUNT_FILTER_OPTIONS.map(o => (
                              <button key={o.value} onClick={() => { setAccountFilter(o.value); setShowAccountFilter(false) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: accountFilter === o.value ? 700 : 500, background: accountFilter === o.value ? '#d1fae5' : 'transparent', color: accountFilter === o.value ? '#065f46' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th style={thBase}>date</th>
                    <th style={thBase}>media</th>
                    <th style={thBase}>content</th>
                    <th style={thBase}>
                      <div ref={brandFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                        <span>brand</span>
                        <button onClick={() => { setShowBrandFilter(p => !p); setShowAccountFilter(false); setShowStatusFilter(false) }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: brandFilter !== 'all' ? 'var(--teal-dk)' : 'transparent', color: brandFilter !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                          <ListFilter size={13} />
                        </button>
                        {showBrandFilter && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                            {BRAND_FILTER_OPTIONS.map(o => (
                              <button key={o.value} onClick={() => { setBrandFilter(o.value); setShowBrandFilter(false) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: brandFilter === o.value ? 700 : 500, background: brandFilter === o.value ? '#d1fae5' : 'transparent', color: brandFilter === o.value ? '#065f46' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th style={thBase}>
                      <div ref={statusFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                        <span>review link</span>
                        <button onClick={() => { setShowStatusFilter(p => !p); setShowAccountFilter(false); setShowBrandFilter(false) }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: statusFilter !== 'all' ? 'var(--teal-dk)' : 'transparent', color: statusFilter !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                          <ListFilter size={13} />
                        </button>
                        {showStatusFilter && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                            {STATUS_FILTER_OPTIONS.map(o => (
                              <button key={o.value} onClick={() => { setStatusFilter(o.value); setShowStatusFilter(false) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: statusFilter === o.value ? 700 : 500, background: statusFilter === o.value ? '#d1fae5' : 'transparent', color: statusFilter === o.value ? '#065f46' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
                      const platform = (group.rows[0].platform || '').toLowerCase()
                      const anyLink  = group.rows.some(r => r.review_link?.startsWith('http'))
                      const isTikTok    = platform.includes('tiktok')
                      const isInstagram = platform.includes('instagram')
                      const profileUrl  = isTikTok ? `https://www.tiktok.com/@${account}` : isInstagram ? `https://www.instagram.com/${account}` : ''
                      const groupBorderStyle = !isLastGroup ? { borderBottom: '2px solid var(--gray-2)' } : {}

                      return group.rows.map((r, ri) => {
                        const isFirst  = ri === 0
                        const isLast   = ri === group.rows.length - 1
                        const link     = r.review_link || ''
                        const hasLink  = !!link.startsWith('http')
                        const rowBrand = (r.brand || '').toLowerCase()
                        const rowColor = BRAND_COLORS[rowBrand as Brand] || 'var(--gray-4)'
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                  {isTikTok
                                    ? <span className="platform-badge platform-tiktok">TikTok</span>
                                    : isInstagram
                                      ? <span className="platform-badge platform-instagram">Instagram</span>
                                      : <span className="platform-badge" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>Blog</span>}
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
                                      const kwLow    = kw.toLowerCase()
                                      const isMimuse = (brandKws.mimuse || []).some(k => k.toLowerCase() === kwLow)
                                      const brandIdx = (brandKws.brands || []).findIndex(k => k.toLowerCase() === kwLow)
                                      const c        = isMimuse ? BRAND_COLORS.mimuse : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : 'var(--gray-5)'
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
          <div style={{ fontSize: 10, fontWeight: 700, color: BRAND_COLORS.mimuse, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>MiMuse</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {(brandKws.mimuse || []).map(kw => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: BRAND_COLORS.mimuse + '18', color: BRAND_COLORS.mimuse,
                border: `1px solid ${BRAND_COLORS.mimuse}44`,
              }}>
                {kw}
                <button onClick={() => showConfirm(`"${kw}" 키워드를 삭제할까요?`, () => removeKeyword('mimuse', kw))}
                  style={{ background: 'none', border: 'none', color: BRAND_COLORS.mimuse, cursor: 'pointer', fontSize: 12, padding: '0 1px', lineHeight: 1 }}>×</button>
              </span>
            ))}
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <input className="modal-input" placeholder="키워드 추가" value={newMimuseKw}
                onChange={e => setNewMimuseKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword('mimuse', newMimuseKw, () => setNewMimuseKw('')) } }}
                style={{ width: 140, padding: '8px 12px', fontSize: 12 }} />
              <button className="cfg-btn" onClick={() => addKeyword('mimuse', newMimuseKw, () => setNewMimuseKw(''))}>+</button>
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>브랜드</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {(brandKws.brands || []).map((kw, idx) => {
              const c = BRANDS_KW_COLORS[idx % BRANDS_KW_COLORS.length]
              return (
                <span key={kw} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  background: c + '18', color: c, border: `1px solid ${c}44`,
                }}>
                  {kw}
                  <button onClick={() => showConfirm(`"${kw}" 키워드를 삭제할까요?`, () => removeKeyword('brands', kw))}
                    style={{ background: 'none', border: 'none', color: c, cursor: 'pointer', fontSize: 12, padding: '0 1px', lineHeight: 1 }}>×</button>
                </span>
              )
            })}
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <input className="modal-input" placeholder="키워드 추가" value={newBrandsKw}
                onChange={e => setNewBrandsKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword('brands', newBrandsKw, () => setNewBrandsKw('')) } }}
                style={{ width: 140, padding: '8px 12px', fontSize: 12 }} />
              <button className="cfg-btn" onClick={() => addKeyword('brands', newBrandsKw, () => setNewBrandsKw(''))}>+</button>
            </span>
          </div>
        </div>

        {kwSaving && <div className="modal-status">저장 중…</div>}

        <div className="modal-actions">
          <button className="modal-btn-confirm" onClick={() => setShowKwModal(false)}>완료</button>
        </div>
      </Modal>

      {/* ── Review View / Edit Modal ── */}
      <Modal
        open={!!modalRow}
        onClose={closeModal}
        title={modalRow ? `${modalEditing ? '리뷰 데이터 편집' : '리뷰 정보'} · ${modalTitle(modalRow)}` : ''}
      >
        {modalRow && (
          <>
            {modalGroupRows.length > 1 && (
              <div style={{ marginBottom: 16 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                <ViewField label="업로드일">{fmtDate(modalRow.date)}</ViewField>
                <ViewField label="브랜드">
                  {modalRow.brand
                    ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: (BRAND_COLORS[(modalRow.brand || '').toLowerCase() as Brand] || 'var(--gray-4)') + '18', color: BRAND_COLORS[(modalRow.brand || '').toLowerCase() as Brand] || 'var(--gray-6)' }}>{modalRow.brand}</span>
                    : '—'}
                </ViewField>
                <ViewField label="미디어">{modalRow.media || '—'}</ViewField>
                <ViewField label="콘텐츠">{modalRow.content || '—'}</ViewField>
                <ViewField label="리뷰 링크" span>
                  {modalRow.review_link?.startsWith('http')
                    ? <a href={modalRow.review_link} target="_blank" rel="noopener" className="video-link">↗ 보기</a>
                    : '—'}
                </ViewField>
                <ViewField label="조회수">{modalRow.views ? fmtNum(modalRow.views) : '—'}</ViewField>
                <ViewField label="좋아요 수">{modalRow.likes ? fmtNum(modalRow.likes) : '—'}</ViewField>
                <ViewField label="댓글 수">{modalRow.comments ? fmtNum(modalRow.comments) : '—'}</ViewField>
                <ViewField label="감지된 키워드" span>
                  {modalRow.keywords
                    ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {modalRow.keywords.split(',').map(kw => kw.trim()).filter(Boolean).map(kw => {
                          const kwLow    = kw.toLowerCase()
                          const isMimuse = (brandKws.mimuse || []).some(k => k.toLowerCase() === kwLow)
                          const brandIdx = (brandKws.brands || []).findIndex(k => k.toLowerCase() === kwLow)
                          const c        = isMimuse ? BRAND_COLORS.mimuse : brandIdx >= 0 ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length] : 'var(--gray-5)'
                          return (
                            <span key={kw} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c + '18', color: c, border: `1px solid ${c}44`, whiteSpace: 'nowrap' }}>{kw}</span>
                          )
                        })}
                      </div>
                    )
                    : '—'}
                </ViewField>
                <ViewField label="모니터링 실행일">{modalRow.updated ? fmtDate(modalRow.updated) : '—'}</ViewField>
              </div>
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
                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
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
          </>
        )}
      </Modal>
    </div>
  )
}
