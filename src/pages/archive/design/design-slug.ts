import { archiveSectionPath } from '../archive-slug'
import type { PhaseSlugInput } from '../season/slug'
import { phaseFromSlug } from '../season/slug'

export type { PhaseSlugInput }

export function designArchiveTitle(phase: PhaseSlugInput) {
  return `${phase.name} 디자인 자료`
}

export function designArchivePath(phase: PhaseSlugInput, _phases?: PhaseSlugInput[]) {
  return archiveSectionPath(phase, 'design')
}

export function phaseFromDesignSlug<T extends PhaseSlugInput>(phases: T[], slug: string | undefined): T | null {
  return phaseFromSlug(phases, slug, {})
}
