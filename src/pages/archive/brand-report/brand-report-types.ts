export type BrandPageType =
  | 'cover'
  | 'project_overview'
  | 'brand_content_performance'
  | 'review_list'
  | 'best_review'
  | 'best_review_detail'
  | 'brand_mention'
  | 'brand_mention_detail'
  | 'outro'

export interface ProcessStep {
  date: string
  content: string
}

export interface BrandPageContent {
  // cover / outro
  title?: string
  caption?: string
  outroContacts?: string       // "name|email" per line
  // header (all content pages)
  engTitle?: string
  korTitle?: string
  // project_overview
  imageUrl?: string
  projectName?: string
  projectPurpose?: string
  kitRecipients?: string
  totalShipping?: string
  participatingBrands?: string
  processSteps?: ProcessStep[]
  // brand_content_performance
  cpRecoveryCards?: string     // "label|desc|pct" per line
  cpContentTypeRows?: string   // "label|tiktok|instagram|magazine|total" per line
  cpCommentReaction?: string   // editable text block
  // review_list
  rlSubtitle?: string          // "Mi Muse 리뷰" | "브랜드 개별 리뷰"
  rlOffset?: number            // row pagination start index
  // best_review_detail
  brdPickIndex?: number    // which best pick (0=1st, 1=2nd, 2=3rd)
  brdCard1?: string        // JSON { rowId, comment } for the comment
  brdCard1Img?: string     // manual image override
  // brand_mention_detail (one influencer per slide)
  bmdPickIndex?: number        // which brand row to show (0 = first)
  bmdHandle?: string           // kept for legacy / manual override
  bmdFollowers?: string
  bmdViews?: string
  bmdLikes?: string
  bmdComments?: string
  bmdAdditional?: string       // 추가 업로드 handle
  bmdCommentReaction?: string
  bmdImageUrl?: string
  // brand_mention manual slot overrides — JSON: { "ti": "url" }
  bmOverrides?: string
  // tracks which monitoring row ID filled each slot — JSON: { "ti": "rowId" }
  bmRowIds?: string
  // auto-thumbnail exclusions — JSON array of monitoring row IDs to hide from auto zone
  bmAutoExclude?: string
}

export interface BrandReportPage {
  id: string
  phase_id: string
  brand_name: string
  order_index: number
  type: BrandPageType
  content: BrandPageContent
}

export const BRAND_PAGE_TYPE_LABELS: Record<BrandPageType, string> = {
  cover:                     '표지',
  project_overview:          '프로젝트 개요',
  brand_content_performance: '콘텐츠 성과',
  review_list:               '리뷰 업로드 리스트',
  best_review:               '베스트 리뷰 (그리드)',
  best_review_detail:        '베스트 리뷰 (상세)',
  brand_mention:             '브랜드 언급 (그리드)',
  brand_mention_detail:      '브랜드 언급 (상세)',
  outro:                     '마무리',
}

const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  { date: '', content: '' },
  { date: '', content: '' },
  { date: '', content: '' },
  { date: '', content: '' },
]

export const BRAND_DEFAULT_CONTENT: Record<BrandPageType, BrandPageContent> = {
  cover: { title: '' },
  project_overview: {
    engTitle: 'OVERVIEW',
    korTitle: 'Mi Muse 시딩 프로젝트 개요',
    imageUrl: '',
    projectName: '',
    projectPurpose: '',
    kitRecipients: '',
    totalShipping: '',
    participatingBrands: '',
    processSteps: DEFAULT_PROCESS_STEPS,
  },
  brand_content_performance: {
    engTitle: 'Content Performance',
    korTitle: '콘텐츠 성과 OVERVIEW',
    cpRecoveryCards: '인플루언서||80\n매거진||100\n콘텐츠 수량||98',
    cpContentTypeRows: 'Mi Muse 리뷰|0|0|0|0\n개별 브랜드 리뷰|0|0|0|0\n브랜드 단독 리뷰|0|0|0|0\n합계|0|0|0|0',
    cpCommentReaction: '',
  },
  review_list: {
    engTitle: 'REVIEW',
    korTitle: '리뷰 업로드 리스트',
    rlSubtitle: 'Mi Muse 리뷰',
    rlOffset: 0,
  },
  best_review: {
    engTitle: 'Best Review Highlights',
    korTitle: '베스트 리뷰 하이라이트',
  },
  best_review_detail: {
    engTitle: 'Best Review Highlights',
    korTitle: '베스트 리뷰 하이라이트',
    brdCard1: '',
  },
  brand_mention: {
    engTitle: 'Brand Mention Highlights',
    korTitle: '브랜드 언급 하이라이트',
  },
  brand_mention_detail: {
    engTitle: 'Brand Mention Highlights',
    korTitle: '브랜드 언급 하이라이트',
    bmdHandle: '',
    bmdFollowers: '',
    bmdViews: '',
    bmdLikes: '',
    bmdComments: '',
    bmdAdditional: '',
    bmdCommentReaction: '',
    bmdImageUrl: '',
  },
  outro: { title: 'E.O.D', caption: '' },
}

export const BRAND_DEFAULT_PAGE_ORDER: Array<{
  type: BrandPageType
  extra?: Partial<BrandPageContent>
}> = [
  { type: 'cover' },
  { type: 'project_overview' },
  { type: 'brand_content_performance' },
  { type: 'review_list', extra: { rlSubtitle: 'Mi Muse 리뷰', rlOffset: 0 } },
  { type: 'review_list', extra: { rlSubtitle: '브랜드 개별 리뷰', rlOffset: 0 } },
  { type: 'best_review' },
  { type: 'best_review_detail', extra: { brdPickIndex: 0 } },
  { type: 'best_review_detail', extra: { brdPickIndex: 1 } },
  { type: 'best_review_detail', extra: { brdPickIndex: 2 } },
  { type: 'brand_mention' },
  { type: 'brand_mention_detail' },
  { type: 'brand_mention_detail' },
  { type: 'brand_mention_detail' },
  { type: 'outro' },
]

export const BRAND_ADDABLE_TYPES: BrandPageType[] = [
  'best_review',
  'best_review_detail',
  'brand_mention_detail',
  'review_list',
]
