import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { buildDefaultOutreachSignatureHtml } from '@/lib/email-signature-config'

const BUCKET = 'email-assets'
const LOGO_PATH = 'crane-logo.png'

export function localSignatureLogoUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/email/crane-logo.png`
  }
  return '/email/crane-logo.png'
}

export function isLegacyOutreachSignature(html: string): boolean {
  if (!html || html.length > 2500) return true
  return html.includes('logo-light.png')
    || html.includes('data:image')
    || html.includes('<style')
}

/** Upload public/email/crane-logo.png → Supabase, set GAS logo URL, reset signature HTML. */
export async function syncSignatureLogoAndReset(): Promise<string> {
  const res = await fetch('/email/crane-logo.png', { cache: 'no-store' })
  if (!res.ok) throw new Error('로고 파일을 찾을 수 없습니다 (public/email/crane-logo.png)')

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
