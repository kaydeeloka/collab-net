import { supabase } from '@/lib/supabase'
import { BUCKET, getSignedUrl } from '@/pages/brand/confirmed/archive/shared'

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
