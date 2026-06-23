import { supabase } from '@/lib/supabase'
import { BUCKET, getSignedUrl } from '@/pages/brand/confirmed/archive/shared'

function buildCollectionHeroPath(phaseId: string, fileName: string) {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop() ?? 'jpg' : 'jpg'
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `${phaseId}/collection/hero/${token}.${ext}`
}

export async function loadCollectionHeroUrl(storagePath: string | null | undefined) {
  if (!storagePath) return null
  const { url } = await getSignedUrl(storagePath)
  return url
}

export async function uploadCollectionHero(phaseId: string, file: File, previousPath: string | null) {
  const path = buildCollectionHeroPath(phaseId, file.name)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (upErr) return { path: null as string | null, error: upErr.message }

  const { error: dbErr } = await supabase
    .from('phases')
    .update({ collection_hero_path: path })
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

export async function removeCollectionHero(phaseId: string, storagePath: string) {
  const { error: dbErr } = await supabase
    .from('phases')
    .update({ collection_hero_path: null })
    .eq('id', phaseId)
  if (dbErr) return { error: dbErr.message }

  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (storageErr && !storageErr.message.includes('Not found')) {
    return { error: storageErr.message }
  }

  return { error: null }
}
