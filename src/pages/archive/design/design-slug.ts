import { archiveSectionPath } from '../archive-slug'
import { conceptTitleFromProjectConcept } from '../brand-report/season-collection-content'
import type { PhaseSlugInput } from '../brand-report/slug'
import { conceptTitleToSlug, phaseFromSlug } from '../brand-report/slug'

export type { PhaseSlugInput }

export function designArchiveTitle(phase: PhaseSlugInput) {
  const title = conceptTitleFromProjectConcept(phase.project_concept)?.trim()
  return title || `Mi Muse ${phase.name} Design`
}

export function designArchiveSlug(phase: PhaseSlugInput, phases: PhaseSlugInput[]) {
  const base = conceptTitleToSlug(designArchiveTitle(phase))
  const siblings = phases.filter(p => conceptTitleToSlug(designArchiveTitle(p)) === base)
  if (siblings.length <= 1) return base
  const index = siblings.findIndex(p => p.id === phase.id)
  return index <= 0 ? base : `${base}-${index + 1}`
}

export function designArchivePath(phase: PhaseSlugInput, _phases?: PhaseSlugInput[]) {
  return archiveSectionPath(phase, 'design')
}

export function phaseFromDesignSlug<T extends PhaseSlugInput>(phases: T[], slug: string | undefined): T | null {
  if (!slug) return null
  const decoded = decodeURIComponent(slug)

  const byDesignSlug = phases.find(p => designArchiveSlug(p, phases) === decoded)
  if (byDesignSlug) return byDesignSlug

  return phaseFromSlug(phases, slug, {})
}
