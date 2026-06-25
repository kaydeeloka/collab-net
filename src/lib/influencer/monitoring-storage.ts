import { supabase } from '@/lib/supabase'

/** Public bucket — store JPG/WEBP */
export const MONITORING_THUMBNAIL_BUCKET = 'monitoring-thumbnails'

/** Private bucket — store MP4 */
export const MONITORING_VIDEO_BUCKET = 'monitoring-videos'

const VIDEO_SIGNED_URL_TTL_SEC = 3600

export interface MonitoringAssets {
  thumbnail_source_url: string | null
  thumbnail_path:       string | null
  video_path:           string | null
  cover_url:            string | null
  video_url:            string | null
}

/** `{phaseId}/{monitoringRowId}.jpg` */
export function monitoringThumbnailPath(phaseId: string, monitoringId: string) {
  return `${phaseId}/${monitoringId}.jpg`
}

/** `{phaseId}/{monitoringRowId}.mp4` */
export function monitoringVideoPath(phaseId: string, monitoringId: string) {
  return `${phaseId}/${monitoringId}.mp4`
}

export function monitoringThumbnailPublicUrl(storagePath: string) {
  const { data } = supabase.storage.from(MONITORING_THUMBNAIL_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export function resolveMonitoringThumbnailUrl(assets: MonitoringAssets | null | undefined) {
  if (!assets) return null
  if (assets.thumbnail_path) return monitoringThumbnailPublicUrl(assets.thumbnail_path)
  return assets.cover_url || assets.thumbnail_source_url
}

export async function createMonitoringVideoSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(MONITORING_VIDEO_BUCKET)
    .createSignedUrl(storagePath, VIDEO_SIGNED_URL_TTL_SEC)
  if (error) throw error
  return data.signedUrl
}

export async function upsertMonitoringAssets(
  monitoringId: string,
  fields: Partial<MonitoringAssets>,
) {
  const { error } = await supabase.from('monitoring_assets').upsert(
    { monitoring_id: monitoringId, ...fields, updated_at: new Date().toISOString() },
    { onConflict: 'monitoring_id' },
  )
  if (error) throw error
}

/** Upload thumbnail; sets monitoring_assets.thumbnail_path */
export async function uploadMonitoringThumbnail(
  phaseId: string,
  monitoringId: string,
  file: Blob,
  contentType = 'image/jpeg',
) {
  const path = monitoringThumbnailPath(phaseId, monitoringId)
  const { error } = await supabase.storage.from(MONITORING_THUMBNAIL_BUCKET).upload(path, file, {
    upsert: true,
    contentType,
  })
  if (error) throw error
  await upsertMonitoringAssets(monitoringId, { thumbnail_path: path })
  return monitoringThumbnailPublicUrl(path)
}

/** Upload MP4; sets monitoring_assets.video_path */
export async function uploadMonitoringVideo(
  phaseId: string,
  monitoringId: string,
  file: Blob,
) {
  const path = monitoringVideoPath(phaseId, monitoringId)
  const { error } = await supabase.storage.from(MONITORING_VIDEO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: 'video/mp4',
  })
  if (error) throw error
  await upsertMonitoringAssets(monitoringId, { video_path: path })
  return path
}
