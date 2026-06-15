export const EMS_TEMPLATE_CATEGORIES = ['초기 안내', '재발송 안내', '반송 처리', '기타'] as const
export type EmsTemplateCategory = typeof EMS_TEMPLATE_CATEGORIES[number]

export interface EmsTemplate {
  id: string
  name: string
  category: EmsTemplateCategory
  subject: string
  body: string
}

export const DEFAULT_EMS_TEMPLATES: EmsTemplate[] = [
  {
    id: 'ems_01', name: '기본 오류 안내', category: '초기 안내',
    subject: '[MiMuse] 배송 오류 안내 — {운송장번호}',
    body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님께 발송된 패키지({운송장번호})의 배송 과정에서 문제가 발생하여 연락드립니다.\n\n■ 오류 내용: {오류_사유}\n■ 운송장 번호: {운송장번호}\n■ 발송일: {발송일}\n\n현재 해당 건을 확인 중이며, 빠른 시일 내에 재발송 또는 해결 방안을 안내해 드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀`,
  },
  {
    id: 'ems_02', name: '재발송 안내', category: '재발송 안내',
    subject: '[MiMuse] 패키지 재발송 안내 — {이름}님',
    body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n이전 배송 오류로 인해 불편을 드린 점 진심으로 사과드립니다.\n아래와 같이 패키지를 재발송하였습니다.\n\n■ 새 운송장 번호: {새_운송장번호}\n■ 재발송일: {재발송일}\n■ 예상 도착일: {예상_도착일}\n\n이번에는 정상적으로 수령하실 수 있도록 최선을 다하겠습니다.\n궁금하신 점은 언제든지 연락해 주세요.\n\n감사합니다,\nMiMuse 팀`,
  },
  {
    id: 'ems_03', name: '반송 처리 완료', category: '반송 처리',
    subject: '[MiMuse] 반송 처리 완료 — {이름}님',
    body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님의 패키지({운송장번호})가 반송 처리되어 저희 측에 도착하였습니다.\n\n■ 반송 도착일: {반송_도착일}\n■ 반송 사유: {오류_사유}\n\n빠른 시일 내에 재발송 일정을 안내드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀`,
  },
]

const STORAGE_KEY = 'mm_ems_templates'

export function loadEmsTemplates(): EmsTemplate[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? JSON.parse(v) as EmsTemplate[] : DEFAULT_EMS_TEMPLATES
  } catch {
    return DEFAULT_EMS_TEMPLATES
  }
}

export function saveEmsTemplates(templates: EmsTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
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
