export const COLLABNET_BRAND = 'collabnet'
export const COLLABNET_COLOR = '#3b82f6'

/** Per-brand accent palette — shared by monitoring keyword badges and brand pills. */
export const BRAND_KW_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#f97316', '#06b6d4', '#3b82f6', '#e11d48']

export function monitoringBrandKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}

export const DEFAULT_COLLABNET_KEYWORDS = ['collabnet', 'mi muse', 'mi-muse', '미뮤즈', 'CollabNet Beauty']

export function defaultBrandKeywords(brandName: string): string[] {
  const trimmed = brandName.trim()
  const key = monitoringBrandKey(brandName)
  return [trimmed, key].filter((v, i, a) => v && a.indexOf(v) === i)
}

export type BrandKwsState = {
  collabnet: string[]
  byBrand: Record<string, string[]>
}

export type ConfirmedBrandKw = {
  key: string
  name: string
  en: string
}

export function emptyBrandKws(): BrandKwsState {
  return { collabnet: [...DEFAULT_COLLABNET_KEYWORDS], byBrand: {} }
}

export function flattenBrandKeywords(state: BrandKwsState): string[] {
  const flat = [...(state.collabnet || [])]
  for (const kws of Object.values(state.byBrand || {})) {
    flat.push(...kws)
  }
  return flat
}

export function isMimuseKeyword(kw: string, collabnet: string[]): boolean {
  const kwLow = kw.toLowerCase()
  return collabnet.some(k => k.toLowerCase() === kwLow)
}

export function brandKeywordIndex(
  kw: string,
  byBrand: Record<string, string[]>,
  confirmedBrands: ConfirmedBrandKw[],
): number {
  const kwLow = kw.toLowerCase()
  return confirmedBrands.findIndex(b => (byBrand[b.key] || []).some(k => k.toLowerCase() === kwLow))
}

/** Resolve the accent color for a brand key/name, matching monitoring keyword badge colors. */
export function brandColorForKey(
  key: string,
  confirmedBrands: ConfirmedBrandKw[],
  byBrand?: Record<string, string[]>,
): string {
  const normalized = (key || '').toLowerCase()
  if (!normalized) return '#94a3b8'
  if (normalized === COLLABNET_BRAND) return COLLABNET_COLOR
  let idx = confirmedBrands.findIndex(b => b.key === normalized)
  if (idx < 0) idx = confirmedBrands.findIndex(b => b.name.toLowerCase() === normalized)
  if (idx < 0 && byBrand) {
    idx = confirmedBrands.findIndex(b => (byBrand[b.key] || []).some(kw => kw.toLowerCase() === normalized))
  }
  if (idx >= 0) return BRAND_KW_COLORS[idx % BRAND_KW_COLORS.length]
  return '#94a3b8'
}

export function buildBrandKwsFromRows(
  rows: { brand: string; keywords: string[] | null; phase_id: string | null }[],
  confirmedBrands: ConfirmedBrandKw[],
): BrandKwsState {
  const state = emptyBrandKws()
  const collabnetRow = rows.find(r => r.brand === COLLABNET_BRAND && !r.phase_id)
  if (collabnetRow?.keywords?.length) state.collabnet = collabnetRow.keywords

  for (const brand of confirmedBrands) {
    const keyLower = brand.key.toLowerCase()
    const nameLower = brand.name.toLowerCase()
    const row = rows.find(r => r.phase_id && (
      r.brand === brand.key ||
      r.brand === nameLower ||
      (Array.isArray(r.keywords) && r.keywords.some(kw =>
        kw.toLowerCase() === keyLower || kw.toLowerCase() === nameLower
      ))
    ))
    state.byBrand[brand.key] = row?.keywords?.length
      ? row.keywords
      : defaultBrandKeywords(brand.name)
  }
  return state
}
