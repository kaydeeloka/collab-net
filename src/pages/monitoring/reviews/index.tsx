import { useEffect, useState, useCallback } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { fmtNum } from '../../../lib/utils'
import Spinner from '../../../components/Spinner'

// Column indices — matches sheet: 플랫폼|계정|핸들|영상일|링크|조회수|좋아요|댓글|최종업데이트
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

// Keyword badge colours (cycles through this list)
const KW_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
]

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

export default function Monitoring() {
  const [data,    setData]    = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)

  const [keywords,   setKeywords]   = useState<string[]>([])
  const [kwEditMode, setKwEditMode] = useState(false)
  const [newKw,      setNewKw]      = useState('')
  const [kwSaving,   setKwSaving]   = useState(false)

  const [searchQuery,     setSearchQuery]     = useState('')
  const [platformFilter,  setPlatformFilter]  = useState('all')
  const [keywordFilter,   setKeywordFilter]   = useState('all')

  // Map keyword → stable colour for consistent badge colours
  const kwColorMap = useCallback((kw: string) => {
    const idx = keywords.indexOf(kw)
    return KW_COLORS[(idx >= 0 ? idx : kw.charCodeAt(0)) % KW_COLORS.length]
  }, [keywords])

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
      const kws: string[] = await gasGet('getMonitoringKeywords')
      setKeywords(kws)
    } catch {
      // keep empty
    }
  }

  async function saveKeywords(next: string[]) {
    setKwSaving(true)
    try {
      await gasPost({ action: 'saveMonitoringKeywords', keywords: next })
    } catch {
      // silently fail — keywords are still shown from local state
    }
    setKwSaving(false)
  }

  function addKeyword() {
    const kw = newKw.trim()
    if (!kw || keywords.includes(kw)) { setNewKw(''); return }
    const next = [...keywords, kw]
    setKeywords(next)
    setNewKw('')
    saveKeywords(next)
  }

  function removeKeyword(kw: string) {
    const next = keywords.filter(k => k !== kw)
    setKeywords(next)
    saveKeywords(next)
  }

  const rows         = (data?.rows || []).filter(r => r && (r[C.INFLUENCER] || r[C.HANDLE]))
  const stats        = data?.stats
  const keywordCounts = stats?.keywordCounts || {}

  const reviewRows = rows.filter(r => r[C.LINK] && r[C.LINK].startsWith('http'))

  const filteredRows = reviewRows.filter(r => {
    const platform = (r[C.PLATFORM] || '').toLowerCase()
    if (platformFilter === 'tiktok'    && !platform.includes('tiktok'))    return false
    if (platformFilter === 'instagram' && !platform.includes('instagram')) return false

    const kws = (r[C.KEYWORDS] || '').toLowerCase()
    if (keywordFilter !== 'all' && !kws.includes(keywordFilter.toLowerCase())) return false

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

      {/* Keyword manager + keyword hit summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Keyword config */}
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              감지 키워드 설정
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
          <div>
            {keywords.map((kw, i) => (
              <div key={kw} className="cfg-item">
                <span style={{
                  flex: 1, fontSize: 12, fontWeight: 600,
                  color: KW_COLORS[i % KW_COLORS.length],
                  background: KW_COLORS[i % KW_COLORS.length] + '18',
                  padding: '2px 8px', borderRadius: 20,
                }}>{kw}</span>
                {kwEditMode && (
                  <button onClick={() => removeKeyword(kw)}
                    style={{ background: 'none', border: 'none', color: 'var(--gray-5)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>×</button>
                )}
              </div>
            ))}
          </div>
          {kwEditMode && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="mon-add-input" placeholder="키워드 입력 후 Enter"
                value={newKw} onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }} />
              <button className="cfg-btn" onClick={addKeyword}>추가</button>
            </div>
          )}
        </div>

        {/* Keyword hit counts */}
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 14 }}>
            키워드별 감지 횟수
          </div>
          {Object.keys(keywordCounts).length === 0 ? (
            <div style={{ color: 'var(--gray-4)', fontSize: 13 }}>감지된 키워드 없음</div>
          ) : (
            Object.entries(keywordCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([kw, cnt]) => (
                <div key={kw} className="cfg-item" style={{ justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: kwColorMap(kw),
                    background: kwColorMap(kw) + '18',
                    padding: '2px 8px', borderRadius: 20,
                  }}>{kw}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)' }}>{cnt}회</span>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="인플루언서명, 핸들, 키워드 검색..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 320 }} />
        <div className="filter-group">
          <label>플랫폼:</label>
          {[['all', '전체'], ['tiktok', 'TikTok'], ['instagram', 'Instagram']].map(([v, l]) => (
            <button key={v} className={'ems-filter-btn' + (platformFilter === v ? ' active' : '')}
              onClick={() => setPlatformFilter(v)}>{l}</button>
          ))}
        </div>
        <div className="filter-group">
          <label>키워드:</label>
          <button className={'ems-filter-btn' + (keywordFilter === 'all' ? ' active' : '')}
            onClick={() => setKeywordFilter('all')}>전체</button>
          {keywords.map(kw => (
            <button key={kw} className={'ems-filter-btn' + (keywordFilter === kw ? ' active' : '')}
              onClick={() => setKeywordFilter(keywordFilter === kw ? 'all' : kw)}>{kw}</button>
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
                    <th>인플루언서명</th>
                    <th>리뷰콘텐츠링크</th>
                    <th>업로드일자</th>
                    <th className="num">조회수</th>
                    <th className="num">좋아요수</th>
                    <th className="num">댓글수</th>
                    <th>감지 키워드</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const handle   = (r[C.HANDLE]   || '').replace(/^@/, '')
                    const platform = (r[C.PLATFORM]  || '').toLowerCase()
                    const isTikTok = platform.includes('tiktok')
                    const profileUrl = isTikTok
                      ? `https://www.tiktok.com/@${handle}`
                      : `https://www.instagram.com/${handle}`

                    const detectedKws = (r[C.KEYWORDS] || '').split(',').map(k => k.trim()).filter(Boolean)

                    return (
                      <tr key={i}>
                        {/* 인플루언서명 */}
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r[C.INFLUENCER] || '—'}</div>
                          {handle && (
                            <a href={profileUrl} target="_blank" rel="noopener"
                              style={{ fontSize: 11, color: 'var(--gray-5)', textDecoration: 'none' }}>
                              @{handle}
                              {isTikTok
                                ? <span className="platform-badge platform-tiktok" style={{ marginLeft: 4, fontSize: 9 }}>TK</span>
                                : <span className="platform-badge platform-instagram" style={{ marginLeft: 4, fontSize: 9 }}>IG</span>
                              }
                            </a>
                          )}
                        </td>

                        {/* 리뷰콘텐츠링크 */}
                        <td>
                          {r[C.LINK]
                            ? <a href={r[C.LINK]} target="_blank" rel="noopener" className="video-link">↗ 콘텐츠 보기</a>
                            : '—'}
                        </td>

                        {/* 업로드일자 */}
                        <td style={{ fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap' }}>
                          {r[C.DATE] || '—'}
                        </td>

                        {/* 조회수 */}
                        <td className="num">{r[C.VIEWS] ? fmtNum(r[C.VIEWS]) : '—'}</td>

                        {/* 좋아요수 */}
                        <td className="num">{r[C.LIKES] ? fmtNum(r[C.LIKES]) : '—'}</td>

                        {/* 댓글수 */}
                        <td className="num">{r[C.COMMENTS] ? fmtNum(r[C.COMMENTS]) : '—'}</td>

                        {/* 감지 키워드 */}
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {detectedKws.length === 0
                              ? <span style={{ color: 'var(--gray-4)', fontSize: 12 }}>—</span>
                              : detectedKws.map(kw => (
                                <span key={kw} style={{
                                  fontSize: 11, fontWeight: 600,
                                  color: kwColorMap(kw),
                                  background: kwColorMap(kw) + '20',
                                  border: `1px solid ${kwColorMap(kw)}40`,
                                  padding: '2px 7px', borderRadius: 20,
                                  whiteSpace: 'nowrap',
                                }}>{kw}</span>
                              ))
                            }
                          </div>
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
