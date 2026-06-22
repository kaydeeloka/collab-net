const SUPABASE_PUBLIC_LOGO_URL =
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/email-assets/crane-logo.png`

/** Public HTTPS URL for outreach signature logo (used in sent emails). */
export const OUTREACH_SIGNATURE_LOGO_URL =
  (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined)?.replace(/\/$/, '')
    ? `${(import.meta.env.VITE_PUBLIC_ORIGIN as string).replace(/\/$/, '')}/email/crane-logo.png`
    : SUPABASE_PUBLIC_LOGO_URL

export function buildDefaultOutreachSignatureHtml(logoUrl: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;border:none;font-family:'Malgun Gothic',Arial,sans-serif;">
<tr>
  <td style="padding:0;font-size:12px;line-height:1.65;color:#666;">
    <img src="${logoUrl}" alt="Crane Communications" width="260" style="display:block;border:0;max-width:260px;height:auto;margin:0 0 10px 0;" />
    <span style="color:#333;font-weight:700;">Mi Muse</span> 운영팀 / 크레인커뮤니케이션즈<br>
    <span style="color:#2c4a6e;font-weight:700;">Mi Muse Operations Team / Crane Communications</span><br>
    T. 02-522-0692 &nbsp; E. <a href="mailto:beautyproject@cranecomm.com" style="color:#2563eb;text-decoration:underline;">beautyproject@cranecomm.com</a><br>
    06754 서울특별시 서초구 양재천로69, 1층<br>
    1F, Yangjaecheon-ro 69, Seocho-gu, Seoul, Korea 06619
  </td>
</tr>
</table>`
}

export const DEFAULT_OUTREACH_SIGNATURE_HTML = buildDefaultOutreachSignatureHtml(OUTREACH_SIGNATURE_LOGO_URL)
