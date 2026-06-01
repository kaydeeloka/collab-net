import { useEffect, useState, useCallback } from 'react'
import { gasGet, gasPost } from '../lib/api'
import { fmtNum, escHtml } from '../lib/utils'
import Spinner from '../components/Spinner'
import ConfirmToast, { useConfirmToast } from '../components/ConfirmToast'

type ListupTab = 'settings' | 'apify' | 'search' | 'database'

const DEFAULT_KBEAUTY_KEYWORDS = ['glassskin','kbeauty','koreanbeauty','koreanskincare','kbeautyreview','kbeautyroutine','koreanskincaeroutine','kbeautyproducts','kbeautyaddict','koreanmakeup','oliveyoung','kbeautyskincare']
const DEFAULT_BEAUTY_KEYWORDS  = ['beautyreview','skincare','makeuptips','beautycreator','beautytok','makeuphaul','beautyhacks','beautyinfluencer']
const DEFAULT_TIERS = [
  { rank:'1순위', label:'마이크로 (10K~50K)',  minF:10000,  maxF:50000,  tags:'kbeauty', category:'K-뷰티' },
  { rank:'2순위', label:'마이크로 (10K~50K)',  minF:10000,  maxF:50000,  tags:'beauty',  category:'일반뷰티' },
  { rank:'3순위', label:'나노 (3K~10K)',       minF:3000,   maxF:9999,   tags:'kbeauty', category:'K-뷰티' },
  { rank:'4순위', label:'나노 (3K~10K)',       minF:3000,   maxF:9999,   tags:'beauty',  category:'일반뷰티' },
  { rank:'5순위', label:'마이크로 (60K~100K)', minF:60000,  maxF:100000, tags:'kbeauty', category:'K-뷰티' },
]

const DB_TIERS = ['1순위','2순위','3순위','4순위','5순위']

function loadCfg<T>(key: string, def: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def } catch { return def }
}
function saveCfg<T>(key: string, val: T) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

interface Tier { rank: string; label: string; minF: number; maxF: number; tags: string; category: string }
interface FilterCond { cat: string; desc: string }

interface InfluencerData {
  error?: string
  _debug?: { kbRows: number; beRows: number; rankCol: string; sampleRanks: unknown[] }
  [key: string]: unknown
}

interface TierData {
  stats?: { total?: number; totalFollowers?: number }
  headers?: string[]
  colIdx?: Record<string, number>
  rows?: string[][]
  rowNums?: number[]
  sheetNames?: string[]
}

export default function Listup() {
  const [activeTab, setActiveTab] = useState<ListupTab>('settings')
  const { state: confirmState, show: showConfirm, hide: hideConfirm } = useConfirmToast()

  // Config state
  const [tiers, setTiers] = useState<Tier[]>(() => loadCfg('mm_tiers', DEFAULT_TIERS))
  const [tierEditMode, setTierEditMode] = useState(false)
  const [kbeautyKws, setKbeautyKws] = useState<string[]>(() => loadCfg('mm_kbeauty_kws', DEFAULT_KBEAUTY_KEYWORDS))
  const [beautyKws, setBeautyKws] = useState<string[]>(() => loadCfg('mm_beauty_kws', DEFAULT_BEAUTY_KEYWORDS))
  const [kbeautyEdit, setKbeautyEdit] = useState(false)
  const [beautyEdit, setBeautyEdit] = useState(false)
  const [newKbeautyKw, setNewKbeautyKw] = useState('')
  const [newBeautyKw, setNewBeautyKw] = useState('')

  const FILTER_COND_DEFAULT: FilterCond[] = [
    { cat: '팔로잉 비율', desc: '팔로잉 수가 팔로워 수의 70% 초과 시 제외' },
    { cat: '업로드 주기', desc: '최근 1개월 이내 업로드 콘텐츠가 없는 계정 제외' },
    { cat: '나이대',      desc: '10대 ~ 30대 계정' },
    { cat: '국가',        desc: '미국, 그 중에서도 북미 메인 타겟' },
    { cat: '중복',        desc: '1~5순위까지의 중복 계정 필터링' },
    { cat: '영상 퀄리티', desc: '영상 콘텐츠 퀄리티 기준 수기 검토 예정' },
  ]
  const [filterConds, setFilterConds] = useState<FilterCond[]>(() => loadCfg('mimuse_filter_conds', FILTER_COND_DEFAULT))
  const [filterEditMode, setFilterEditMode] = useState(false)

  // Apify state
  const [apifyTierIdx, setApifyTierIdx] = useState<number | null>(null)
  const [apifyPostsPerTag, setApifyPostsPerTag] = useState(20)
  const [apifyStatus, setApifyStatus] = useState('')
  const [apifyLoading, setApifyLoading] = useState(false)
  const [apifyResults, setApifyResults] = useState<string[][] | null>(null)
  const [apifyRunId, setApifyRunId] = useState('')
  const [apifyDatasetId, setApifyDatasetId] = useState('')

  // TCM state
  const [tcmTier, setTcmTier] = useState('')
  const [tcmKeyword, setTcmKeyword] = useState('')
  const [tcmTargetCount, setTcmTargetCount] = useState(20)
  const [tcmLoading, setTcmLoading] = useState(false)
  const [tcmStatus, setTcmStatus] = useState('')
  const [tcmResults, setTcmResults] = useState<string[][] | null>(null)
  const [tcmCategory, setTcmCategory] = useState('')

  // DB state
  const [listupData, setListupData] = useState<InfluencerData | null>(null)
  const [listupLoaded, setListupLoaded] = useState(false)
  const [listupLoading, setListupLoading] = useState(false)
  const [currentDbTab, setCurrentDbTab] = useState('전체')
  const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set())
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function switchTab(t: ListupTab) {
    setActiveTab(t)
    if (t === 'database' && !listupLoaded) loadListup()
  }

  async function loadListup() {
    setListupLoaded(true)
    setListupLoading(true)
    try {
      const data: InfluencerData = await gasGet('getInfluencerList')
      // build combined '전체' tier
      const firstTier = DB_TIERS.find(t => (data[t] as TierData)?.headers?.length)
      if (firstTier) {
        const base = data[firstTier] as TierData
        const allRows: string[][] = [], allNums: number[] = [], allNames: string[] = []
        DB_TIERS.forEach(t => {
          const td = data[t] as TierData
          ;(td?.rows || []).forEach((r, i) => {
            allRows.push([...r])
            allNums.push((td.rowNums || [])[i])
            allNames.push((td.sheetNames || [])[i] || '')
          })
        })
        data['전체'] = { headers: base.headers, colIdx: base.colIdx, rows: allRows, rowNums: allNums, sheetNames: allNames }
      }
      // pre-hide columns
      const firstTierData = firstTier ? data[firstTier] as TierData : null
      if (firstTierData?.headers) {
        const hide = new Set<number>()
        firstTierData.headers.forEach((h, i) => {
          const l = h.toLowerCase().trim()
          if (l === 'profile url' || l === 'outreach') hide.add(i)
        })
        setHiddenCols(hide)
      }
      setListupData(data)
    } catch (e: unknown) {
      setListupData({ error: (e as Error).message })
    }
    setListupLoading(false)
  }

  async function deleteDbRow(tier: string, sheetRow: number, sheetName: string) {
    if (!confirm('이 크리에이터를 삭제하시겠습니까?')) return
    try {
      const result: { ok?: boolean; error?: string } = await gasPost({ action: 'deleteInfluencerRow', sheetRow, sheetName })
      if (!result.ok) { alert('오류: ' + result.error); return }
      // update local data
      if (listupData) {
        const updated = { ...listupData }
        ;[tier, '전체'].forEach(t => {
          const td = updated[t] as TierData
          if (!td) return
          const idx = (td.rowNums || []).findIndex((rn, j) => rn === sheetRow && (td.sheetNames || [])[j] === sheetName)
          if (idx >= 0) {
            td.rows = td.rows?.filter((_, i) => i !== idx)
            td.rowNums = td.rowNums?.filter((_, i) => i !== idx)
            td.sheetNames = td.sheetNames?.filter((_, i) => i !== idx)
          }
        })
        setListupData({ ...updated })
      }
    } catch (e: unknown) { alert('오류: ' + (e as Error).message) }
  }

  // TCM search
  async function startTcmSearch() {
    if (!tcmTier) { setTcmStatus('티어를 먼저 선택하세요.'); return }
    if (!tcmKeyword) { setTcmStatus('키워드를 선택하세요.'); return }
    setTcmLoading(true)
    setTcmStatus('탐색 중...')
    setTcmResults(null)
    try {
      const tier = tiers.find(t => t.rank === tcmTier) || {}
      const res: { error?: string; rows?: string[][]; category?: string; stats?: Record<string, unknown>; tierLabel?: string } = await gasPost({
        action: 'tcmRunSearch',
        params: { tierRank: tcmTier, targetCount: tcmTargetCount, keyword: tcmKeyword, minF: (tier as Tier).minF, maxF: (tier as Tier).maxF },
      })
      if (res.error) { setTcmStatus('오류: ' + res.error); return }
      setTcmResults(res.rows || [])
      setTcmCategory(res.category || '')
      const st = res.stats || {}
      setTcmStatus(`완료: ${(res.rows || []).length}명 신규 (${res.tierLabel || tcmTier})`)
    } catch (e: unknown) { setTcmStatus('오류: ' + (e as Error).message) }
    setTcmLoading(false)
  }

  async function saveTcmToSheet() {
    if (!tcmResults?.length) return
    const kRows = tcmCategory === 'K-뷰티' ? tcmResults : []
    const bRows = tcmCategory === '뷰티' ? tcmResults : []
    try {
      const res: { error?: string; kCount?: number; bCount?: number; kDupes?: number; bDupes?: number } = await gasPost({ action: 'tcmSaveToSheet', kRows, bRows })
      if (res.error) { alert('오류: ' + res.error); return }
      const saved = (res.kCount || 0) + (res.bCount || 0)
      const dupes = (res.kDupes || 0) + (res.bDupes || 0)
      alert(`${saved}명 저장${dupes > 0 ? ` (${dupes}명 중복 제외)` : ''}`)
    } catch (e: unknown) { alert('오류: ' + (e as Error).message) }
  }

  function getFilteredRows(tier: string) {
    if (!listupData) return { rows: [], rowNums: [], sheetNames: [] }
    const td = listupData[tier] as TierData
    if (!td) return { rows: [], rowNums: [], sheetNames: [] }
    const C = td.colIdx || {}
    const hdr = td.headers || []
    const search = (searchTerms[tier] || '').toLowerCase()
    const dateCol = hdr.findIndex(h => { const l = h.toLowerCase(); return l.includes('timestamp') || l.includes('date') || l.includes('추가일') })

    const filtered = (td.rows || [])
      .map((r, i) => ({ row: r, sheetRow: (td.rowNums || [])[i], sheetName: (td.sheetNames || [])[i] || '' }))
      .filter(({ row }) => {
        if (search && !(row[C.name] || '').toLowerCase().includes(search) && !(row[C.handle] || '').toLowerCase().includes(search)) return false
        if (dateCol >= 0 && (dateFrom || dateTo)) {
          const cellDate = (row[dateCol] || '').toString().substring(0, 10)
          if (dateFrom && cellDate < dateFrom) return false
          if (dateTo && cellDate > dateTo) return false
        }
        return true
      })
    return { rows: filtered.map(x => x.row), rowNums: filtered.map(x => x.sheetRow), sheetNames: filtered.map(x => x.sheetName) }
  }

  function renderDbTable(tier: string) {
    if (!listupData) return null
    const td = listupData[tier] as TierData
    if (!td) return null
    const C = td.colIdx || {}
    const hdr = td.headers || []
    const { rows, rowNums, sheetNames } = getFilteredRows(tier)
    const profileCol = hdr.findIndex(h => h.toLowerCase().includes('profile') && h.toLowerCase().includes('url'))
    const aiCol = hdr.findIndex(h => h.toLowerCase().includes('ai') && h.toLowerCase().includes('분석'))
    const visCols = hdr.map((_, i) => i).filter(i => !hiddenCols.has(i))
    const dateCol = hdr.findIndex(h => { const l = h.toLowerCase(); return l.includes('timestamp') || l.includes('date') || l.includes('추가일') })
    const orderedCols = dateCol > 0 ? [dateCol, ...visCols.filter(i => i !== dateCol)] : visCols

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {orderedCols.map(i => <th key={i}>{hdr[i]}</th>)}
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={orderedCols.length + 1} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-5)' }}>데이터가 없습니다</td></tr>
            ) : rows.map((r, i) => {
              const aiText = aiCol >= 0 ? (r[aiCol] || '') : ''
              let acctBg = ''
              if (aiText.includes('적합하지 않다')) acctBg = 'background:#ffd6d6'
              else if (aiText.includes('적합해 보인다')) acctBg = 'background:#fff9c4'
              else if (aiText.includes('적합하다')) acctBg = 'background:#d4edda'

              return (
                <tr key={i}>
                  {orderedCols.map(ci => {
                    const cell = r[ci] || ''
                    const bg = ci === (C.name >= 0 ? C.name : C.handle) ? acctBg : ''
                    if (ci === profileCol && cell)
                      return <td key={ci} style={{ background: bg || undefined }}><a href={cell} target="_blank" style={{ color: 'var(--blue-dk)', textDecoration: 'underline', fontSize: 13 }}>{cell}</a></td>
                    if (ci === C.handle && cell)
                      return <td key={ci} style={{ background: bg || undefined }}><a href={`https://www.tiktok.com/@${cell}`} target="_blank" rel="noopener" style={{ color: 'var(--gray-8)', textDecoration: 'none', fontWeight: 500 }}>@{cell}</a></td>
                    if (ci === C.email)
                      return cell && cell.includes('@')
                        ? <td key={ci} style={{ background: bg || undefined }}><a href={`mailto:${cell}`} style={{ color: '#1558b0', fontSize: 13 }}>{cell}</a></td>
                        : <td key={ci} style={{ background: bg || undefined }}><span style={{ color: 'var(--gray-5)' }}>{cell || '—'}</span></td>
                    if ([C.followers, C.following, C.avgView, C.totalLikes, C.videoCount].includes(ci) && !isNaN(parseFloat(cell.replace(/,/g, ''))))
                      return <td key={ci} className="num" style={{ background: bg || undefined }}>{fmtNum(cell)}</td>
                    return <td key={ci} style={{ background: bg || undefined }}>{cell}</td>
                  })}
                  <td>
                    {rowNums[i] && (
                      <button
                        onClick={() => deleteDbRow(tier, rowNums[i], sheetNames[i])}
                        style={{ padding: '3px 10px', background: '#fee', border: '1px solid #fcc', borderRadius: 4, fontSize: 13, cursor: 'pointer', color: '#c00' }}
                      >✗</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const tcmKws = tcmTier ? (tiers.find(t => t.rank === tcmTier)?.tags === 'kbeauty' ? kbeautyKws : beautyKws) : []

  return (
    <div className="page page--fill" id="page-listup">
      <div className="page-banner">
        <span className="page-banner-deco">👥</span>
        <div>
          <div className="page-banner-title">인플루언서 리스트업 &amp; 크리에이터 DB 관리</div>
          <div className="page-banner-desc">Apify 및 TCM을 통해 조건에 맞는 TikTok/Instagram 크리에이터를 탐색하고, 1~5순위 티어로 분류하여 아웃리치 파이프라인에 연결합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={() => switchTab('apify')}>Apify 탐색</button>
          <button className="page-banner-btn page-banner-btn--secondary" onClick={() => switchTab('database')}>인플루언서 DB</button>
          <button className="page-banner-btn page-banner-btn--secondary" onClick={() => { setListupLoaded(false); switchTab('database') }}><span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침 (Sync)</button>
        </div>
      </div>

      <div className="ftab-bar">
        {(['settings', 'apify', 'search', 'database'] as ListupTab[]).map((t, i) => (
          <button key={t} className={'ftab' + (activeTab === t ? ' active' : '')} onClick={() => switchTab(t)}>
            {['크리에이터 조건', 'Apify 탐색', 'TCM 탐색', '인플루언서 DB'][i]}
          </button>
        ))}
      </div>

      <div className="ftab-content">

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Filter conditions */}
              <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>인플루언서 필터링 조건</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!filterEditMode
                      ? <button className="cfg-btn" onClick={() => setFilterEditMode(true)}>편집</button>
                      : <>
                        <button className="cfg-btn" onClick={() => setFilterConds(prev => [...prev, { cat: '구분', desc: '내용을 입력하세요' }])}>+ 추가</button>
                        <button className="cfg-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }} onClick={() => { saveCfg('mimuse_filter_conds', filterConds); setFilterEditMode(false) }}>저장</button>
                        <button className="cfg-btn cfg-btn--ghost" title="기본값으로 초기화" onClick={() => { setFilterConds(FILTER_COND_DEFAULT); }}>↺</button>
                      </>
                    }
                  </div>
                </div>
                <div className="table-wrap">
                  <table style={{ minWidth: 0 }}>
                    <thead><tr><th>NO.</th><th>구분</th><th>내용</th>{filterEditMode && <th></th>}</tr></thead>
                    <tbody>
                      {filterConds.map((fc, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: 'center', width: 32, color: 'var(--gray-6)' }}>{i + 1}</td>
                          <td style={{ whiteSpace: 'normal' }}>
                            {filterEditMode
                              ? <input className="cfg-input" value={fc.cat} onChange={e => setFilterConds(prev => prev.map((c, j) => j === i ? { ...c, cat: e.target.value } : c))} />
                              : fc.cat}
                          </td>
                          <td style={{ whiteSpace: 'normal', maxWidth: 'none', overflow: 'visible' }}>
                            {filterEditMode
                              ? <input className="cfg-input" style={{ width: '100%' }} value={fc.desc} onChange={e => setFilterConds(prev => prev.map((c, j) => j === i ? { ...c, desc: e.target.value } : c))} />
                              : fc.desc}
                          </td>
                          {filterEditMode && (
                            <td><button className="cfg-btn cfg-btn--danger" onClick={() => showConfirm(`"${fc.cat}" 조건을 삭제할까요?`, () => setFilterConds(prev => prev.filter((_, j) => j !== i)))}>✕</button></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tier table */}
              <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>우선순위 티어 설정</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="cfg-btn" onClick={() => { if (tierEditMode) { saveCfg('mm_tiers', tiers) } setTierEditMode(!tierEditMode) }}>
                      {tierEditMode ? '✓ 완료' : '편집'}
                    </button>
                    <button className="cfg-btn cfg-btn--ghost" onClick={() => { if (confirm('순위표를 기본값으로 초기화하시겠습니까?')) { setTiers(DEFAULT_TIERS.map(t => ({...t}))); saveCfg('mm_tiers', DEFAULT_TIERS); setTierEditMode(false) } }}>↺</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table style={{ minWidth: 0 }}>
                    <thead><tr><th>순위</th><th>규모</th><th>팔로워 범위</th><th>카테고리</th>{tierEditMode && <th></th>}</tr></thead>
                    <tbody>
                      {tiers.map((t, i) => (
                        <tr key={i}>
                          {tierEditMode ? (
                            <>
                              <td><input className="cfg-input" style={{ width: 60 }} value={t.rank} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, rank: e.target.value } : r))} /></td>
                              <td><input className="cfg-input" style={{ width: 120 }} value={t.label} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} /></td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input className="cfg-input" type="number" style={{ width: 70 }} value={t.minF} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, minF: +e.target.value } : r))} />
                                  <span style={{ color: 'var(--gray-5)', fontSize: 11 }}>~</span>
                                  <input className="cfg-input" type="number" style={{ width: 70 }} value={t.maxF} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, maxF: +e.target.value } : r))} />
                                </div>
                              </td>
                              <td>
                                <select className="cfg-input" value={t.tags} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, tags: e.target.value, category: e.target.value === 'kbeauty' ? 'K-뷰티' : '일반뷰티' } : r))}>
                                  <option value="kbeauty">K-뷰티</option>
                                  <option value="beauty">일반뷰티</option>
                                </select>
                              </td>
                              <td><button className="cfg-btn cfg-btn--danger" onClick={() => showConfirm(`"${t.label}" 티어를 삭제할까요?`, () => setTiers(prev => prev.filter((_, j) => j !== i)))}>✕</button></td>
                            </>
                          ) : (
                            <>
                              <td><strong>{t.rank}</strong></td>
                              <td>{t.label}</td>
                              <td style={{ color: 'var(--gray-5)' }}>{(t.minF/1000).toFixed(0)}K ~ {(t.maxF/1000).toFixed(0)}K</td>
                              <td><span className="platform-badge" style={{ background: t.tags === 'kbeauty' ? '#111' : 'var(--blue)', color: '#fff' }}>{t.category}</span></td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tierEditMode && (
                  <div style={{ marginTop: 8 }}>
                    <button className="cfg-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setTiers(prev => [...prev, { rank: (prev.length + 1) + '순위', label: '새 티어', minF: 1000, maxF: 10000, tags: 'beauty', category: '일반뷰티' }])}>+ 티어 추가</button>
                  </div>
                )}
              </div>
            </div>

            {/* Keywords */}
            <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16 }}>키워드 설정 — Apify · TCM 공통</div>
              {[
                { key: 'kbeauty', label: 'K-뷰티 키워드', kws: kbeautyKws, editMode: kbeautyEdit, setEdit: setKbeautyEdit, newKw: newKbeautyKw, setNewKw: setNewKbeautyKw, setKws: setKbeautyKws, storageKey: 'mm_kbeauty_kws', defaults: DEFAULT_KBEAUTY_KEYWORDS },
                { key: 'beauty', label: '일반뷰티 키워드', kws: beautyKws, editMode: beautyEdit, setEdit: setBeautyEdit, newKw: newBeautyKw, setNewKw: setNewBeautyKw, setKws: setBeautyKws, storageKey: 'mm_beauty_kws', defaults: DEFAULT_BEAUTY_KEYWORDS },
              ].map(({ key, label, kws, editMode, setEdit, newKw, setNewKw, setKws, storageKey, defaults }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-7)' }}>{label}</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="cfg-btn" onClick={() => setEdit(!editMode)}>{editMode ? '✓ 완료' : '편집'}</button>
                      <button className="cfg-btn cfg-btn--ghost" onClick={() => { if (confirm('기본 키워드로 초기화하시겠습니까?')) { setKws([...defaults]); saveCfg(storageKey, defaults); setEdit(false) } }}>↺</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {kws.map(kw => (
                      <span key={kw} className="tag-pill">
                        {kw}
                        {editMode && (
                          <button className="tag-remove" onClick={() => { const next = kws.filter(k => k !== kw); setKws(next); saveCfg(storageKey, next) }}>×</button>
                        )}
                      </span>
                    ))}
                  </div>
                  {editMode && (
                    <div className="tag-input-row" style={{ marginTop: 6 }}>
                      <input className="cfg-input" placeholder="키워드 입력" value={newKw} onChange={e => setNewKw(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { if (!newKw.trim() || kws.includes(newKw.trim())) return; const next = [...kws, newKw.trim()]; setKws(next); saveCfg(storageKey, next); setNewKw('') } }} />
                      <button className="cfg-btn" onClick={() => { if (!newKw.trim() || kws.includes(newKw.trim())) return; const next = [...kws, newKw.trim()]; setKws(next); saveCfg(storageKey, next); setNewKw('') }}>추가</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apify Tab */}
        {activeTab === 'apify' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 10 }}>우선순위 등급표 — 행을 클릭해 티어 선택</div>
                <div className="table-wrap">
                  <table style={{ minWidth: 0 }}>
                    <thead><tr><th>순위</th><th>규모</th><th>팔로워</th><th>카테고리</th></tr></thead>
                    <tbody>
                      {tiers.map((t, i) => (
                        <tr key={i} style={{ cursor: 'pointer', background: apifyTierIdx === i ? 'var(--blue-lt)' : undefined }} onClick={() => setApifyTierIdx(i)}>
                          <td><strong>{t.rank}</strong></td>
                          <td>{t.label}</td>
                          <td style={{ color: 'var(--gray-5)' }}>{(t.minF/1000).toFixed(0)}K~{(t.maxF/1000).toFixed(0)}K</td>
                          <td><span className="platform-badge" style={{ background: t.tags === 'kbeauty' ? '#111' : 'var(--blue)', color: '#fff' }}>{t.category}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-4)', marginBottom: 12 }}>키워드는 <strong>크리에이터 조건</strong> 탭에서 편집하세요.</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 8, fontWeight: 600 }}>K-뷰티 키워드</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{kbeautyKws.map(t => <span key={t} className="tag-pill active">#{t}</span>)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 8, fontWeight: 600 }}>일반뷰티 키워드</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{beautyKws.map(t => <span key={t} className="tag-pill">#{t}</span>)}</div>
                </div>
              </div>
            </div>
            <div className="filters" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>선택 티어 <strong style={{ color: 'var(--yellow-text)' }}>{apifyTierIdx !== null ? tiers[apifyTierIdx]?.rank : '← 위 표에서 선택'}</strong></span>
              <div className="filter-group">
                <label>포스트 수/태그</label>
                <input type="number" value={apifyPostsPerTag} min={10} max={200} style={{ width: 60 }} onChange={e => setApifyPostsPerTag(+e.target.value)} />
              </div>
              <button className="listup-find-btn" disabled={apifyLoading || apifyTierIdx === null} onClick={async () => {
                if (apifyTierIdx === null) return
                const tier = tiers[apifyTierIdx]
                setApifyLoading(true); setApifyStatus('탐색 중...')
                try {
                  const tags = tier.tags === 'kbeauty' ? kbeautyKws : beautyKws
                  const res: { error?: string; runId?: string } = await gasPost({ action: 'startCreatorSearch', hashtags: tags, postsPerTag: apifyPostsPerTag, followerMin: tier.minF, followerMax: tier.maxF, rank: tier.rank, sheetName: tier.category === 'K-뷰티' ? 'K-뷰티' : '일반뷰티' })
                  if (res.error) { setApifyStatus('오류: ' + res.error) } else { setApifyRunId(res.runId || ''); setApifyStatus('탐색 시작됨. Run ID: ' + res.runId) }
                } catch (e: unknown) { setApifyStatus('오류: ' + (e as Error).message) }
                setApifyLoading(false)
              }}>Find Creators</button>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', marginLeft: 4 }}>{apifyLoading && <Spinner sm />} {apifyStatus}</span>
            </div>
            <div className="listup-empty-state">
              <div className="listup-empty-icon">🔍</div>
              <div className="listup-empty-title">티어를 선택하고 Find Creators를 누르세요</div>
              <div className="listup-empty-desc">왼쪽 표에서 티어를 클릭해 선택하고 탐색을 시작합니다.<br />탐색은 클라우드에서 실행되며 2~5분 소요됩니다.</div>
            </div>
          </div>
        )}

        {/* TCM Tab */}
        {activeTab === 'search' && (
          <div>
            <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 14 }}>TikTok Creator Marketplace 자동 탐색</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 8 }}>탐색할 티어 선택</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tiers.map(t => (
                    <button key={t.rank} className={'tcm-tier-btn' + (tcmTier === t.rank ? ' active' : '')} onClick={() => { setTcmTier(t.rank); setTcmKeyword('') }}>
                      {t.rank}<br /><small>{t.label}</small>
                    </button>
                  ))}
                </div>
              </div>
              {tcmTier && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 8 }}>검색 키워드 선택</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tcmKws.map(kw => (
                      <button key={kw} className={'tcm-kw-btn' + (tcmKeyword === kw ? ' active' : '')} onClick={() => setTcmKeyword(kw)}>{kw}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="filters" style={{ marginBottom: 0 }}>
                <div className="filter-group">
                  <label>목표 인원 (이메일 보유)</label>
                  <input type="number" value={tcmTargetCount} min={5} max={200} style={{ width: 65 }} onChange={e => setTcmTargetCount(+e.target.value)} />
                </div>
                <button className="listup-find-btn" onClick={startTcmSearch} disabled={tcmLoading}>TCM 탐색</button>
                <button className="listup-update-btn" onClick={saveTcmToSheet} disabled={!tcmResults?.length} style={{ opacity: tcmResults?.length ? 1 : .5 }}>시트 저장</button>
                <span style={{ fontSize: 13, color: 'var(--gray-5)', marginLeft: 4 }}>{tcmLoading && <Spinner sm />} {tcmStatus}</span>
              </div>
            </div>
            {tcmLoading && <div className="loader"><Spinner /></div>}
            {!tcmLoading && !tcmResults && (
              <div className="listup-empty-state">
                <div className="listup-empty-icon">📱</div>
                <div className="listup-empty-title">티어 선택 후 목표 인원을 입력하고 TCM 탐색 버튼을 누르세요</div>
              </div>
            )}
            {!tcmLoading && tcmResults && tcmResults.length === 0 && <div className="empty">결과가 없습니다.</div>}
            {!tcmLoading && tcmResults && tcmResults.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 10 }}>총 <strong>{tcmResults.length}</strong>명</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>순위</th><th>핸들</th><th>이름</th><th>팔로워</th><th>이메일</th></tr></thead>
                    <tbody>
                      {tcmResults.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{escHtml(r[1])}</strong></td>
                          <td>{r[13] ? <a href={r[13]} target="_blank" rel="noopener" style={{ color: 'var(--blue-dk)', fontWeight: 600 }}>@{r[2]}</a> : `@${r[2]}`}</td>
                          <td>{r[3]}</td>
                          <td className="num">{fmtNum(r[5])}</td>
                          <td>{r[4] ? <a href={`mailto:${r[4]}`} style={{ color: '#1558b0' }}>{r[4]}</a> : <span style={{ color: 'var(--gray-5)' }}>없음</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div>
            {listupLoading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
            {!listupLoading && listupData?.error && <div className="empty">오류: {listupData.error as string}</div>}
            {!listupLoading && listupData && !listupData.error && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div className="weekly-tabs">
                    {['전체', ...DB_TIERS].map(t => (
                      <button key={t} className={'weekly-tab' + (currentDbTab === t ? ' active' : '')} onClick={() => setCurrentDbTab(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="filters" style={{ marginBottom: 16 }}>
                  <div className="filter-group">
                    <label>검색</label>
                    <input type="text" placeholder="계정명 또는 핸들..." value={searchTerms[currentDbTab] || ''} onChange={e => setSearchTerms(prev => ({ ...prev, [currentDbTab]: e.target.value }))} />
                  </div>
                  <div className="filter-group">
                    <label>추가일</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>~</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gray-5)' }}>
                    표시: <strong style={{ color: 'var(--yellow-text)' }}>{getFilteredRows(currentDbTab).rows.length}</strong>개
                  </span>
                </div>
                {renderDbTable(currentDbTab)}
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmToast state={confirmState} onHide={hideConfirm} />
    </div>
  )
}
