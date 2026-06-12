export interface ContentPlatformAccount {
  platform: string
  handle: string
  followers: number
  profile_url: string
  is_primary: boolean
}

export const PLATFORM_OPTIONS = ['TikTok', 'Instagram', 'YouTube', 'Blog', 'Facebook'] as const

export function defaultProfileUrl(platform: string, handle: string): string {
  const h = handle.replace(/^@/, '')
  if (!h) return ''
  const p = platform.toLowerCase()
  if (p.includes('tiktok')) return `https://www.tiktok.com/@${h}`
  if (p.includes('instagram')) return `https://www.instagram.com/${h}`
  if (p.includes('youtube')) return `https://www.youtube.com/@${h}`
  return ''
}

export function parseContentPlatforms(raw: unknown): ContentPlatformAccount[] {
  if (!raw) return []
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) arr = parsed
    } catch { /* ignore */ }
  }
  const accounts = arr.map((item, i) => {
    const o = item as Record<string, unknown>
    const platform = String(o.platform ?? '').trim()
    const handle = String(o.handle ?? '').replace(/^@/, '').trim()
    return {
      platform,
      handle,
      followers: Number(o.followers ?? 0) || 0,
      profile_url: String(o.profile_url ?? '') || (platform && handle ? defaultProfileUrl(platform, handle) : ''),
      is_primary: Boolean(o.is_primary),
      _i: i,
    }
  }).filter(a => a.platform) as (ContentPlatformAccount & { _i: number })[]

  if (accounts.length && !accounts.some(a => a.is_primary)) {
    accounts[0].is_primary = true
  }
  return accounts.map(({ _i: _, ...a }) => a)
}

export function primaryAccount(accounts: ContentPlatformAccount[]): ContentPlatformAccount | null {
  if (!accounts.length) return null
  return accounts.find(a => a.is_primary) ?? accounts[0]
}

export function primaryPlatform(accounts: ContentPlatformAccount[]): string | null {
  return primaryAccount(accounts)?.platform ?? null
}

export function buildContentPlatformsFromInfluencer(inf: {
  platform?: string | null
  handle?: string | null
  followers?: number | null
  profile_url?: string | null
}): ContentPlatformAccount[] {
  const platform = inf.platform || 'TikTok'
  const handle = (inf.handle || '').replace(/^@/, '')
  if (!handle && !inf.platform) return []
  return [{
    platform,
    handle,
    followers: inf.followers ?? 0,
    profile_url: inf.profile_url || defaultProfileUrl(platform, handle),
    is_primary: true,
  }]
}

export function resolveContentPlatforms(
  raw: unknown,
  inf: { platform?: string | null; handle?: string | null; followers?: number | null; profile_url?: string | null } | null,
): ContentPlatformAccount[] {
  const parsed = parseContentPlatforms(raw)
  if (parsed.length) return parsed
  if (inf) return buildContentPlatformsFromInfluencer(inf)
  return []
}

export function normalizeContentPlatforms(accounts: ContentPlatformAccount[]): ContentPlatformAccount[] {
  const cleaned = accounts
    .map(a => ({
      platform: a.platform.trim(),
      handle: a.handle.replace(/^@/, '').trim(),
      followers: Number(a.followers) || 0,
      profile_url: a.profile_url.trim() || defaultProfileUrl(a.platform, a.handle),
      is_primary: a.is_primary,
    }))
    .filter(a => a.platform)

  if (cleaned.length && !cleaned.some(a => a.is_primary)) {
    cleaned[0] = { ...cleaned[0], is_primary: true }
  }
  return cleaned
}

export function setPrimaryAccount(accounts: ContentPlatformAccount[], index: number): ContentPlatformAccount[] {
  return accounts.map((a, i) => ({ ...a, is_primary: i === index }))
}

export function emptyPlatformAccount(): ContentPlatformAccount {
  return { platform: 'TikTok', handle: '', followers: 0, profile_url: '', is_primary: false }
}
