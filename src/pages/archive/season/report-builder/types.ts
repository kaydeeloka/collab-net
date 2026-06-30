export type PageType =
  | 'cover'
  | 'project_overview'
  | 'kit_composition'
  | 'content_performance'
  | 'best_review'
  | 'brand_mention'
  | 'next_project'
  | 'outro'

export interface PageContent {
  // cover / outro
  title?: string
  caption?: string
  // content pages — shown as header on every non-cover page
  engTitle?: string
  korTitle?: string
  // body text
  body?: string
  // best_review grid columns
  columns?: number
}

export interface ReportPage {
  id: string
  phase_id: string
  order_index: number
  type: PageType
  content: PageContent
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  cover:               '표지',
  project_overview:    '프로젝트 개요',
  kit_composition:     '키트 구성',
  content_performance: '콘텐츠 성과',
  best_review:         '베스트 리뷰 하이라이트',
  brand_mention:       '브랜드 언급 하이라이트',
  next_project:        '넥스트 프로젝트',
  outro:               '마무리',
}

export const DEFAULT_CONTENT: Record<PageType, PageContent> = {
  cover:               { title: '' },
  project_overview:    { engTitle: 'Project Overview', korTitle: '프로젝트 개요', body: '' },
  kit_composition:     { engTitle: 'Kit Composition', korTitle: '키트 구성', body: '' },
  content_performance: { engTitle: 'Content Performance', korTitle: '콘텐츠 성과 OVERVIEW' },
  best_review:         { engTitle: 'Best Review Highlights', korTitle: '베스트 리뷰 하이라이트', columns: 5 },
  brand_mention:       { engTitle: 'Brand Mention Highlights', korTitle: '브랜드 언급 하이라이트' },
  next_project:        { engTitle: 'Next Project', korTitle: '넥스트 프로젝트', body: '' },
  outro:               { title: 'E.O.D', caption: '' },
}
