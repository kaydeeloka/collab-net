import { supabase } from '@/lib/supabase'
import { getSignedUrl } from '@/pages/brand/confirmed/archive/shared'

export interface SeasonCoverAsset {
  id: string
  file_name: string
  file_size: number | null
  storage_path: string
}

export interface SeasonBrandItem {
  id: string
  brandName: string
  product: string | null
  productEn: string | null
  website: string | null
  description: string | null
  imageUrl: string | null
  coverAsset: SeasonCoverAsset | null
}

export async function loadSeasonBrands(phaseId: string): Promise<SeasonBrandItem[]> {
  const { data: brands, error } = await supabase
    .from('confirmed_brands')
    .select('id, brand_name, product, product_en, website, archive_desc')
    .eq('phase_id', phaseId)
    .order('brand_name')

  if (error || !brands?.length) return []

  const ids = brands.map(b => b.id)
  const { data: assets } = await supabase
    .from('confirmed_brand_assets')
    .select('id, confirmed_brand_id, category, storage_path, file_name, file_size, sort_order, created_at')
    .in('confirmed_brand_id', ids)
    .in('category', ['product_cover', 'product_main', 'logo'])
    .order('sort_order')
    .order('created_at')

  const coverByBrand = new Map<string, SeasonCoverAsset>()
  const assetByBrand = new Map<string, { path: string; category: string }>()
  const categoryRank = (category: string) => {
    if (category === 'product_cover') return 0
    if (category === 'product_main') return 1
    return 2
  }
  for (const asset of assets ?? []) {
    const brandId = asset.confirmed_brand_id as string
    const path = asset.storage_path as string
    const category = asset.category as string

    if (category === 'product_cover') {
      coverByBrand.set(brandId, {
        id: asset.id as string,
        file_name: asset.file_name as string,
        file_size: asset.file_size as number | null,
        storage_path: path,
      })
    }

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

      const archiveDesc = (brand.archive_desc as string | null)?.trim()
      const description = archiveDesc || null

      return {
        id: brand.id,
        brandName: brand.brand_name as string,
        product: brand.product as string | null,
        productEn: (brand.product_en as string | null) ?? null,
        website: brand.website as string | null,
        description,
        imageUrl,
        coverAsset: coverByBrand.get(brand.id) ?? null,
      }
    }),
  )

  return items
}
