import { supabase } from '@/lib/supabase'

export async function uploadReportSlideImage(phaseId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const path = `${phaseId}/report-images/${token}.${ext}`

  const { error } = await supabase.storage
    .from('brand-archive')
    .upload(path, file, { cacheControl: '31536000', upsert: false })

  if (error) return null

  const { data } = await supabase.storage
    .from('brand-archive')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10) // 10-year signed URL

  return data?.signedUrl ?? null
}
