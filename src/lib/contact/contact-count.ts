import { formatKstShortDate } from '@/lib/kst-time'

/** Display label for contact_count (0 → 미컨택, n → n차 컨택) */
export function formatContactCount(count: number | null | undefined): string {
  const n = coerceContactCount(count)
  if (n === 0) return '미컨택'
  return `${n}차 컨택`
}

export function coerceContactCount(count: number | null | undefined): number {
  return Math.max(0, count ?? 0)
}

export function contactCountStyle(count: number): { bg: string; color: string } {
  if (count <= 0) return { bg: '#f1f5f9', color: '#94a3b8' }
  const palette = [
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#ede9fe', color: '#7c3aed' },
    { bg: '#fef3c7', color: '#a16207' },
    { bg: '#d1fae5', color: '#065f46' },
    { bg: '#fce7f3', color: '#be185d' },
  ]
  return palette[Math.min(count - 1, palette.length - 1)]
}

export function nextContactCountAfterSend(current: number | null | undefined): number {
  return coerceContactCount(current) + 1
}

/** `M월 D일` label for contact / reply badges in KST (e.g. 6월 17일). */
export function formatShortContactDate(iso: string | null | undefined): string | null {
  return formatKstShortDate(iso)
}
