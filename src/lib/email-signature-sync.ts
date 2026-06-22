import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { buildDefaultOutreachSignatureHtml } from '@/lib/email-signature-config'

const BUCKET = 'email-assets'
const LOGO_FILE = 'crane-logo-compressed.png'
const LOGO_PATH = LOGO_FILE

export function localSignatureLogoUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/email/${LOGO_FILE}`
  }
  return `/email/${LOGO_FILE}`
}

export function isLegacyOutreachSignature(html: string): boolean {
  if (!html || html.length > 2500) return true
  return html.includes('logo-light.png')
    || html.includes('data:image')
    || html.includes('<style')
}

/** Upload public/email/crane-logo-compressed.png → Supabase, set GAS logo URL, reset signature HTML. */
export async function syncSignatureLogoAndReset(): Promise<string> {
  const res = await fetch(`/email/${LOGO_FILE}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`로고 파일을 찾을 수 없습니다 (public/email/${LOGO_FILE})`)

  const blob = await res.blob()
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(LOGO_PATH, blob, { upsert: true, contentType: 'image/png' })
  if (uploadErr) throw new Error(`로고 업로드 실패: ${uploadErr.message}`)

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH)
  const logoUrl = pub.publicUrl

  await gasPost({ action: 'setOutreachSignatureLogoUrl', url: logoUrl })
  const sigRes = await gasPost<{ ok?: boolean; signature?: string }>({ action: 'resetEmailSignatureToDefault' })
  return sigRes.signature ?? buildDefaultOutreachSignatureHtml(logoUrl)
}

export function previewDefaultSignatureHtml(): string {
  return buildDefaultOutreachSignatureHtml(localSignatureLogoUrl())
}
