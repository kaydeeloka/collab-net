export type ArchiveSection = 'design' | 'season' | 'brand-report'

export function archivePhaseSlug(phase: { name: string }) {
  return encodeURIComponent(phase.name)
}

export function phaseFromArchiveSlug<T extends { id: string; name: string }>(
  phases: T[],
  slug: string | undefined,
): T | null {
  if (!slug) return null
  const decoded = decodeURIComponent(slug)
  return phases.find(p => p.name === decoded) ?? null
}

export function archiveBasePath(phase: { name: string }) {
  return `/archive/${archivePhaseSlug(phase)}`
}

export function archiveSectionPath(phase: { name: string }, section: ArchiveSection) {
  return `${archiveBasePath(phase)}/${section}`
}

export function archiveSectionFromPath(pathname: string): ArchiveSection | null {
  const match = pathname.match(/^\/archive\/[^/]+\/(design|season|brand-report)/)
  return match ? (match[1] as ArchiveSection) : null
}

export function archivePhaseSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/archive\/([^/]+)/)
  return match ? match[1] : null
}
