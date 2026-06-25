/** Cover slide title — e.g. "2026 Q1 시딩 프로젝트 결과 리포트" */

const PHASE_QUARTER: Record<string, number> = {
  '1차': 1,
  '2차': 2,
  '3차': 3,
  '4차': 4,
}

function phaseYear(startedAt: string | null, endedAt: string | null): number {
  const iso = startedAt || endedAt
  if (!iso) return new Date().getFullYear()
  const y = new Date(iso).getFullYear()
  return Number.isNaN(y) ? new Date().getFullYear() : y
}

function phaseQuarter(phaseName: string, startedAt: string | null): number {
  if (PHASE_QUARTER[phaseName]) return PHASE_QUARTER[phaseName]
  if (startedAt) {
    const m = new Date(startedAt).getMonth()
    if (!Number.isNaN(m)) return Math.floor(m / 3) + 1
  }
  return 1
}

export function getReportCoverTitle(
  phaseName: string,
  startedAt: string | null,
  endedAt: string | null,
): string {
  const year = phaseYear(startedAt, endedAt)
  const quarter = phaseQuarter(phaseName, startedAt)
  return `${year} Q${quarter} 시딩 프로젝트 결과 리포트`
}

export const REPORT_COVER_FOOTER = '© CRANECOMMUNICATIONS'
