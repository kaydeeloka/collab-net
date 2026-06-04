import { useEffect, useRef, useState } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { fmtNum } from '../../../lib/utils'
import Spinner from '../../../components/Spinner'

// Matches 모니터링 sheet: no.|platform|account|date|media|content|brand|repost|review link|조회수|좋아요 수|댓글 수|모니터링 실행일
const C = {
  NO       : 0,
  PLATFORM : 1,
  HANDLE   : 2,
  DATE     : 3,
  MEDIA    : 4,
  CONTENT  : 5,
  BRAND    : 6,
  REPOST   : 7,
  LINK     : 8,
  VIEWS    : 9,
  LIKES    : 10,
  COMMENTS : 11,
  KEYWORDS : 12,
  UPDATED  : 13,
}

const BRANDS = ['mimuse', 'aesthen', 'joodoc', 'nesh', 'varuza'] as const
type Brand = typeof BRANDS[number]

const DEFAULT_BRAND_KEYWORDS: Record<string, string[]> = {
  mimuse: ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', 'MiMuse Beauty'],
  brands: ['aesthen', 'joodoc', 'nesh', 'varuza'],
}

const BRANDS_KW_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316', '#06b6d4', '#3b82f6', '#e11d48']

const BRAND_COLORS: Record<Brand, string> = {
  mimuse:  '#3b82f6',
  aesthen: '#8b5cf6',
  joodoc:  '#ec4899',
  nesh:    '#f59e0b',
  varuza:  '#10b981',
}

const MEDIA_OPTIONS   = ['photo', 'video']
const CONTENT_OPTIONS = ['review video', 'unboxing','other']

interface MonStats {
  totalInfluencers : number
  totalReviews     : number
  totalViews       : number
  totalLikes       : number
  totalComments    : number
  brandCounts      : Record<string, number>
  lastRun          : string
}

interface MonitoringData {
  error?     : string
  headers?   : string[]
  rows?      : string[][]
  stats?     : MonStats
  runStatus? : string | null
}

type RowExtras = {
  media?  : string
  content?: string
  brand?  : string
  repost? : string
}

function findVideoLink(r: string[]): string {
  for (const val of r) {
    if (typeof val === 'string' && val.startsWith('http') && (
      val.includes('/video/') ||
      val.includes('/reel/') ||
      val.includes('/p/')    ||
      val.includes('youtu')
    )) return val
  }
  return ''
}

function rowKey(r: string[]): string {
  return [r[C.HANDLE], r[C.DATE], r[C.LINK]].filter(Boolean).join('|') || r.slice(0, 5).join('|')
}

function fmtDate(val: string): string {
  if (!val) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Monitoring() {
  const [data,    setData]    = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)

  const [brandKws,      setBrandKws]      = useState<Record<string, string[]>>(DEFAULT_BRAND_KEYWORDS)
  const [kwEditMode,    setKwEditMode]    = useState(false)
  const [newMimuseKw,   setNewMimuseKw]  = useState('')
  const [newBrandsKw,   setNewBrandsKw]  = useState('')
  const [kwSaving,      setKwSaving]     = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ brand: string; kw: string } | null>(null)

  const [rowExtras, setRowExtras] = useState<Record<string, RowExtras>>(() => {
    try { return JSON.parse(localStorage.getItem('monitoring_row_extras') || '{}') }
    catch { return {} }
  })

  const [scrapeLoading,  setScrapeLoading]  = useState(false)
  const [scrapeMsg,      setScrapeMsg]      = useState('')
  const [runPending,     setRunPending]     = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [manualRunId,    setManualRunId]    = useState('')
  const [manualLoading,  setManualLoading]  = useState(false)
  const [manualMsg,      setManualMsg]      = useState('')

  const [searchQuery,    setSearchQuery]    = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [brandFilter,    setBrandFilter]    = useState('all')
  const [statusFilter,   setStatusFilter]   = useState('all')  // all | matched | pending

  useEffect(() => {
    loadMonitoring()
    loadKeywords()
  }, [])

  async function loadMonitoring() {
    setLoading(true)
    try {
      const d: MonitoringData = await gasGet('getMonitoringData')
      setData(d)
      if (d.runStatus === 'RUNNING') {
        setScrapeMsg('스크래핑 진행 중… — 자동으로 결과를 확인합니다.')
        setRunPending(true)
      }
    } catch (e: unknown) {
      setData({ error: (e as Error).message })
    }
    setLoading(false)
  }

  async function loadKeywords() {
    try {
      const kws = await gasGet('getMonitoringKeywords')
      if (Array.isArray(kws)) {
        setBrandKws({ ...DEFAULT_BRAND_KEYWORDS, mimuse: kws as string[] })
      } else {
        const loaded = kws as Record<string, string[]>
        // Migrate old per-brand format → flat brands array
        if (!loaded.brands && (loaded.aesthen || loaded.joodoc || loaded.nesh || loaded.varuza)) {
          const brands = [...new Set([
            ...(loaded.aesthen || []), ...(loaded.joodoc || []),
            ...(loaded.nesh    || []), ...(loaded.varuza || []),
          ])]
          setBrandKws({ mimuse: loaded.mimuse || DEFAULT_BRAND_KEYWORDS.mimuse, brands })
        } else {
          setBrandKws({ ...DEFAULT_BRAND_KEYWORDS, ...loaded })
        }
      }
    } catch {
      // keep defaults
    }
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  async function pollOnce() {
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; status?: string }>({ action: 'checkMonitoringRun' })
      if (r.error) {
        stopPolling(); setRunPending(false)
        setScrapeMsg('오류: ' + r.error)
        return
      }
      if (r.status && r.status !== 'SUCCEEDED') {
        setScrapeMsg('스크래핑 중… (' + r.status + ') — 자동으로 결과를 확인합니다.')
        return
      }
      // Done
      stopPolling(); setRunPending(false)
      setScrapeMsg(r.message || '완료')
      await loadMonitoring()
    } catch {
      // network hiccup — keep polling
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
    setScrapeLoading(true)
    setScrapeMsg('')
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; profiles?: number; handles?: string[] }>({
        action: 'runMonitoringScrape',
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
    try {
      await gasPost({ action: 'resetMonitoringRun' })
    } catch { /* ignore */ }
    stopPolling()
    setRunPending(false)
    setScrapeMsg('')
  }

  async function processManualRun() {
    const id = manualRunId.trim()
    if (!id) return
    setManualLoading(true)
    setManualMsg('')
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; message?: string; matched?: number }>({
        action: 'processApifyRunById',
        runId: id,
      })
      if (r.error) {
        setManualMsg('오류: ' + r.error)
      } else {
        setManualMsg(r.message || '완료')
        await loadMonitoring()
      }
    } catch (e: unknown) {
      setManualMsg('오류: ' + (e as Error).message)
    } finally {
      setManualLoading(false)
    }
  }

  async function saveKeywords(next: Record<string, string[]>) {
    setKwSaving(true)
    try {
      await gasPost({ action: 'saveMonitoringKeywords', brandKeywords: next })
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

  function updateRowExtra(link: string, field: keyof RowExtras, value: string) {
    const next = { ...rowExtras, [link]: { ...(rowExtras[link] || {}), [field]: value } }
    setRowExtras(next)
    localStorage.setItem('monitoring_row_extras', JSON.stringify(next))
  }

  const stats = data?.stats

  const rows = (data?.rows || []).filter(r => r && r[C.HANDLE])

  const filteredRows = rows.filter(r => {
    const platform = (r[C.PLATFORM] || '').toLowerCase()
    if (platformFilter === 'tiktok'    && !platform.includes('tiktok'))    return false
    if (platformFilter === 'instagram' && !platform.includes('instagram')) return false

    if (brandFilter !== 'all') {
      const extras   = rowExtras[rowKey(r)] || {}
      const rowBrand = extras.brand || r[C.BRAND] || ''
      if (rowBrand.toLowerCase() !== brandFilter.toLowerCase()) return false
    }

    const hasLink = !!findVideoLink(r)
    if (statusFilter === 'matched' && !hasLink) return false
    if (statusFilter === 'pending' && hasLink)  return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="page page--fill">
      {/* Banner */}
      <div className="page-banner">
        <span className="page-banner-deco">📡</span>
        <div>
          <div className="page-banner-title">인플루언서 리뷰 모니터링</div>
          <div className="page-banner-desc">
            Apify로 최대 50명의 인플루언서 콘텐츠를 스캔하여 키워드 감지 결과를 실시간 추적합니다.
            {stats?.lastRun && stats.lastRun !== '-' && (
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
        }}>
          {scrapeMsg}
        </div>
      )}

      {/* Manual run ID processor */}
      <div style={{
        background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: '12px 16px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>
          Run ID로 처리
        </span>
        <input
          type="text"
          placeholder="Apify Run ID (예: dneoZLDX0POvzg1Gz)"
          value={manualRunId}
          onChange={e => setManualRunId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') processManualRun() }}
          style={{ flex: 1, minWidth: 220, fontSize: 12 }}
        />
        <button className="page-banner-btn" onClick={processManualRun} disabled={manualLoading || !manualRunId.trim()}
          style={{ background: 'var(--blue-dk)', color: '#fff', borderColor: 'var(--blue-dk)', whiteSpace: 'nowrap' }}>
          {manualLoading ? '처리 중…' : '결과 적용'}
        </button>
        {manualMsg && (
          <span style={{ fontSize: 12, color: manualMsg.startsWith('오류') ? '#b91c1c' : '#166534', width: '100%' }}>
            {manualMsg}
          </span>
        )}
      </div>

      {/* Stats cards */}
      <div className="cards">
        <div className="card">
          <div className="card-label">모니터링 인플루언서</div>
          <div className="card-value">{stats?.totalInfluencers ?? 0}</div>
        </div>
        <div className="card highlight">
          <div className="card-label">리뷰 감지됨</div>
          <div className="card-value" style={{ color: 'var(--blue-dk)' }}>{stats?.totalReviews ?? 0}</div>
        </div>
        <div className="card">
          <div className="card-label">총 조회수</div>
          <div className="card-value">{fmtNum(stats?.totalViews ?? 0)}</div>
        </div>
        <div className="card">
          <div className="card-label">총 좋아요수</div>
          <div className="card-value">{fmtNum(stats?.totalLikes ?? 0)}</div>
        </div>
        <div className="card">
          <div className="card-label">총 댓글수</div>
          <div className="card-value">{fmtNum(stats?.totalComments ?? 0)}</div>
        </div>
      </div>

      {/* Apify workflow diagram */}
      {(() => {
        const running = runPending
        // A run has completed before if lastRun is a real date string
        const lastRun = stats?.lastRun ?? ''
        const hasRan  = !!lastRun && lastRun !== '-' && lastRun !== '아직 실행 안 됨'

        type StepState = 'done' | 'active' | 'idle'
        const steps: { icon: string; label: string; sub: string; state: StepState }[] = [
          {
            icon: '📋',
            label: '핸들 수집',
            sub: `${stats?.totalInfluencers ?? 0}명 인플루언서`,
            state: (running || hasRan) ? 'done' : 'idle',
          },
          {
            icon: '🚀',
            label: 'Apify 실행',
            sub: 'clockworks 스크래퍼',
            state: running ? 'active' : hasRan ? 'done' : 'idle',
          },
          {
            icon: '⏳',
            label: '완료 대기',
            sub: '최대 50개 프로필',
            state: running ? 'active' : hasRan ? 'done' : 'idle',
          },
          {
            icon: '🔎',
            label: '키워드 필터링',
            sub: 'mimuse · aesthen · nesh…',
            state: running ? 'idle' : hasRan ? 'done' : 'idle',
          },
          {
            icon: '📊',
            label: '시트 업데이트',
            sub: `${stats?.totalReviews ?? 0}개 리뷰 감지`,
            state: running ? 'idle' : hasRan ? 'done' : 'idle',
          },
        ]

        const colors: Record<StepState, { bg: string; border: string; icon: string; label: string; sub: string }> = {
          done:   { bg: '#fefce8', border: '#fde047', icon: '#ca8a04', label: '#a16207', sub: '#facc15' },
          active: { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb', label: '#1d4ed8', sub: '#60a5fa' },
          idle:   { bg: 'var(--gray-0)', border: 'var(--gray-2)', icon: 'var(--gray-4)', label: 'var(--gray-5)', sub: 'var(--gray-3)' },
        }

        return (
          <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 14 }}>
              Apify 워크플로우
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {steps.map((step, i) => {
                const c = colors[step.state]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{
                      flex: 1, minWidth: 0,
                      background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: 10, padding: '10px 12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      position: 'relative',
                    }}>
                      {step.state === 'active' && (
                        <span style={{
                          position: 'absolute', top: 5, right: 7,
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#3b82f6',
                          boxShadow: '0 0 0 2px #bfdbfe',
                          animation: 'pulse 1.5s infinite',
                        }} />
                      )}
                      {step.state === 'done' && (
                        <span style={{
                          position: 'absolute', top: 5, right: 7,
                          fontSize: 9, color: '#ca8a04', fontWeight: 800,
                        }}>✓</span>
                      )}
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{step.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.label, textAlign: 'center', whiteSpace: 'nowrap' }}>{step.label}</span>
                      <span style={{ fontSize: 10, color: c.sub, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{step.sub}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 14, color: 'var(--gray-3)', userSelect: 'none' }}>›</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* 키워드 설정 + 브랜드 횟수 side by side */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>

      {/* Brand count panel — left side */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '14px 20px', minWidth: 200 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
          브랜드 횟수
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BRANDS.map(brand => {
            const count = (stats?.brandCounts?.[brand.toLowerCase()] ?? stats?.brandCounts?.[brand]) ?? 0
            return (
              <div key={brand} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
                  background: BRAND_COLORS[brand] + '18', color: BRAND_COLORS[brand],
                  border: `1px solid ${BRAND_COLORS[brand]}44`,
                }}>{brand}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: count > 0 ? 'var(--gray-7)' : 'var(--gray-3)' }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 키워드 설정 — right side */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            키워드 설정
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {kwSaving && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>저장 중…</span>}
            {!kwEditMode
              ? <button className="cfg-btn" onClick={() => setKwEditMode(true)}>편집</button>
              : <button className="cfg-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }}
                  onClick={() => setKwEditMode(false)}>완료</button>
            }
          </div>
        </div>

        {/* MiMuse keywords */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BRAND_COLORS.mimuse, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            MiMuse
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {(brandKws.mimuse || []).map(kw => (
              <span key={kw} style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                background: BRAND_COLORS.mimuse + '18', color: BRAND_COLORS.mimuse,
                border: `1px solid ${BRAND_COLORS.mimuse}44`,
              }}>
                {kw}
                {kwEditMode && (
                  <button onClick={() => setPendingDelete({ brand: 'mimuse', kw })}
                    style={{ background: 'none', border: 'none', color: BRAND_COLORS.mimuse, cursor: 'pointer', fontSize: 12, padding: '0 1px', lineHeight: 1 }}>×</button>
                )}
              </span>
            ))}
            {kwEditMode && (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <input className="mon-add-input" placeholder="키워드 추가" value={newMimuseKw}
                  onChange={e => setNewMimuseKw(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword('mimuse', newMimuseKw, () => setNewMimuseKw('')) } }}
                  style={{ width: 110 }} />
                <button className="cfg-btn" onClick={() => addKeyword('mimuse', newMimuseKw, () => setNewMimuseKw(''))}>+</button>
              </span>
            )}
          </div>
        </div>

        {/* Brand keywords — flat list, each keyword gets a cycling color */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            브랜드
          </div>
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
                  {kwEditMode && (
                    <button onClick={() => setPendingDelete({ brand: 'brands', kw })}
                      style={{ background: 'none', border: 'none', color: c, cursor: 'pointer', fontSize: 12, padding: '0 1px', lineHeight: 1 }}>×</button>
                  )}
                </span>
              )
            })}
            {kwEditMode && (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <input className="mon-add-input" placeholder="키워드 추가" value={newBrandsKw}
                  onChange={e => setNewBrandsKw(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword('brands', newBrandsKw, () => setNewBrandsKw('')) } }}
                  style={{ width: 110 }} />
                <button className="cfg-btn" onClick={() => addKeyword('brands', newBrandsKw, () => setNewBrandsKw(''))}>+</button>
              </span>
            )}
          </div>
        </div>
      </div>

      </div>{/* end flex row wrapper */}

      {/* Delete confirmation toast */}
      {pendingDelete && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--gray-8, #1f2937)', color: '#fff', borderRadius: 10,
          padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 1000, fontSize: 12, whiteSpace: 'nowrap',
        }}>
          <span>"{pendingDelete.kw}" 키워드를 삭제할까요?</span>
          <button onClick={() => { removeKeyword(pendingDelete.brand, pendingDelete.kw); setPendingDelete(null) }}
            style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            삭제
          </button>
          <button onClick={() => setPendingDelete(null)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>
            취소
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="인플루언서명, 핸들 검색..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 180, maxWidth: 280 }} />
        <div className="filter-group">
          <label>플랫폼:</label>
          {[['all', '전체'], ['tiktok', 'TikTok'], ['instagram', 'Instagram']].map(([v, l]) => (
            <button key={v} className={'ems-filter-btn' + (platformFilter === v ? ' active' : '')}
              onClick={() => setPlatformFilter(v)}>{l}</button>
          ))}
        </div>
        <div className="filter-group">
          <label>브랜드:</label>
          <button className={'ems-filter-btn' + (brandFilter === 'all' ? ' active' : '')}
            onClick={() => setBrandFilter('all')}>전체</button>
          {BRANDS.map(brand => (
            <button key={brand}
              className={'ems-filter-btn' + (brandFilter === brand ? ' active' : '')}
              onClick={() => setBrandFilter(brandFilter === brand ? 'all' : brand)}>{brand}</button>
          ))}
        </div>
        <div className="filter-group">
          <label>상태:</label>
          {([['all', '전체'], ['matched', '데이터 있음'], ['pending', '대기중']] as [string, string][]).map(([v, l]) => (
            <button key={v} className={'ems-filter-btn' + (statusFilter === v ? ' active' : '')}
              onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
      {!loading && data?.error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius)',
          color: '#b91c1c', padding: '16px 20px', marginBottom: 16, fontSize: 13,
        }}>
          ! {data.error}
        </div>
      )}
      {!loading && !data?.error && (
        filteredRows.length === 0
          ? <div className="empty">감지된 리뷰가 없습니다.</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>no.</th>
                    <th>account</th>
                    <th>date</th>
                    <th>media</th>
                    <th>content</th>
                    <th>brand</th>
                    <th>repost</th>
                    <th>review link</th>
                    <th className="num">조회수</th>
                    <th className="num">좋아요 수</th>
                    <th className="num">댓글 수</th>
                    <th>감지된 키워드</th>
                    <th>모니터링 실행일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const handle   = (r[C.HANDLE]   || '').replace(/^@/, '')
                    const platform = (r[C.PLATFORM] || '').toLowerCase()
                    const link     = findVideoLink(r)
                    const hasLink  = !!link
                    const isTikTok = platform.includes('tiktok') || link.toLowerCase().includes('tiktok.com')
                    const profileUrl = isTikTok
                      ? `https://www.tiktok.com/@${handle}`
                      : `https://www.instagram.com/${handle}`
                    const runDate     = r[C.UPDATED] || ''
                    const showRunDate = (runDate && !runDate.startsWith('http')) ? runDate : ''

                    const rKey     = rowKey(r)
                    const extras   = rowExtras[rKey] || {}
                    const rowBrand = extras.brand || r[C.BRAND] || ''
                    const rowColor = BRAND_COLORS[rowBrand as Brand] || 'var(--gray-4)'

                    return (
                      <tr key={i} style={{ opacity: hasLink ? 1 : 0.6 }}>
                        {/* no. */}
                        <td style={{ color: 'var(--gray-4)', fontSize: 11, textAlign: 'center' }}>{i + 1}</td>

                        {/* account */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {isTikTok
                              ? <span className="platform-badge platform-tiktok">TikTok</span>
                              : <span className="platform-badge platform-instagram">Instagram</span>
                            }
                            {!hasLink && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                                background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047',
                              }}>대기중</span>
                            )}
                          </div>
                          {handle && (
                            <div style={{ marginTop: 3 }}>
                              <a href={profileUrl} target="_blank" rel="noopener"
                                style={{ fontSize: 11, color: 'var(--gray-5)', textDecoration: 'none' }}>
                                @{handle}
                              </a>
                            </div>
                          )}
                        </td>

                        {/* date */}
                        <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>
                          {fmtDate(r[C.DATE] || '')}
                        </td>

                        {/* media */}
                        <td>
                          <select
                            value={extras.media || r[C.MEDIA] || ''}
                            onChange={e => updateRowExtra(rKey, 'media', e.target.value)}
                            className="inline-select"
                          >
                            <option value="">—</option>
                            {MEDIA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>

                        {/* content */}
                        <td>
                          <select
                            value={extras.content || r[C.CONTENT] || ''}
                            onChange={e => updateRowExtra(rKey, 'content', e.target.value)}
                            className="inline-select"
                          >
                            <option value="">—</option>
                            {CONTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>

                        {/* brand */}
                        <td>
                          <select
                            value={rowBrand}
                            onChange={e => updateRowExtra(rKey, 'brand', e.target.value)}
                            className="inline-select"
                            style={{
                              color: rowBrand ? rowColor : 'var(--gray-4)',
                              border: `1px solid ${rowBrand ? rowColor : 'var(--gray-2)'}`,
                              background: rowBrand ? rowColor + '18' : 'var(--gray-0)',
                              fontWeight: rowBrand ? 600 : 400,
                            }}
                          >
                            <option value="">—</option>
                            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </td>

                        {/* repost */}
                        <td>
                          <select
                            value={extras.repost || r[C.REPOST] || ''}
                            onChange={e => updateRowExtra(rKey, 'repost', e.target.value)}
                            className="inline-select"
                            style={{
                              color: extras.repost === 'Y' ? 'var(--green)' : extras.repost === 'N' ? '#ef4444' : 'var(--gray-4)',
                              fontWeight: extras.repost ? 600 : 400,
                            }}
                          >
                            <option value="">—</option>
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>

                        {/* review link */}
                        <td>
                          {link
                            ? <a href={link} target="_blank" rel="noopener" className="video-link">↗ 보기</a>
                            : '—'}
                        </td>

                        {/* 조회수 */}
                        <td className="num">{r[C.VIEWS] ? fmtNum(r[C.VIEWS]) : '—'}</td>

                        {/* 좋아요 수 */}
                        <td className="num">{r[C.LIKES] ? fmtNum(r[C.LIKES]) : '—'}</td>

                        {/* 댓글 수 */}
                        <td className="num">{r[C.COMMENTS] ? fmtNum(r[C.COMMENTS]) : '—'}</td>

                        {/* 감지된 키워드 */}
                        <td>
                          {r[C.KEYWORDS]
                            ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {r[C.KEYWORDS].split(',').map(kw => kw.trim()).filter(Boolean).map(kw => {
                                  const kwLow = kw.toLowerCase()
                                  const isMimuse = (brandKws.mimuse || []).some(k => k.toLowerCase() === kwLow)
                                  const brandIdx = (brandKws.brands || []).findIndex(k => k.toLowerCase() === kwLow)
                                  const c = isMimuse
                                    ? BRAND_COLORS.mimuse
                                    : brandIdx >= 0
                                      ? BRANDS_KW_COLORS[brandIdx % BRANDS_KW_COLORS.length]
                                      : 'var(--gray-5)'
                                  return (
                                    <span key={kw} style={{
                                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                                      background: c + '18', color: c,
                                      border: `1px solid ${c}44`, whiteSpace: 'nowrap',
                                    }}>{kw}</span>
                                  )
                                })}
                              </div>
                            : '—'}
                        </td>

                        {/* 모니터링 실행일 */}
                        <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>
                          {showRunDate || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  )
}
