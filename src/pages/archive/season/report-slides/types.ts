export type PageType =
  | 'cover'
  | 'project_overview'
  | 'kit_composition'
  | 'content_performance'
  | 'best_review'
  | 'best_review_detail'
  | 'brand_mention'
  | 'next_project'
  | 'outro'

export interface ProcessStep {
  date: string
  content: string
}

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
  // project_overview
  imageUrl?: string
  projectName?: string
  projectPurpose?: string
  kitRecipients?: string
  totalShipping?: string
  participatingBrands?: string
  processSteps?: ProcessStep[]
  // best_review_detail cards — each stored as "@handle\nfollowers\ncomment"
  brdCard1?: string
  brdCard2?: string
  brdCard3?: string
  // next_project redesign
  npImageUrls?: string        // up to 4 URLs, newline-separated
  npConcept?: string          // multiline: 1st line = title, rest = detail
  npPeriod?: string
  npKitRecipients?: string
  npBrands?: string
  npImprovementTitle?: string
  npCard1?: string            // "카드 제목\n■ bullet1\n■ bullet2"
  npCard2?: string
  npCard3?: string
  // kit_composition
  kitImageUrl?: string
  kitConceptTitle?: string
  kitConceptText?: string
  kitBrandItems?: string
  kitMimuseItems?: string
  // content_performance
  cpRecoveryCards?: string  // "label|desc|pct" per line
  cpContentTypes?: string   // "title\ndesc" blocks separated by \n\n
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
  best_review:         '베스트 리뷰 (그리드)',
  best_review_detail:  '베스트 리뷰 (상세)',
  brand_mention:       '브랜드 언급',
  next_project:        '다음 프로젝트',
  outro:               '마무리',
}

export const DEFAULT_CONTENT: Record<PageType, PageContent> = {
  cover:               { title: '' },
  project_overview:    {
    engTitle: 'OVERVIEW',
    korTitle: 'Mi Muse 시딩 프로젝트 개요',
    imageUrl: '',
    projectName: '',
    projectPurpose: '',
    kitRecipients: '',
    totalShipping: '',
    participatingBrands: '',
    processSteps: [
      { date: '', content: '' },
      { date: '', content: '' },
      { date: '', content: '' },
      { date: '', content: '' },
    ],
  },
  kit_composition:     {
    engTitle: 'OVERVIEW',
    korTitle: 'Mi Muse 시딩 키트 구성',
    kitImageUrl: '',
    kitConceptTitle: '',
    kitConceptText: '',
    kitBrandItems: '',
    kitMimuseItems: '',
  },
  content_performance: {
    engTitle: 'Content Performance',
    korTitle: '콘텐츠 성과 OVERVIEW',
    cpRecoveryCards: '인플루언서||80\n매거진||100\n콘텐츠 수량||98',
    cpContentTypes: '숏폼 중심\n전체 콘텐츠의 대다수가 TikTok 숏폼으로 생성\n\n댓글 반응 활발\n키트 패키징·구성에 대한 자발적 질문 및 공유 다수\n\n키트 언박싱 포맷\n개봉 과정을 담은 리뷰가 주요 콘텐츠 유형으로 확인',
  },
  best_review:         { engTitle: 'Best Review Highlights', korTitle: '베스트 리뷰 하이라이트', columns: 5 },
  best_review_detail:  { engTitle: 'Best Review Highlights', korTitle: '베스트 리뷰 하이라이트', brdCard1: '', brdCard2: '', brdCard3: '' },
  brand_mention:       { engTitle: 'Brand Mention Highlights', korTitle: '브랜드 언급 하이라이트' },
  next_project:        {
    engTitle: 'Next Step',
    korTitle: '2026 Q2 시딩 프로젝트',
    npImageUrls: '',
    npConcept: '충전 (充電) / Recharge\n"피부도, 마음도 모두 채우는, K-뷰티식 회복의 순간"\n■ \'0% → 100%\'의 회복 서사를 경험할 수 있는 지친 여름날의 선물과 같은 키트',
    npPeriod: '7월 - 10월',
    npKitRecipients: '총 50건 발송 (인플루언서 50인)',
    npBrands: '4개 브랜드 (모집 예정)',
    npImprovementTitle: '1차 대비 보완 운영 예정',
    npCard1: '인플루언서 운영 집중\n인플루언서 50인으로 규모 확대, 매거진 채널 운영 없이 집중 운영\n콘텐츠 업로드 이력 및 참여율 기반 선별 강화',
    npCard2: '콘텐츠 퀄리티 제고\n팔로워 대비 조회수·댓글 반응을 기준 선별 및 K-뷰티 전문 채널 비중 확대\n전달 가이드라인 구체화를 통한 영상 퀄리티 수준 제고',
    npCard3: '가이드라인 준수율 제고\n인플루언서 자유도를 존중하되 보다 구체적인 가이드라인 전달\n개별 제품에 대한 리뷰 필수 항목 삽입 등 UGC 최소 수량 확보 예정',
  },
  outro:               { title: 'E.O.D', caption: '' },
}
