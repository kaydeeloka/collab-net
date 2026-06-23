import { KST, formatKstDateTime } from '@/lib/kst-time'

export { formatKstDateTime }

export function fmtNum(n: string | number): string {
  const num = parseInt(String(n).replace(/,/g, ''))
  if (isNaN(num)) return '—'
  if (num >= 1_000_000) {
    const v = num / 1_000_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'M'
  }
  if (num >= 10_000) {
    const v = num / 1_000
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'K'
  }
  return num.toLocaleString('ko-KR')
}

export function escHtml(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function phaseNum(name: string): number {
  const m = (name || '').match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

/** Normalize user input to phase label like `3차`. */
export function normalizePhaseNameInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const withoutSuffix = trimmed.replace(/차\s*$/i, '').trim()
  if (/^\d+$/.test(withoutSuffix)) return `${parseInt(withoutSuffix, 10)}차`
  return trimmed
}

export function suggestNextPhaseName(phases: { name: string }[]): string {
  const max = phases.reduce((m, p) => Math.max(m, phaseNum(p.name)), 0)
  return `${max + 1}차`
}

export function buildPhaseDbOptions(data: {
  phases?: { name?: string; outreachId?: string }[]
  phase1SheetId?: string
  activeOutreachId?: string
  activePhase?: string
}): { id: string; label: string }[] {
  const p1 = (data.phase1SheetId || '').trim()
  const opts: { id: string; label: string }[] = []

  // 1차 always appears first — even if the same ID is reused by a phase entry
  if (p1) opts.push({ id: p1, label: '1차' })

  // Additional linked phases (skip exact 1차 duplicate only)
  ;(data.phases || []).forEach(p => {
    const id = (p.outreachId || '').toString().trim()
    const label = (p.name || '차수').trim()
    if (!id) return
    // Allow same ID as 1차 if the label is different (user can switch label without changing DB)
    if (id === p1 && label === '1차') return
    opts.push({ id, label })
  })

  opts.sort((a, b) => phaseNum(a.label) - phaseNum(b.label))
  return opts
}

export function useKrClock() {
  function getKrTime() {
    const now = new Date()
    const opts = { timeZone: KST } as const
    return {
      date: now.toLocaleDateString('ko-KR', {
        ...opts,
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      }),
      time: now.toLocaleTimeString('ko-KR', {
        ...opts,
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }),
      navDate: now.toLocaleDateString('ko-KR', { ...opts, month: 'numeric', day: 'numeric', weekday: 'short' }),
      navTime: now.toLocaleTimeString('ko-KR', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false }),
    }
  }
  return getKrTime
}
