import { getSeasonCollectionCopy } from './season-collection-content'
import { archiveSectionPath } from '../archive-slug'

export interface PhaseSlugInput {
  id: string
  name: string
  project_concept: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function phaseConceptTitle(phase: PhaseSlugInput, brandCount = 0) {
  return getSeasonCollectionCopy(phase.name, brandCount, phase.project_concept).title
}

export function conceptTitleToSlug(title: string) {
  const trimmed = title.trim()
  if (!trimmed) return 'collection'
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[<>:"/\\|?*#%]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'collection'
}

export function phaseCollectionSlug(phase: PhaseSlugInput, phases: PhaseSlugInput[], brandCount = 0) {
  const base = conceptTitleToSlug(phaseConceptTitle(phase, brandCount))
  const siblings = phases.filter(p => conceptTitleToSlug(phaseConceptTitle(p, brandCount)) === base)
  if (siblings.length <= 1) return base
  const index = siblings.findIndex(p => p.id === phase.id)
  return index <= 0 ? base : `${base}-${index + 1}`
}

export function phaseCollectionPath(phase: PhaseSlugInput, _phases?: PhaseSlugInput[], _brandCount = 0) {
  return archiveSectionPath(phase, 'season')
}

export function phaseFromSlug<T extends PhaseSlugInput>(
  phases: T[],
  slug: string | undefined,
  brandCountByPhase: Record<string, number> = {},
): T | null {
  if (!slug) return null
  const decoded = decodeURIComponent(slug)

  if (UUID_RE.test(decoded)) {
    const byId = phases.find(p => p.id === decoded)
    if (byId) return byId
  }

  const match = phases.find(p => {
    const count = brandCountByPhase[p.id] ?? 0
    return phaseCollectionSlug(p, phases, count) === decoded
  })
  return match ?? null
}
