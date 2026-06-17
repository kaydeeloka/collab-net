import { supabase } from './supabase'

export type EmailTemplateDomain = 'influencer' | 'brand' | 'ems'

export interface EmailTemplate {
  id: string
  domain: EmailTemplateDomain
  name: string
  title: string
  body: string
  category: string
  sort_order: number
  is_default: boolean
}

type EmailTemplateRow = {
  id: string
  domain: string
  name: string
  title: string
  body: string
  category: string
  sort_order: number
  is_default: boolean
  is_active: boolean
}

const LOCAL_STORAGE_KEYS: Record<EmailTemplateDomain, string> = {
  influencer: 'mm_email_templates',
  brand: 'mm_brand_email_templates',
  ems: 'mm_ems_templates',
}

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateDomain, Omit<EmailTemplate, 'id'>[]> = {
  influencer: [
    {
      domain: 'influencer',
      name: '신제품 기프트 제안',
      title: '[MiMuse] {{이름}}님, 미뮤즈 신제품 VIP 기프트 증정 제안',
      body: `안녕하세요 {{이름}}님!\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n평소 {{이름}}님의 TikTok 채널({{핸들}})을 통해 전달하시는 세련된 감성과 독창적인 리뷰 스타일에 깊은 인상을 받았습니다.\n\n이번 론칭하는 수분 세럼 패키지를 맞이하여 기프팅 선물을 전달드리고자 메일 드립니다.\n\n배송을 위해 성함, 연락처, 배송 정보를 회신 주시면 조속히 발송하겠습니다.\n\nMiMuse 드림.`,
      category: '첫 컨택',
      sort_order: 1,
      is_default: true,
    },
    {
      domain: 'influencer',
      name: '1차 기프트 리마인더',
      title: '[MiMuse] {{이름}}님, 이전 기프트 패키지 증정 관련 재문의',
      body: `안녕하세요 {{이름}}님, MiMuse 글로벌 팀입니다.\n\n이전 메일을 통해 전달해 드렸던 신제품 선물 기프팅 제안에 대해 재문의 드립니다.\n\n{{이름}}님 채널({{핸들}})이 저희 제품과 잘 어울릴 것 같아 특별히 연락드립니다.\n\n배송 정보를 회신 주시면 즉시 절차를 진행하겠습니다.\n감사합니다.`,
      category: '리마인더',
      sort_order: 2,
      is_default: true,
    },
  ],
  brand: [
    {
      domain: 'brand',
      name: '협업 제안 (첫 컨택)',
      title: '[MiMuse] {{브랜드명}} 담당자님, 미뮤즈 협업 제안드립니다',
      body: `안녕하세요 {{담당자}}님,\n\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n{{브랜드명}}의 제품과 미뮤즈가 함께 시너지를 낼 수 있을 것이라 생각하여 협업을 제안드립니다.\n\n자세한 내용은 아래와 같으며, 검토 후 회신 주시면 감사하겠습니다.\n\n미뮤즈 드림.`,
      category: '첫 컨택',
      sort_order: 1,
      is_default: true,
    },
    {
      domain: 'brand',
      name: '협업 리마인더',
      title: '[MiMuse] {{브랜드명}} 담당자님, 이전 협업 제안 관련 재문의',
      body: `안녕하세요 {{담당자}}님, MiMuse 글로벌 팀입니다.\n\n이전에 발송드린 협업 제안 메일 관련하여 재문의 드립니다.\n\n{{브랜드명}}과의 협업에 여전히 큰 기대를 가지고 있으며, 편하실 때 회신 주시면 감사하겠습니다.\n\n감사합니다.`,
      category: '리마인더',
      sort_order: 2,
      is_default: true,
    },
  ],
  ems: [
    {
      domain: 'ems',
      name: '기본 오류 안내',
      title: '[MiMuse] 배송 오류 안내 — {운송장번호}',
      body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님께 발송된 패키지({운송장번호})의 배송 과정에서 문제가 발생하여 연락드립니다.\n\n■ 오류 내용: {오류_사유}\n■ 운송장 번호: {운송장번호}\n■ 발송일: {발송일}\n\n현재 해당 건을 확인 중이며, 빠른 시일 내에 재발송 또는 해결 방안을 안내해 드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀`,
      category: '초기 안내',
      sort_order: 1,
      is_default: true,
    },
    {
      domain: 'ems',
      name: '재발송 안내',
      title: '[MiMuse] 패키지 재발송 안내 — {이름}님',
      body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n이전 배송 오류로 인해 불편을 드린 점 진심으로 사과드립니다.\n아래와 같이 패키지를 재발송하였습니다.\n\n■ 새 운송장 번호: {새_운송장번호}\n■ 재발송일: {재발송일}\n■ 예상 도착일: {예상_도착일}\n\n이번에는 정상적으로 수령하실 수 있도록 최선을 다하겠습니다.\n궁금하신 점은 언제든지 연락해 주세요.\n\n감사합니다,\nMiMuse 팀`,
      category: '재발송 안내',
      sort_order: 2,
      is_default: true,
    },
    {
      domain: 'ems',
      name: '반송 처리 완료',
      title: '[MiMuse] 반송 처리 완료 — {이름}님',
      body: `안녕하세요, {이름}님.\n\nMiMuse 팀입니다.\n\n{이름}님의 패키지({운송장번호})가 반송 처리되어 저희 측에 도착하였습니다.\n\n■ 반송 도착일: {반송_도착일}\n■ 반송 사유: {오류_사유}\n\n빠른 시일 내에 재발송 일정을 안내드리겠습니다.\n불편을 드려 대단히 죄송합니다.\n\n감사합니다,\nMiMuse 팀`,
      category: '반송 처리',
      sort_order: 3,
      is_default: true,
    },
  ],
}

function fromRow(row: EmailTemplateRow): EmailTemplate {
  return {
    id: row.id,
    domain: row.domain as EmailTemplateDomain,
    name: row.name,
    title: row.title,
    body: row.body,
    category: row.category,
    sort_order: row.sort_order,
    is_default: row.is_default,
  }
}

function readLegacyLocal(domain: EmailTemplateDomain): EmailTemplate[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS[domain])
    if (!raw) return null
    const parsed = JSON.parse(raw) as Array<{
      id?: string
      name: string
      subject?: string
      title?: string
      body: string
      category?: string
    }>
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.map((t, i) => ({
      id: t.id || crypto.randomUUID(),
      domain,
      name: t.name,
      title: t.title ?? t.subject ?? '',
      body: t.body,
      category: t.category || '기타',
      sort_order: i + 1,
      is_default: false,
    }))
  } catch {
    return null
  }
}

async function insertTemplates(
  domain: EmailTemplateDomain,
  templates: Array<Pick<EmailTemplate, 'name' | 'title' | 'body' | 'category' | 'sort_order' | 'is_default'>>,
) {
  const rows = templates.map((t, i) => ({
    domain,
    name: t.name,
    title: t.title,
    body: t.body,
    category: t.category,
    sort_order: t.sort_order ?? i + 1,
    is_default: t.is_default ?? false,
  }))
  const { data, error } = await supabase.from('email_templates').insert(rows).select('*')
  if (error) throw error
  return (data as EmailTemplateRow[]).map(fromRow)
}

async function seedDefaults(domain: EmailTemplateDomain): Promise<EmailTemplate[]> {
  return insertTemplates(domain, DEFAULT_EMAIL_TEMPLATES[domain].map(({ name, title, body, category, sort_order, is_default }) => ({
    name, title, body, category, sort_order, is_default,
  })))
}

export async function fetchEmailTemplates(domain: EmailTemplateDomain): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('domain', domain)
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at')

  if (error) throw error

  if (!data?.length) {
    const legacy = readLegacyLocal(domain)
    if (legacy?.length) {
      const inserted = await insertTemplates(domain, legacy.map(({ name, title, body, category, sort_order, is_default }) => ({
        name, title, body, category, sort_order, is_default,
      })))
      localStorage.removeItem(LOCAL_STORAGE_KEYS[domain])
      return inserted
    }
    return seedDefaults(domain)
  }

  return (data as EmailTemplateRow[]).map(fromRow)
}

export async function saveEmailTemplate(template: EmailTemplate): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .update({
      name: template.name,
      title: template.title,
      body: template.body,
      category: template.category,
      updated_at: new Date().toISOString(),
    })
    .eq('id', template.id)
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as EmailTemplateRow)
}

export async function createEmailTemplate(
  domain: EmailTemplateDomain,
  partial: Pick<EmailTemplate, 'name' | 'title' | 'body' | 'category'>,
  sortOrder = 99,
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      domain,
      name: partial.name,
      title: partial.title,
      body: partial.body,
      category: partial.category,
      sort_order: sortOrder,
      is_default: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return fromRow(data as EmailTemplateRow)
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
