import { normalizeKeywords } from '@/lib/beauty-news'

export interface ArchiveItem {
  id: string
  windows_start: string
  windows_end?: string
  report_title?: string
  created_at: string
  categories?: unknown
  keywords?: unknown
}

export interface CategoryItem {
  title: string
  link?: string
  source?: string
  pubDate?: string
  summary: string
}

export interface Category {
  emoji: string
  name: string
  count?: number
  items: CategoryItem[]
}

export interface ReportData {
  ok: boolean
  reportTitle?: string
  windowsStart?: string
  windowsEnd?: string
  categories?: Category[]
  keywords?: { tag: string; explanation: string }[]
  fromArchive?: boolean
  error?: string
}

export const ARCHIVE_MEDIA_BG = '#334155'
export const ARCHIVE_MEDIA_FG = '#ffffff'

export const ARCHIVE_CARD_THEMES = [
  { bg: '#e8a598', fg: '#ffffff' },
  { bg: '#a8d4e6', fg: '#1a3a4a' },
  { bg: '#f5d547', fg: '#5c4a00' },
  { bg: '#2d3748', fg: '#ffffff' },
  { bg: '#f97316', fg: '#ffffff' },
  { bg: '#5eead4', fg: '#134e4a' },
  { bg: '#c4b5fd', fg: '#3b0764' },
  { bg: '#fda4af', fg: '#881337' },
] as const

type RawArticle = {
  title?: string
  headline?: string
  link?: string
  url?: string
  source?: string
  pubDate?: string
  date?: string
  summary?: string
}

type RawCategory = {
  emoji?: string
  name: string
  count?: number
  items?: RawArticle[]
  stories?: RawArticle[]
  articles?: RawArticle[]
}

function parseJsonArray(raw: unknown): RawCategory[] {
  if (Array.isArray(raw)) return raw as RawCategory[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed as RawCategory[] : []
    } catch { return [] }
  }
  return []
}

function normalizeCategory(cat: RawCategory): Category {
  const raw = cat.items ?? cat.stories ?? cat.articles ?? []
  const items: CategoryItem[] = (Array.isArray(raw) ? raw : []).map(a => ({
    title: a.title ?? a.headline ?? '',
    link: (a.link ?? a.url) || undefined,
    source: a.source,
    pubDate: a.pubDate ?? a.date,
    summary: a.summary ?? '',
  }))
  return {
    emoji: cat.emoji ?? '',
    name: cat.name,
    count: cat.count ?? items.length,
    items,
  }
}

export function reportFromRow(row: {
  report_title?: string
  windows_start: string
  windows_end?: string
  categories?: unknown
  keywords?: unknown
}, fromArchive = false): ReportData {
  return {
    ok: true,
    reportTitle: row.report_title,
    windowsStart: row.windows_start,
    windowsEnd: row.windows_end,
    categories: parseJsonArray(row.categories).map(normalizeCategory),
    keywords: normalizeKeywords(row.keywords),
    fromArchive,
  }
}

export function fmtKor(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

export function fmtKorFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

function fmtTodayKor(): string {
  const d = new Date()
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

export function parseReportTitleDate(title?: string | null): string | null {
  const t = String(title ?? '')
  const kor = t.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (kor) {
    return `${kor[1]}-${String(kor[2]).padStart(2, '0')}-${String(kor[3]).padStart(2, '0')}`
  }
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}

export function reportTitleDisplayDate(report: ReportData): string {
  const fromTitle = parseReportTitleDate(report.reportTitle)
  if (fromTitle) return fmtKorFull(fromTitle)
  if (report.reportTitle) {
    const stripped = report.reportTitle.replace(/^이번\s*주\s*뷰티?\s*브리핑\s*[—\-–]\s*/u, '').trim()
    if (stripped) return stripped
  }
  if (report.windowsEnd) return fmtKorFull(report.windowsEnd)
  if (report.windowsStart) return fmtKorFull(report.windowsStart)
  return fmtTodayKor()
}

/** Padded Korean date for briefing card header — e.g. 2026년 06월 22일 */
export function reportHeaderDisplayDate(report: ReportData): string {
  const iso = parseReportTitleDate(report.reportTitle)
    || report.windowsEnd
    || report.windowsStart
  if (iso) return fmtKorFullPadded(iso)
  if (report.reportTitle) {
    const stripped = report.reportTitle.replace(/^이번\s*주\s*뷰티?\s*브리핑\s*[—\-–]\s*/u, '').trim()
    if (stripped) return stripped
  }
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return fmtKorFullPadded(today)
}

export function reportWindowBasis(report: ReportData): string | null {
  if (report.windowsStart && report.windowsEnd) {
    return `${fmtKor(report.windowsStart)} – ${fmtKor(report.windowsEnd)} 기준`
  }
  if (report.windowsStart) return `${fmtKor(report.windowsStart)} 기준`
  return null
}

export function archiveItemSortDate(item: Pick<ArchiveItem, 'report_title' | 'windows_end' | 'windows_start' | 'created_at'>): string {
  return parseReportTitleDate(item.report_title)
    || item.windows_end
    || item.windows_start
    || (item.created_at ? item.created_at.slice(0, 10) : '')
}

export function archiveItemWindowRange(item: ArchiveItem): string | null {
  if (item.windows_start && item.windows_end) {
    return `${fmtKor(item.windows_start)} – ${fmtKor(item.windows_end)}`
  }
  if (item.windows_start) return fmtKor(item.windows_start)
  return null
}

export function archiveItemWindowBasis(item: ArchiveItem): string | null {
  if (item.windows_start && item.windows_end) {
    return `뷰티 뉴스 ${fmtKor(item.windows_start)} – ${fmtKor(item.windows_end)} 기준`
  }
  if (item.windows_start) return `뷰티 뉴스 ${fmtKor(item.windows_start)} 기준`
  return null
}

export function fmtKorFullPadded(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}년 ${m}월 ${day}일`
}

export function archiveItemSidebarLines(item: ArchiveItem) {
  const meta = archiveItemCardMeta(item)
  const titleIso = parseReportTitleDate(item.report_title)
  const titleDate = titleIso
    ? fmtKorFullPadded(titleIso)
    : meta.heroLines.line2
  const primary = `${meta.heroLines.line1} - ${titleDate}`
  const range = archiveItemWindowRange(item)
  const secondary = range
    ? `${range} 기준 · ${meta.count}건`
    : `${meta.count}건`
  return { primary, secondary }
}

export function archiveItemHeroLines(item: ArchiveItem): { line1: string; line2: string } {
  const trimmed = item.report_title?.trim()
  if (trimmed) {
    const split = trimmed.match(/^(이번\s*주\s*뷰티?\s*브리핑)\s*[—\-–]\s*(.+)$/u)
    if (split) {
      return { line1: split[1], line2: split[2].trim() }
    }
    const fromTitle = parseReportTitleDate(item.report_title)
    if (fromTitle) {
      return { line1: '이번 주 뷰티 브리핑', line2: fmtKorFull(fromTitle) }
    }
  }
  return {
    line1: '이번 주 뷰티 브리핑',
    line2: archiveItemLabel(item),
  }
}

export function archiveItemHeroTitle(item: ArchiveItem): string {
  const trimmed = item.report_title?.trim()
  if (trimmed) return trimmed
  return '이번 주 뷰티 브리핑'
}

export function archiveItemLabel(item: ArchiveItem): string {
  const fromTitle = parseReportTitleDate(item.report_title)
  if (fromTitle) return fmtKorFull(fromTitle)
  if (item.report_title) {
    const stripped = item.report_title.replace(/^이번\s*주\s*뷰티?\s*브리핑\s*[—\-–]\s*/u, '').trim()
    if (stripped) return stripped
  }
  return item.windows_end ? fmtKor(item.windows_start) + ' – ' + fmtKor(item.windows_end) : fmtKor(item.windows_start)
}

export function reportArticleCount(report: ReportData): number {
  return (report.categories ?? []).reduce((sum, cat) => sum + (cat.items?.length ?? 0), 0)
}

export function archiveItemCardMeta(item: ArchiveItem) {
  const report = reportFromRow({
    report_title: item.report_title,
    windows_start: item.windows_start,
    windows_end: item.windows_end,
    categories: item.categories,
    keywords: item.keywords,
  })
  return {
    heroLines: archiveItemHeroLines(item),
    heroTitle: archiveItemHeroTitle(item),
    title: archiveItemLabel(item),
    windowBasis: archiveItemWindowBasis(item),
    count: reportArticleCount(report),
    keywords: normalizeKeywords(item.keywords),
  }
}

export function archiveMonthKey(item: ArchiveItem): string {
  return archiveItemSortDate(item).slice(0, 7)
}

export function archiveMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  if (!year || !month) return monthKey
  return `${year}년 ${parseInt(month, 10)}월`
}

export function groupArchiveByMonth(items: ArchiveItem[]): { key: string; label: string; items: ArchiveItem[] }[] {
  const map = new Map<string, ArchiveItem[]>()
  for (const item of items) {
    const key = archiveMonthKey(item)
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, groupItems]) => ({
      key,
      label: archiveMonthLabel(key),
      items: groupItems,
    }))
}

export function archiveCardTheme(windowsStart: string) {
  let h = 0
  for (let i = 0; i < windowsStart.length; i++) {
    h = (h * 31 + windowsStart.charCodeAt(i)) | 0
  }
  return ARCHIVE_CARD_THEMES[Math.abs(h) % ARCHIVE_CARD_THEMES.length]
}
