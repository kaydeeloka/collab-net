import { supabase } from '@/lib/supabase'
import { PLATFORM_BUCKETS, PLATFORM_DISPLAY, platformBucket, type PlatformBucket } from '@/lib/influencer/content-platforms'

export const MON_SCRAPE_LIMIT = 50

export interface MonitoringRow {
  id:                      string
  influencer_platform_id:  string | null
  confirmed_influencer_id: string | null
  seq:                     number | null
  platform:                string
  handle:                  string
  display_name:            string | null
  avatar_url:              string | null
  date:                    string | null
  media:                   string | null
  content:                 string | null
  brand:                   string | null
  repost:                  string | null
  review_link:             string | null
  views:                   number
  likes:                   number
  comments:                number
  keywords:                string | null
  updated:                 string | null
  isPlaceholder?:          boolean
}

export interface ContentTypeRow {
  label:     string
  tiktok:    number
  instagram: number
  magazine:  number
  total:     number
}

export interface PlatformPerformanceRow {
  platform:     string
  label:        string
  count:        number
  avgViews:     number | null
  avgLikes:     number | null
  avgComments:  number | null
}

export interface CollectionRate {
  current: number
  total:   number
  pct:     number
}

export interface ReportSummary {
  uploadRate:   CollectionRate & { notUploaded: number }
  totalContent: { count: number; mimuse: number; brand: number }
  engagement:   { views: number; likes: number; comments: number }
}

export interface BrandPerformanceRow {
  key:         'mimuse' | 'brand'
  label:       string
  count:       number
  avgViews:    number | null
  avgLikes:    number | null
  avgComments: number | null
}

export interface TopPostRow {
  id:            string
  rank:          number
  handle:        string
  displayName:   string | null
  platform:      string
  platformLabel: string
  brand:         string | null
  brandLabel:    string
  views:         number
  likes:         number
  comments:      number
  reviewLink:    string
}

export interface UploadChannelSegment {
  key:   PlatformBucket
  label: string
  count: number
  pct:   number
}

export interface ContentReport {
  summary:             ReportSummary
  contentTypeRows:       ContentTypeRow[]
  brandPerformanceRows:  BrandPerformanceRow[]
  performanceRows:       PlatformPerformanceRow[]
  topPosts:              TopPostRow[]
  uploadChannels:        UploadChannelSegment[]
}

const BRAND_PERF_LABELS: Record<'mimuse' | 'brand', string> = {
  mimuse: 'Mi Muse',
  brand:  '브랜드별',
}

const TOP_POSTS_LIMIT = 10

function brandDisplayLabel(brand: string | null): string {
  const b = (brand || '').toLowerCase()
  if (!b) return '—'
  if (b === 'mimuse') return 'Mi Muse'
  return brand!
}

function buildBrandPerformanceRows(reviewRows: MonitoringRow[]): BrandPerformanceRow[] {
  return (['mimuse', 'brand'] as const).map(key => {
    const matched = reviewRows.filter(r => contentTypeBucket(r.brand) === key)
    return {
      key,
      label:       BRAND_PERF_LABELS[key],
      count:       matched.length,
      avgViews:    matched.length ? avgField(matched, 'views') : null,
      avgLikes:    matched.length ? avgField(matched, 'likes') : null,
      avgComments: matched.length ? avgField(matched, 'comments') : null,
    }
  })
}

function buildTopPosts(reviewRows: MonitoringRow[]): TopPostRow[] {
  return reviewRows
    .slice()
    .sort((a, b) => b.views - a.views || b.likes - a.likes)
    .slice(0, TOP_POSTS_LIMIT)
    .map((r, i) => {
      const bucket = platformBucket(r.platform)
      return {
        id:            r.id,
        rank:          i + 1,
        handle:        r.handle,
        displayName:   r.display_name,
        platform:      r.platform,
        platformLabel: PLATFORM_DISPLAY[bucket].label,
        brand:         r.brand,
        brandLabel:    brandDisplayLabel(r.brand),
        views:         r.views,
        likes:         r.likes,
        comments:      r.comments,
        reviewLink:    r.review_link!,
      }
    })
}

function mapMonitoringRecord(m: any): MonitoringRow {
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
    views:                   m.views    || 0,
    likes:                   m.likes    || 0,
    comments:                m.comments || 0,
    keywords:                m.keywords,
    updated:                 m.updated,
  }
}

function buildPlaceholder(ci: any, ip: { id: string; platform: string; handle: string } | null): MonitoringRow {
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
    views:                   0,
    likes:                   0,
    comments:                 0,
    keywords:                null,
    updated:                 null,
    isPlaceholder:           true,
  }
}

function sortGroupRows(group: MonitoringRow[]): MonitoringRow[] {
  return group.slice().sort((a, b) => {
    const da = a.date || ''
    const db = b.date || ''
    if (da !== db) return db.localeCompare(da)
    return a.id.localeCompare(b.id)
  })
}

export async function loadMonitoringData(phaseId: string): Promise<{ rows: MonitoringRow[]; confirmedCount: number }> {
  const monitoringSelect = `
    id, date, media, content, brand, review_link, views, likes, comments, keywords, updated,
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
      .eq('phase_id', phaseId)
      .order('seq', { ascending: true, nullsFirst: false }),
    supabase
      .from('monitoring')
      .select(monitoringSelect)
      .order('date', { ascending: false }),
  ])

  if (confirmedRes.error) throw confirmedRes.error
  if (monitoringRes.error) throw monitoringRes.error

  const confirmed = (confirmedRes.data || []).slice(0, MON_SCRAPE_LIMIT)

  const confirmedById = new Map<string, any>()
  const platformToConfirmed = new Map<string, any>()
  for (const ci of confirmed) {
    confirmedById.set(ci.id, ci)
    for (const ip of ci.influencer_platform || []) {
      platformToConfirmed.set(ip.id, ci)
    }
  }

  const monitoringByConfirmedId = new Map<string, MonitoringRow[]>()
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

  const rows: MonitoringRow[] = []
  for (const ci of confirmed) {
    const monRows = monitoringByConfirmedId.get(ci.id)
    if (monRows?.length) {
      rows.push(...sortGroupRows(monRows))
    } else {
      const platforms = ci.influencer_platform || []
      const primary = platforms.find((p: any) => (p.platform || '').toLowerCase().includes('tiktok')) || platforms[0]
      rows.push(buildPlaceholder(ci, primary ?? null))
    }
  }

  return { rows, confirmedCount: confirmed.length }
}

function isUploaded(r: MonitoringRow): boolean {
  return !!r.review_link?.startsWith('http')
}

function contentTypeBucket(brand: string | null): 'mimuse' | 'brand' | null {
  const b = (brand || '').toLowerCase()
  if (!b) return null
  if (b === 'mimuse') return 'mimuse'
  return 'brand'
}

function pct(current: number, total: number): number {
  return total ? Math.round((current / total) * 100) : 0
}

function avgField(rows: MonitoringRow[], field: 'views' | 'likes' | 'comments'): number {
  if (!rows.length) return 0
  return Math.round(rows.reduce((s, r) => s + r[field], 0) / rows.length)
}

function platformSupportsLikes(key: PlatformBucket): boolean {
  return key !== 'magazine'
}

export function computeContentReport(rows: MonitoringRow[]): ContentReport {
  const reviewRows = rows.filter(isUploaded)

  const groupMap = new Map<string, MonitoringRow[]>()
  for (const r of rows) {
    const key = r.confirmed_influencer_id || r.influencer_platform_id || r.id
    const list = groupMap.get(key) || []
    list.push(r)
    groupMap.set(key, list)
  }
  const groups = Array.from(groupMap.values())

  const uploadedGroups = groups.filter(g => g.some(isUploaded)).length
  const mimuseCount = reviewRows.filter(r => contentTypeBucket(r.brand) === 'mimuse').length
  const brandCount  = reviewRows.filter(r => contentTypeBucket(r.brand) === 'brand').length

  const typeDefs = [
    { key: 'mimuse' as const, label: 'Mi Muse 리뷰' },
    { key: 'brand'  as const, label: '개별 브랜드 리뷰' },
  ]

  const contentTypeRows: ContentTypeRow[] = typeDefs.map(t => {
    const matched = reviewRows.filter(r => contentTypeBucket(r.brand) === t.key)
    return {
      label:     t.label,
      tiktok:    matched.filter(r => platformBucket(r.platform) === 'tiktok').length,
      instagram: matched.filter(r => platformBucket(r.platform) === 'instagram').length,
      magazine:  matched.filter(r => platformBucket(r.platform) === 'magazine').length,
      total:     matched.length,
    }
  })

  contentTypeRows.push({
    label:     '합계',
    tiktok:    contentTypeRows.reduce((s, r) => s + r.tiktok, 0),
    instagram: contentTypeRows.reduce((s, r) => s + r.instagram, 0),
    magazine:  contentTypeRows.reduce((s, r) => s + r.magazine, 0),
    total:     reviewRows.filter(r => contentTypeBucket(r.brand)).length,
  })

  const platformDefs = PLATFORM_BUCKETS.map(key => ({
    key,
    label: PLATFORM_DISPLAY[key].label,
  }))

  const performanceRows: PlatformPerformanceRow[] = platformDefs.map(p => {
    const matched = reviewRows.filter(r => platformBucket(r.platform) === p.key)
    return {
      platform:    p.key,
      label:       p.label,
      count:       matched.length,
      avgViews:    matched.length ? avgField(matched, 'views') : null,
      avgLikes:    matched.length && platformSupportsLikes(p.key) ? avgField(matched, 'likes') : null,
      avgComments: matched.length ? avgField(matched, 'comments') : null,
    }
  })

  const channelTotal = reviewRows.length
  const uploadChannels: UploadChannelSegment[] = platformDefs.map(p => {
    const count = reviewRows.filter(r => platformBucket(r.platform) === p.key).length
    return {
      key:   p.key,
      label: p.label,
      count,
      pct:   channelTotal ? Math.round((count / channelTotal) * 100) : 0,
    }
  })

  const notUploaded = groups.length - uploadedGroups

  return {
    summary: {
      uploadRate: {
        current:     uploadedGroups,
        total:       groups.length,
        pct:         pct(uploadedGroups, groups.length),
        notUploaded,
      },
      totalContent: {
        count:  reviewRows.length,
        mimuse: mimuseCount,
        brand:  brandCount,
      },
      engagement: {
        views:    reviewRows.reduce((s, r) => s + r.views, 0),
        likes:    reviewRows.reduce((s, r) => s + r.likes, 0),
        comments: reviewRows.reduce((s, r) => s + r.comments, 0),
      },
    },
    contentTypeRows,
    brandPerformanceRows: buildBrandPerformanceRows(reviewRows),
    performanceRows,
    topPosts: buildTopPosts(reviewRows),
    uploadChannels,
  }
}
