import { useEffect, useState } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { fmtNum } from '../../../lib/utils'
import Spinner from '../../../components/Spinner'

const C = {
  PLATFORM   : 0,
  INFLUENCER : 1,
  HANDLE     : 2,
  DATE       : 3,
  LINK       : 4,
  VIEWS      : 5,
  LIKES      : 6,
  COMMENTS   : 7,
  UPDATED    : 8,
  KEYWORDS   : 9,
}

const BRANDS = ['mimuse', 'aesthen', 'joodoc', 'nesh', 'varuza'] as const
type Brand = typeof BRANDS[number]

const DEFAULT_BRAND_KEYWORDS: Record<Brand, string[]> = {
  mimuse:  ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', '#mimuse', '#미뮤즈', 'MiMuse Beauty'],
  aesthen: ['aesthen', '#aesthen'],
  joodoc:  ['joodoc', '#joodoc'],
  nesh:    ['nesh', '#nesh'],
  varuza:  ['varuza', '#varuza'],
}

const BRAND_COLORS: Record<Brand, string> = {
  mimuse:  '#3b82f6',
  aesthen: '#8b5cf6',
  joodoc:  '#ec4899',
  nesh:    '#f59e0b',
  varuza:  '#10b981',
}

const MEDIA_OPTIONS   = ['photo', 'video']
const CONTENT_OPTIONS = ['review video', 'unboxing', 'haul', 'tutorial', 'sponsored', 'other']

interface MonStats {
  totalInfluencers : number
  totalReviews     : number
  totalViews       : number
  totalLikes       : number
  totalComments    : number
  keywordCounts    : Record<string, number>
  lastRun          : string
}

interface MonitoringData {
  error?   : string
  headers? : string[]
  rows?    : string[][]
  stats?   : MonStats
}

type RowExtras = {
  media?  : string
  content?: string
  brand?  : string
  repost? : string
}

function fmtDate(val: string): string {
  if (!val) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toISOString().slice(0, 10)
}

function detectBrand(keywords: string, brandKws: Record<string, string[]>): string {
  if (!keywords) return ''
  const kwLower = keywords.toLowerCase()
  for (const brand of BRANDS) {
    const kws = brandKws[brand] || []
    if (kws.some(k => kwLower.includes(k.toLowerCase()))) return brand
  }
  return ''
}

export default function Monitoring() {
  const [data,    setData]    = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)

  const [brandKws,   setBrandKws]   = useState<Record<string, string[]>>(DEFAULT_BRAND_KEYWORDS)
  const [kwBrandTab, setKwBrandTab] = useState<Brand>('mimuse')
  const [kwEditMode, setKwEditMode] = useState(false)
  const [newKw,      setNewKw]      = useState('')
  const [kwSaving,   setKwSaving]   = useState(false)

  const [rowExtras, setRowExtras] = useState<Record<string, RowExtras>>(() => {
    try { return JSON.parse(localStorage.getItem('monitoring_row_extras') || '{}') }
    catch { return {} }
  })

  const [searchQuery,    setSearchQuery]    = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [brandFilter,    setBrandFilter]    = useState('all')

  useEffect(() => {
    loadMonitoring()
    loadKeywords()
  }, [])

  async function loadMonitoring() {
    setLoading(true)
    try {
      const d: MonitoringData = await gasGet('getMonitoringData')
      setData(d)
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
        setBrandKws({ ...DEFAULT_BRAND_KEYWORDS, ...(kws as Record<string, string[]>) })
      }
    } catch {
      // keep defaults
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

  function addKeyword() {
    const kw = newKw.trim()
    if (!kw) { setNewKw(''); return }
    const current = brandKws[kwBrandTab] || []
    if (current.includes(kw)) { setNewKw(''); return }
    const next = { ...brandKws, [kwBrandTab]: [...current, kw] }
    setBrandKws(next)
    setNewKw('')
    saveKeywords(next)
  }

  function removeKeyword(kw: string) {
    const current = brandKws[kwBrandTab] || []
    const next = { ...brandKws, [kwBrandTab]: current.filter(k => k !== kw) }
    setBrandKws(next)
    saveKeywords(next)
  }

  function updateRowExtra(link: string, field: keyof RowExtras, value: string) {
    const next = { ...rowExtras, [link]: { ...(rowExtras[link] || {}), [field]: value } }
    setRowExtras(next)
    localStorage.setItem('monitoring_row_extras', JSON.stringify(next))
  }

  const stats         = data?.stats
  const keywordCounts = stats?.keywordCounts || {}

  const rows = (data?.rows || []).filter(r => r && (r[C.INFLUENCER] || r[C.HANDLE]))

  const filteredRows = rows.filter(r => {
    const platform = (r[C.PLATFORM] || '').toLowerCase()
    if (platformFilter === 'tiktok'    && !platform.includes('tiktok'))    return false
    if (platformFilter === 'instagram' && !platform.includes('instagram')) return false

    if (brandFilter !== 'all') {
      const extras    = rowExtras[r[C.LINK]] || {}
      const autoBrand = detectBrand(r[C.KEYWORDS] || '', brandKws)
      const rowBrand  = extras.brand || autoBrand
      if (rowBrand !== brandFilter) return false
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const currentBrandKws = brandKws[kwBrandTab] || []
  const brandColor      = BRAND_COLORS[kwBrandTab]

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
          <button className="page-banner-btn page-banner-btn--secondary" onClick={loadMonitoring}>
            <span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침
          </button>
        </div>
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

      {/* Brand keyword config */}
      <div style={{ marginBottom: 20 }}>

        {/* Brand keyword config */}
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              브랜드별 감지 키워드
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

          {/* Brand tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {BRANDS.map(brand => (
              <button key={brand} onClick={() => setKwBrandTab(brand)} style={{
                fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                border: `1px solid ${BRAND_COLORS[brand]}`,
                background: kwBrandTab === brand ? BRAND_COLORS[brand] : BRAND_COLORS[brand] + '18',
                color: kwBrandTab === brand ? '#fff' : BRAND_COLORS[brand],
                cursor: 'pointer',
              }}>{brand}</button>
            ))}
          </div>

          {/* Keywords for selected brand */}
          <div>
            {currentBrandKws.length === 0
              ? <div style={{ color: 'var(--gray-4)', fontSize: 12 }}>키워드 없음</div>
              : currentBrandKws.map(kw => (
                <div key={kw} className="cfg-item">
                  <span style={{
                    flex: 1, fontSize: 12, fontWeight: 600,
                    color: brandColor,
                    background: brandColor + '18',
                    padding: '2px 8px', borderRadius: 20,
                  }}>{kw}</span>
                  {kwEditMode && (
                    <button onClick={() => removeKeyword(kw)}
                      style={{ background: 'none', border: 'none', color: 'var(--gray-5)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))
            }
          </div>
          {kwEditMode && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="mon-add-input"
                placeholder={`${kwBrandTab} 키워드 입력 후 Enter`}
                value={newKw}
                onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }} />
              <button className="cfg-btn" onClick={addKeyword}>추가</button>
            </div>
          )}
        </div>

      </div>

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
                    <th>모니터링 실행일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const handle   = (r[C.HANDLE]   || '').replace(/^@/, '')
                    // Column 1 (INFLUENCER) stores the actual content platform (TikTok/Instagram)
                    const contentPlatform = (r[C.INFLUENCER] || '').toLowerCase()
                    const link     = (r[C.LINK] || '').toLowerCase()
                    const isTikTok = contentPlatform.includes('tiktok') || link.includes('tiktok.com')
                    const profileUrl = isTikTok
                      ? `https://www.tiktok.com/@${handle}`
                      : `https://www.instagram.com/${handle}`
                    const runDate  = r[C.UPDATED] || ''
                    const showRunDate = runDate && !runDate.startsWith('http')

                    const extras    = rowExtras[r[C.LINK]] || {}
                    const autoBrand = detectBrand(r[C.KEYWORDS] || '', brandKws)
                    const rowBrand  = extras.brand || autoBrand
                    const rowColor  = BRAND_COLORS[rowBrand as Brand] || 'var(--gray-4)'

                    return (
                      <tr key={i}>
                        {/* no. */}
                        <td style={{ color: 'var(--gray-4)', fontSize: 11, textAlign: 'center' }}>{i + 1}</td>

                        {/* account */}
                        <td>
                          {isTikTok
                            ? <span className="platform-badge platform-tiktok">TikTok</span>
                            : <span className="platform-badge platform-instagram">Instagram</span>
                          }
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
                            value={extras.media || ''}
                            onChange={e => updateRowExtra(r[C.LINK], 'media', e.target.value)}
                            className="inline-select"
                          >
                            <option value="">—</option>
                            {MEDIA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>

                        {/* content */}
                        <td>
                          <select
                            value={extras.content || ''}
                            onChange={e => updateRowExtra(r[C.LINK], 'content', e.target.value)}
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
                            onChange={e => updateRowExtra(r[C.LINK], 'brand', e.target.value)}
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
                            value={extras.repost || ''}
                            onChange={e => updateRowExtra(r[C.LINK], 'repost', e.target.value)}
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
                          {r[C.LINK]
                            ? <a href={r[C.LINK]} target="_blank" rel="noopener" className="video-link">↗ 보기</a>
                            : '—'}
                        </td>

                        {/* 조회수 */}
                        <td className="num">{r[C.VIEWS] ? fmtNum(r[C.VIEWS]) : '—'}</td>

                        {/* 좋아요 수 */}
                        <td className="num">{r[C.LIKES] ? fmtNum(r[C.LIKES]) : '—'}</td>

                        {/* 댓글 수 */}
                        <td className="num">{r[C.COMMENTS] ? fmtNum(r[C.COMMENTS]) : '—'}</td>

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
