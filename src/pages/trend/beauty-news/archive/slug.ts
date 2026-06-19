import { type ArchiveItem, archiveItemSortDate } from './shared'

/** URL segment: ISO date from report title metadata (e.g. 2026-05-25) */
export function archiveReportSlug(item: ArchiveItem): string {
  return archiveItemSortDate(item)
}

export function archiveDetailPath(item: ArchiveItem): string {
  return `/trend/beauty-news-archive/${archiveReportSlug(item)}`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseArchiveSlug(slug: string | undefined): string | null {
  if (!slug) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    return null
  }
  return ISO_DATE.test(decoded) ? decoded : null
}

export function findArchiveItemBySlug(
  items: ArchiveItem[],
  slug: string | undefined,
): ArchiveItem | null {
  const date = parseArchiveSlug(slug)
  if (!date) return null
  return items.find(item => archiveItemSortDate(item) === date) ?? null
}
