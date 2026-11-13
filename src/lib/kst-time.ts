/** Korea Standard Time helpers for Supabase timestamptz read/write and UI display. */
export const KST = 'Asia/Seoul'

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Current instant as ISO UTC — use when writing Supabase `timestamptz` columns. */
export function demoDbNow(): string {
  return new Date().toISOString()
}

/** Today's calendar date in KST (`YYYY-MM-DD`). */
export function kstToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(new Date())
}

export function kstParts(iso: string | null | undefined): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} | null {
  const d = parseTimestamp(iso)
  if (!d) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? 0)

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** `M월 D일` in KST (phase periods, contact/reply badges). */
export function formatKstShortDate(iso: string | null | undefined): string | null {
  const p = kstParts(iso)
  if (!p) return null
  return `${p.month}월 ${p.day}일`
}

/** `YYYY-MM-DD` in KST. */
export function formatKstDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const p = kstParts(iso)
  if (!p) return null
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Full datetime in KST (e.g. 2026. 6. 17. 15:45). */
export function formatKstDateTime(iso: string | null | undefined): string | null {
  const d = parseTimestamp(iso)
  if (!d) return null
  return d.toLocaleString('ko-KR', {
    timeZone: KST,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** `HH:mm` in KST — pass ISO or omit for current time. */
export function formatKstTime(iso?: string | null): string {
  const d = iso ? parseTimestamp(iso) : new Date()
  if (!d) return '—'
  return d.toLocaleTimeString('ko-KR', {
    timeZone: KST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatKstSyncLabel(): string {
  return `마지막 동기화: ${formatKstTime()}`
}

/** Normalize DB/API timestamps to ISO UTC for comparisons. */
export function toIsoTimestamp(value: string | null | undefined): string | undefined {
  const d = parseTimestamp(value)
  return d ? d.toISOString() : undefined
}

/** Parse `YYYY-MM-DD` (or date prefix) as start of day in KST. */
export function parseKstDateOnly(dateStr: string): Date {
  const day = dateStr.split('T')[0]
  return new Date(`${day}T00:00:00+09:00`)
}

/** Date-only string → ISO UTC (KST midnight). */
export function dateOnlyToIso(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return parseKstDateOnly(dateStr).toISOString()
  }
  const d = parseTimestamp(dateStr)
  return d ? d.toISOString() : demoDbNow()
}

/** Compare Supabase `created_at` filter against a KST date picker value. */
export function matchesKstDate(iso: string | null | undefined, ymd: string): boolean {
  return formatKstDate(iso) === ymd
}

/** Sticky topbar clock — e.g. `6월. 19일 (금) 20:10` */
export function formatStickyBarClock(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? ''

  const month = get('month')
  const day = get('day')
  const weekday = now.toLocaleDateString('ko-KR', { timeZone: KST, weekday: 'short' })
  const time = `${get('hour').padStart(2, '0')}:${get('minute').padStart(2, '0')}`
  return `${month}월 ${day}일 (${weekday}) ${time}`
}
