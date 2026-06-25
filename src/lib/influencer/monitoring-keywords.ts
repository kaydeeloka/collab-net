export const MIMUSE_BRAND = 'mimuse'
export const MIMUSE_COLOR = '#3b82f6'

export function monitoringBrandKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}

export const DEFAULT_MIMUSE_KEYWORDS = ['mimuse', 'mi muse', 'mi-muse', '미뮤즈', 'MiMuse Beauty']

export function defaultBrandKeywords(brandName: string): string[] {
  const trimmed = brandName.trim()
  const key = monitoringBrandKey(brandName)
  return [trimmed, key].filter((v, i, a) => v && a.indexOf(v) === i)
}

export type BrandKwsState = {
  mimuse: string[]
  byBrand: Record<string, string[]>
}

export type ConfirmedBrandKw = {
  key: string
  name: string
}

export function emptyBrandKws(): BrandKwsState {
  return { mimuse: [...DEFAULT_MIMUSE_KEYWORDS], byBrand: {} }
}

export function flattenBrandKeywords(state: BrandKwsState): string[] {
  const flat = [...(state.mimuse || [])]
  for (const kws of Object.values(state.byBrand || {})) {
    flat.push(...kws)
  }
  return flat
}

export function isMimuseKeyword(kw: string, mimuse: string[]): boolean {
  const kwLow = kw.toLowerCase()
  return mimuse.some(k => k.toLowerCase() === kwLow)
}

export function brandKeywordIndex(
  kw: string,
  byBrand: Record<string, string[]>,
  confirmedBrands: ConfirmedBrandKw[],
): number {
  const kwLow = kw.toLowerCase()
  return confirmedBrands.findIndex(b => (byBrand[b.key] || []).some(k => k.toLowerCase() === kwLow))
}

export function buildBrandKwsFromRows(
  rows: { brand: string; keywords: string[] | null; phase_id: string | null }[],
  confirmedBrands: ConfirmedBrandKw[],
): BrandKwsState {
  const state = emptyBrandKws()
  const mimuseRow = rows.find(r => r.brand === MIMUSE_BRAND && !r.phase_id)
  if (mimuseRow?.keywords?.length) state.mimuse = mimuseRow.keywords

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
