import { supabase } from '@/lib/supabase'
import {
  BUCKET,
  buildStoragePath,
  getSignedUrl,
} from '@/pages/brand/confirmed/archive/shared'

function buildCollectionImgPath(phaseId: string, fileName: string) {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop() ?? 'jpg' : 'jpg'
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `${phaseId}/collection_img/${token}.${ext}`
}

export async function loadStorageImageUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null
  const { url } = await getSignedUrl(storagePath)
  return url
}

export async function uploadCollectionImg(phaseId: string, file: File, previousPath: string | null) {
  const path = buildCollectionImgPath(phaseId, file.name)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) return { path: null as string | null, error: upErr.message }

  const { error: dbErr } = await supabase
    .from('phases')
    .update({ collection_img: path })
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

export async function removeCollectionImg(phaseId: string, storagePath: string) {
  const { error: dbErr } = await supabase
    .from('phases')
    .update({ collection_img: null })
    .eq('id', phaseId)
  if (dbErr) return { error: dbErr.message }

  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageErr && !storageErr.message.includes('Not found')) {
    return { error: storageErr.message }
  }

  return { error: null }
}

export async function uploadBrandCover(phaseId: string, brandId: string, file: File) {
  const { data: existing } = await supabase
    .from('confirmed_brand_assets')
    .select('id, storage_path')
    .eq('confirmed_brand_id', brandId)
    .eq('category', 'product_cover')

  for (const row of existing ?? []) {
    await supabase.storage.from(BUCKET).remove([row.storage_path as string])
    await supabase.from('confirmed_brand_assets').delete().eq('id', row.id)
  }

  const path = buildStoragePath(phaseId, brandId, 'product_cover', file.name, 0)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) return { imageUrl: null as string | null, coverAsset: null, error: upErr.message }

  const { data: row, error: insErr } = await supabase.from('confirmed_brand_assets').insert({
    confirmed_brand_id: brandId,
    category: 'product_cover',
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    mime_type: file.type || null,
    sort_order: 0,
  })
    .select('id, file_name, file_size, storage_path')
    .single()
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path])
    return { imageUrl: null, coverAsset: null, error: insErr.message }
  }

  const imageUrl = await loadStorageImageUrl(path)
  const coverAsset = {
    id: row.id as string,
    file_name: row.file_name as string,
    file_size: row.file_size as number | null,
    storage_path: row.storage_path as string,
  }
  return { imageUrl, coverAsset, error: null }
}

export async function removeBrandCover(assetId: string, storagePath: string) {
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageErr && !storageErr.message.includes('Not found')) {
    return { error: storageErr.message }
  }

  const { error: dbErr } = await supabase.from('confirmed_brand_assets').delete().eq('id', assetId)
  if (dbErr) return { error: dbErr.message }

  return { error: null }
}
