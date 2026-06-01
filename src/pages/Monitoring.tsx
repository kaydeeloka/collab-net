import { useEffect, useState } from 'react'
import { gasGet } from '../lib/api'
import { fmtNum } from '../lib/utils'
import Spinner from '../components/Spinner'

const DEFAULT_KEYWORDS = ['MiMuse', '미뮤즈', '#MiMuse', '#미뮤즈', 'mimuse', 'MiMuse Beauty']
const DEFAULT_BRANDS = ['Laneige', 'Innisfree', 'COSRX', 'Glow Recipe', 'Some By Mi']

function loadMonCfg<T>(key: string, def: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def }
}
function saveMonCfg<T>(key: string, val: T) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

interface MonitoringData {
  error?: string
  stats?: { totalInfluencers?: number; mentions?: number }
  rows?: string[][]
  headers?: string[]
}

export default function Monitoring() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(false)

  const [keywords, setKeywords] = useState<string[]>(() => loadMonCfg('mon_keywords', DEFAULT_KEYWORDS))
  const [brands, setBrands] = useState<string[]>(() => loadMonCfg('mon_brands', DEFAULT_BRANDS))

  const [kwEditMode, setKwEditMode] = useState(false)
  const [bcEditMode, setBcEditMode] = useState(false)
  const [newKw, setNewKw] = useState('')
  const [newBc, setNewBc] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [mentionFilter, setMentionFilter] = useState('all')

  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { loadMonitoring() }, [])

  async function loadMonitoring() {
    setLoading(true)
    try {
      const d: MonitoringData = await gasGet('getMonitoringData')
      setData(d)
    } catch (e: unknown) { setData({ error: (e as Error).message }) }
    setLoading(false)
  }

  function getColMap(headers: string[]): Record<string, number> {
    const m: Record<string, number> = {}
    headers.forEach((h, i) => { m[h.trim().toLowerCase()] = i })
    return m
  }

  const headers = data?.headers || []
  const cm = getColMap(headers)
  const rows = (data?.rows || []).filter(r => r && (r[0] || r[1]))

  const filteredRows = rows.filter(r => {
    const platform = (r[cm['platform'] ?? 2] || '').toLowerCase()
    if (platformFilter !== 'all') {
      if (platformFilter === 'tiktok' && !platform.includes('tiktok')) return false
      if (platformFilter === 'instagram' && !platform.includes('instagram')) return false
    }
    const mention = (r[cm['mention'] ?? cm['mimuse mention'] ?? 3] || '').toLowerCase()
    if (mentionFilter === 'yes' && !mention.includes('yes')) return false
    if (mentionFilter === 'no' && mention.includes('yes')) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!r.join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = data?.stats || {}
  const total = stats.totalInfluencers ?? rows.length
  const mentioned = stats.mentions ?? rows.filter(r => (r[cm['mention'] ?? 3] || '').toLowerCase().includes('yes')).length

  function addKeyword() {
    if (!newKw.trim() || keywords.includes(newKw.trim())) { setNewKw(''); return }
    const next = [...keywords, newKw.trim()]
    setKeywords(next); saveMonCfg('mon_keywords', next); setNewKw('')
  }
  function removeKeyword(kw: string) {
    const next = keywords.filter(k => k !== kw)
    setKeywords(next); saveMonCfg('mon_keywords', next)
  }
  function addBrand() {
    if (!newBc.trim() || brands.includes(newBc.trim())) { setNewBc(''); return }
    const next = [...brands, newBc.trim()]
    setBrands(next); saveMonCfg('mon_brands', next); setNewBc('')
  }
  function removeBrand(b: string) {
    const next = brands.filter(k => k !== b)
    setBrands(next); saveMonCfg('mon_brands', next)
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📡</span>
        <div>
          <div className="page-banner-title">인플루언서 실시간 모니터링 시스템</div>
          <div className="page-banner-desc">협업 크리에이터의 TikTok &amp; Instagram 콘텐츠를 자동으로 스캔하여 MiMuse 브랜드 언급 여부를 실시간으로 추적합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={loadMonitoring}><span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침 (Sync)</button>
        </div>
      </div>

      {/* Stats */}
      <div className="cards">
        <div className="card"><div className="card-label">모니터링 중</div><div className="card-value">{total}</div></div>
        <div className="card highlight"><div className="card-label">MiMuse 언급</div><div className="card-value" style={{ color: 'var(--blue-dk)' }}>{mentioned}</div></div>
        <div className="card"><div className="card-label">미언급</div><div className="card-value">{total - mentioned}</div></div>
      </div>

      {/* Keywords & Brand Collab */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          {
            title: '모니터링 키워드', editMode: kwEditMode, setEdit: setKwEditMode,
            items: keywords, newVal: newKw, setNewVal: setNewKw, onAdd: addKeyword, onRemove: removeKeyword,
            storageKey: 'mon_keywords', defaults: DEFAULT_KEYWORDS,
            placeholder: '키워드 입력 후 Enter 또는 + 추가',
          },
          {
            title: '브랜드 협업 목록', editMode: bcEditMode, setEdit: setBcEditMode,
            items: brands, newVal: newBc, setNewVal: setNewBc, onAdd: addBrand, onRemove: removeBrand,
            storageKey: 'mon_brands', defaults: DEFAULT_BRANDS,
            placeholder: '브랜드명 입력 후 Enter 또는 + 추가',
          },
        ].map(cfg => (
          <div key={cfg.title} style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{cfg.title}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!cfg.editMode
                  ? <button className="cfg-btn" onClick={() => cfg.setEdit(true)}>편집</button>
                  : <>
                    <button className="cfg-btn" onClick={() => { cfg.onAdd(); }}>+ 추가</button>
                    <button className="cfg-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }} onClick={() => cfg.setEdit(false)}>저장</button>
                    <button className="cfg-btn cfg-btn--ghost" onClick={() => {
                      if (confirm('초기화하시겠습니까?')) {
                        if (cfg.storageKey === 'mon_keywords') { setKeywords([...DEFAULT_KEYWORDS]); saveMonCfg('mon_keywords', DEFAULT_KEYWORDS) }
                        else { setBrands([...DEFAULT_BRANDS]); saveMonCfg('mon_brands', DEFAULT_BRANDS) }
                      }
                    }}>↺</button>
                  </>
                }
              </div>
            </div>
            <div>
              {cfg.items.map(item => (
                <div key={item} className="cfg-item">
                  <span style={{ flex: 1, fontSize: 13 }}>{item}</span>
                  {cfg.editMode && (
                    <button onClick={() => cfg.onRemove(item)}
                      style={{ background: 'none', border: 'none', color: 'var(--gray-5)', cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            {cfg.editMode && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input className="mon-add-input" placeholder={cfg.placeholder} value={cfg.newVal} onChange={e => cfg.setNewVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); cfg.onAdd() } }} />
                <button className="cfg-btn" onClick={cfg.onAdd}>추가</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="이름, 핸들, 키워드로 검색..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 320 }} />
        <div className="filter-group">
          <label>플랫폼:</label>
          {[['all', '전체'], ['tiktok', 'TikTok'], ['instagram', 'Instagram']].map(([v, l]) => (
            <button key={v} className={'ems-filter-btn' + (platformFilter === v ? ' active' : '')} onClick={() => setPlatformFilter(v)}>{l}</button>
          ))}
        </div>
        <div className="filter-group">
          <label>언급 여부:</label>
          {[['all', '전체'], ['yes', '언급'], ['no', '미언급']].map(([v, l]) => (
            <button key={v} className={'ems-filter-btn' + (mentionFilter === v ? ' active' : '')} onClick={() => setMentionFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
      {!loading && data?.error && <div className="empty">오류: {data.error}</div>}
      {!loading && !data?.error && (
        filteredRows.length === 0
          ? <div className="empty">데이터가 없습니다.</div>
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {headers.length > 0
                      ? headers.map(h => <th key={h}>{h}</th>)
                      : ['핸들', '이름', '플랫폼', '언급 여부', '마지막 콘텐츠', '링크'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => {
                    const mentionCol = cm['mention'] ?? cm['mimuse mention'] ?? 3
                    const mentioned = (r[mentionCol] || '').toLowerCase().includes('yes')
                    return (
                      <tr key={i} className={mentioned ? 'mentioned' : ''}>
                        {headers.length > 0
                          ? headers.map((h, ci) => {
                              const cell = r[ci] || ''
                              const hl = h.toLowerCase()
                              if (hl === 'platform') {
                                const pl = cell.toLowerCase()
                                return <td key={ci}>
                                  {pl.includes('tiktok') ? <span className="platform-badge platform-tiktok">TikTok</span>
                                    : pl.includes('instagram') ? <span className="platform-badge platform-instagram">Instagram</span>
                                    : <span>{cell}</span>}
                                </td>
                              }
                              if (hl.includes('mention')) {
                                return <td key={ci}>
                                  {cell.toLowerCase().includes('yes')
                                    ? <span className="mention-badge">✓ MiMuse 언급</span>
                                    : <span className="no-mention">—</span>}
                                </td>
                              }
                              if (hl.includes('link') || hl.includes('url') || hl.includes('video')) {
                                return <td key={ci}>{cell ? <a href={cell} target="_blank" rel="noopener" className="video-link">↗ 보기</a> : '—'}</td>
                              }
                              if (hl.includes('follower') || hl.includes('view') || hl.includes('like')) {
                                return <td key={ci} className="num">{cell ? fmtNum(cell) : '—'}</td>
                              }
                              if (hl.includes('handle') || hl.includes('@')) {
                                return <td key={ci}><a href={`https://www.tiktok.com/@${cell}`} target="_blank" rel="noopener" style={{ color: 'var(--gray-8)', textDecoration: 'none', fontWeight: 500 }}>@{cell}</a></td>
                              }
                              return <td key={ci}>{cell || '—'}</td>
                            })
                          : <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)' }}>{r.join(' | ')}</td>
                        }
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
