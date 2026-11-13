import { demoDb } from '@/lib/local-db'
import { getSignedUrl } from '@/pages/brand/confirmed/archive/shared'

export interface SeasonBrandItem {
  id: string
  brandName: string
  brandEn: string | null
  product: string | null
  productEn: string | null
  website: string | null
  description: string | null
  imageUrl: string | null
}

export async function loadSeasonBrands(phaseId: string): Promise<SeasonBrandItem[]> {
  const { data: brands, error } = await demoDb
    .from('confirmed_brands')
    .select('id, brand_name, product, product_en, website, description_en')
    .eq('phase_id', phaseId)
    .order('brand_name')

  if (error || !brands?.length) return []

  const { data: contacts } = await demoDb
    .from('brand_contacts')
    .select('brand_name, brand_en')
    .eq('phase_id', phaseId)
  const brandEnByName = new Map<string, string | null>()
  for (const c of contacts ?? []) brandEnByName.set(c.brand_name as string, (c.brand_en as string | null) ?? null)

  const ids = brands.map(b => b.id)
  const { data: assets } = await demoDb
    .from('confirmed_brand_assets')
    .select('id, confirmed_brand_id, category, storage_path, file_name, file_size, sort_order, created_at')
    .in('confirmed_brand_id', ids)
    .in('category', ['product_main', 'product_sub', 'logo'])
    .order('sort_order')
    .order('created_at')

  const assetByBrand = new Map<string, { path: string; category: string }>()
  const categoryRank = (category: string) => {
    if (category === 'product_main') return 0
    if (category === 'product_sub') return 1
    return 2
  }
  for (const asset of assets ?? []) {
    const brandId = asset.confirmed_brand_id as string
    const path = asset.storage_path as string
    const category = asset.category as string

    const existing = assetByBrand.get(brandId)
    if (!existing) {
      assetByBrand.set(brandId, { path, category })
      continue
    }
    if (categoryRank(category) < categoryRank(existing.category)) {
      assetByBrand.set(brandId, { path, category })
    }
  }

  const items = await Promise.all(
    brands.map(async brand => {
      const storagePath = assetByBrand.get(brand.id)?.path
      let imageUrl: string | null = null
      if (storagePath) {
        const { url } = await getSignedUrl(storagePath)
        imageUrl = url
      }

      const descriptionEn = (brand.description_en as string | null)?.trim()
      const description = descriptionEn || null

      return {
        id: brand.id,
        brandName: brand.brand_name as string,
        brandEn: brandEnByName.get(brand.brand_name as string) ?? null,
        product: brand.product as string | null,
        productEn: (brand.product_en as string | null) ?? null,
        website: brand.website as string | null,
        description,
        imageUrl,
      }
    }),
  )

  return items
}
