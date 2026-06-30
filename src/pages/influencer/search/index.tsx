import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { gasPost } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { matchesKstDate, supabaseNow } from '@/lib/kst-time'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import Modal from '@/components/Modal'
import { DbTableRowSelect, DbTableSelectAll, DbSelectAllButton, dbTableRowClass } from '@/components/DbTableSelect'
import { FilterSegmentBar } from '@/components/FilterSegmentBar'
import { PageTabs } from '@/components/ui'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import {
  clampTargetCreators,
  isLowPerKeywordTarget,
  tcmKeywordLimitMessage,
  TCM_APIFY_SCRAPE_MAX,
  TCM_KEYWORD_MAX,
  tcmTargetLimitMessage,
  tcmPoolBuffer,
  TCM_POOL_BUFFER_MICRO,
  TCM_PER_KEYWORD_TARGET_WARN,
  TCM_TARGET_MAX,
  TCM_TARGET_MIN,
  tryToggleTcmKeyword,
} from '@/lib/influencer/tcm-search'
import { markInfluencerContact } from '@/lib/contact/contact-cancel'
import { SearchStatsCards, TIER_COLOR } from './SearchStatsCards'

type ListupTab = 'search' | 'database'

const DEFAULT_FILTER_CONDS: FilterCond[] = [
  { cat: '중복', desc: '1~5순위까지의 중복 계정 필터링', type: 'dedup', enabled: true },
]

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

interface Tier { rank: string; label: string; minF: number; maxF: number; tags: string; category: string }

type DbTierRow = {
  rank: string
  label: string
  category: string
  tags: string
  min_followers: number
  max_followers: number
}

function mapDbTier(row: DbTierRow): Tier {
  return {
    rank: row.rank,
    label: row.label,
    category: row.category,
    tags: row.tags,
    minF: row.min_followers,
    maxF: row.max_followers,
  }
}

async function fetchTiersFromDb(): Promise<Tier[]> {
  const { data } = await supabase
    .from('tiers')
    .select('rank, label, category, tags, min_followers, max_followers')
    .order('sort_order')
  return (data ?? []).map(mapDbTier)
}

const DB_TIERS = ['1순위','2순위','3순위','4순위','5순위']
interface Influencer  {
  id: string; created_at: string; phase_id: string; handle: string
  display_name: string | null; email: string | null; followers: number; following: number
  following_ratio: string | null;   total_likes: number; video_count: number
  engagement_rate: number; profile_url: string | null; avatar_url?: string | null; status: string
  contacted: boolean
  source_phase_id?: string | null
  tiers?: { rank: string; label: string; category: string } | null
}

function tierSortIndex(rank: string | null | undefined): number {
  const idx = DB_TIERS.indexOf(rank ?? '')
  return idx === -1 ? DB_TIERS.length : idx
}

function influencerDisplaySortKey(inf: Influencer): string {
  return (inf.display_name?.trim() || inf.handle || '').toLowerCase()
}

function compareInfluencersByTierAndName(a: Influencer, b: Influencer): number {
  if (a.contacted !== b.contacted) return a.contacted ? 1 : -1
  const tierDiff = tierSortIndex(a.tiers?.rank) - tierSortIndex(b.tiers?.rank)
  if (tierDiff !== 0) return tierDiff
  const nameDiff = influencerDisplaySortKey(a).localeCompare(influencerDisplaySortKey(b), 'ko', { sensitivity: 'base' })
  if (nameDiff !== 0) return nameDiff
  return a.handle.localeCompare(b.handle, 'ko', { sensitivity: 'base' })
}
interface ApifyCreator {
  handle: string; displayName: string; email: string; followers: number
  following: number; ratio: string; totalLikes: number; videoCount: number
  avgViews: number; engRate: number; bio: string; profileUrl: string; avatarUrl?: string
}

function formatPipelineStats(stats: { poolSize?: number; collectTarget?: number; apifyQueued?: number; scrapeLimit?: number } | null) {
  if (!stats || stats.poolSize == null) return ''
  const parts: string[] = [`TCM ${stats.poolSize}명`]
  if (stats.collectTarget != null && stats.poolSize < stats.collectTarget) {
    parts[0] = `TCM ${stats.poolSize}/${stats.collectTarget}명`
  }
  if (stats.apifyQueued != null) parts.push(`Apify ${stats.apifyQueued}명`)
  return parts.join(' · ')
}

function formatExclusionStats(stats: { noEmailSkipped: number; dedupSkipped: number; followRatioSkipped?: number } | null) {
  if (!stats) return ''
  const parts: string[] = []
  if (stats.noEmailSkipped > 0) parts.push(`이메일 없음 ${stats.noEmailSkipped}명 제외`)
  if (stats.dedupSkipped > 0) parts.push(`중복 ${stats.dedupSkipped}명 제외`)
  if (stats.followRatioSkipped && stats.followRatioSkipped > 0) parts.push(`팔로잉 비율 ${stats.followRatioSkipped}명 제외`)
  return parts.join(' · ')
}

function formatSearchDuration(ms: number, live = false) {
  const totalSec = live ? Math.floor(ms / 1000) : Math.max(1, Math.round(ms / 1000))
  if (totalSec < 60) return `${totalSec}초`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return sec > 0 ? `${min}분 ${sec}초` : `${min}분`
}

function formatSearchMeta(
  elapsedMs: number | null,
  stats: {
    noEmailSkipped: number
    dedupSkipped: number
    followRatioSkipped?: number
    poolSize?: number
    collectTarget?: number
    apifyQueued?: number
    scrapeLimit?: number
  } | null,
) {
  const parts: string[] = []
  if (elapsedMs != null) parts.push(formatSearchDuration(elapsedMs))
  const pipeline = formatPipelineStats(stats)
  if (pipeline) parts.push(pipeline)
  const exclusions = formatExclusionStats(stats)
  if (exclusions) parts.push(exclusions)
  return parts.join(' · ')
}

function saveConfig(key: string, value: unknown) {
  supabase.from('app_config').upsert({ key, value, updated_at: supabaseNow() }).then()
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

export default function Listup() {
  const { viewPhaseId, phases } = usePhase()
  const phaseLabel = phases.find(p => p.id === viewPhaseId)?.name ?? '1차'
  const phaseNameById = Object.fromEntries(phases.map(p => [p.id, p.name]))
  const otherPhases = phases.filter(p => p.id !== viewPhaseId)
  const { showToast, showConfirm } = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab: ListupTab = pathname.endsWith('/db') ? 'database' : 'search'

  // Config state (loaded from Supabase)
  const [configLoading, setConfigLoading] = useState(true)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [tierEditMode, setTierEditMode] = useState(false)
  const [kbeautyKws, setKbeautyKws] = useState<string[]>([])
  const [beautyKws, setBeautyKws] = useState<string[]>([])
  const initialKbeautyKwsRef = useRef<string[]>([])
  const initialBeautyKwsRef = useRef<string[]>([])
  const [kbeautyEdit, setKbeautyEdit] = useState(false)
  const [beautyEdit, setBeautyEdit] = useState(false)
  const [newKbeautyKw, setNewKbeautyKw] = useState('')
  const [newBeautyKw, setNewBeautyKw] = useState('')
  const [filterConds, setFilterConds] = useState<FilterCond[]>(DEFAULT_FILTER_CONDS)
  const [maxRatio, setMaxRatio] = useState(70)
  const [maxUploadDays, setMaxUploadDays] = useState(30)
  const [proxyCountry, setProxyCountry] = useState('US')
  const [requireEmail, setRequireEmail] = useState(true)

  // Apify / TCM search state
  const [apifyTierIdx, setApifyTierIdx] = useState<number | null>(null)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [targetCreators, setTargetCreators] = useState(100)
  const [apifyLoading, setApifyLoading] = useState(false)
  const [apifyResults, setApifyResults] = useState<ApifyCreator[] | null>(null)
  const [apifyCurrentTier, setApifyCurrentTier] = useState<Tier | null>(null)
  const [apifyFilterStats, setApifyFilterStats] = useState<{
    noEmailSkipped: number
    dedupSkipped: number
    followRatioSkipped?: number
    poolSize?: number
    collectTarget?: number
    apifyQueued?: number
    scrapeLimit?: number
  } | null>(null)
  const [searchElapsedMs, setSearchElapsedMs] = useState<number | null>(null)
  const [searchLiveMs, setSearchLiveMs] = useState(0)
  const existingHandlesRef = useRef<string[]>([])
  const searchStartedAtRef = useRef<number | null>(null)
  const [apifyManualId, setApifyManualId] = useState('')
  const [apifyImportLoading, setApifyImportLoading] = useState(false)

  useEffect(() => {
    if (!apifyLoading) return
    const tick = () => {
      if (searchStartedAtRef.current != null) {
        setSearchLiveMs(Date.now() - searchStartedAtRef.current)
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [apifyLoading])

  const selectedTier = apifyTierIdx !== null ? tiers[apifyTierIdx] ?? null : null

  const keywordCategories = [
    {
      tag: 'kbeauty' as const,
      title: 'K-뷰티',
      badgeBg: '#111',
      keywords: kbeautyKws,
      cfgKey: 'kbeauty_keywords' as const,
      initialRef: initialKbeautyKwsRef,
      edit: kbeautyEdit,
      setEdit: setKbeautyEdit,
      newKw: newKbeautyKw,
      setNewKw: setNewKbeautyKw,
      setKws: setKbeautyKws,
    },
    {
      tag: 'beauty' as const,
      title: '일반뷰티',
      badgeBg: 'var(--blue)',
      keywords: beautyKws,
      cfgKey: 'beauty_keywords' as const,
      initialRef: initialBeautyKwsRef,
      edit: beautyEdit,
      setEdit: setBeautyEdit,
      newKw: newBeautyKw,
      setNewKw: setNewBeautyKw,
      setKws: setBeautyKws,
    },
  ]

  const lowPerKeywordTarget = isLowPerKeywordTarget(targetCreators, selectedKeywords.length)

  function toggleKeyword(kw: string) {
    setSelectedKeywords(prev => {
      const { next, rejected } = tryToggleTcmKeyword(prev, kw)
      if (rejected) showToast(tcmKeywordLimitMessage(), 'error')
      return next
    })
  }

  function selectTier(idx: number) {
    setApifyTierIdx(idx)
    setSelectedKeywords([])
  }

  async function runTcmSearch() {
    if (apifyTierIdx === null || !selectedKeywords.length) return
    const tier = tiers[apifyTierIdx]
    setApifyLoading(true)
    setApifyResults(null)
    setApifyFilterStats(null)
    setSearchElapsedMs(null)
    setSearchLiveMs(0)
    setApifyCurrentTier(tier)
    existingHandlesRef.current = []
    const startedAt = Date.now()
    searchStartedAtRef.current = startedAt
    try {
      await prefetchExistingHandles()
      const res: {
        error?: string
        ok?: boolean
        creators?: ApifyCreator[]
        count?: number
        stats?: {
          noEmail?: number
          followRatio?: number
          dupes?: number
          followerRange?: number
          poolSize?: number
          collectTarget?: number
          scrapeLimit?: number
          apifyQueued?: number
          apifyScraped?: number
          buffer?: number
          uploadSkipped?: number
          country?: string
          apiError?: string
        }
      } = await gasPost({
        action: 'tcmRunSearch',
        params: {
          tierRank: tier.rank,
          tierLabel: tier.label,
          tierTags: tier.tags,
          category: tier.category,
          targetCount: clampTargetCreators(targetCreators),
          keywords: selectedKeywords,
          minF: tier.minF,
          maxF: tier.maxF,
          existingHandles: existingHandlesRef.current,
          maxRatio,
          maxUploadDays,
          requireEmail,
          proxyCountry: proxyCountry || 'US',
        },
      })
      if (res.error) {
        alert('오류: ' + res.error)
        return
      }
      if (res.stats?.apiError) {
        showToast('TCM API 오류 (일일 한도 초과 가능): ' + res.stats.apiError, 'error')
      }
      const list = res.creators ?? []
      const stats = res.stats
      setApifyResults(list)
      setApifyFilterStats({
        noEmailSkipped: stats?.noEmail ?? 0,
        dedupSkipped: stats?.dupes ?? 0,
        followRatioSkipped: stats?.followRatio ?? 0,
        poolSize: stats?.poolSize,
        collectTarget: stats?.collectTarget,
        apifyQueued: stats?.apifyQueued,
        scrapeLimit: stats?.scrapeLimit,
      })
    } catch (e: unknown) {
      alert('오류: ' + (e as Error).message)
    } finally {
      if (searchStartedAtRef.current != null) {
        setSearchElapsedMs(Date.now() - searchStartedAtRef.current)
      }
      setApifyLoading(false)
    }
  }

  // DB state
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const [dbLoaded, setDbLoaded] = useState(false)
  const [currentDbTab, setCurrentDbTab] = useState('전체')
  const [dateFrom, setDateFrom] = useState('')
  const [dbPage, setDbPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const [sheetUpdating, setSheetUpdating] = useState(false)
  const [sheetUrl,      setSheetUrl]      = useState<string | null>(null)

  const [showImportModal, setShowImportModal] = useState(false)
  const [importPhaseId, setImportPhaseId] = useState('')
  const [importTier, setImportTier] = useState('전체')
  const [importAcceptOnly, setImportAcceptOnly] = useState(false)
  const [importPreview, setImportPreview] = useState<{ add: number; skip: number } | null>(null)
  const [importing, setImporting] = useState(false)

  // Dashboard stats
  const [dashStats, setDashStats] = useState<{ total: number; contacted: number; confirmed: number; tiers: { rank: string; total: number }[] } | null>(null)

  // Load config once on mount
  useEffect(() => {
    ;(async () => {
      setConfigLoading(true)
      try {
        const [{ data: cfg }, dbTiers] = await Promise.all([
          supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['tiers', 'kbeauty_keywords', 'beauty_keywords', 'filter_conditions', 'search_filters']),
          fetchTiersFromDb(),
        ])

        const map = Object.fromEntries((cfg ?? []).map(r => [r.key, r.value]))

        const loadedTiers = map.tiers
          ? (map.tiers as Tier[])
          : dbTiers
        setTiers(loadedTiers)

        if (map.kbeauty_keywords) {
          const kws = map.kbeauty_keywords as string[]
          setKbeautyKws(kws)
          initialKbeautyKwsRef.current = [...kws]
        }
        if (map.beauty_keywords) {
          const kws = map.beauty_keywords as string[]
          setBeautyKws(kws)
          initialBeautyKwsRef.current = [...kws]
        }
        if (map.filter_conditions) setFilterConds(normalizeFilterConds(map.filter_conditions as FilterCond[]))
        if (map.search_filters) {
          const sf = map.search_filters as Partial<SearchFilters>
          setMaxRatio(sf.maxRatio ?? 70)
          setMaxUploadDays(sf.maxUploadDays ?? 30)
          setProxyCountry(sf.proxyCountry ?? 'US')
          setRequireEmail(sf.requireEmail !== false)
        }
      } finally {
        setConfigLoading(false)
      }
    })()
  }, [])

  async function resetTiersFromDb() {
    const dbTiers = await fetchTiersFromDb()
    setTiers(dbTiers)
    saveConfig('tiers', dbTiers)
    setTierEditMode(false)
  }

  async function loadDashStats() {
    if (!viewPhaseId) return
    const [{ data: infData }, { count: confirmedCount }] = await Promise.all([
      supabase.from('influencers').select('contacted, tiers(rank)').eq('phase_id', viewPhaseId),
      supabase.from('confirmed_influencers').select('*', { count: 'exact', head: true }).eq('phase_id', viewPhaseId),
    ])
    if (!infData) return
    let total = 0, contacted = 0
    const tierCounts: Record<string, number> = {}
    for (const r of infData as unknown as { contacted: boolean; tiers?: { rank: string } | null }[]) {
      total++
      if (r.contacted) contacted++
      const rank = r.tiers?.rank
      if (rank) tierCounts[rank] = (tierCounts[rank] ?? 0) + 1
    }
    const tierStats = DB_TIERS.map(rank => ({ rank, total: tierCounts[rank] ?? 0 }))
    setDashStats({ total, contacted, confirmed: confirmedCount ?? 0, tiers: tierStats })
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

  async function loadFromRunId() {
    const id = apifyManualId.trim()
    if (!id) return
    const tier = apifyTierIdx !== null ? tiers[apifyTierIdx] : null
    setApifyImportLoading(true)
    setApifyResults(null)
    setApifyFilterStats(null)
    setApifyCurrentTier(tier)
    existingHandlesRef.current = []
    try {
      await prefetchExistingHandles()
      const res: { ok?: boolean; creators?: ApifyCreator[]; noEmailSkipped?: number; dedupSkipped?: number; error?: string } =
        await gasPost({
          action: 'loadCreatorResults',
          runId: id,
          searchFilters: { maxRatio, maxUploadDays, requireEmail, followerMin: tier?.minF ?? 0, followerMax: tier?.maxF ?? 0, maxCreators: 500 },
          filterConditions: filterConds,
          existingHandles: existingHandlesRef.current,
        })
      if (res.error) { showToast('오류: ' + res.error, 'error'); return }
      setApifyResults(res.creators ?? [])
      setApifyFilterStats({ noEmailSkipped: res.noEmailSkipped ?? 0, dedupSkipped: res.dedupSkipped ?? 0 })
    } catch (e: unknown) {
      showToast('오류: ' + (e as Error).message, 'error')
    } finally {
      setApifyImportLoading(false)
    }
  }

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

  const loadImportPreview = useCallback(async () => {
    if (!viewPhaseId || !importPhaseId) { setImportPreview(null); return }
    const [{ data: current }, { data: source }] = await Promise.all([
      supabase.from('influencers').select('handle').eq('phase_id', viewPhaseId),
      supabase.from('influencers').select('handle, status, tiers(rank)').eq('phase_id', importPhaseId),
    ])
    const existingSet = new Set((current ?? []).map(r => r.handle.toLowerCase()))
    const sourceRows = (source ?? []) as unknown as Array<{ handle: string; status: string; tiers?: { rank: string } | null }>
    const filtered = sourceRows.filter(r => {
      if (importTier !== '전체' && r.tiers?.rank !== importTier) return false
      if (importAcceptOnly && r.status !== 'accept') return false
      return true
    })
    const add = filtered.filter(r => !existingSet.has(r.handle.toLowerCase())).length
    setImportPreview({ add, skip: filtered.length - add })
  }, [viewPhaseId, importPhaseId, importTier, importAcceptOnly])

  useEffect(() => {
    if (!showImportModal) return
    loadImportPreview()
  }, [showImportModal, loadImportPreview])

  async function importFromPhase() {
    if (!viewPhaseId || !importPhaseId) { showToast('불러올 차수를 선택하세요.', 'error'); return }
    if (!importPreview?.add) { showToast('추가할 인플루언서가 없습니다.', 'error'); return }

    setImporting(true)
    try {
      const [{ data: current }, { data: source }] = await Promise.all([
        supabase.from('influencers').select('handle').eq('phase_id', viewPhaseId),
        supabase.from('influencers').select(
          'handle, display_name, email, platform, followers, following, following_ratio, total_likes, video_count, engagement_rate, profile_url, tier_id, memo, status, tiers(rank)',
        ).eq('phase_id', importPhaseId),
      ])
      const existingSet = new Set((current ?? []).map(r => r.handle.toLowerCase()))
      const sourceRows = (source ?? []) as unknown as Array<{
        handle: string; display_name: string | null; email: string | null; platform: string | null
        followers: number; following: number; following_ratio: string | null; total_likes: number
        video_count: number; engagement_rate: number; profile_url: string | null; tier_id: string | null
        memo: string | null; status: string; tiers?: { rank: string } | null
      }>
      const rows = sourceRows
        .filter(r => {
          if (importTier !== '전체' && r.tiers?.rank !== importTier) return false
          if (importAcceptOnly && r.status !== 'accept') return false
          return !existingSet.has(r.handle.toLowerCase())
        })
        .map(r => ({
          phase_id:         viewPhaseId,
          source_phase_id:  importPhaseId,
          handle:           r.handle,
          display_name:     r.display_name,
          email:            r.email,
          platform:         r.platform,
          followers:        r.followers ?? 0,
          following:        r.following ?? 0,
          following_ratio:  r.following_ratio,
          total_likes:      r.total_likes ?? 0,
          video_count:      r.video_count ?? 0,
          engagement_rate:  r.engagement_rate ?? 0,
          profile_url:      r.profile_url,
          tier_id:          r.tier_id,
          memo:             r.memo,
          status:           '',
          contact_count:    0,
          last_contact_at:  null,
          reply_count:      0,
        }))

      if (!rows.length) {
        showToast('추가할 인플루언서가 없습니다.', 'error')
        return
      }

      const { error } = await supabase.from('influencers').insert(rows)
      if (error) { showToast(error.message, 'error'); return }

      showToast(`${rows.length}명을 ${phaseNameById[importPhaseId] ?? '이전 차수'}에서 불러왔습니다`, 'success')
      setShowImportModal(false)
      setImportPhaseId('')
      setImportPreview(null)
      loadInfluencers()
    } finally {
      setImporting(false)
    }
  }

  async function deleteInfluencer(id: string) {
    const { error } = await supabase.from('influencers').delete().eq('id', id)
    if (error) { alert('오류: ' + error.message); return }
    setInfluencers(prev => prev.filter(inf => inf.id !== id))
  }

  function requestDeleteInfluencer(id: string) {
    showConfirm('이 크리에이터를 삭제하시겠습니까?', () => { void deleteInfluencer(id) })
  }

  async function markContact(id: string) {
    const inf = influencers.find(r => r.id === id)
    if (!inf) return
    const { ok, error } = await markInfluencerContact(id, !!inf.contacted, inf.status)
    if (!ok) { showToast(error || '컨택 상태 변경 실패', 'error'); return }
    const nextContacted = !inf.contacted
    setInfluencers(prev => prev.map(r => r.id === id ? {
      ...r,
      contacted: nextContacted,
      status: nextContacted && !r.status ? 'target' : r.status,
    } : r))
  }

  async function bulkMarkTarget() {
    if (!selected.size) return
    setBulkLoading(true)
    const ids = Array.from(selected)
    const selectedRows = influencers.filter(inf => selected.has(inf.id))
    const { error } = await supabase.from('influencers').update({ contacted: true }).in('id', ids)
    if (error) {
      showToast(error.message, 'error')
      setBulkLoading(false)
      return
    }
    const needsStatus = selectedRows.filter(r => !r.status).map(r => r.id)
    if (needsStatus.length) {
      await supabase.from('influencers').update({ status: 'target' }).in('id', needsStatus)
    }
    setInfluencers(prev => prev.map(inf => selected.has(inf.id)
      ? { ...inf, contacted: true, status: inf.status || 'target' }
      : inf))
    setSelected(new Set())
    navigate('/influencer/contact')
    setBulkLoading(false)
  }

  async function saveToSupabase() {
    if (!apifyResults?.length || !viewPhaseId) return
    setApifyLoading(true)

    const tierQuery = apifyCurrentTier
      ? supabase.from('tiers').select('id').eq('rank', apifyCurrentTier.rank).maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [{ data: tierRow }, { data: existing }] = await Promise.all([
      tierQuery,
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
        engagement_rate:  c.engRate,
        profile_url:      c.profileUrl || null,
        avatar_url:       c.avatarUrl || null,
        status:           '',
      }))

    if (!rows.length) {
      alert('저장할 신규 크리에이터가 없습니다 (이메일 없음 또는 중복)')
      setApifyLoading(false)
      return
    }

    const { error, data } = await supabase
      .from('influencers')
      .upsert(rows, { onConflict: 'phase_id,handle', ignoreDuplicates: true })
      .select('*, tiers(rank, label, category)')
    if (error) {
      alert('저장 오류: ' + error.message)
    } else {
      const saved = data?.length ?? 0
      const skipped = rows.length - saved
      alert(`저장 완료: ${saved}명 추가${skipped > 0 ? ` (${skipped}명 중복 건너뜀)` : ''}`)
      if (data?.length) {
        setInfluencers(prev => [...(data as Influencer[]), ...prev])
        loadDashStats()
      }
      setDbLoaded(false)
      switchTab('database')
    }
    setApifyLoading(false)
  }

  function getFilteredInfluencers() {
    let list = influencers
    if (currentDbTab !== '전체') list = list.filter(inf => inf.tiers?.rank === currentDbTab)
    if (dateFrom) list = list.filter(inf => matchesKstDate(inf.created_at, dateFrom))
    return [...list].sort(compareInfluencersByTierAndName)
  }

  async function handleUpdateInfluencerSheet() {
    if (!viewPhaseId) { showToast('페이즈를 선택하세요.', 'error'); return }
    setSheetUpdating(true)
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; url?: string; count?: number; message?: string }>({
        action: 'updateInfluencerSheet',
        phaseId: viewPhaseId,
      })
      if (r.error) { showToast('오류: ' + r.error, 'error'); return }
      setSheetUrl(r.url ?? null)
      showToast(r.message || '시트 업데이트 완료', 'success')
    } catch (e: unknown) {
      showToast('오류: ' + (e as Error).message, 'error')
    } finally {
      setSheetUpdating(false)
    }
  }

  function renderDbTable() {
    const filtered = getFilteredInfluencers()
    const totalPages = Math.max(1, Math.ceil(filtered.length / DB_PAGE_SIZE))
    const safePage   = Math.min(dbPage, totalPages)
    const startIdx   = (safePage - 1) * DB_PAGE_SIZE
    const rows       = filtered.slice(startIdx, startIdx + DB_PAGE_SIZE)
    const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id))

    function toggleSelectAllFiltered() {
      if (allFilteredSelected) {
        setSelected(prev => {
          const next = new Set(prev)
          filtered.forEach(r => next.delete(r.id))
          return next
        })
      } else {
        setSelected(prev => new Set([...prev, ...filtered.map(r => r.id)]))
      }
    }

    return (
      <div>
        <FilterSegmentBar
          label="순위"
          ariaLabel="티어 필터"
          value={currentDbTab}
          onChange={v => { setCurrentDbTab(v); setDbPage(1) }}
          style={{ marginBottom: 12 }}
          leading={(
            <DbSelectAllButton
              allSelected={allFilteredSelected}
              disabled={filtered.length === 0}
              onClick={toggleSelectAllFiltered}
            />
          )}
          options={[
            { value: '전체', label: '전체' },
            ...DB_TIERS.map(rank => ({ value: rank, label: rank })),
          ]}
        >
          <span style={{ fontSize: 13, color: 'var(--gray-5)' }}>
            표시: <strong style={{ color: 'var(--yellow-text)' }}>{filtered.length}</strong>개
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={bulkMarkTarget}
              disabled={bulkLoading}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--blue-dk)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {bulkLoading ? '처리 중...' : `일괄 컨택 (${selected.size}명)`}
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--gray-5)', fontWeight: 600 }}>추가일</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDbPage(1) }}
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--gray-3)', outline: 'none' }} />
            {dateFrom && (
              <button type="button" onClick={() => setDateFrom('')}
                style={{ fontSize: 11, color: 'var(--gray-5)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setImportPhaseId(otherPhases[0]?.id ?? '')
                setImportTier('전체')
                setImportAcceptOnly(false)
                setShowImportModal(true)
              }}
              disabled={!otherPhases.length}
              style={{ marginLeft: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: '#6d28d9', color: '#fff', cursor: otherPhases.length ? 'pointer' : 'not-allowed', opacity: otherPhases.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              이전 차수 불러오기
            </button>
            <button
              type="button"
              onClick={() => navigate('/influencer/contact')}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--teal-dk)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              컨택 페이지 →
            </button>
          </div>
        </FilterSegmentBar>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <DbTableSelectAll
                    checked={rows.length > 0 && rows.every(r => selected.has(r.id))}
                    indeterminate={rows.some(r => selected.has(r.id)) && !rows.every(r => selected.has(r.id))}
                    onChange={checked => {
                      setSelected(prev => {
                        const next = new Set(prev)
                        rows.forEach(r => checked ? next.add(r.id) : next.delete(r.id))
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
                : rows.map((inf, i) => {
                  const tc = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                  return (
                    <tr
                      key={inf.id}
                      className={dbTableRowClass(selected.has(inf.id), inf.contacted)}
                      style={tc ? { borderLeft: `3px solid ${tc}` } : undefined}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <DbTableRowSelect
                          rowNumber={startIdx + i + 1}
                          checked={selected.has(inf.id)}
                          onChange={checked => setSelected(prev => {
                            const next = new Set(prev)
                            checked ? next.add(inf.id) : next.delete(inf.id)
                            return next
                          })}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-8)' }}>{inf.display_name || inf.handle}</span>
                          {inf.source_phase_id && (
                            <span style={{
                              display: 'inline-block', fontSize: 10, fontWeight: 700, width: 'fit-content',
                              background: '#ede9fe', color: '#6d28d9', borderRadius: 6, padding: '1px 6px',
                            }}>
                              {phaseNameById[inf.source_phase_id] ?? '이전 차수'} 이관
                            </span>
                          )}
                          <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--blue-dk)', textDecoration: 'none' }}>@{inf.handle}</a>
                        </div>
                      </td>
                      <td>{inf.email ? <a href={`mailto:${inf.email}`} style={{ color: '#1558b0', fontSize: 13 }}>{inf.email}</a> : <span style={{ color: 'var(--gray-5)' }}>—</span>}</td>
                      <td className="num">{fmtNum(inf.followers)}</td>
                      <td className="num">{fmtNum(inf.following)}</td>
                      <td className="num">{inf.following_ratio || '—'}</td>
                      <td className="num">{fmtNum(inf.video_count)}</td>

                      <td className="num">{inf.engagement_rate}%</td>
                      <td style={{ paddingRight: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <button
                            onClick={() => markContact(inf.id)}
                            style={{
                              padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap',
                              border: `1.5px solid ${inf.contacted ? '#6ee7b7' : '#e2e8f0'}`,
                              background: inf.contacted ? '#d1fae5' : '#f1f5f9',
                              color: inf.contacted ? '#065f46' : '#94a3b8',
                            }}>
                            {inf.contacted ? '✓ 컨택' : '컨택'}
                          </button>
                          <button
                            onClick={() => requestDeleteInfluencer(inf.id)}
                            style={{
                              width: 24, height: 24, borderRadius: 6, border: '1px solid #fecaca',
                              background: '#fff5f5', color: '#dc2626', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 700, flexShrink: 0,
                            }}
                            title="삭제"
                          >
                            ×
                          </button>
                        </div>
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

  const searchResultMeta = apifyResults !== null
    ? formatSearchMeta(searchElapsedMs, apifyFilterStats)
    : ''

  return (
    <div className="page page--fill" id="page-listup">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="인플루언서 리스트업"
          description="Apify를 통해 조건에 맞는 TikTok 크리에이터를 탐색하고, 1~5순위 티어로 분류하여 인플루언서 DB관리 합니다."
          actions={(
            <>
              {sheetUrl && (
                <a href={sheetUrl} target="_blank" rel="noopener" className="page-banner-btn page-banner-btn--green" style={{ textDecoration: 'none' }}>시트 열기</a>
              )}
              <button className="page-banner-btn page-banner-btn--secondary" onClick={() => { void handleUpdateInfluencerSheet() }} disabled={sheetUpdating}>
                {sheetUpdating ? '업데이트 중…' : '시트 업데이트'}
              </button>
              <button className="page-banner-btn page-banner-btn--secondary" onClick={() => { setDbLoaded(false); switchTab('database') }}><span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침</button>
            </>
          )}
        />
      </PageHeroBanner>

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
            <div className="listup-filter-panel">
              <div className="listup-setup-head">인플루언서 필터링 조건</div>
              <div className="listup-filter-grid listup-filter-grid--inline">
                  <div className="listup-filter-item listup-filter-item--wide">
                    <span className="listup-filter-item__label">팔로잉 비율</span>
                    <p className="listup-filter-item__sentence">
                      팔로잉 수가 팔로워 수의{' '}
                      <select className="listup-filter-control listup-filter-control--inline" value={maxRatio}
                        onChange={e => { const v = +e.target.value; setMaxRatio(v); saveSearchFilters({ maxRatio: v, maxUploadDays, proxyCountry, requireEmail }) }}>
                        <option value={50}>50%</option>
                        <option value={60}>60%</option>
                        <option value={70}>70%</option>
                        <option value={80}>80%</option>
                      </select>
                      {' '}초과 시 제외
                    </p>
                  </div>
                  <div className="listup-filter-item listup-filter-item--wide">
                    <span className="listup-filter-item__label">업로드 주기</span>
                    <p className="listup-filter-item__sentence">
                      최근{' '}
                      <select className="listup-filter-control listup-filter-control--inline" value={maxUploadDays}
                        onChange={e => { const v = +e.target.value; setMaxUploadDays(v); saveSearchFilters({ maxRatio, maxUploadDays: v, proxyCountry, requireEmail }) }}>
                        <option value={30}>30일</option>
                        <option value={49}>7주</option>
                      </select>
                      {' '}이내 미업로드 계정 제외
                    </p>
                  </div>
                  <div className="listup-filter-item">
                    <span className="listup-filter-item__label">국가</span>
                    <div className="listup-filter-item__control">
                      <select className="listup-filter-control listup-filter-control--wide" value={proxyCountry}
                        onChange={e => { const v = e.target.value; setProxyCountry(v); saveSearchFilters({ maxRatio, maxUploadDays, proxyCountry: v, requireEmail }) }}>
                        {Object.entries(COUNTRY_MAP).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="listup-filter-item listup-filter-item--wide">
                    <span className="listup-filter-item__label">이메일</span>
                    <label className="listup-filter-check">
                      <input type="checkbox" checked={requireEmail}
                        onChange={e => { const v = e.target.checked; setRequireEmail(v); saveSearchFilters({ maxRatio, maxUploadDays, proxyCountry, requireEmail: v }) }} />
                      bio에 이메일이 없는 계정 제외
                    </label>
                  </div>
                  <div className="listup-filter-item listup-filter-item--wide">
                    <span className="listup-filter-item__label">중복</span>
                    <label className="listup-filter-check">
                      <input type="checkbox" checked={(filterConds.find(isDedupCond) ?? DEFAULT_FILTER_CONDS[0]).enabled !== false}
                        onChange={e => setDedupEnabled(e.target.checked)} />
                      {(filterConds.find(isDedupCond) ?? DEFAULT_FILTER_CONDS[0]).desc}
                    </label>
                  </div>
                </div>
            </div>

            <div className="listup-setup-row">
              <div className="listup-setup-box">
                  <div className="listup-setup-col__head">
                    <div className="listup-setup-head listup-setup-head--blue">우선순위 등급표</div>
                    <div className="listup-setup-col__actions">
                      <button className="cfg-btn" onClick={() => { if (tierEditMode) saveConfig('tiers', tiers); setTierEditMode(!tierEditMode) }}>{tierEditMode ? '완료' : '편집'}</button>
                      <button className="cfg-btn cfg-btn--ghost" onClick={() => showConfirm('DB 기본값으로 초기화하시겠습니까?', () => resetTiersFromDb())}>↺</button>
                    </div>
                  </div>
                  {configLoading ? (
                    <div className="listup-setup-loading"><Spinner sm /> 불러오는 중...</div>
                  ) : (
                    <div className="listup-flat-table-wrap">
                      <table className="listup-tier-table">
                        <thead>
                          <tr>
                            <th>순위</th>
                            <th>규모</th>
                            <th>팔로워 범위</th>
                            <th>카테고리</th>
                            {tierEditMode && <th className="listup-tier-table__action-col" />}
                          </tr>
                        </thead>
                        <tbody>
                          {tiers.map((t, i) => (
                            <tr
                              key={i}
                              className={[
                                tierEditMode ? '' : 'listup-tier-row',
                                !tierEditMode && apifyTierIdx === i ? 'listup-tier-row--selected' : '',
                              ].filter(Boolean).join(' ')}
                              onClick={() => !tierEditMode && selectTier(i)}
                            >
                              {tierEditMode ? (
                                <>
                                  <td><input className="cfg-input cfg-input--sm" value={t.rank} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, rank: e.target.value } : r))} /></td>
                                  <td><input className="cfg-input cfg-input--sm cfg-input--md" value={t.label} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} /></td>
                                  <td>
                                    <div className="listup-tier-range">
                                      <input className="cfg-input cfg-input--sm" type="number" value={t.minF} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, minF: +e.target.value } : r))} />
                                      <span>~</span>
                                      <input className="cfg-input cfg-input--sm" type="number" value={t.maxF} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, maxF: +e.target.value } : r))} />
                                    </div>
                                  </td>
                                  <td>
                                    <select className="cfg-input cfg-input--sm" value={t.tags} onChange={e => setTiers(prev => prev.map((r, j) => j === i ? { ...r, tags: e.target.value, category: e.target.value === 'kbeauty' ? 'K-뷰티' : '일반뷰티' } : r))}>
                                      <option value="kbeauty">K-뷰티</option>
                                      <option value="beauty">일반뷰티</option>
                                    </select>
                                  </td>
                                  <td className="listup-tier-table__action-col">
                                    <button type="button" className="listup-tier-del" onClick={() => showConfirm(`"${t.label}" 티어를 삭제할까요?`, () => setTiers(prev => prev.filter((_, j) => j !== i)))} title="삭제">×</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td><strong>{t.rank}</strong></td>
                                  <td>{t.label}</td>
                                  <td className="listup-tier-table__muted">{(t.minF/1000).toFixed(0)}K~{(t.maxF/1000).toFixed(0)}K</td>
                                  <td>
                                    <span className="platform-badge" style={{ background: t.tags === 'kbeauty' ? '#111' : 'var(--blue)', color: '#fff' }}>{t.category}</span>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {tierEditMode && !configLoading && (
                    <button type="button" className="listup-tier-add" onClick={() => setTiers(prev => [...prev, { rank: (prev.length + 1) + '순위', label: '새 티어', minF: 1000, maxF: 10000, tags: 'beauty', category: '일반뷰티' }])}>+ 티어 추가</button>
                  )}
                </div>

              <div className="listup-setup-box">
                  <div className="listup-setup-col__head">
                    <div className="listup-setup-head">키워드 설정</div>
                    <div className="listup-setup-col__actions">
                      <button
                        type="button"
                        className="cfg-btn cfg-btn--ghost"
                        disabled={!selectedKeywords.length}
                        onClick={() => setSelectedKeywords([])}
                        title="선택한 키워드 초기화"
                      >
                        ↺ 선택 초기화
                      </button>
                    </div>
                  </div>
                  <div className="listup-keyword-sub">
                    키워드 복수 선택 (TCM) · 최대 {TCM_KEYWORD_MAX}개
                    {selectedTier ? (
                      selectedKeywords.length > 0 ? (
                        <> · <strong>{selectedTier.category}</strong> 목록 · <strong>{selectedKeywords.length}/{TCM_KEYWORD_MAX}</strong></>
                      ) : (
                        <> · <strong>탐색할 키워드를 1개 이상 선택하세요 (최대 {TCM_KEYWORD_MAX}개)</strong></>
                      )
                    ) : (
                      ' · 티어 선택 시 해당 카테고리에서 선택'
                    )}
                  </div>
                {keywordCategories.map((cat, idx) => {
                  const selectable = selectedTier?.tags === cat.tag
                  const yellow = { background: 'var(--yellow)', color: 'var(--yellow-text)', border: '1px solid var(--yellow-md)' }
                  const blue   = { background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid var(--blue)' }
                  const muted  = { background: 'var(--gray-1)', color: 'var(--gray-5)', border: '1px solid var(--gray-2)' }
                  return (
                    <div key={cat.tag} className={`listup-keyword-block${idx < keywordCategories.length - 1 ? '' : ' listup-keyword-block--last'}`}>
                      <div className="listup-keyword-block__head">
                        <div className="listup-keyword-block__title">
                          <span className="platform-badge" style={{ background: cat.badgeBg, color: '#fff' }}>{cat.title}</span>
                          {selectable && <span className="listup-keyword-block__hint">선택 가능</span>}
                        </div>
                        <div className="listup-setup-col__actions">
                          <button type="button" className="cfg-btn" onClick={() => cat.setEdit(!cat.edit)}>{cat.edit ? '완료' : '편집'}</button>
                          {cat.edit && (
                            <button
                              type="button"
                              className="cfg-btn cfg-btn--ghost"
                              onClick={() => showConfirm('처음 불러온 값으로 목록을 복원할까요?', () => {
                                const kws = [...cat.initialRef.current]
                                cat.setKws(kws)
                                saveConfig(cat.cfgKey, kws)
                                if (selectedKeywords.some(k => !kws.includes(k))) {
                                  setSelectedKeywords(prev => prev.filter(k => kws.includes(k)))
                                }
                                cat.setEdit(false)
                              })}
                            >
                              목록 복원
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {cat.keywords.map(kw => {
                          const isSelected = selectable && selectedKeywords.includes(kw)
                          return (
                            <span
                              key={kw}
                              className="tag-pill"
                              style={{
                                ...(isSelected ? yellow : selectable ? blue : muted),
                                cursor: cat.edit || selectable ? (cat.edit ? 'default' : 'pointer') : 'default',
                                opacity: selectable || cat.edit ? 1 : 0.85,
                              }}
                              onClick={() => { if (!cat.edit && selectable) toggleKeyword(kw) }}
                            >
                              {kw}
                              {cat.edit && (
                                <button className="tag-remove" onClick={e => {
                                  e.stopPropagation()
                                  showConfirm(`「${kw}」 키워드를 삭제하시겠습니까?`, () => {
                                    const next = cat.keywords.filter(k => k !== kw)
                                    cat.setKws(next)
                                    saveConfig(cat.cfgKey, next)
                                    if (selectedKeywords.includes(kw)) {
                                      setSelectedKeywords(prev => prev.filter(k => k !== kw))
                                    }
                                  })
                                }}>×</button>
                              )}
                            </span>
                          )
                        })}
                        {!configLoading && cat.keywords.length === 0 && (
                          <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>키워드 없음</span>
                        )}
                      </div>
                      {cat.edit && (
                        <div className="tag-input-row" style={{ marginTop: 6 }}>
                          <input className="cfg-input" placeholder="키워드 입력" value={cat.newKw} onChange={e => cat.setNewKw(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && cat.newKw.trim() && !cat.keywords.includes(cat.newKw.trim())) {
                                const next = [...cat.keywords, cat.newKw.trim()]
                                cat.setKws(next)
                                saveConfig(cat.cfgKey, next)
                                cat.setNewKw('')
                              }
                            }} />
                          <button className="cfg-btn" onClick={() => {
                            if (cat.newKw.trim() && !cat.keywords.includes(cat.newKw.trim())) {
                              const next = [...cat.keywords, cat.newKw.trim()]
                              cat.setKws(next)
                              saveConfig(cat.cfgKey, next)
                              cat.setNewKw('')
                            }
                          }}>추가</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {lowPerKeywordTarget && (
                  <div className="listup-keyword-warn">
                    키워드당 목표가 {TCM_PER_KEYWORD_TARGET_WARN}명 미만입니다. 결과가 부족할 수 있으니 키워드 수를 줄이거나 목표를 늘려 보세요.
                  </div>
                )}
              </div>
            </div>

            {/* Find Creators */}
            <div className="listup-search-panel">
              <div className="listup-search-bar">
                <div className="listup-search-bar__meta">
                  {selectedTier ? (
                    <>
                      선택 티어{' '}
                      <span className="listup-search-bar__cat">{selectedTier.category}</span>
                      <strong>{selectedTier.rank}</strong>
                      {selectedKeywords.length > 0 && (
                        <> · 키워드 <strong>{selectedKeywords.length}/{TCM_KEYWORD_MAX}</strong> {selectedKeywords.join(', ')}</>
                      )}
                    </>
                  ) : (
                    <>선택 티어 <strong>← 위 표에서 선택</strong></>
                  )}
                </div>
                <div className="listup-search-bar__target">
                  <label htmlFor="tcm-target-count">목표 인플루언서 수 (명, 최대 {TCM_TARGET_MAX})</label>
                  <input
                    id="tcm-target-count"
                    type="number"
                    value={targetCreators}
                    min={TCM_TARGET_MIN}
                    max={TCM_TARGET_MAX}
                    step={1}
                    onChange={e => setTargetCreators(Math.min(TCM_TARGET_MAX, +e.target.value || 0))}
                  />
                </div>
                <button
                  className="listup-find-btn"
                  disabled={apifyLoading || apifyTierIdx === null || !selectedKeywords.length}
                  onClick={runTcmSearch}
                >
                  Find Creators (TCM)
                </button>
                {apifyLoading && (
                  <span className="listup-search-bar__timer">
                    {formatSearchDuration(searchLiveMs, true)}
                  </span>
                )}
              </div>

              {/* Run ID import */}
              <div className="listup-run-id-bar">
                <span className="listup-run-id-bar__label">Run ID 가져오기</span>
                <input
                  type="text"
                  className="listup-run-id-bar__input"
                  value={apifyManualId}
                  placeholder="완료된 Apify Run ID"
                  onChange={e => setApifyManualId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && apifyManualId.trim()) void loadFromRunId() }}
                />
                <button
                  className="cfg-btn"
                  disabled={apifyImportLoading || apifyLoading || !apifyManualId.trim()}
                  onClick={() => { void loadFromRunId() }}
                >
                  {apifyImportLoading ? <Spinner sm /> : '필터 적용'}
                </button>
                <span className="listup-run-id-bar__hint">중복 제거 후 신규 크리에이터만 표시</span>
              </div>

              {/* Empty / loading state inside the config panel */}
              {apifyResults === null && (
                <div className="listup-empty-state">
                  <div className={`listup-empty-icon${apifyLoading ? ' listup-empty-icon--loading' : ''}`}>
                    {apifyLoading ? <Spinner /> : <Search size={26} strokeWidth={2.2} aria-hidden />}
                  </div>
                  <div className="listup-empty-title">
                    {apifyLoading
                      ? 'TCM 탐색 중...'
                      : '티어와 키워드를 선택하고 Find Creators를 누르세요'}
                  </div>
                  <div className="listup-empty-desc">
                    {apifyLoading
                      ? 'TCM 키워드 탐색 후 프로필 메타데이터를 수집합니다. 수 분 소요될 수 있습니다.'
                      : '위 표에서 티어를 클릭해 선택하고 Find Creators로 탐색을 시작하세요.'}
                  </div>
                </div>
              )}
            </div>{/* end Find Creators config panel */}

            {/* Results panel — separate card below config */}
            {apifyResults !== null && (
              <div className="listup-search-panel">
                <div className="listup-results-bar">
                  <div className="listup-results-bar__count">
                    탐색 결과 <span style={{ color: 'var(--blue-dk)' }}>{apifyResults.length}명</span>
                    {searchResultMeta && (
                      <span className="listup-results-bar__meta">· {searchResultMeta}</span>
                    )}
                  </div>
                  <button className="cfg-btn cfg-btn--blue" disabled={apifyLoading || !apifyResults.length} onClick={saveToSupabase}>
                    DB에 저장
                  </button>
                </div>
                {apifyResults.length > 0 ? (
                  <div style={{ padding: '16px 18px' }}>
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
                  </div>
                ) : (
                  <div className="listup-empty-state" style={{ padding: '32px 24px' }}>
                    <div className="listup-empty-title">조건에 맞는 크리에이터가 없습니다</div>
                    <div className="listup-empty-desc">필터 조건을 완화하거나 다른 티어·키워드로 다시 탐색해 보세요.</div>
                  </div>
                )}
              </div>
            )}
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

      <Modal open={showImportModal} onClose={() => !importing && setShowImportModal(false)} title="이전 차수 불러오기">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 320 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-6)', lineHeight: 1.6, margin: 0 }}>
            다른 차수의 인플루언서를 현재 차수 DB에 복사합니다. 프로필·티어는 유지되며, 중복 핸들은 제외됩니다.
          </p>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 6 }}>불러올 차수</label>
            <select value={importPhaseId} onChange={e => setImportPhaseId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="">선택…</option>
              {otherPhases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', display: 'block', marginBottom: 6 }}>티어</label>
            <select value={importTier} onChange={e => setImportTier(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="전체">전체</option>
              {DB_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={importAcceptOnly} onChange={e => setImportAcceptOnly(e.target.checked)} />
            확정(accept) 상태만 불러오기
          </label>
          {importPreview && importPhaseId && (
            <div style={{ fontSize: 12, color: 'var(--gray-6)', background: 'var(--gray-1)', borderRadius: 8, padding: '10px 12px' }}>
              <strong style={{ color: 'var(--teal-dk)' }}>{importPreview.add}명</strong> 추가 · 중복 {importPreview.skip}명 제외
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="cfg-btn cfg-btn--ghost" disabled={importing} onClick={() => setShowImportModal(false)}>취소</button>
            <button type="button" className="cfg-btn" disabled={importing || !importPhaseId || !importPreview?.add}
              style={{ background: 'var(--teal-dk)', color: '#fff', borderColor: 'var(--teal-dk)' }}
              onClick={importFromPhase}>
              {importing ? '불러오는 중…' : `${importPreview?.add ?? 0}명 불러오기`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
