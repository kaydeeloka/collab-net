import { supabase } from '@/lib/supabase'
import { getSignedUrl } from '@/pages/brand/confirmed/archive/shared'

export interface SeasonBrandItem {
  id: string
  brandName: string
  product: string | null
  website: string | null
  description: string | null
  imageUrl: string | null
}

export async function loadSeasonBrands(phaseId: string): Promise<SeasonBrandItem[]> {
  const { data: brands, error } = await supabase
    .from('confirmed_brands')
    .select('id, brand_name, product, website, notes')
    .eq('phase_id', phaseId)
    .order('brand_name')

  if (error || !brands?.length) return []

  const ids = brands.map(b => b.id)
  const { data: assets } = await supabase
    .from('confirmed_brand_assets')
    .select('confirmed_brand_id, category, storage_path, sort_order, created_at')
    .in('confirmed_brand_id', ids)
    .in('category', ['product_main', 'logo'])
    .order('sort_order')
    .order('created_at')

  const assetByBrand = new Map<string, { path: string; category: string }>()
  for (const asset of assets ?? []) {
    const brandId = asset.confirmed_brand_id as string
    const path = asset.storage_path as string
    const category = asset.category as string
    const existing = assetByBrand.get(brandId)
    if (!existing) {
      assetByBrand.set(brandId, { path, category })
      continue
    }
    if (existing.category !== 'product_main' && category === 'product_main') {
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

      const notes = (brand.notes as string | null)?.trim()
      const description = notes || null

      return {
        id: brand.id,
        brandName: brand.brand_name as string,
        product: brand.product as string | null,
        website: brand.website as string | null,
        description,
        imageUrl,
      }
    }),
  )

  return items
}
