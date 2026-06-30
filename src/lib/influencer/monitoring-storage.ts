export interface MonitoringAssets {
  cover_url:  string | null
  video_url:  string | null
  image_urls: string[] | null
}

/** Thumbnail to display for a monitoring row — uses the imported TikTok cover URL. */
export function resolveMonitoringThumbnailUrl(assets: MonitoringAssets | null | undefined) {
  return assets?.cover_url ?? null
}
