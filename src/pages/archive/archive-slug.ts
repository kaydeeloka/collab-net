export type ArchiveSection = 'design' | 'season' | 'brand-report'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ArchiveBrandSlugInput {
  id: string
  brandName: string
}

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

/** Stable slug key for a brand within a phase (decoded; used for tabs and lookup). */
export function archiveBrandSlugKey(brand: ArchiveBrandSlugInput, brands: ArchiveBrandSlugInput[]): string {
  const base = brand.brandName.trim()
  const siblings = brands.filter(b => b.brandName.trim() === base)
  if (siblings.length <= 1) return base
  const index = siblings.findIndex(b => b.id === brand.id)
  return index <= 0 ? base : `${base}-${index + 1}`
}

export function archiveBrandReportPath(
  phase: { name: string },
  brand: ArchiveBrandSlugInput,
  brands: ArchiveBrandSlugInput[],
) {
  return `${archiveSectionPath(phase, 'brand-report')}/${encodeURIComponent(archiveBrandSlugKey(brand, brands))}`
}

export function archiveBrandSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/archive\/[^/]+\/brand-report\/([^/]+)/)
  if (!match) return null
  return decodeURIComponent(match[1])
}

export function brandFromArchiveBrandSlug<T extends ArchiveBrandSlugInput>(
  brands: T[],
  slug: string | null | undefined,
): T | null {
  if (!slug) return null
  const decoded = decodeURIComponent(slug)

  const byKey = brands.find(b => archiveBrandSlugKey(b, brands) === decoded)
  if (byKey) return byKey

  if (UUID_RE.test(decoded)) {
    return brands.find(b => b.id === decoded) ?? null
  }

  return null
}

export function isLegacyArchiveBrandIdSlug(slug: string | null | undefined): boolean {
  if (!slug) return false
  return UUID_RE.test(decodeURIComponent(slug))
}

export function archiveSectionFromPath(pathname: string): ArchiveSection | null {
  const match = pathname.match(/^\/archive\/[^/]+\/(design|season|brand-report)/)
  return match ? (match[1] as ArchiveSection) : null
}

export function archivePhaseSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/archive\/([^/]+)/)
  return match ? match[1] : null
}

export function isArchiveDetailPath(pathname: string) {
  return archiveSectionFromPath(pathname) != null && archivePhaseSlugFromPath(pathname) != null
}
