import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { gasPost } from '../../../lib/api'
import { fmtNum } from '../../../lib/utils'
import Spinner from '../../../components/Spinner'
import Pagination from '../../../components/Pagination'

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

export default function Monitoring() {
  const [rows,    setRows]    = useState<MonRow[]>([])
  const [loading, setLoading] = useState(true)

  const [brandKws,      setBrandKws]      = useState<Record<string, string[]>>({
    mimuse: ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', 'MiMuse Beauty'],
    brands: ['aesthen', 'joodoc', 'nesh', 'varuza'],
  })
  const [kwEditMode,    setKwEditMode]    = useState(false)
  const [newMimuseKw,   setNewMimuseKw]  = useState('')
  const [newBrandsKw,   setNewBrandsKw]  = useState('')
  const [kwSaving,      setKwSaving]     = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ brand: string; kw: string } | null>(null)

  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [scrapeMsg,     setScrapeMsg]     = useState('')
  const [runPending,    setRunPending]    = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [manualRunId,   setManualRunId]   = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualMsg,     setManualMsg]     = useState('')

  const [tableEditMode,  setTableEditMode]  = useState(false)
  const [activeTab,      setActiveTab]      = useState<'upload' | 'list'>('upload')
  const [uploadPage,     setUploadPage]     = useState(1)
  const [listPage,       setListPage]       = useState(1)
  const MON_PAGE_SIZE = 25

  const [searchQuery,    setSearchQuery]    = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [brandFilter,    setBrandFilter]    = useState('all')
  const [statusFilter,   setStatusFilter]   = useState('all')

  useEffect(() => { setUploadPage(1) }, [searchQuery, platformFilter, brandFilter, statusFilter])
  useEffect(() => { setListPage(1) }, [activeTab])

  useEffect(() => {
    loadMonitoring()
    loadKeywords()
  }, [])

  async function loadMonitoring() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('monitoring')
        .select(`
          id, date, media, content, brand, review_link, views, likes, comments, keywords, updated,
          influencer_platform_id,
          influencer_platforms(
            platform, handle,
            confirmed_influencers(
              id, seq, repost,
              influencers(display_name)
            )
          )
        `)
        .order('date', { ascending: false })

      if (error) throw error

      const mapped: MonRow[] = (data || []).map((m: any) => {
        const ip = m.influencer_platforms
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
      })
      setRows(mapped)
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

  async function updateRowField(id: string, field: string, value: string | number | null) {
    await supabase.from('monitoring').update({ [field]: value || null }).eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } as MonRow : r))
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
    totalInfluencers: new Set(rows.map(r => r.confirmed_influencer_id).filter(Boolean)).size,
    totalReviews:     reviewRows.length,
    totalViews:       reviewRows.reduce((s, r) => s + r.views, 0),
    totalLikes:       reviewRows.reduce((s, r) => s + r.likes, 0),
    totalComments:    reviewRows.reduce((s, r) => s + r.comments, 0),
    brandCounts:      reviewRows.reduce((acc, r) => {
      const b = (r.brand || '').toLowerCase()
      if (b) acc[b] = (acc[b] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    lastRun: rows.find(r => r.updated)?.updated || '아직 실행 안 됨',
  }

  const filteredRows = rows.filter(r => {
    if (platformFilter !== 'all' && !(r.platform || '').toLowerCase().includes(platformFilter)) return false
    if (brandFilter !== 'all' && (r.brand || '').toLowerCase() !== brandFilter.toLowerCase()) return false
    const hasLink = !!r.review_link?.startsWith('http')
    if (statusFilter === 'matched' && !hasLink) return false
    if (statusFilter === 'pending' && hasLink) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (![r.handle, r.brand, r.keywords, r.review_link].join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

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
              {!kwEditMode
                ? <button className="cfg-btn" onClick={() => setKwEditMode(true)}>편집</button>
                : <button className="cfg-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }} onClick={() => setKwEditMode(false)}>완료</button>
              }
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
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-2)', marginBottom: 20 }}>
        {([['upload', '리뷰 업로드'], ['list', '리뷰 리스트']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 22px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: activeTab === key ? 'var(--blue-dk)' : 'var(--gray-5)',
              borderBottom: activeTab === key ? '2px solid var(--blue-dk)' : '2px solid transparent',
              marginBottom: -2, transition: 'color .15s',
            }}>{label}</button>
        ))}
      </div>

      {/* Delete keyword toast */}
      {pendingDelete && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--gray-8, #1f2937)', color: '#fff', borderRadius: 10,
          padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 1000, fontSize: 12, whiteSpace: 'nowrap',
        }}>
          <span>"{pendingDelete.kw}" 키워드를 삭제할까요?</span>
          <button onClick={() => { removeKeyword(pendingDelete.brand, pendingDelete.kw); setPendingDelete(null) }}
            style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>삭제</button>
          <button onClick={() => setPendingDelete(null)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>취소</button>
        </div>
      )}

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
          <div className="filter-group">
            <label>플랫폼:</label>
            <select className="inline-select" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
              <option value="all">전체</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div className="filter-group">
            <label>브랜드:</label>
            <select className="inline-select" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
              <option value="all">전체</option>
              {BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>상태:</label>
            <select className="inline-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">전체</option>
              <option value="matched">데이터 있음</option>
              <option value="pending">대기중</option>
            </select>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            {!tableEditMode
              ? <button className="cfg-btn" onClick={() => setTableEditMode(true)}>편집</button>
              : <button className="cfg-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }} onClick={() => setTableEditMode(false)}>완료</button>}
          </div>
        </div>

        {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

        {!loading && (() => {
          // Group filteredRows by confirmed_influencer_id, preserving order of first appearance
          type Group = { key: string; rows: MonRow[] }
          const groupMap = new Map<string, Group>()
          filteredRows.forEach(r => {
            const key = r.confirmed_influencer_id || r.influencer_platform_id || r.id
            if (!groupMap.has(key)) groupMap.set(key, { key, rows: [] })
            groupMap.get(key)!.rows.push(r)
          })
          const groups = Array.from(groupMap.values())

          // Paginate by group (one influencer = one "entry"), not by row
          const uploadTotalPages = Math.max(1, Math.ceil(groups.length / MON_PAGE_SIZE))
          const uploadSafePage   = Math.min(uploadPage, uploadTotalPages)
          const uploadStartIdx   = (uploadSafePage - 1) * MON_PAGE_SIZE
          const pagedGroups      = groups.slice(uploadStartIdx, uploadStartIdx + MON_PAGE_SIZE)

          return groups.length === 0
            ? <div className="empty">감지된 리뷰가 없습니다.</div>
            : (
              <>
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
                    {pagedGroups.map((group, gi) => {
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
                        const ed       = tableEditMode
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
                              <td rowSpan={group.rows.length} style={{ verticalAlign: 'middle', ...groupBorderStyle }}>
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
                                      ? <a href={profileUrl} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--gray-5)', textDecoration: 'none' }}>@{account}</a>
                                      : <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>{account}</span>}
                                  </div>
                                )}
                              </td>
                            )}

                            <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>
                              {ed
                                ? <input type="date" value={r.date || ''} className="inline-select" style={{ width: 120, fontSize: 11 }}
                                    onChange={e => updateRowField(r.id, 'date', e.target.value || null)} />
                                : fmtDate(r.date)}
                            </td>

                            <td>
                              {ed
                                ? <select value={r.media || ''} onChange={e => updateRowField(r.id, 'media', e.target.value)} className="inline-select">
                                    <option value="">—</option>
                                    {MEDIA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                : <span style={{ fontSize: 12, color: 'var(--gray-6)' }}>{r.media || '—'}</span>}
                            </td>

                            <td>
                              {ed
                                ? <select value={r.content || ''} onChange={e => updateRowField(r.id, 'content', e.target.value)} className="inline-select">
                                    <option value="">—</option>
                                    {CONTENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                : <span style={{ fontSize: 12, color: 'var(--gray-6)' }}>{r.content || '—'}</span>}
                            </td>

                            <td>
                              {ed
                                ? <select value={rowBrand} onChange={e => updateRowField(r.id, 'brand', e.target.value)} className="inline-select"
                                    style={{ color: rowBrand ? rowColor : 'var(--gray-4)', border: `1px solid ${rowBrand ? rowColor : 'var(--gray-2)'}`, background: rowBrand ? rowColor + '18' : 'var(--gray-0)', fontWeight: rowBrand ? 600 : 400 }}>
                                    <option value="">—</option>
                                    {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                                  </select>
                                : rowBrand
                                  ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: rowColor + '18', color: rowColor, border: `1px solid ${rowColor}44` }}>{rowBrand}</span>
                                  : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                            </td>

                            <td>
                              <span style={{ fontSize: 12, fontWeight: 600, color: r.repost === 'O' ? 'var(--green)' : r.repost === '▲' ? '#ef4444' : 'var(--gray-3)' }}>
                                {r.repost || '—'}
                              </span>
                            </td>

                            <td>
                              {ed
                                ? <input type="text" value={link} placeholder="https://…" className="inline-select" style={{ width: 160, fontSize: 11 }}
                                    onChange={e => updateRowField(r.id, 'review_link', e.target.value)} />
                                : link
                                  ? <a href={link} target="_blank" rel="noopener" className="video-link">↗ 보기</a>
                                  : '—'}
                            </td>

                            <td className="num">
                              {ed
                                ? <input type="number" value={r.views || ''} className="inline-select" style={{ width: 70, fontSize: 11, textAlign: 'right' }}
                                    onChange={e => updateRowField(r.id, 'views', parseInt(e.target.value) || 0)} />
                                : r.views ? fmtNum(r.views) : '—'}
                            </td>

                            <td className="num">
                              {ed
                                ? <input type="number" value={r.likes || ''} className="inline-select" style={{ width: 70, fontSize: 11, textAlign: 'right' }}
                                    onChange={e => updateRowField(r.id, 'likes', parseInt(e.target.value) || 0)} />
                                : r.likes ? fmtNum(r.likes) : '—'}
                            </td>

                            <td className="num">
                              {ed
                                ? <input type="number" value={r.comments || ''} className="inline-select" style={{ width: 70, fontSize: 11, textAlign: 'right' }}
                                    onChange={e => updateRowField(r.id, 'comments', parseInt(e.target.value) || 0)} />
                                : r.comments ? fmtNum(r.comments) : '—'}
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
                          </tr>
                        )
                      })
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={uploadSafePage} totalPages={uploadTotalPages} total={groups.length}
                startIdx={uploadStartIdx} endIdx={uploadStartIdx + pagedGroups.length}
                onPrev={() => setUploadPage(p => Math.max(1, p - 1))}
                onNext={() => setUploadPage(p => Math.min(uploadTotalPages, p + 1))} />
              </>
            )
        })()}
      </>}
    </div>
  )
}
