export interface MonitoringAssets {
  cover_url:  string | null
  video_url:  string | null
  image_urls: string[] | null
}

/** Thumbnail to display for a monitoring row.
 *  Prefers cover_url when explicitly set by the user (any permanent URL).
 *  Falls back to image_urls[0] then bare cover_url. */
export function resolveMonitoringThumbnailUrl(assets: MonitoringAssets | null | undefined) {
  return assets?.cover_url ?? assets?.image_urls?.[0] ?? null
}
