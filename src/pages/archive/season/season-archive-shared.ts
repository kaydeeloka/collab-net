export interface SeasonArchivePhase {
  id: string
  name: string
  started_at: string | null
  ended_at: string | null
  project_concept: string | null
  collection_img: string | null
}

const PHASE_NAME_ORDER: Record<string, number> = { '1차': 1, '2차': 2 }

export function phaseYearKey(phase: Pick<SeasonArchivePhase, 'started_at' | 'ended_at'>): string | null {
  const raw = phase.started_at ?? phase.ended_at
  if (!raw) return null
  return raw.split('T')[0].slice(0, 4)
}

export function phaseYearLabel(yearKey: string) {
  return `${yearKey}년`
}

export interface YearPhaseGroup {
  key: string
  label: string
  phases: SeasonArchivePhase[]
}

export function groupPhasesByYear(phases: SeasonArchivePhase[]): YearPhaseGroup[] {
  const map = new Map<string, SeasonArchivePhase[]>()

  for (const phase of phases) {
    const key = phaseYearKey(phase) ?? 'unknown'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(phase)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === 'unknown') return 1
      if (b === 'unknown') return -1
      return b.localeCompare(a)
    })
    .map(([key, items]) => ({
      key,
      label: key === 'unknown' ? '연도 미설정' : phaseYearLabel(key),
      phases: [...items].sort((a, b) => {
        const ao = PHASE_NAME_ORDER[a.name] ?? 99
        const bo = PHASE_NAME_ORDER[b.name] ?? 99
        if (ao !== bo) return ao - bo
        return (a.started_at ?? '').localeCompare(b.started_at ?? '')
      }),
    }))
}
