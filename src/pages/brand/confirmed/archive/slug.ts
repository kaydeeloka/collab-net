import type { ConfirmedBrand } from './shared'

/** URL segment from brand name (keeps Korean / letters / numbers) */
export function brandNameToSlug(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'brand'
  return trimmed
    .replace(/\s+/g, '-')
    .replace(/[<>:"/\\|?*#%]/g, '')
}

/** Unique slug per brand in the current phase list */
export function brandArchiveSlug(brand: ConfirmedBrand, brands: ConfirmedBrand[]): string {
  const base = brandNameToSlug(brand.brand_name)
  const siblings = brands.filter(b => brandNameToSlug(b.brand_name) === base)
  if (siblings.length <= 1) return base
  const index = siblings.findIndex(b => b.id === brand.id)
  return index <= 0 ? base : `${base}-${index + 1}`
}

export function archiveDetailPath(brand: ConfirmedBrand, brands: ConfirmedBrand[]): string {
  const slug = brandArchiveSlug(brand, brands)
  return `/brand/confirmed/archive/${encodeURIComponent(slug)}`
}

export function brandFromSlug(brands: ConfirmedBrand[], slug: string | undefined): ConfirmedBrand | null {
  if (!slug) return null
  const decoded = decodeURIComponent(slug)

  const match = brands.find(b => brandArchiveSlug(b, brands) === decoded)
  if (match) return match

  // Legacy numbered paths: brand1, archive-brand1
  const legacy = /^(?:archive-)?brand(\d+)$/i.exec(decoded)
  if (legacy) {
    const index = parseInt(legacy[1], 10) - 1
    if (index >= 0 && index < brands.length) return brands[index]
  }

  return null
}

export function brandSlugForId(brands: ConfirmedBrand[], brandId: string): string | null {
  const brand = brands.find(b => b.id === brandId)
  if (!brand) return null
  return brandArchiveSlug(brand, brands)
}
