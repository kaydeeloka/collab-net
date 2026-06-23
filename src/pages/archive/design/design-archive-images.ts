import { supabase } from '@/lib/supabase'
import { BUCKET } from '@/pages/brand/confirmed/archive/shared'
import { loadStorageImageUrl } from '../brand-report/season-collection-images'

export type DesignAssetCategory = 'theme' | 'kit_box' | 'collection_card' | 'brochure'

const COLUMN_BY_CATEGORY: Record<DesignAssetCategory, string> = {
  theme: 'design_theme_img',
  kit_box: 'design_kit_box_img',
  collection_card: 'design_collection_card_img',
  brochure: 'design_brochure_img',
}

export { loadStorageImageUrl }

export function designCoverPath(phase: {
  design_theme_img?: string | null
  collection_img?: string | null
}) {
  return phase.design_theme_img ?? phase.collection_img ?? null
}

export async function loadDesignAssetUrls(phase: {
  design_theme_img?: string | null
  design_kit_box_img?: string | null
  design_collection_card_img?: string | null
  design_brochure_img?: string | null
  collection_img?: string | null
}) {
  const [kitBox, collectionCard, brochure] = await Promise.all([
    loadStorageImageUrl(phase.design_kit_box_img),
    loadStorageImageUrl(phase.design_collection_card_img),
    loadStorageImageUrl(phase.design_brochure_img),
  ])
  return { kitBox, collectionCard, brochure }
}

function buildDesignAssetPath(phaseId: string, category: DesignAssetCategory, fileName: string) {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop() ?? 'jpg' : 'jpg'
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `${phaseId}/design/${category}/${token}.${ext}`
}

export async function uploadDesignAsset(
  phaseId: string,
  category: DesignAssetCategory,
  file: File,
  previousPath: string | null,
) {
  const column = COLUMN_BY_CATEGORY[category]
  const path = buildDesignAssetPath(phaseId, category, file.name)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) return { path: null as string | null, error: upErr.message }

  const { error: dbErr } = await supabase
    .from('phases')
    .update({ [column]: path })
    .eq('id', phaseId)
  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return { path: null, error: dbErr.message }
  }

  if (previousPath) {
    await supabase.storage.from(BUCKET).remove([previousPath])
  }

  return { path, error: null }
}
