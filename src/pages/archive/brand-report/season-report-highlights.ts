import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import { PLATFORM_DISPLAY, platformBucket } from '@/lib/influencer/content-platforms'

export interface ReviewHighlight {
  id:            string
  handle:        string
  displayName:   string | null
  platform:      string
  platformLabel: string
  brandLabel:    string
  views:         number
  likes:         number
  comments:      number
  reviewLink:    string
}

export interface BrandMention {
  brand:    string
  label:    string
  mentions: number
  views:    number
  likes:    number
}

function isUploaded(r: MonitoringRow): boolean {
  return !!r.review_link?.startsWith('http')
}

function brandLabel(brand: string | null): string {
  const b = (brand || '').trim()
  if (!b) return '—'
  if (b.toLowerCase() === 'mimuse') return 'Mi Muse'
  return b.toUpperCase()
}

export function computeReviewHighlights(rows: MonitoringRow[], limit = 6): ReviewHighlight[] {
  return rows
    .filter(isUploaded)
    .slice()
    .sort((a, b) => b.views - a.views || b.likes - a.likes)
    .slice(0, limit)
    .map(r => {
      const bucket = platformBucket(r.platform)
      return {
        id:            r.id,
        handle:        r.handle,
        displayName:   r.display_name,
        platform:      r.platform,
        platformLabel: PLATFORM_DISPLAY[bucket].label,
        brandLabel:    brandLabel(r.brand),
        views:         r.views,
        likes:         r.likes,
        comments:      r.comments,
        reviewLink:    r.review_link!,
      }
    })
}

export function computeBrandMentions(rows: MonitoringRow[]): BrandMention[] {
  const map = new Map<string, BrandMention>()
  for (const r of rows.filter(isUploaded)) {
    const key = (r.brand || '').trim().toLowerCase()
    if (!key || key === 'mimuse') continue
    const existing = map.get(key) ?? {
      brand:    key,
      label:    brandLabel(r.brand),
      mentions: 0,
      views:    0,
      likes:    0,
    }
    existing.mentions += 1
    existing.views += r.views
    existing.likes += r.likes
    map.set(key, existing)
  }
  return Array.from(map.values()).sort((a, b) => b.mentions - a.mentions || b.views - a.views)
}
