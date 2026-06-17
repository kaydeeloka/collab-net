
//You can ignore this page is it's not use
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { gasPost } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import { PageTabs } from '@/components/ui'
import { SearchStatsCards, TIER_COLOR } from './SearchStatsCards'

type ListupTab = 'search' | 'database'

const DEFAULT_KBEAUTY_KEYWORDS = ['glass skin','kbeauty','korean beauty','korean skincare','kbeauty review','kbeauty routine','korean skincare routine','kbeauty products','kbeauty addict','korean makeup','olive young','kbeauty skincare']
const DEFAULT_BEAUTY_KEYWORDS  = ['beauty review','skincare','makeup tips','beauty creator','beautytok','makeup haul','beauty hacks','beauty influencer']
const DEFAULT_TIERS = [
  { rank:'1순위', label:'마이크로 (10K~50K)',  minF:10000,  maxF:50000,  tags:'kbeauty', category:'K-뷰티' },
  { rank:'2순위', label:'마이크로 (10K~50K)',  minF:10000,  maxF:50000,  tags:'beauty',  category:'일반뷰티' },
  { rank:'3순위', label:'나노 (3K~10K)',       minF:3000,   maxF:9999,   tags:'kbeauty', category:'K-뷰티' },
  { rank:'4순위', label:'나노 (3K~10K)',       minF:3000,   maxF:9999,   tags:'beauty',  category:'일반뷰티' },
  { rank:'5순위', label:'마이크로 (60K~100K)', minF:60000,  maxF:100000, tags:'kbeauty', category:'K-뷰티' },
]
const DEFAULT_FILTER_CONDS: FilterCond[] = [
  { cat: '중복', desc: '1~5순위까지의 중복 계정 필터링', type: 'dedup', enabled: true },
]

const FILTER_SELECT: CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--gray-3)',
  fontSize: 13, background: '#fff', fontWeight: 600, minWidth: 72,
}
const FILTER_CHECK_LABEL: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-6)', cursor: 'pointer', margin: 0,
}
const FILTER_INLINE: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--gray-6)',
}

interface SearchFilters {
  maxRatio: number
  maxUploadDays: number
  proxyCountry: string
  requireEmail: boolean
  followerMin: number
  followerMax: number
  maxCreators: number
}

interface FilterCond { cat: string; desc: string; manual?: boolean; type?: 'dedup'; enabled?: boolean }
const DB_PAGE_SIZE = 25

const COUNTRY_MAP: Record<string, string> = {
  '':'None (기본)',
  'AF':'Afghanistan','AL':'Albania','DZ':'Algeria','AS':'American Samoa','AD':'Andorra',
  'AO':'Angola','AI':'Anguilla','AG':'Antigua and Barbuda','AR':'Argentina','AM':'Armenia',
  'AU':'Australia','AT':'Austria','AZ':'Azerbaijan','BS':'Bahamas','BH':'Bahrain',
  'BB':'Barbados','BY':'Belarus','BE':'Belgium','BZ':'Belize','BJ':'Benin',
  'BM':'Bermuda','BT':'Bhutan','BO':'Bolivia','BA':'Bosnia and Herzegovina','BW':'Botswana',
  'BR':'Brazil','VG':'British Virgin Islands','BN':'Brunei','BG':'Bulgaria','BF':'Burkina Faso',
  'BI':'Burundi','KH':'Cambodia','CM':'Cameroon','CA':'Canada','CV':'Cape Verde',
  'KY':'Cayman Islands','TD':'Chad','CL':'Chile','CO':'Colombia','CK':'Cook Islands',
  'CR':'Costa Rica','HR':'Croatia','CY':'Cyprus','CZ':'Czech Republic','CD':'DR Congo',
  'DK':'Denmark','DJ':'Djibouti','DO':'Dominican Republic','EC':'Ecuador','EG':'Egypt',
  'SV':'El Salvador','EE':'Estonia','ET':'Ethiopia','FK':'Falkland Islands','FJ':'Fiji',
  'FI':'Finland','FR':'France','PF':'French Polynesia','GA':'Gabon','GE':'Georgia',
  'DE':'Germany','GH':'Ghana','GI':'Gibraltar','GR':'Greece','GL':'Greenland',
  'GD':'Grenada','GP':'Guadeloupe','GT':'Guatemala','GN':'Guinea','GW':'Guinea-Bissau',
  'GY':'Guyana','HN':'Honduras','HU':'Hungary','IS':'Iceland','ID':'Indonesia',
  'IQ':'Iraq','IE':'Ireland','IM':'Isle of Man','IL':'Israel','IT':'Italy',
  'CI':'Ivory Coast','JM':'Jamaica','JP':'Japan','JE':'Jersey','KZ':'Kazakhstan',
  'KE':'Kenya','XK':'Kosovo','KW':'Kuwait','LA':'Laos','LV':'Latvia',
  'LB':'Lebanon','LS':'Lesotho','LR':'Liberia','LY':'Libya','LT':'Lithuania',
  'LU':'Luxembourg','MO':'Macao','MG':'Madagascar','MW':'Malawi','MY':'Malaysia',
  'MV':'Maldives','ML':'Mali','MT':'Malta','MH':'Marshall Islands','MQ':'Martinique',
  'MR':'Mauritania','MU':'Mauritius','MX':'Mexico','MD':'Moldova','MC':'Monaco',
  'MN':'Mongolia','ME':'Montenegro','MA':'Morocco','MZ':'Mozambique','MM':'Myanmar',
  'NA':'Namibia','NR':'Nauru','NP':'Nepal','NL':'Netherlands','NZ':'New Zealand',
  'NI':'Nicaragua','NG':'Nigeria','MK':'North Macedonia','NO':'Norway','OM':'Oman',
  'PS':'Palestine','PA':'Panama','PG':'Papua New Guinea','PY':'Paraguay','PE':'Peru',
  'PH':'Philippines','PL':'Poland','PT':'Portugal','PR':'Puerto Rico','QA':'Qatar',
  'CG':'Republic of Congo','RO':'Romania','RU':'Russia','RW':'Rwanda','RE':'Réunion',
  'KN':'Saint Kitts and Nevis','LC':'Saint Lucia','MF':'Saint Martin','PM':'Saint Pierre and Miquelon',
  'VC':'Saint Vincent and the Grenadines','SM':'San Marino','SA':'Saudi Arabia',
  'SN':'Senegal','RS':'Serbia','SL':'Sierra Leone','SG':'Singapore','SX':'Sint Maarten',
  'SK':'Slovakia','SB':'Solomon Islands','SO':'Somalia','ZA':'South Africa',
  'KR':'South Korea','ES':'Spain','LK':'Sri Lanka','SR':'Suriname','SZ':'Eswatini',
  'SE':'Sweden','CH':'Switzerland','TW':'Taiwan','TJ':'Tajikistan','TZ':'Tanzania',
  'TH':'Thailand','TG':'Togo','TO':'Tonga','TT':'Trinidad and Tobago','TN':'Tunisia',
  'TR':'Turkey','TC':'Turks and Caicos Islands','TV':'Tuvalu','VI':'U.S. Virgin Islands',
  'UG':'Uganda','UA':'Ukraine','AE':'United Arab Emirates','GB':'United Kingdom',
  'US':'United States','UY':'Uruguay','VE':'Venezuela','VN':'Vietnam',
  'WF':'Wallis and Futuna','YE':'Yemen','ZM':'Zambia','ZW':'Zimbabwe','AX':'Åland Islands',
}

interface Tier        { rank: string; label: string; minF: number; maxF: number; tags: string; category: string }

const DB_TIERS = ['1순위','2순위','3순위','4순위','5순위']
interface Influencer  {
  id: string; created_at: string; phase_id: string; handle: string
  display_name: string | null; email: string | null; followers: number; following: number
  following_ratio: string | null; total_likes: number; video_count: number
  avg_views: number; engagement_rate: number; profile_url: string | null; status: string
  tiers?: { rank: string; label: string; category: string } | null
}
interface ApifyCreator {
  handle: string; displayName: string; email: string; followers: number
  following: number; ratio: string; totalLikes: number; videoCount: number
  avgViews: number; engRate: number; bio: string; profileUrl: string
}

function saveConfig(key: string, value: unknown) {
  supabase.from('app_config').upsert({ key, value, updated_at: new Date().toISOString() }).then()
}

function saveSearchFilters(filters: Pick<SearchFilters, 'maxRatio' | 'maxUploadDays' | 'proxyCountry' | 'requireEmail'>) {
  saveConfig('search_filters', filters)
}

function isDedupCond(fc: FilterCond) {
  return fc.type === 'dedup' || fc.cat.includes('중복')
}

function normalizeFilterConds(conds: FilterCond[]): FilterCond[] {
  const filtered = conds.filter(fc =>
    fc.cat !== '국가' && !fc.manual &&
    !fc.cat.includes('영상') && !fc.cat.includes('퀄리티')
  )
  const normalized = filtered.map(fc => {
    if (!isDedupCond(fc)) return fc
    return { ...DEFAULT_FILTER_CONDS[0], ...fc, type: 'dedup' as const, enabled: fc.enabled !== false }
  })
  if (!normalized.some(isDedupCond)) {
    return [DEFAULT_FILTER_CONDS[0]]
  }
  return normalized.filter(isDedupCond)
}

function hasDedupFilter(conds: FilterCond[]) {
  return conds.some(fc => isDedupCond(fc) && fc.enabled !== false)
}

const OUTREACH_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  yes:       { bg: '#dbeafe', color: '#1d4ed8', label: '완료' },
  reply:     { bg: '#fef3c7', color: '#d97706', label: '답장' },
  negotiate: { bg: '#d1fae5', color: '#065f46', label: '협의중' },
  accept:    { bg: '#bbf7d0', color: '#14532d', label: '수락확정' },
  reject:    { bg: '#fee2e2', color: '#991b1b', label: '거절' },
  target:    { bg: '#ede9fe', color: '#6d28d9', label: '컨택예정' },
  default:   { bg: '#f1f5f9', color: '#64748b', label: '미발송' },
}

export default function Listup() {
  const { viewPhaseId, phases } = usePhase()
  const phaseLabel = phases.find(p => p.id === viewPhaseId)?.name ?? '1차'
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab: ListupTab = pathname.endsWith('/db') ? 'database' : 'search'
  const { showConfirm } = useToast()

  // Config state (loaded from Supabase app_config)
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS)
  const [tierEditMode, setTierEditMode] = useState(false)
  const [kbeautyKws, setKbeautyKws] = useState<string[]>(DEFAULT_KBEAUTY_KEYWORDS)
  const [beautyKws, setBeautyKws] = useState<string[]>(DEFAULT_BEAUTY_KEYWORDS)
  const [kbeautyEdit, setKbeautyEdit] = useState(false)
  const [beautyEdit, setBeautyEdit] = useState(false)
  const [newKbeautyKw, setNewKbeautyKw] = useState('')
  const [newBeautyKw, setNewBeautyKw] = useState('')
  const [filterConds, setFilterConds] = useState<FilterCond[]>(DEFAULT_FILTER_CONDS)
  const [maxRatio, setMaxRatio] = useState(70)
  const [maxUploadDays, setMaxUploadDays] = useState(30)
  const [proxyCountry, setProxyCountry] = useState('US')
  const [requireEmail, setRequireEmail] = useState(true)

  // Apify state (still uses GAS)
  const [apifyTierIdx, setApifyTierIdx] = useState<number | null>(null)
  const [targetCreators, setTargetCreators] = useState(100)
  const [apifyStatus, setApifyStatus] = useState('')
  const [apifyLoading, setApifyLoading] = useState(false)
  const [apifyResults, setApifyResults] = useState<ApifyCreator[] | null>(null)
  const [apifyRunId, setApifyRunId] = useState('')
  const [apifyDatasetId, setApifyDatasetId] = useState('')
  const [apifyPolling, setApifyPolling] = useState(false)
  const [apifyProcessing, setApifyProcessing] = useState(false)
  const [apifyCurrentTier, setApifyCurrentTier] = useState<Tier | null>(null)
  const [apifyFilterStats, setApifyFilterStats] = useState<{ noEmailSkipped: number; dedupSkipped: number } | null>(null)
  const [apifyManualId, setApifyManualId] = useState('')
  const existingHandlesRef = useRef<string[]>([])

  // DB state
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [currentDbTab, setCurrentDbTab] = useState('전체')
  const [dateFrom, setDateFrom] = useState('')
  const [dbPage, setDbPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Dashboard stats
  const [dashStats, setDashStats] = useState<{ total: number; sent: number; confirmed: number; tiers: { rank: string; total: number }[] } | null>(null)

  // Load config once on mount
  useEffect(() => {
    ;(async () => {
      const { data: cfg } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['tiers', 'kbeauty_keywords', 'beauty_keywords', 'filter_conditions', 'search_filters'])

      if (!cfg) return
      const map = Object.fromEntries(cfg.map(r => [r.key, r.value]))
      if (map.tiers)             setTiers(map.tiers as Tier[])
      if (map.kbeauty_keywords)  setKbeautyKws(map.kbeauty_keywords as string[])
      if (map.beauty_keywords)   setBeautyKws(map.beauty_keywords as string[])
      if (map.filter_conditions) setFilterConds(normalizeFilterConds(map.filter_conditions as FilterCond[]))
      if (map.search_filters) {
        const sf = map.search_filters as Partial<SearchFilters>
        setMaxRatio(sf.maxRatio ?? 70)
        setMaxUploadDays(sf.maxUploadDays ?? 30)
        setProxyCountry(sf.proxyCountry ?? 'US')
        setRequireEmail(sf.requireEmail !== false)
      }
    })()
  }, [])

  async function loadDashStats() {
    if (!viewPhaseId) return
    const [{ data: infData }, { count: confirmedCount }] = await Promise.all([
      supabase.from('influencers').select('status, tiers(rank)').eq('phase_id', viewPhaseId),
      supabase.from('confirmed_influencers').select('*', { count: 'exact', head: true }).eq('phase_id', viewPhaseId),
    ])
    if (!infData) return
    let total = 0, sent = 0
    const tierCounts: Record<string, number> = {}
    for (const r of infData as unknown as { status: string; tiers?: { rank: string } | null }[]) {
      total++
      if (['yes', 'reply', 'negotiate', 'accept'].includes(r.status)) sent++
      const rank = r.tiers?.rank
      if (rank) tierCounts[rank] = (tierCounts[rank] ?? 0) + 1
    }
    const tierStats = DB_TIERS.map(rank => ({ rank, total: tierCounts[rank] ?? 0 }))
    setDashStats({ total, sent, confirmed: confirmedCount ?? 0, tiers: tierStats })
  }

  // Reload stats when phase (차수) changes
  useEffect(() => { loadDashStats() }, [viewPhaseId])

  // Reload DB list when phase changes (if already loaded)
  useEffect(() => {
    if (!viewPhaseId) return
    setDbLoaded(false)
    setSelected(new Set())
    if (activeTab === 'database') loadInfluencers()
  }, [viewPhaseId])

  useEffect(() => { setDbPage(1) }, [currentDbTab, dateFrom])

  async function fetchExistingHandles() {
    if (!viewPhaseId) return []
    const { data } = await supabase.from('influencers').select('handle').eq('phase_id', viewPhaseId)
    return (data ?? []).map(r => r.handle)
  }

  function buildSearchFilters(tier: Tier | null): SearchFilters {
    return {
      maxRatio,
      maxUploadDays,
      proxyCountry: proxyCountry || 'US',
      requireEmail,
      followerMin: tier?.minF ?? 0,
      followerMax: tier?.maxF ?? 0,
      maxCreators: targetCreators,
    }
  }

  function setDedupEnabled(enabled: boolean) {
    const next = [{ ...DEFAULT_FILTER_CONDS[0], enabled }]
    setFilterConds(next)
    saveConfig('filter_conditions', next)
  }

  async function prefetchExistingHandles() {
    if (!hasDedupFilter(filterConds)) return
    if (!existingHandlesRef.current.length) {
      existingHandlesRef.current = await fetchExistingHandles()
    }
  }

  async function fetchAndApplyResults(dsId: string, tier: Tier | null) {
    setApifyProcessing(true)
    setApifyStatus('탐색 완료! 결과 처리 중...')
    setApifyResults(null)
    setApifyFilterStats(null)
    try {
      await prefetchExistingHandles()
      const results: { ok?: boolean; creators?: ApifyCreator[]; dedupSkipped?: number; noEmailSkipped?: number; error?: string } =
        await gasPost({
          action: 'getRunResults',
          datasetId: dsId,
          searchFilters: buildSearchFilters(tier),
          filterConditions: filterConds,
          existingHandles: existingHandlesRef.current,
        })
      if (results.error) {
        setApifyStatus('결과 오류: ' + results.error)
        return
      }
      const list = results.creators || []
      const noEmailSkipped = results.noEmailSkipped ?? 0
      const dedupSkipped = results.dedupSkipped ?? 0
      setApifyResults(list)
      setApifyFilterStats({ noEmailSkipped, dedupSkipped })
      setApifyStatus(`완료: ${list.length}명${noEmailSkipped > 0 ? ` · 이메일 없음 ${noEmailSkipped}명 제외` : ''}${dedupSkipped > 0 ? ` · 중복 ${dedupSkipped}명 제외` : ''}`)
    } catch (e: unknown) {
      setApifyStatus('결과 오류: ' + (e as Error).message)
    } finally {
      setApifyProcessing(false)
    }
  }

  async function resolveApifyDatasetId(id: string): Promise<string> {
    const statusRes = await gasPost<{ status?: string; datasetId?: string; error?: string; notFound?: boolean }>({
      action: 'checkRunStatus',
      runId: id,
    })
    if (statusRes.status) {
      if (statusRes.status !== 'SUCCEEDED') {
        throw new Error('Run 미완료: ' + statusRes.status)
      }
      if (statusRes.datasetId) return statusRes.datasetId
    }
    if (statusRes.error && !statusRes.notFound) {
      throw new Error(statusRes.error)
    }
    return id
  }

  async function loadFromApifyId() {
    if (apifyTierIdx === null) return
    const id = apifyManualId.trim()
    if (!id) return
    const tier = tiers[apifyTierIdx]
    setApifyPolling(false)
    setApifyLoading(true)
    setApifyResults(null)
    setApifyFilterStats(null)
    setApifyCurrentTier(tier)
    existingHandlesRef.current = []
    setApifyStatus('Apify Run/Dataset 확인 중...')
    try {
      const dsId = await resolveApifyDatasetId(id)
      setApifyLoading(false)
      await fetchAndApplyResults(dsId, tier)
    } catch (e: unknown) {
      setApifyStatus('오류: ' + (e as Error).message)
      setApifyLoading(false)
    }
  }

  // Apify polling (GAS)
  useEffect(() => {
    if (!apifyPolling || !apifyRunId) return
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (cancelled) return
      try {
        const statusRes: { status?: string; datasetId?: string; error?: string } =
          await gasPost({ action: 'checkRunStatus', runId: apifyRunId })
        if (cancelled) return
        if (statusRes.error) {
          setApifyStatus('상태 확인 오류: ' + statusRes.error)
          setApifyPolling(false)
          setApifyProcessing(false)
          return
        }
        const s = statusRes.status || ''
        if (s === 'SUCCEEDED') {
          setApifyPolling(false)
          const dsId = statusRes.datasetId || apifyDatasetId
          if (cancelled) return
          await fetchAndApplyResults(dsId, apifyCurrentTier)
        } else if (['FAILED','ABORTED','TIMED-OUT'].includes(s)) {
          setApifyPolling(false)
          setApifyProcessing(false)
          setApifyStatus('탐색 실패: ' + s)
        } else {
          setApifyStatus(`Apify 탐색 중... (${s})`)
          if (!cancelled) timerId = setTimeout(poll, 5000)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setApifyPolling(false)
          setApifyProcessing(false)
          setApifyStatus('폴링 오류: ' + (e as Error).message)
        }
      }
    }

    timerId = setTimeout(poll, 3000)
    return () => { cancelled = true; clearTimeout(timerId) }
  }, [apifyPolling, apifyRunId, apifyDatasetId, apifyCurrentTier, maxRatio, maxUploadDays, targetCreators, requireEmail, proxyCountry, filterConds])

  function switchTab(t: ListupTab) {
    navigate(t === 'database' ? '/influencer/search/db' : '/influencer/search')
    if (t === 'database' && !dbLoaded) loadInfluencers()
  }

  async function loadInfluencers() {
    if (!viewPhaseId) return
    setDbLoaded(true)
    setDbLoading(true)
    const { data, error } = await supabase.from('influencers').select('*, tiers(rank, label, category)').eq('phase_id', viewPhaseId).order('created_at', { ascending: false })
    if (error) { setDbLoading(false); return }
    setInfluencers(data ?? [])
    setDbLoading(false)
  }

  async function deleteInfluencer(id: string) {
    const { error } = await supabase.from('influencers').delete().eq('id', id)
    if (error) { alert('오류: ' + error.message); return }
    setInfluencers(prev => prev.filter(inf => inf.id !== id))
  }

  async function markContact(id: string) {
    const inf = influencers.find(r => r.id === id)
    if (!inf) return
    // only allow toggling off if status is exactly 'target'; advanced statuses can't be cleared here
    if (inf.status && inf.status !== 'target') return
    const newStatus = inf.status === 'target' ? '' : 'target'
    const { error } = await supabase.from('influencers').update({ status: newStatus }).eq('id', id)
    if (error) return
    setInfluencers(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }

  async function bulkMarkTarget() {
    if (!selected.size) return
    setBulkLoading(true)
    const ids = Array.from(selected)
    const { error } = await supabase.from('influencers').update({ status: 'target' }).in('id', ids)
    if (!error) {
      setInfluencers(prev => prev.map(inf => selected.has(inf.id) ? { ...inf, status: 'target' } : inf))
      setSelected(new Set())
      navigate('/influencer/contact')
    }
    setBulkLoading(false)
  }

  async function saveToSupabase() {
    if (!apifyResults?.length || !apifyCurrentTier || !viewPhaseId) return
    setApifyLoading(true)

    const [{ data: tierRow }, { data: existing }] = await Promise.all([
      supabase.from('tiers').select('id').eq('rank', apifyCurrentTier.rank).maybeSingle(),
      supabase.from('influencers').select('handle').eq('phase_id', viewPhaseId),
    ])
    const existingSet = new Set((existing ?? []).map(r => r.handle.toLowerCase()))

    const dedup = hasDedupFilter(filterConds)
    const rows = apifyResults
      .filter(c => (!requireEmail || c.email?.trim()) && (!dedup || !existingSet.has(c.handle.toLowerCase())))
      .map(c => ({
        phase_id:         viewPhaseId,
        tier_id:          tierRow?.id ?? null,
        handle:           c.handle,
        display_name:     c.displayName || null,
        email:            c.email?.trim() || null,
        platform:         'TikTok',
        followers:        c.followers,
        following:        c.following,
        following_ratio:  c.ratio || null,
        total_likes:      c.totalLikes,
        video_count:      c.videoCount,
        avg_views:        c.avgViews,
        engagement_rate:  c.engRate,
        profile_url:      c.profileUrl || null,
        status:           '',
      }))

    if (!rows.length) {
      setApifyStatus('저장할 신규 크리에이터가 없습니다 (이메일 없음 또는 중복)')
      setApifyLoading(false)
      return
    }

    const { error, data } = await supabase
      .from('influencers')
      .upsert(rows, { onConflict: 'phase_id,handle', ignoreDuplicates: true })
      .select('*, tiers(rank, label, category)')
    if (error) {
      setApifyStatus('저장 오류: ' + error.message)
    } else {
      const saved = data?.length ?? 0
      const skipped = rows.length - saved
      setApifyStatus(`저장 완료: ${saved}명 추가${skipped > 0 ? ` (${skipped}명 중복 건너뜀)` : ''}`)
      if (data?.length) {
        setInfluencers(prev => [...(data as Influencer[]), ...prev])
        loadDashStats()
      }
    }
    setApifyLoading(false)
  }

  function getFilteredInfluencers() {
    let list = influencers
    if (currentDbTab !== '전체') list = list.filter(inf => inf.tiers?.rank === currentDbTab)
    if (dateFrom) list = list.filter(inf => inf.created_at.substring(0, 10) === dateFrom)
    return [...list].sort((a, b) => (a.status ? 1 : 0) - (b.status ? 1 : 0))
  }

  function renderDbTable() {
    const filtered = getFilteredInfluencers()
    const totalPages = Math.max(1, Math.ceil(filtered.length / DB_PAGE_SIZE))
    const safePage   = Math.min(dbPage, totalPages)
    const startIdx   = (safePage - 1) * DB_PAGE_SIZE
    const rows       = filtered.slice(startIdx, startIdx + DB_PAGE_SIZE)

    return (
      <div>
        {/* Tier filter dropdown + date range */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={currentDbTab}
            onChange={e => { setCurrentDbTab(e.target.value); setDbPage(1) }}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: `2px solid ${TIER_COLOR[currentDbTab] ?? 'var(--gray-3)'}`,
              color: TIER_COLOR[currentDbTab] ?? 'var(--gray-7)',
              background: '#fff', cursor: 'pointer', outline: 'none',
            }}>
            <option value="전체">전체</option>
            {DB_TIERS.map(rank => <option key={rank} value={rank}>{rank}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>
            표시: <strong style={{ color: 'var(--yellow-text)' }}>{getFilteredInfluencers().length}</strong>개
          </span>

          {/* Bulk action — shown when rows are selected */}
          {selected.size > 0 && (
            <button
              onClick={bulkMarkTarget}
              disabled={bulkLoading}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--blue-dk)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {bulkLoading ? '처리 중...' : `일괄 컨택 예정 (${selected.size}명)`}
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--gray-5)', fontWeight: 600 }}>추가일</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDbPage(1) }}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--gray-3)', outline: 'none' }} />
            {dateFrom && (
              <button onClick={() => setDateFrom('')}
                style={{ fontSize: 11, color: 'var(--gray-5)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                ✕
              </button>
            )}
            <button
              onClick={() => navigate('/influencer/contact')}
              style={{ marginLeft: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--teal-dk)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              컨택 페이지 →
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox"
                    checked={rows.length > 0 && rows.every(r => selected.has(r.id))}
                    onChange={e => {
                      setSelected(prev => {
                        const next = new Set(prev)
                        rows.forEach(r => e.target.checked ? next.add(r.id) : next.delete(r.id))
                        return next
                      })
                    }}
                  />
                </th>
                <th>크리에이터 이름 + 핸들</th><th>이메일</th>
                <th style={{ textAlign: 'right' }}>팔로워</th><th style={{ textAlign: 'right' }}>팔로잉</th><th style={{ textAlign: 'right' }}>팔로잉 비율</th>
                <th style={{ textAlign: 'right' }}>영상 수</th><th style={{ textAlign: 'right' }}>참여율 (%)</th><th>컨택 대상</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-5)' }}>데이터가 없습니다</td></tr>
                : rows.map(inf => {
                  const tc = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                  return (
                    <tr key={inf.id} style={tc ? { borderLeft: `3px solid ${tc}` } : undefined}>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox"
                          checked={selected.has(inf.id)}
                          onChange={e => setSelected(prev => {
                            const next = new Set(prev)
                            e.target.checked ? next.add(inf.id) : next.delete(inf.id)
                            return next
                          })}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-8)' }}>{inf.display_name || inf.handle}</span>
                          <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--blue-dk)', textDecoration: 'none' }}>@{inf.handle}</a>
                        </div>
                      </td>
                      <td>{inf.email ? <a href={`mailto:${inf.email}`} style={{ color: '#1558b0', fontSize: 13 }}>{inf.email}</a> : <span style={{ color: 'var(--gray-5)' }}>—</span>}</td>
                      <td className="num">{fmtNum(inf.followers)}</td>
                      <td className="num">{fmtNum(inf.following)}</td>
                      <td className="num">{inf.following_ratio || '—'}</td>
                      <td className="num">{fmtNum(inf.video_count)}</td>

                      <td className="num">{inf.engagement_rate}%</td>
                      <td>
                        <button
                          onClick={() => markContact(inf.id)}
                          style={{
                            padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap',
                            border: `1.5px solid ${inf.status ? '#6ee7b7' : '#e2e8f0'}`,
                            background: inf.status ? '#d1fae5' : '#f1f5f9',
                            color: inf.status ? '#065f46' : '#94a3b8',
                          }}>
                          {inf.status ? '✓ 컨택' : '컨택'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
        <Pagination
          page={safePage} totalPages={totalPages}
          total={filtered.length} startIdx={startIdx} endIdx={startIdx + rows.length}
          onPrev={() => setDbPage(p => Math.max(1, p - 1))}
          onNext={() => setDbPage(p => Math.min(totalPages, p + 1))}
        />
      </div>
    )
  }

  return (
    <div className="page page--fill" id="page-listup">
      <div className="page-banner">
        <span className="page-banner-deco">👥</span>
        <div>
          <div className="page-banner-title">인플루언서 리스트업 &amp; 크리에이터 DB 관리</div>
          <div className="page-banner-desc">Apify를 통해 조건에 맞는 TikTok 크리에이터를 탐색하고, 1~5순위 티어로 분류하여 아웃리치 파이프라인에 연결합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={() => switchTab('database')}>인플루언서 DB</button>
          <button className="page-banner-btn page-banner-btn--secondary" onClick={() => { setDbLoaded(false); switchTab('database') }}><span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침</button>
        </div>
      </div>

      {dashStats && <SearchStatsCards dashStats={dashStats} phaseLabel={phaseLabel} />}

      <PageTabs
        tabs={[
          { id: 'search', label: '인플루언서 찾기' },
          { id: 'database', label: '인플루언서 DB' },
        ]}
        active={activeTab}
        onChange={switchTab}
      />

      <div className={activeTab === 'database' ? 'ftab-content' : ''} style={activeTab === 'search' ? { padding: 0 } : undefined}>

        {activeTab === 'search' && (
          <div>
            {/* 필터링 조건 */}
            <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 14 }}>인플루언서 필터링 조건</div>
              <div className="table-wrap listup-filter-table">
                <table>
                  <thead><tr><th className="filter-no">NO.</th><th className="filter-cat">구분</th><th>내용</th></tr></thead>
                  <tbody>
                    <tr>
                      <td className="filter-no">1</td>
                      <td className="filter-cat">팔로잉 비율</td>
                      <td>
                        <div style={FILTER_INLINE}>
                          <span>팔로잉 수가 팔로워 수의</span>
                          <select value={maxRatio} style={FILTER_SELECT}
                            onChange={e => { const v = +e.target.value; setMaxRatio(v); saveSearchFilters({ maxRatio: v, maxUploadDays, proxyCountry, requireEmail }) }}>
                            <option value={50}>50%</option>
                            <option value={60}>60%</option>
                            <option value={70}>70%</option>
                            <option value={80}>80%</option>
                          </select>
                          <span>초과 시 제외</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="filter-no">2</td>
                      <td className="filter-cat">업로드 주기</td>
                      <td>
                        <div style={FILTER_INLINE}>
                          <span>최근</span>
                          <select value={maxUploadDays} style={FILTER_SELECT}
                            onChange={e => { const v = +e.target.value; setMaxUploadDays(v); saveSearchFilters({ maxRatio, maxUploadDays: v, proxyCountry, requireEmail }) }}>
                            <option value={30}>30일</option>
                            <option value={49}>7주</option>
                          </select>
                          <span>이내 업로드 콘텐츠가 없는 계정 제외</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="filter-no">3</td>
                      <td className="filter-cat">국가</td>
                      <td>
                        <select value={proxyCountry} style={{ ...FILTER_SELECT, minWidth: 180, maxWidth: 240 }}
                          onChange={e => { const v = e.target.value; setProxyCountry(v); saveSearchFilters({ maxRatio, maxUploadDays, proxyCountry: v, requireEmail }) }}>
                          {Object.entries(COUNTRY_MAP).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                        </select>
                      </td>
                    </tr>
                    <tr>
                      <td className="filter-no">4</td>
                      <td className="filter-cat">이메일</td>
                      <td>
                        <label style={FILTER_CHECK_LABEL}>
                          <input type="checkbox" checked={requireEmail}
                            onChange={e => { const v = e.target.checked; setRequireEmail(v); saveSearchFilters({ maxRatio, maxUploadDays, proxyCountry, requireEmail: v }) }} />
                          bio에 이메일이 없는 계정 제외
                        </label>
                      </td>
                    </tr>
                    <tr>
                      <td className="filter-no">5</td>
                      <td className="filter-cat">중복</td>
                      <td>
                        <label style={FILTER_CHECK_LABEL}>
                          <input type="checkbox" checked={(filterConds.find(isDedupCond) ?? DEFAULT_FILTER_CONDS[0]).enabled !== false}
                            onChange={e => setDedupEnabled(e.target.checked)} />
                          {(filterConds.find(isDedupCond) ?? DEFAULT_FILTER_CONDS[0]).desc}
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tier table + Keywords */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px' }}>우선순위 등급표</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="cfg-btn" onClick={() => { if (tierEditMode) saveConfig('tiers', tiers); setTierEditMode(!tierEditMode) }}>{tierEditMode ? '완료' : '편집'}</button>
                    <button className="cfg-btn cfg-btn--ghost" onClick={() => showConfirm('기본값으로 초기화하시겠습니까?', () => { setTiers(DEFAULT_TIERS.map(t => ({...t}))); saveConfig('tiers', DEFAULT_TIERS); setTierEditMode(false) })}>↺</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table style={{ minWidth: 0 }}>
                    <thead><tr><th>순위</th><th>규모</th><th>팔로워 범위</th><th>카테고리</th>{tierEditMode && <th></th>}</tr></thead>
                    <tbody>
                      {tiers.map((t, i) => (
                        <tr key={i} style={{ cursor: tierEditMode ? undefined : 'pointer', background: apifyTierIdx === i ? 'var(--blue-lt)' : undefined }}
                          onClick={() => !tierEditMode && setApifyTierIdx(i)}>
                          {tierEditMode ? (
                            <>
                              <td><input className="cfg-input" style={{ width: 60 }} value={t.rank} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, rank: e.target.value } : r))} /></td>
                              <td><input className="cfg-input" style={{ width: 120 }} value={t.label} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} /></td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input className="cfg-input" type="number" style={{ width: 60 }} value={t.minF} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, minF: +e.target.value } : r))} />
                                  <span style={{ color: 'var(--gray-5)', fontSize: 11 }}>~</span>
                                  <input className="cfg-input" type="number" style={{ width: 60 }} value={t.maxF} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, maxF: +e.target.value } : r))} />
                                </div>
                              </td>
                              <td>
                                <select className="cfg-input" value={t.tags} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, tags: e.target.value, category: e.target.value === 'kbeauty' ? 'K-뷰티' : '일반뷰티' } : r))}>
                                  <option value="kbeauty">K-뷰티</option>
                                  <option value="beauty">일반뷰티</option>
                                </select>
                              </td>
                              <td><button className="cfg-btn cfg-btn--danger" onClick={() => showConfirm(`"${t.label}" 티어를 삭제할까요?`, () => setTiers(prev => prev.filter((_, j) => j !== i)))}>×</button></td>
                            </>
                          ) : (
                            <>
                              <td><strong>{t.rank}</strong></td>
                              <td>{t.label}</td>
                              <td style={{ color: 'var(--gray-5)' }}>{(t.minF/1000).toFixed(0)}K~{(t.maxF/1000).toFixed(0)}K</td>
                              <td><span className="platform-badge" style={{ background: t.tags === 'kbeauty' ? '#111' : 'var(--blue)', color: '#fff' }}>{t.category}</span></td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tierEditMode && (
                  <button className="cfg-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setTiers(prev => [...prev, { rank: (prev.length + 1) + '순위', label: '새 티어', minF: 1000, maxF: 10000, tags: 'beauty', category: '일반뷰티' }])}>+ 티어 추가</button>
                )}
              </div>

              {/* Keywords */}
              <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>키워드 설정</div>
                {[
                  { key: 'kbeauty', label: 'K-뷰티 키워드', kws: kbeautyKws, editMode: kbeautyEdit, setEdit: setKbeautyEdit, newKw: newKbeautyKw, setNewKw: setNewKbeautyKw, setKws: setKbeautyKws, cfgKey: 'kbeauty_keywords', defaults: DEFAULT_KBEAUTY_KEYWORDS },
                  { key: 'beauty',  label: '일반뷰티 키워드', kws: beautyKws,  editMode: beautyEdit,   setEdit: setBeautyEdit,   newKw: newBeautyKw,  setNewKw: setNewBeautyKw,  setKws: setBeautyKws,  cfgKey: 'beauty_keywords',  defaults: DEFAULT_BEAUTY_KEYWORDS },
                ].map(({ key, label, kws, editMode, setEdit, newKw, setNewKw, setKws, cfgKey, defaults }) => {
                  const isChosen = apifyTierIdx !== null && tiers[apifyTierIdx]?.tags === key
                  const yellow = { background: 'var(--yellow)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-md)' }
                  const blue   = { background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid var(--blue)' }
                  return (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isChosen ? 'var(--yellow-text)' : 'var(--gray-6)' }}>
                          {label} {isChosen && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--yellow)', color: 'var(--yellow-text)', borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>선택됨</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="cfg-btn" onClick={() => setEdit(!editMode)}>{editMode ? '완료' : '편집'}</button>
                          <button className="cfg-btn cfg-btn--ghost" onClick={() => showConfirm('기본값으로 초기화?', () => { setKws([...defaults]); saveConfig(cfgKey, defaults); setEdit(false) })}>↺</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {kws.map(kw => (
                          <span key={kw} className="tag-pill" style={{ ...(isChosen ? yellow : blue) }}>
                            {kw}
                            {editMode && <button className="tag-remove" onClick={() => { const next = kws.filter(k => k !== kw); setKws(next); saveConfig(cfgKey, next) }}>×</button>}
                          </span>
                        ))}
                      </div>
                      {editMode && (
                        <div className="tag-input-row" style={{ marginTop: 6 }}>
                          <input className="cfg-input" placeholder="키워드 입력" value={newKw} onChange={e => setNewKw(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newKw.trim() && !kws.includes(newKw.trim())) { const next = [...kws, newKw.trim()]; setKws(next); saveConfig(cfgKey, next); setNewKw('') } }} />
                          <button className="cfg-btn" onClick={() => { if (newKw.trim() && !kws.includes(newKw.trim())) { const next = [...kws, newKw.trim()]; setKws(next); saveConfig(cfgKey, next); setNewKw('') } }}>추가</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Find Creators box */}
            <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20, marginBottom: 16 }}>
            <div className="filters" style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>선택 티어 <strong style={{ color: 'var(--yellow-text)' }}>{apifyTierIdx !== null ? tiers[apifyTierIdx]?.rank : '← 위 표에서 선택'}</strong></span>
              <div className="filter-group">
                <label>목표 인플루언서 수 (명)</label>
                <input type="number" value={targetCreators} min={10} max={1000} step={10} style={{ width: 70 }} onChange={e => setTargetCreators(+e.target.value)} />
              </div>
              <button className="listup-find-btn" disabled={apifyLoading || apifyPolling || apifyProcessing || apifyTierIdx === null} onClick={async () => {
                if (apifyTierIdx === null) return
                const tier = tiers[apifyTierIdx]
                setApifyLoading(true); setApifyStatus('Apify 탐색 시작...')
                setApifyResults(null); setApifyFilterStats(null)
                setApifyProcessing(false)
                existingHandlesRef.current = []
                prefetchExistingHandles()
                try {
                  const tags = tier.tags === 'kbeauty' ? kbeautyKws : beautyKws
                  const res: { error?: string; runId?: string; datasetId?: string } = await gasPost({
                    action: 'startCreatorSearch',
                    hashtags: tags,
                    searchFilters: buildSearchFilters(tier),
                    filterConditions: filterConds,
                  })
                  if (res.error) {
                    setApifyStatus('오류: ' + res.error)
                  } else {
                    setApifyRunId(res.runId || '')
                    setApifyDatasetId(res.datasetId || '')
                    setApifyCurrentTier(tier)
                    setApifyPolling(true)
                    setApifyStatus(`Apify 탐색 중... (Run: ${res.runId || ''})`)
                  }
                } catch (e: unknown) { setApifyStatus('오류: ' + (e as Error).message) }
                setApifyLoading(false)
              }}>Find Creators</button>
              {(apifyLoading || apifyPolling || apifyProcessing) && <Spinner sm />}
            </div>
            <div className="filters" style={{ marginBottom: 16, paddingTop: 12, borderTop: '1px solid var(--gray-2)' }}>
              <div className="filter-group" style={{ flex: 1, minWidth: 220 }}>
                <label>Apify Run / Dataset ID</label>
                <input
                  type="text"
                  value={apifyManualId}
                  placeholder="완료된 Run ID 또는 Dataset ID"
                  style={{ width: '100%', maxWidth: 320 }}
                  onChange={e => setApifyManualId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && apifyManualId.trim() && apifyTierIdx !== null) loadFromApifyId() }}
                />
              </div>
              <button
                className="listup-update-btn"
                disabled={apifyLoading || apifyPolling || apifyProcessing || apifyTierIdx === null || !apifyManualId.trim()}
                onClick={loadFromApifyId}
              >
                필터 적용
              </button>
              <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>완료된 Apify run에서 바로 필터링 (대기 없음)</span>
            </div>

            {/* Results */}
            {apifyResults !== null ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)' }}>
                    탐색 결과 <span style={{ color: 'var(--blue-dk)' }}>{apifyResults.length}명</span>
                    {apifyStatus && (
                      <span style={{ fontSize: 11, color: 'var(--gray-5)', fontWeight: 400, marginLeft: 8 }}>{apifyStatus}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--gray-5)', fontWeight: 400, marginLeft: 8 }}>
                      이메일 필수 · 팔로잉 비율 &le;{maxRatio}% · 최근 {maxUploadDays}일 이내 업로드
                      {apifyFilterStats && (apifyFilterStats.noEmailSkipped > 0 || apifyFilterStats.dedupSkipped > 0) && (
                        <> · 제외: 이메일 없음 {apifyFilterStats.noEmailSkipped}명, 중복 {apifyFilterStats.dedupSkipped}명</>
                      )}
                    </span>
                  </div>
                  <button className="cfg-btn" style={{ background: 'var(--blue-dk)', color: '#fff', borderColor: 'var(--blue-dk)' }} disabled={apifyLoading || !apifyResults.length} onClick={saveToSupabase}>
                    DB에 저장
                  </button>
                </div>
                {apifyResults.length > 0 ? (
                <div className="table-wrap">
                  <table style={{ minWidth: 0 }}>
                    <thead>
                      <tr>
                        <th>크리에이터 이름 + 핸들</th><th>이메일</th>
                        <th style={{ textAlign: 'right' }}>팔로워</th><th style={{ textAlign: 'right' }}>팔로잉</th><th style={{ textAlign: 'right' }}>팔로잉 비율</th>
                        <th style={{ textAlign: 'right' }}>영상 수</th><th style={{ textAlign: 'right' }}>참여율 (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apifyResults.map((c, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-8)' }}>{c.displayName || c.handle}</span>
                              <a href={`https://www.tiktok.com/@${c.handle}`} target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--blue-dk)', textDecoration: 'none' }}>@{c.handle}</a>
                            </div>
                          </td>
                          <td>{c.email ? <a href={`mailto:${c.email}`} style={{ color: '#1558b0', fontSize: 13 }}>{c.email}</a> : <span style={{ color: 'var(--gray-5)' }}>—</span>}</td>
                          <td className="num">{fmtNum(c.followers)}</td>
                          <td className="num">{fmtNum(c.following)}</td>
                          <td className="num">{c.ratio || '—'}</td>
                          <td className="num">{fmtNum(c.videoCount)}</td>
                          <td className="num">{c.engRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <div className="listup-empty-state" style={{ padding: '32px 24px' }}>
                    <div className="listup-empty-title">조건에 맞는 크리에이터가 없습니다</div>
                    <div className="listup-empty-desc">필터 조건을 완화하거나 다른 티어·키워드로 다시 탐색해 보세요.</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="listup-empty-state">
                <div className={`listup-empty-icon${(apifyPolling || apifyProcessing) ? ' listup-empty-icon--loading' : ''}`}>
                  {(apifyPolling || apifyProcessing) ? <Spinner /> : '🔍'}
                </div>
                <div className="listup-empty-title">
                  {apifyProcessing
                    ? '탐색 완료! 결과 처리 중...'
                    : apifyPolling
                      ? (apifyStatus || 'Apify 탐색 중...')
                      : apifyStatus && !apifyStatus.startsWith('Apify 탐색')
                        ? apifyStatus
                        : '티어를 선택하고 Find Creators를 누르세요'}
                </div>
                <div className="listup-empty-desc" style={{ whiteSpace: 'pre-line' }}>
                  {apifyProcessing
                    ? 'Apify 데이터를 가져와 필터를 적용하고 있습니다. 잠시만 기다려 주세요.'
                    : apifyPolling
                      ? 'Apify에서 TikTok 크리에이터를 탐색하고 있습니다. 2~5분 소요됩니다.'
                      : '위 표에서 티어를 클릭해 선택하고 Find Creators로 Apify 탐색을 시작합니다.\n이미 완료된 Run이 있으면 Run/Dataset ID를 입력해 필터 적용을 누르세요.'}
                </div>
              </div>
            )}
            </div>{/* end Find Creators box */}
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div>
            {dbLoading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
            {!dbLoading && renderDbTable()}
          </div>
        )}
      </div>

    </div>
  )
}
