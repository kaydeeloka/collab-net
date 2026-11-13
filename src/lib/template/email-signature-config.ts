const APP_URL = (
  import.meta.env.VITE_APP_URL as string | undefined
)?.replace(/\/$/, '') || 'https://collab-net-psi.vercel.app'

export const OUTREACH_SIGNATURE_LOGO_URL = `${APP_URL}/email/collabnet-logo.svg`

function outreachSignatureTextHtml(): string {
  return `<b style="color:#333;">CollabNet</b> 운영팀 / 크레인커뮤니케이션즈<br>
<b style="color:#2c4a6e;">CollabNet Operations Team / Crane Communications</b><br>
T. 02-522-0692 · E. <a href="mailto:project1@collabnet.com" style="color:#2563eb;">project1@collabnet.com</a><br>
06754 서울특별시 서초구 양재천로69, 1층<br>
1F, Yangjaecheon-ro 69, Seocho-gu, Seoul, Korea 06619`
}

export function buildTextOnlyOutreachSignatureHtml(): string {
  return outreachSignatureTextHtml()
}

/** Matches GAS defaultOutreachSignatureHtml (table layout, no per-send unique token). */
export function buildOutreachSignatureHtml(logoSrc: string | null): string {
  const img = logoSrc
    ? `<img src="${logoSrc}" alt="CollabNet" width="260" style="border:0;max-width:260px;height:auto;display:block;margin:0 0 8px 0;" />`
    : ''
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Malgun Gothic,Arial,sans-serif;font-size:14px;line-height:1.7;color:#222;"><tr><td style="padding:8px 0 0 0;">${img}${outreachSignatureTextHtml()}</td></tr></table>`
}

export function buildDefaultOutreachSignatureHtml(logoUrl: string): string {
  return buildOutreachSignatureHtml(logoUrl)
}

export const DEFAULT_OUTREACH_SIGNATURE_HTML = buildDefaultOutreachSignatureHtml(OUTREACH_SIGNATURE_LOGO_URL)
