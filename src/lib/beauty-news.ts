import { supabase } from './supabase'

export interface BeautyNewsKeyword {
  tag: string
  explanation: string
}

export function normalizeKeywords(raw: unknown): BeautyNewsKeyword[] {
  if (!raw) return []
  const arr = typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw) } catch { return raw } })()
    : raw
  if (Array.isArray(arr)) {
    return arr.map(kw => {
      if (typeof kw === 'string') return { tag: kw, explanation: '' }
      const o = kw as { tag?: string; explanation?: string }
      return { tag: o.tag ?? '', explanation: o.explanation ?? '' }
    })
  }
  if (typeof arr === 'string') return [{ tag: arr, explanation: '' }]
  return []
}

export async function fetchLatestBeautyNewsKeywords(): Promise<BeautyNewsKeyword[]> {
  const { data, error } = await supabase
    .from('beauty_news_archives')
    .select('keywords')
    .order('windows_end', { ascending: false, nullsFirst: false })
    .order('windows_start', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) return []
  return normalizeKeywords(data.keywords)
}
