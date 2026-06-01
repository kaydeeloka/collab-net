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

export function buildPhaseDbOptions(data: {
  phases?: { name?: string; outreachId?: string }[]
  phase1SheetId?: string
  activeOutreachId?: string
  activePhase?: string
}): { id: string; label: string }[] {
  const activeId = (data.activeOutreachId || '').trim()
  const p1 = (data.phase1SheetId || '').trim()
  const seen = new Set<string>()
  const opts: { id: string; label: string }[] = []

  ;(data.phases || []).forEach(p => {
    const id = (p.outreachId || '').toString().trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    opts.push({ id, label: p.name || '차수' })
  })

  if (p1 && !seen.has(p1)) {
    opts.push({ id: p1, label: '1차' })
    seen.add(p1)
  }
  if (activeId && !seen.has(activeId)) {
    opts.push({ id: activeId, label: data.activePhase || '현재' })
  }

  opts.sort((a, b) => phaseNum(b.label) - phaseNum(a.label))
  return opts
}

export function useKrClock() {
  function getKrTime() {
    const now = new Date()
    return {
      date: now.toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
      }),
      time: now.toLocaleTimeString('ko-KR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }),
      navDate: now.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }),
      navTime: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }
  }
  return getKrTime
}
