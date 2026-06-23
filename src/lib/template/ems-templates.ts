export const EMS_TEMPLATE_CATEGORIES = ['초기 안내', '재발송 안내', '반송 처리', '기타'] as const
export type EmsTemplateCategory = typeof EMS_TEMPLATE_CATEGORIES[number]

import { fetchEmailTemplates } from './email-templates'

export type { EmailTemplate as EmsTemplate } from './email-templates'
export {
  DEFAULT_EMAIL_TEMPLATES,
  fetchEmailTemplates,
  saveEmailTemplate,
  createEmailTemplate,
  deleteEmailTemplate,
} from './email-templates'

export function loadEmsTemplates() {
  return fetchEmailTemplates('ems')
}

export interface EmsPlaceholderRow {
  name: string
  email?: string | null
  tracking?: string
  applicationNumber?: string
  sentDate?: string
  country?: string
  reason?: string
  original?: {
    ems_number?: string
    registered_date?: string
    last_update?: string
  } | null
}

function val(v: string | null | undefined) {
  return v && v !== '—' ? v : ''
}

export function applyEmsPlaceholders(text: string, row: EmsPlaceholderRow): string {
  const originalTracking = val(row.original?.ems_number)
  const newTracking = val(row.tracking)
  const map: Record<string, string> = {
    '{이름}':         val(row.name),
    '{운송장번호}':   originalTracking || newTracking,
    '{발송일}':       val(row.original?.registered_date) || val(row.sentDate),
    '{오류_사유}':    val(row.reason),
    '{국가}':         val(row.country),
    '{새_운송장번호}': newTracking,
    '{재발송일}':     val(row.sentDate),
    '{예상_도착일}':  '',
    '{반송_도착일}':  val(row.original?.last_update),
  }
  let out = text
  for (const [tag, replacement] of Object.entries(map)) {
    out = out.split(tag).join(replacement)
  }
  return out
}
