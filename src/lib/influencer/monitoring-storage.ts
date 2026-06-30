export interface MonitoringAssets {
  cover_url:  string | null
  video_url:  string | null
  image_urls: string[] | null
}

/** Thumbnail to display for a monitoring row.
 *  Prefers image_urls[0] (Apify-hosted, permanent) over cover_url (TikTok CDN signed, expires). */
export function resolveMonitoringThumbnailUrl(assets: MonitoringAssets | null | undefined) {
  return assets?.image_urls?.[0] ?? assets?.cover_url ?? null
}
