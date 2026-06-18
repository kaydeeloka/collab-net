export interface PhaseLike {
  id: string
  started_at: string | null
  ended_at: string | null
}

/** Parse phase UUID from app_config JSONB value. */
export function normalizePhaseId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  return null
}

import { kstToday } from '@/lib/kst-time'

/** Phase whose date range includes today. */
export function getDateActivePhaseId(phases: PhaseLike[], today = kstToday()): string | null {
  return phases.find(p => {
    if (!p.started_at || !p.ended_at) return false
    const start = p.started_at.split('T')[0]
    const end   = p.ended_at.split('T')[0]
    return today >= start && today <= end
  })?.id ?? null
}
