import type { EmailTemplateDomain } from './email-templates'
import { EMS_TEMPLATE_CATEGORIES } from './ems-templates'

const CONTACT_CATEGORIES = ['첫 컨택', '리마인더', '수락/협의', '기타'] as const

const CONTACT_CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  '첫 컨택':   { bg: '#eff6ff', color: '#1d4ed8' },
  '리마인더':  { bg: '#fef9c3', color: '#a16207' },
  '수락/협의': { bg: '#f0fdf4', color: '#15803d' },
  '기타':      { bg: '#f3f4f6', color: '#6b7280' },
}

export interface EmailTemplateUiConfig {
  bannerTitle: string
  bannerDesc: string
  bannerDeco: 'mail-icon' | 'emoji'
  categories: readonly string[]
  categoryColors: Record<string, { bg: string; color: string }>
  defaultCategory: string
  titlePlaceholders: string[]
  bodyPlaceholders: string[]
  dummyValues: Record<string, { value: string; color: string }>
  previewSender: string
  titleMaxLength: number
}

export const EMAIL_TEMPLATE_UI_CONFIG: Record<EmailTemplateDomain, EmailTemplateUiConfig> = {
  influencer: {
    bannerTitle: '인플루언서 템플릿 관리',
    bannerDesc: '인플루언서 컨택 이메일 템플릿을 작성하고 관리합니다.',
    bannerDeco: 'emoji',
    categories: CONTACT_CATEGORIES,
    categoryColors: CONTACT_CATEGORY_COLORS,
    defaultCategory: '첫 컨택',
    titlePlaceholders: ['{{이름}}', '{{핸들}}'],
    bodyPlaceholders: ['{{이름}}', '{{핸들}}', '{{이메일}}', '{{팔로워}}', '{{조회수}}'],
    dummyValues: {
      '{{이름}}':   { value: 'CollabNet Creator',    color: '#a07800' },
      '{{핸들}}':   { value: '@collabnet_creator',    color: '#0369a1' },
      '{{이메일}}': { value: 'creator@collabnet.com', color: '#b45309' },
      '{{팔로워}}': { value: '42,800',             color: '#065f46' },
      '{{조회수}}': { value: '18,500',             color: '#be123c' },
    },
    previewSender: '보내는 사람 · CollabNet Team <project1@collabnet.com>',
    titleMaxLength: 50,
  },
  brand: {
    bannerTitle: '브랜드 템플릿 관리',
    bannerDesc: '브랜드 컨택 이메일 템플릿을 작성하고 관리합니다.',
    bannerDeco: 'emoji',
    categories: CONTACT_CATEGORIES,
    categoryColors: CONTACT_CATEGORY_COLORS,
    defaultCategory: '첫 컨택',
    titlePlaceholders: ['{{브랜드명}}', '{{담당자}}'],
    bodyPlaceholders: ['{{브랜드명}}', '{{담당자}}', '{{직함}}'],
    dummyValues: {
      '{{브랜드명}}': { value: 'AmorePacific', color: '#a07800' },
      '{{담당자}}':   { value: '김민지',        color: '#0369a1' },
      '{{직함}}':     { value: '마케팅 팀장',    color: '#065f46' },
    },
    previewSender: '보내는 사람 · CollabNet Team <project1@collabnet.com>',
    titleMaxLength: 50,
  },
  ems: {
    bannerTitle: 'EMS 템플릿 관리',
    bannerDesc: '배송 오류·재발송 안내 이메일 템플릿을 작성하고 관리합니다.',
    bannerDeco: 'mail-icon',
    categories: EMS_TEMPLATE_CATEGORIES,
    categoryColors: {
      '초기 안내':   { bg: '#eff6ff', color: '#1d4ed8' },
      '재발송 안내': { bg: '#fef9c3', color: '#a16207' },
      '반송 처리':   { bg: '#f0fdf4', color: '#15803d' },
      '기타':        { bg: '#f3f4f6', color: '#6b7280' },
    },
    defaultCategory: '초기 안내',
    titlePlaceholders: ['{이름}', '{운송장번호}'],
    bodyPlaceholders: ['{이름}', '{운송장번호}', '{발송일}', '{오류_사유}', '{국가}'],
    dummyValues: {
      '{이름}':       { value: 'Sarah Kim',      color: '#a07800' },
      '{운송장번호}': { value: 'EMS123456789KR', color: '#0369a1' },
      '{발송일}':     { value: '2026-05-12',      color: '#b45309' },
      '{오류_사유}':  { value: '주소 불명',       color: '#be123c' },
      '{국가}':       { value: '미국',            color: '#065f46' },
    },
    previewSender: '보내는 사람 · CollabNet 팀 <hello@collabnet.com>',
    titleMaxLength: 80,
  },
}

export function getEmailTemplateUiConfig(domain: EmailTemplateDomain): EmailTemplateUiConfig {
  return EMAIL_TEMPLATE_UI_CONFIG[domain]
}
