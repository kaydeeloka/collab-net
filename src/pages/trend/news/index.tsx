import { useEffect, useRef, useState } from 'react'
import { gasPost } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import Spinner from '../../../components/Spinner'

interface ArchiveItem {
  id: string
  windows_start: string
  windows_end?: string
  report_title?: string
  created_at: string
}

interface ArchiveGroup {
  label: string
  items: ArchiveItem[]
}

interface CategoryItem {
  title: string
  link?: string
  source?: string
  pubDate?: string
  summary: string
}

interface Category {
  emoji: string
  name: string
  count?: number
  items: CategoryItem[]
}

interface Keyword {
  tag: string
  explanation: string
}

interface ReportData {
  ok: boolean
  reportTitle?: string
  windowsStart?: string
  windowsEnd?: string
  categories?: Category[]
  keywords?: Keyword[]
  fromArchive?: boolean
  error?: string
}

interface Recipient {
  email: string
  name?: string
}

interface TrendDraft {
  date: string
  subject: string
  body: string
}

const BRIEFING_PREVIEW: ReportData = {
  ok: true,
  reportTitle: '이번 주 뷰티 브리핑',
  windowsStart: '2026-06-04',
  windowsEnd: '2026-06-10',
  categories: [
    {
      emoji: '🧴', name: '스킨케어', count: 5,
      items: [
        { title: 'FDA, 베모트리진디(BEMT) 선크림 성분 승인 → 27년 만의 첫 신규 UV 필터', link: 'https://www.premiumbeautynews.com/en/fda-clears-uv-filter-long-used-in,27745', source: 'Premium Beauty News', pubDate: 'June 9, 2026', summary: '미국 FDA가 합성 UV 필터 베모트리진디(BEMT)를 OTC 선크림 활성 성분으로 공식 승인했다. 이미 유럽·아시아에서 20년 이상 사용된 성분으로, 1990년대 이후 첫 신규 UV 필터 추가다. 기존 미국 선크림의 약점인 UVA 차단 강화를 보완하는 광범위 차단 필터로, 피부 흡수가 낮아 영아 6개월 이상 사용 가능하다. 미국 선크림 포뮬러 전면 혁신의 신호탄으로 평가받으며, 브랜드들의 신제품 개발 레이스가 예상된다.' },
        { title: 'rhode, 멕시코·유럽 7개국 글로벌 확장 → 라틴아메리카 첫 진출', link: 'https://www.businesswire.com/news/home/20260604204140/en/rhode-Expands-Global-Presence-to-Mexico-its-First-Entry-into-Latin-America-and-Adds-Seven-European-Countries', source: 'Business Wire', pubDate: 'June 9, 2026', summary: 'e.l.f. Beauty 산하 rhode가 멕시코(라틴아메리카 첫 진출)와 유럽 7개국에 DTC 채널을 열었다. 연간 매출 약 3억9000만 달러로 전 년 대비 80% 성장을 기록하며, 미국 EMV 기준 스킨케어 브랜드 1위를 유지 중이다. e.l.f. 인수 이후 글로벌 확장 속도가 눈에 띄게 빨라지고 있으며, 장벽 없는 스킨케어에서 하이브리드 메이크업으로 영역을 확장하는 전략이 돋보인다.' },
        { title: 'Sephora, Google AI 생태계에 프레스티지 뷰티 쇼핑 통합', link: 'https://www.glossy.co/beauty/sephora-is-bringing-prestige-beauty-shopping-into-googles-ai-ecosystem/', source: 'Glossy', pubDate: 'June 9, 2026', summary: '세포라가 Google AI 플랫폼과 파트너십을 체결해 소비자가 Google AI 경험 내에서 제품 탐색·맞춤 추천·루틴 구성·구매까지 연결하는 커머스 통합을 실행한다. 검색 창에서 시작하는 뷰티 쇼핑 여정이 AI로 재편되는 가운데, 세포라는 기술 선도 뷰티 이니셔티브 전진 도구로 포지셔닝하며 인간 전문 지식 유지 전략을 변화하고 있다.' },
        { title: 'Med-Spa-ification: 메디컬 클리닉 마케팅이 스킨케어 브랜드를 바꾸고 있다', link: 'https://www.beautyindependent.com/poom-cosmetics-founder-irene-ham-building-in-public/', source: 'Beauty Independent', pubDate: 'June 9, 2026', summary: '스킨케어 브랜드들이 PDR·엑소좀 등 메디컬 용어를 마케팅 전면에 내세우는 Med-Spa화가 가속되고 있다. 소비자들이 클리닉 수준의 효능과 전문성을 기대하게 되면서, OTC 제품이 프로페셔널 트리트먼트처럼 포지셔닝되는 현상이 미국 전역으로 확산 중이다. 더모톨로지와 에스테틱의 경계 붕괴가 브랜드 전략의 핵심 변수로 부상하고 있다.' },
        { title: '헤이롱 트리트먼트, 뷰티 큰 행사의 새 주인공으로', link: 'https://www.businessoffashion.com/articles/beauty/do-retailer-exclusives-still-matter/', source: 'Business of Fashion', pubDate: 'June 9, 2026', summary: '소비자들이 전문 미용실 케어를 집에서 재현하려는 고성능 헤어·스칼프 트리트먼트 제품에 지출을 늘리고 있다. 고물가 시대 합리적 프리미엄 욕구가 확산되며 트리트먼트 포맷이 에어·컨디셔너를 빠르게 추격 중이다. 헤어케어 카테고리에서 기능성 중심 소비 이동이 강화되고 있다는 신호들.' },
      ],
    },
    {
      emoji: '💄', name: '메이크업', count: 5,
      items: [
        { title: 'Kiko Milano × Madonna × Macy\'s → 이탈리아 메이크업 파워하우스의 미국 상륙', link: 'https://wwd.com/beauty-industry-news/color-cosmetics/madonna-kiko-milano-makeup-ambassador-launch-macys-1238997885/', source: 'WWD', pubDate: 'June 8, 2026', summary: '연 매출 10억 달러를 넘기는 이탈리아 뷰티 브랜드 Kiko Milano가 마돈나를 두 번째 글로벌 앰배서더로 내세우며 Macy\'s 헤럴드 스퀘어 등 3개 매장에 입점했다. 향후 시즌 내 27개 Macy\'s 내부로 확장 예정이며, $13~$16의 프리미엄 매스 포지션을 노린다. MAC 크리에이티브 디렉터 출신 Drew Elliott이 예술적·아이코닉 비주얼을 주도하며, 유럽 외 첫 대형 리테일 파트너십으로 미국 컬러 코스메틱 시장 재편에 나선다.' },
        { title: 'Vacation, Sephora 입점 → 멀티-리테일 전략과 배타적 딜의 충돌', link: 'https://www.businessoffashion.com/articles/beauty/do-retailer-exclusives-still-matter/', source: 'Business of Fashion', pubDate: 'June 9, 2026', summary: '선크림 브랜드 Vacation이 이미 Ulta·Target·Costco와 유통되는 상황에서 세포라에도 입점하며 배타적 파트너십 중심의 뷰티 리테일 관례에 의문을 제기한다. BoF는 이 움직임이 세포라의 독점 협상력이 약화되고 있음을 보여주는 신호라 분석한다. 브랜드가 리테일 파트너를 선택하는 기준이 배타성보다 도달 극대화로 이동하는 흐름이 가속되고 있다.' },
        { title: 'Poom Cosmetics: 창업 리얼리티 TikTok으로 Ulta 입점까지', link: 'https://www.beautyindependent.com/poom-cosmetics-founder-irene-ham-building-in-public/', source: 'Beauty Independent', pubDate: 'June 9, 2026', summary: '창업자 Irene Ham이 재무 고민·제품 개발 실패를 TikTok에 날 것 그대로 공유하며 팬을 구축한 Poom Cosmetics가 수익화에 성공하고 Ulta Beauty 액셀러레이터 프로그램 참여 기회를 얻었다. 진정성 스토리텔링이 대형 마케팅 예산을 대체할 수 있음을 증명한 사례로, 독립 뷰티 창업자들의 새로운 롤모델이 되고 있다.' },
        { title: 'Urban Decay 아이섀도 재출시 → 레거시 브랜드 부활의 조건', link: 'https://www.businessoffashion.com/topics/beauty/', source: 'Business of Fashion', pubDate: 'June 8, 2026', summary: 'Urban Decay의 아이섀도 리런칭이 의미 있는 비즈니스 모멘텀으로 이어질 수 있을지를 BoF가 분석한다. 레거시 브랜드의 제품 부활이 단순 노스탤지어 마케팅을 넘어 실질 매출 견인이 가능한 전략임을 보여주며, 포화된 컬러 코스메틱 시장에서 지속 성장을 위해서는 라인의 재정의와 신규 소비자 전이가 동반되어야 한다는 점을 강조한다.' },
        { title: 'P-beauty 부상 → 필리핀 뷰티가 글로벌 시장에 노크한다', link: 'https://www.businessoffashion.com/topics/beauty/', source: 'Business of Fashion', pubDate: 'June 8, 2026', summary: '필리핀산 뷰티 트렌드 P-beauty가 K-beauty의 뒤를 이어 글로벌 뷰티 시장에 새로운 미적 언어를 제시하고 있다. 필리핀 문화 수출과 함께 로컬 브랜드들이 국제 소비자의 주목을 받기 시작했으며, K-beauty가 견인한 아시아산 뷰티 = 혁신 인식을 이어받는 후계자로 평가받는다.' },
      ],
    },
    {
      emoji: '🌿', name: '퍼스널케어', count: 5,
      items: [
        { title: 'Caldera + Lab, Nordstrom 입점 → 남성 스킨케어의 프레스티지 채널 진출', link: 'https://beautymatter.com/articles/caldera-lab-goes-to-nordstrom', source: 'BeautyMatter', pubDate: 'June 9, 2026', summary: '남성 스킨케어 브랜드 Caldera + Lab이 Nordstrom과 첫 메이저 리테일 파트너십을 체결했다. 전통적 남성 그루밍 브랜딩에서 탈피해 프리미엄 디자인·과학적 포뮬러 이상으로 포지셔닝한 이 브랜드의 Nordstrom 입점은, 남성 스킨케어가 기초 그루밍에서 프레스티지 이상케어 영역으로 격상되고 있음을 보여주는 상징적 사건이다.' },
        { title: 'Sally Beauty, Pride Month 커뮤니티 액티베이션 – LA·NYC 도시 행사', link: 'https://www.prnewswire.com/news-releases/sally-beauty-celebrates-pride-month-with-community-activations-across-la-and-nyc-302790856.html', source: 'PR Newswire', pubDate: 'June 9, 2026', summary: 'Sally Beauty가 LA·NYC에서 Pride Month 기념 커뮤니티 이벤트를 열고 LGBTQIA+ 창업 브랜드를 전면 하이라이트했다. 뷰티 리테일러가 제품 판매를 넘어 가치 기반 소비자 커뮤니티를 직접 육성하는 전략으로 진화하고 있음을 보여주며, 브랜드 가치와 소비자 신뢰의 연결이 구매 영향을 미치는 영향이 더욱 커지고 있다.' },
        { title: 'Unilever, 인도 뭄바이에 글로벌 향수 혁신 허브 오픈', link: 'https://cosmeticsbusiness.com/unilever-opens-india-fragrance-hub-to-enhance-global-capabilities', source: 'Cosmetics Business', pubDate: 'June 9, 2026', summary: 'Unilever가 뭄바이에 최신 향수 R&D 시설을 열고, 소비자 리서치·AI·과학적 전문성을 결합해 현지화된 향 개발 속도를 높이겠다고 밝혔다. 인도 프리미엄 뷰티 소비 시장의 급성장을 겨냥한 이 투자는, 글로벌 뷰티 기업들이 서구 중심 향 개발에서 벗어나 아시아 소비자의 감각적 선호를 R&D 전략 중심에 흡수시키는 흐름을 보여준다.' },
        { title: 'IGK Hair의 Anne-Cécile Brilland, T3 CEO로 선임', link: 'https://cew.org/beauty_news/igk-hairs-anne-cecile-brilland-appointed-ceo-of-t3/', source: 'CEW', pubDate: 'June 9-10, 2026', summary: 'IGK Hair 출신 Anne-Cécile Brilland가 헤어 디바이스 전문 브랜드 T3의 CEO로 임명된다. 프리미엄 헤어케어와 디바이스 카테고리에 실력이 가속되는 가운데, 미용 퀄리티 헤어 스타일링 도구에 대한 소비자 욕구 증가가 경영 전략에도 반영되고 있음을 시사하는 인사다.' },
        { title: 'Matière Première, 2025년 리테일 매출 70% 급증 → 니치 프래그런스의 강세', link: 'https://wwd.com/beauty-industry-news/fragrance/whats-fueling-matiere-premiere-robust-growth-1238915396/', source: 'WWD', pubDate: 'June 9, 2026', summary: '프랑스 니치 향수 브랜드 Matière Première의 2025년 리테일 매출이 전 년 대비 70% 이상 증가했다. 클린 뷰티·성분 투명성·감각적 스토리텔링을 결합한 이 브랜드의 급성장은, 소비자들이 메가 향수 파워하우스보다 독립 프래그런스 창업 브랜드에 더 강한 가치를 부여하기 시작했음을 보여준다.' },
      ],
    },
    {
      emoji: '🇰🇷', name: 'K-뷰티', count: 5,
      items: [
        { title: 'Olive Young Century City(LA) 오픈 화제 → 2호점으로 미국 확장 가속', link: 'https://en.sedaily.com/finance/2026/06/01/olive-young-opens-second-us-store-in-la-after-pasadena', source: 'Seoul Economic Daily', pubDate: 'June 1-6, 2026', summary: 'CJ Olive Young이 패사디나 1호점 오픈 직후 웨스트필드 센추리시티 쇼핑몰에 2호점을 이달 중 오픈한다고 밝혔다. 400미터 줄서기를 기록한 1호점의 폭발적 반응을 확인한 LA 프리미엄 쇼핑 허브로 전략적 입지배치를 단행한 것이다. Sephora·Ulta에서 K-뷰티 채널 경쟁이 본격화되는 분기점으로 평가받는다.' },
        { title: 'Sephora × Olive Young 파트너십 → 가을부터 K-뷰티 전용 존 운영', link: 'https://www.businessoffashion.com/articles/beauty/olive-young-touches-down-in-la/', source: 'Business of Fashion', pubDate: 'June 2026', summary: '2026년 하반기부터 세포라 미국·캐나다 650개 매장 및 온라인에 Olive Young이 큐레이션한 K-뷰티 전용 존이 런칭된다. K-뷰티 유통 구조가 독립 브랜드 단위에서 리테일러 대 리테일러 파트너십으로 성숙하는 변곡점을 보여주며, 동남아·중동·영국·호주로의 점진 확장도 예정되어 있다.' },
        { title: 'Medicube, Amazon Q1 뷰티 브랜드 1위 달성 → K-뷰티 아마존 지배력 확인', link: 'https://wwd.com/beauty-industry-news/beauty-features/amazon-beauty-medicube-nutrafol-sales-skin-care-1238916781/', source: 'WWD', pubDate: 'June 2026 (Q1 데이터 분석)', summary: 'Medicube가 Amazon 뷰티 카테고리에서 점유율 14.1%로 1위를 차지하며, 2위 Nutrafol과의 격차가 두 배에 달했다. Medicube는 Amazon 뷰티 섹션 2위 검색어다. K-뷰티 브랜드가 오프라인 리테일뿐만 아니라 아마존 플랫폼도 장악하기 시작한다는 강력한 시그널이다.' },
        { title: 'Sephora K-뷰티 헤어케어 공인 → Dr. Groot·Unove로 포트폴리오 확대', link: 'https://www.glossy.co/beauty/sephora-doubles-down-on-k-beauty-hair-care/', source: 'Glossy', pubDate: 'March–June 2026 진행 중', summary: '세포라는 2026년 하 시즌에만 K-뷰티 헤어케어 브랜드 4개를 신규 입점시키겠다고 발표하며 Unove·Dr. Groot(LG 계열) 론칭에 이어 추가 브랜드를 준비 중이다. 한국에서 스킨케어와 동일한 고기능성 성분이 헤어케어에 빠진다며, 미국 소비자들의 두피·헤어 루틴 혁신이 K-뷰티로 견인되고 있다.' },
        { title: 'TikTok K-뷰티 → Anua, 유료 콘텐츠 1.1%로 Q1 3위 달성', link: 'https://wwd.com/beauty-industry-news/beauty-features/tiktok-viral-beauty-products-tarte-dr-melaxin-1238896201/', source: 'WWD', pubDate: 'June 2026 (Q1 Spate 데이터)', summary: '2026년 Q1 TikTok 뷰티 뷰 성장 상위 10개 브랜드 중 8개가 유료 콘텐츠 의존도 90% 이상이었을 때, Anua는 유료 비중 1.1%로 3위를 차지하며 K-뷰티의 유기적 바이럴 저력을 입증했다. #KoreanSunscreen 뷰는 전 년 대비 106% 증가했다. K-뷰티 브랜드들이 진정성 기반 콘텐츠로 경쟁 우위를 구축하고 있음을 데이터가 뒷받침한다.' },
      ],
    },
    {
      emoji: '✨', name: '기타', count: 5,
      items: [
        { title: 'ChatGPT 뷰티 추천의 핵심 소스는 Reddit·Who What Wear·Sephora → Novi 분석', link: 'https://cew.org/beauty_news/reddit-who-what-wear-wikipedia-and-sephora-top-the-list-of-sources-chatgpt-considers-when-recommending-beauty-products-according-to-new-analysis-from-novi/', source: 'CEW', pubDate: 'June 9, 2026', summary: 'Novi가 ChatGPT 뷰티 제품 추천 시 참조하는 소스를 분석한 결과, Reddit·Who What Wear·Wikipedia·Sephora가 상위권을 차지했다. AI 시대의 GEO(생성형 엔진 최적화) 전략이 뷰티 업계에서도 핵심 과제로 부상 중이며, 브랜드들이 어떤 채널의 콘텐츠를 투자해야 하는지에 대한 전략적 시사점을 제공한다.' },
        { title: 'Iris Ventures, 식용 웰니스 스타트업 Lucille에 멀티밀리언 달러 투자', link: 'https://wwd.com/beauty-industry-news/wellness/iris-leads-multimillion-dollar-round-lucille-shakes-healthy-1238914577/', source: 'WWD', pubDate: 'June 9, 2026', summary: '뷰티·웰니스 전문 투자사 Iris Ventures가 건강 음용 웰니스 브랜드 Lucille의 리드 투자를 단행했다. 이너뷰티 보충제의 기능성 음식이 뷰티와 헬스케어의 확장 카테고리로 자리잡는 흐름 속에서, 투자자들의 관심이 토피컬 스킨케어를 넘어 이너케어 포트폴리오로 이동하고 있음을 보여주는 사례다.' },
        { title: '포용성 뷰티 브랜드, 2025년 비포용 브랜드 대비 1.8배 빠른 성장', link: 'https://wwd.com/beauty-industry-news/beauty-features/beauty-diversity-inclusivity-rare-mac-seeme-index-1238906405/', source: 'WWD', pubDate: 'June 2026 (SEEMe Index 데이터)', summary: 'SEEMe Index 데이터에 따르면 2025년 Rare Beauty·MAC 등 포용성 뷰티 브랜드들이 비포용성 브랜드 대비 1.8배 빠른 성장률을 기록했다. DEI 기반 전략이 브랜드 리스크 관리가 아닌 성장 드라이버로 인식되고 있으며, 피부톤·성별·연령 다양성이 마케팅 효과를 넘어 장기 매출 성과에도 직접 영향을 미치고 있다.' },
        { title: 'WWD 2025 글로벌 뷰티 기업 Top 100 발표 → K-뷰티 기업들의 약진', link: 'https://wwd.com/beauty-industry-news/beauty-features/lists/top-100-beauty-companies-in-the-world-2025-1238915113/', source: 'WWD', pubDate: 'June 11, 2026', summary: 'WWD가 2025년 글로벌 뷰티 기업 매출 기준 Top 100 순위를 발표했다. Amorepacific·LG H&H 등 한국 기업들이 Americas 매출 성장의 힘에 전 년 대비 순위를 높였다. 중국 시장 부진에 미국 시장이 상쇄하는 패턴이 굳어지면서 K-뷰티 기업들의 포트폴리오 재편 방향성이 뚜렷해지고 있다.' },
        { title: 'The Equity Studio, 영국 데어리 브랜드 All Things에 멀티파운드 하이프 투자', link: 'https://wwd.com/beauty-industry-news/wellness/the-equity-studio-multimillion-pound-all-things-dairy-brand-1238917092/', source: 'WWD', pubDate: 'June 9, 2026', summary: '뷰티·라이프스타일 투자사 The Equity Studio가 댄스 음악계 Thomas Straker가 창업한 데어리 브랜드 All Things에 투자를 단행했다. 음식·웰니스·뷰티의 카테고리 융합이 투자 영역까지 확대되고 있음을 보여주며, 먹는 것(food-as-beauty)의 컨셉이 투자자들의 관심을 끌고 있다.' },
      ],
    },
  ],
  keywords: [
    { tag: '#SPFRevolution', explanation: '27년 만의 FDA 베모트리진디 승인으로 미국 선크림 포뮬러 혁신의 문이 열렸다. UVA 차단이 강화되면서 K-뷰티 선크림과의 기술 격차가 줄고, 미국 브랜드들의 신제품 개발 레이스가 예상된다.' },
    { tag: '#AIBeautyCommerce', explanation: '세포라×Google AI, ChatGPT 추천 소스 분석, Poom Cosmetics의 TikTok 창업 스토리까지 – AI가 뷰티 소비자의 발견·추천·구매 모든 접점에 통합되고 있다. GEO(생성형 엔진 최적화)가 뷰티 마케팅의 새 전장이 된다.' },
    { tag: '#KBeautyRetailWar', explanation: 'Olive Young LA 2호점, Sephora×Olive Young 파트너십, 세포라 K-뷰티 헤어케어 확장, Medicube Amazon 1위까지 – K-뷰티가 인플루언서 트렌드를 넘어 주요 리테일러의 전략 자산으로 격상된다. 리테일러들의 K-뷰티 채널 선점 경쟁이 2026년 최대 비즈니스다.' },
    { tag: '#MensPrestige', explanation: 'Caldera+Lab Nordstrom 진출과 남성 스킨케어 프레스티지화가 교차한다. 남성 스킨케어가 대중 채널에서 프레스티지 채널로 이동하면서 카테고리 평균 단가와 브랜드 아이덴티티가 빠르게 업그레이드되고 있다.' },
    { tag: '#DupeEconomy2.0', explanation: 'Kiko Milano의 럭셔리 경험, 어포더블 프라이스 포지셔닝과 K-뷰티의 가성비 공인이 맞물리며 프레스티지 메이크업의 가격 정당성 압박이 커지고 있다. 가격 대비 성능 기대치가 전방위적으로 상승하는 가운데 매스-프레스티지 경계가 흐려지는 흐름이 가속 중이다.' },
  ],
}

function fmtKor(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

function fmtKorFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'
}

export default function Trends() {
  const [activeTab, setActiveTab] = useState<'news' | 'archive'>('news')

  const [latestReport, setLatestReport] = useState<ReportData | null>(null)
  const [latestLoading, setLatestLoading] = useState(true)

  const [archiveReport, setArchiveReport] = useState<ReportData | null>(null)
  const [archiveReportLoading, setArchiveReportLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')

  const [archiveGroups, setArchiveGroups] = useState<Record<string, ArchiveGroup>>({})
  const [archiveOrder, setArchiveOrder] = useState<string[]>([])
  const [archiveListLoading, setArchiveListLoading] = useState(true)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selectedRcpt, setSelectedRcpt] = useState<Set<string>>(new Set())
  const [emailStatus, setEmailStatus] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  // Recipient management
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [rcptSaving, setRcptSaving] = useState(false)

  const [trendDrafts, setTrendDrafts] = useState<TrendDraft[]>([])
  const [trendSelected, setTrendSelected] = useState(0)
  const [trendLoading, setTrendLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [showBriefingModal, setShowBriefingModal] = useState(true)

  useEffect(() => {
    loadRecipients()
    loadLatestReport()
    refreshArchiveList()
    loadTrends()
  }, [])

  // Auto-dismiss preview the moment real data arrives
  useEffect(() => {
    if (latestReport && showBriefingModal) setShowBriefingModal(false)
  }, [latestReport])

  useEffect(() => {
    if (trendDrafts.length > 0 && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) { doc.open(); doc.write(trendDrafts[trendSelected]?.body || ''); doc.close() }
    }
  }, [trendSelected, trendDrafts])

  async function loadRecipients() {
    try {
      const { data } = await supabase
        .from('email_recipients')
        .select('email, name')
        .order('name')
      const list = (data || []) as Recipient[]
      setRecipients(list)
      setSelectedRcpt(new Set(list.map(r => r.email)))
    } catch {}
  }

  async function addRecipient() {
    const email = addEmail.trim().toLowerCase()
    const name  = addName.trim()
    if (!email) return
    setRcptSaving(true)
    const { error } = await supabase.from('email_recipients').insert({ email, name: name || null })
    if (!error) { setAddEmail(''); setAddName(''); setShowAddForm(false); await loadRecipients() }
    setRcptSaving(false)
  }

  function startEdit(r: Recipient) {
    setEditingEmail(r.email)
    setEditName(r.name || '')
    setEditEmail(r.email)
  }

  async function saveEdit(oldEmail: string) {
    const email = editEmail.trim().toLowerCase()
    const name  = editName.trim()
    if (!email) return
    setRcptSaving(true)
    const { error } = await supabase
      .from('email_recipients')
      .update({ email, name: name || null })
      .eq('email', oldEmail)
    if (!error) {
      setEditingEmail(null)
      setSelectedRcpt(prev => {
        const next = new Set(prev)
        if (next.has(oldEmail)) { next.delete(oldEmail); next.add(email) }
        return next
      })
      await loadRecipients()
    }
    setRcptSaving(false)
  }

  async function deleteRecipient(email: string) {
    if (!confirm(email + ' 을(를) 삭제하시겠습니까?')) return
    const { error } = await supabase.from('email_recipients').delete().eq('email', email)
    if (!error) {
      setSelectedRcpt(prev => { const next = new Set(prev); next.delete(email); return next })
      await loadRecipients()
    }
  }

  async function loadLatestReport() {
    setLatestLoading(true)
    try {
      const { data, error } = await supabase
        .from('beauty_news_archives')
        .select('id, windows_start, windows_end, report_title, categories, keywords')
        .order('windows_start', { ascending: false })
        .limit(1)
        .single()
      if (error || !data) throw new Error()
      setLatestReport({
        ok: true,
        reportTitle: data.report_title,
        windowsStart: data.windows_start,
        windowsEnd: data.windows_end,
        categories: data.categories,
        keywords: data.keywords,
      })
    } catch {}
    setLatestLoading(false)
  }

  async function refreshArchiveList() {
    setArchiveListLoading(true)
    try {
      const { data, error } = await supabase
        .from('beauty_news_archives')
        .select('id, windows_start, windows_end, report_title, created_at')
        .order('windows_start', { ascending: false })
      if (error) throw error
      const groups: Record<string, ArchiveGroup> = {}
      const order: string[] = []
      ;(data || []).forEach(a => {
        const d  = new Date(a.windows_start + 'T00:00:00')
        const mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        const ml = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월'
        if (!groups[mk]) { groups[mk] = { label: ml, items: [] }; order.push(mk) }
        groups[mk].items.push(a as ArchiveItem)
      })
      setArchiveGroups(groups)
      setArchiveOrder(order)
      if (order.length > 0) setOpenMonths(new Set([order[0]]))
    } catch {}
    setArchiveListLoading(false)
  }

  async function loadArchive(windowsStart: string) {
    setArchiveReportLoading(true)
    setSelectedKey(windowsStart)
    try {
      const { data, error } = await supabase
        .from('beauty_news_archives')
        .select('id, windows_start, windows_end, report_title, categories, keywords')
        .eq('windows_start', windowsStart)
        .single()
      if (error || !data) throw new Error(error?.message || '불러오기 실패')
      setArchiveReport({
        ok: true,
        reportTitle: data.report_title,
        windowsStart: data.windows_start,
        windowsEnd: data.windows_end,
        categories: data.categories,
        keywords: data.keywords,
        fromArchive: true,
      })
    } catch (e: unknown) {
      setArchiveReport({ ok: false, error: (e as Error).message || '오류' })
    }
    setArchiveReportLoading(false)
  }

  async function deleteArchive(windowsStart: string) {
    if (!confirm('이 아카이브를 삭제하시겠습니까?')) return
    try {
      const { error } = await supabase
        .from('beauty_news_archives')
        .delete()
        .eq('windows_start', windowsStart)
      if (error) throw error
      if (selectedKey === windowsStart) { setArchiveReport(null); setSelectedKey('') }
      await refreshArchiveList()
    } catch (e: unknown) {
      alert('삭제 실패: ' + (e as Error).message)
    }
  }

  async function sendNewsEmail(report: ReportData) {
    const rcpts = [...selectedRcpt].filter(Boolean)
    if (!rcpts.length) { alert('수신자를 선택하세요.'); return }
    setEmailSending(true)
    setEmailStatus('')
    try {
      const dateLabel = report.windowsEnd ? fmtKor(report.windowsEnd) : (report.windowsStart ? fmtKor(report.windowsStart) : '')
      const subject   = '[MiMuse] 주간 뷰티 뉴스 · ' + dateLabel
      const htmlBody  = buildEmailHtml(report)
      const result: { ok: boolean; sent?: number; error?: string } = await gasPost({ action: 'sendBeautyNewsEmail', recipients: rcpts, htmlBody, subject })
      if (!result.ok) throw new Error(result.error || '발송 실패')
      setEmailStatus('완료 — ' + result.sent + '명에게 발송 완료')
    } catch (e: unknown) {
      setEmailStatus('오류: ' + (e as Error).message)
    }
    setEmailSending(false)
  }

  async function loadTrends() {
    setTrendLoading(true)
    try {
      const data: { drafts?: TrendDraft[]; error?: string } = await (await import('../../../lib/api')).gasGet('getAllTrendDrafts')
      setTrendDrafts(data.drafts || [])
    } catch {}
    setTrendLoading(false)
  }

  function buildEmailHtml(data: ReportData): string {
    const ws    = data.windowsStart ? fmtKorFull(data.windowsStart) : ''
    const we    = data.windowsEnd   ? fmtKorFull(data.windowsEnd)   : ''
    const range = ws + (we ? ' – ' + we : '')
    const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + range)
    let h = `<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">`
    h += `<h1 style="font-size:20px;border-bottom:2px solid #f5c518;padding-bottom:8px">🌟 MiMuse ${title}</h1>`
    if (range) h += `<p style="font-size:12px;color:#888;margin-top:4px">📅 ${range}</p>`
    for (const cat of (data.categories || [])) {
      const count = cat.count != null ? cat.count : cat.items.length
      h += `<h2 style="font-size:16px;margin-top:28px">${cat.emoji} ${cat.name}</h2>`
      h += `<p style="font-size:12px;color:#888;margin:4px 0 10px">이번 주 트렌드 시그널이 감지된 뉴스는 총 <strong style="color:#1a73e8">${count}</strong>건입니다.</p>`
      for (const item of cat.items) {
        h += `<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:12px;border-radius:4px">`
        h += `<div style="font-weight:600;font-size:14px">${item.link ? `<a href="${item.link}" style="color:#222;text-decoration:none">${item.title}</a>` : item.title}</div>`
        if (item.source) h += `<div style="font-size:11px;color:#888;margin-bottom:6px">${item.source}${item.pubDate ? ' · ' + item.pubDate : ''}</div>`
        h += `<div style="font-size:13px;line-height:1.6">${item.summary}</div>`
        if (item.link) h += `<a href="${item.link}" style="font-size:11px;color:#1a73e8" target="_blank">원문 보기</a>`
        h += `</div>`
      }
    }
    const keywords = data.keywords || []
    if (keywords.length) {
      h += `<div style="background:#fff3cd;border-radius:6px;padding:16px;margin-top:24px">`
      h += `<h3 style="margin-top:0;font-size:15px">✨ 이번 주 트렌드 키워드</h3>`
      for (const kw of keywords) {
        h += `<div style="margin-bottom:12px"><strong style="font-size:13px">${kw.tag}</strong><br>`
        h += `<span style="font-size:13px;line-height:1.6">${kw.explanation}</span></div>`
      }
      h += `</div>`
    }
    const dashUrl = 'https://mimuse-automation-dashboard.vercel.app/trend/news'
    h += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;text-align:center">`
    h += `<a href="${dashUrl}" target="_blank" style="display:inline-block;background:#f5c518;color:#1a1a1a;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">📊 대시보드 뷰티뉴스 바로가기</a>`
    h += `</div></body></html>`
    return h
  }

  const archiveListPanel = (
    <div className="bn-archive-panel" style={{ maxHeight: 'none' }}>
      <div className="bn-archive-header">
        <span className="bn-archive-title">📁 주간 아카이브</span>
        <span className="bn-archive-hint">최대 12주</span>
      </div>
      <div className="bn-archive-list" style={{ maxHeight: 'none', overflowY: 'visible' }}>
        {archiveListLoading && <div className="bn-archive-loading"><Spinner sm /> 불러오는 중...</div>}
        {!archiveListLoading && archiveOrder.length === 0 && (
          <div className="bn-archive-empty">저장된 아카이브가 없습니다.<br />Claude 루틴이 실행되면 자동으로 저장됩니다.</div>
        )}
        {archiveOrder.map(mk => {
          const g    = archiveGroups[mk]
          const open = openMonths.has(mk)
          return (
            <div key={mk} className="bn-arch-group">
              <button className="bn-arch-month" onClick={() => {
                const next = new Set(openMonths)
                open ? next.delete(mk) : next.add(mk)
                setOpenMonths(next)
              }}>
                <span className="bn-arch-month-label">{g.label}</span>
                <span className="bn-arch-month-count">{g.items.length}건</span>
                <span>{open ? '▾' : '▸'}</span>
              </button>
              {open && g.items.map(a => {
                const rangeLabel = a.windows_end
                  ? fmtKor(a.windows_start) + ' – ' + fmtKor(a.windows_end)
                  : fmtKor(a.windows_start)
                const isSelected = a.windows_start === selectedKey
                return (
                  <div key={a.windows_start} className="bn-archive-item"
                    style={isSelected ? { background: 'var(--yellow-lt)', borderLeft: '3px solid var(--teal)' } : undefined}
                    onClick={() => loadArchive(a.windows_start)}>
                    <div className="bn-archive-item-date">{rangeLabel}</div>
                    <button className="bn-archive-del" onClick={e => { e.stopPropagation(); deleteArchive(a.windows_start) }}>×</button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )

  const emailPanel = (report: ReportData | null) => (
    <div className="bn-email-panel">
      <div className="bn-email-header">
        <span className="bn-email-icon">@</span>
        <span className="bn-email-title">이메일 발송</span>
        <button className="bn-rcpt-add-btn" onClick={() => { setShowAddForm(v => !v); setEditingEmail(null) }} title="수신자 추가">+</button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="bn-rcpt-form">
          <input className="bn-rcpt-input" placeholder="이름 (선택)" value={addName} onChange={e => setAddName(e.target.value)} />
          <input className="bn-rcpt-input" placeholder="이메일 *" type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRecipient()} />
          <div className="bn-rcpt-form-btns">
            <button className="bn-rcpt-save" onClick={addRecipient} disabled={rcptSaving || !addEmail.trim()}>추가</button>
            <button className="bn-rcpt-cancel" onClick={() => { setShowAddForm(false); setAddEmail(''); setAddName('') }}>취소</button>
          </div>
        </div>
      )}

      {/* Recipient list */}
      <div className="bn-recipients">
        {recipients.length === 0 && !showAddForm && <div className="bn-email-none">수신자 없음 — + 버튼으로 추가하세요</div>}
        {recipients.map(r => (
          <div key={r.email}>
            {editingEmail === r.email ? (
              <div className="bn-rcpt-form" style={{ margin: '4px 0' }}>
                <input className="bn-rcpt-input" placeholder="이름 (선택)" value={editName} onChange={e => setEditName(e.target.value)} />
                <input className="bn-rcpt-input" placeholder="이메일 *" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(r.email)} />
                <div className="bn-rcpt-form-btns">
                  <button className="bn-rcpt-save" onClick={() => saveEdit(r.email)} disabled={rcptSaving || !editEmail.trim()}>저장</button>
                  <button className="bn-rcpt-cancel" onClick={() => setEditingEmail(null)}>취소</button>
                </div>
              </div>
            ) : (
              <div className="bn-rcpt-row">
                <label className="bn-rcpt-label" style={{ flex: 1, minWidth: 0 }}>
                  <input type="checkbox" checked={selectedRcpt.has(r.email)}
                    onChange={e => {
                      const next = new Set(selectedRcpt)
                      e.target.checked ? next.add(r.email) : next.delete(r.email)
                      setSelectedRcpt(next)
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    {r.name && <div className="bn-rcpt-name">{r.name}</div>}
                    <div className="bn-rcpt-email">{r.email}</div>
                  </div>
                </label>
                <div className="bn-rcpt-actions">
                  <button className="bn-rcpt-edit-btn" onClick={() => startEdit(r)} title="수정">✎</button>
                  <button className="bn-archive-del" onClick={() => deleteRecipient(r.email)} title="삭제">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bn-email-status" style={{ color: emailStatus.startsWith('완료') ? '#4caf50' : emailStatus.startsWith('오류') ? '#f44336' : undefined }}>
        {emailStatus}
      </div>
      <button className="bn-send-btn" onClick={() => report && sendNewsEmail(report)} disabled={emailSending || !report || selectedRcpt.size === 0}>
        {emailSending ? '발송 중...' : '지금 즉시 전체 발송'}
      </button>
    </div>
  )

  return (
    <div className="page">
      <div className="page-banner">
        <span className="page-banner-deco">📊</span>
        <div>
          <div className="page-banner-title">트렌드 분석</div>
          <div className="page-banner-desc">뷰티 뉴스 AI 분석 및 틱톡 트렌드 리포트를 확인하세요.</div>
        </div>
      </div>

      <div className="bn-tab-bar">
        <button className={`bn-tab-btn${activeTab === 'news' ? ' active' : ''}`} onClick={() => setActiveTab('news')}>이번 주 뉴스</button>
        <button className={`bn-tab-btn${activeTab === 'archive' ? ' active' : ''}`} onClick={() => setActiveTab('archive')}>아카이브</button>
      </div>

      {activeTab === 'news' && (
        <div>

          {/* 50/50 row: date info | email panel */}
          <div className="bn-half-row">
            <div className="bn-date-card">
              <div className="bn-date-card-label">📅 이번 주 브리핑</div>
              {latestLoading && <div style={{ color: 'var(--teal-dk)', fontSize: 13 }}><Spinner sm /></div>}
              {!latestLoading && !latestReport && (
                <>
                  <div className="bn-date-card-range">
                    {fmtKorFull(BRIEFING_PREVIEW.windowsStart!)} – {fmtKorFull(BRIEFING_PREVIEW.windowsEnd!)}
                  </div>
                  {/* <div className="bn-date-card-empty">아직 리포트가 없습니다.<br />Claude 루틴이 실행되면 자동으로 업데이트됩니다.</div> */}
                </>
              )}
              {!latestLoading && latestReport && (
                <>
                  <div className="bn-date-card-range">
                    {latestReport.windowsStart && latestReport.windowsEnd
                      ? fmtKorFull(latestReport.windowsStart) + ' – ' + fmtKorFull(latestReport.windowsEnd)
                      : latestReport.windowsEnd ? fmtKorFull(latestReport.windowsEnd) : ''}
                  </div>
                  {latestReport.reportTitle && (
                    <div className="bn-date-card-title">{latestReport.reportTitle}</div>
                  )}
                  <a className="bn-date-card-link" href="#news-report" onClick={e => {
                    e.preventDefault()
                    document.getElementById('news-report')?.scrollIntoView({ behavior: 'smooth' })
                  }}>이번 주 뉴스 보기 ↓</a>
                </>
              )}
            </div>
            {emailPanel(latestReport ?? (showBriefingModal ? BRIEFING_PREVIEW : null))}
          </div>

          {/* Full-width report */}
          <div className="bn-report-card" id="news-report">
            <div className="bn-report-header">
              <span className="bn-report-title">AI 뉴스 요약 리포트</span>
            </div>
            <div className="bn-report-body">
              {latestLoading && <div className="bn-loading"><Spinner /><span>리포트를 불러오는 중...</span></div>}
              {!latestLoading && !latestReport && !showBriefingModal && (
                <div className="bn-empty-cats">
                  {['스킨케어', '메이크업', '퍼스널케어', 'K-뷰티', '기타'].map(cat => (
                    <div key={cat} style={{ marginBottom: 16 }}>
                      <div className="bn-ph-cat-title">{cat}</div>
                      <div className="bn-ph-cat-body">아직 분석 결과가 없습니다.</div>
                    </div>
                  ))}
                </div>
              )}
              {!latestLoading && !latestReport && showBriefingModal && <ReportBody data={BRIEFING_PREVIEW} />}
              {!latestLoading && latestReport && <ReportBody data={latestReport} />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div>
          {/* 50/50 row: archive nav | email panel */}
          <div className="bn-half-row">
            <div className="bn-date-card">
              <div className="bn-date-card-label">📁 아카이브</div>
              {archiveListLoading && <Spinner sm />}
              <div className="bn-arch-nav-pills" style={{ marginTop: 10 }}>
                {archiveOrder.flatMap(mk => archiveGroups[mk].items).map(a => {
                  const label = a.windows_end
                    ? fmtKor(a.windows_start) + ' – ' + fmtKor(a.windows_end)
                    : fmtKor(a.windows_start)
                  return (
                    <button key={a.windows_start}
                      className={`bn-arch-nav-pill${a.windows_start === selectedKey ? ' active' : ''}`}
                      onClick={() => loadArchive(a.windows_start)}>
                      {label}
                      <span className="bn-arch-nav-del" onClick={e => { e.stopPropagation(); deleteArchive(a.windows_start) }}>×</span>
                    </button>
                  )
                })}
                {!archiveListLoading && archiveOrder.length === 0 && (
                  <span style={{ fontSize: 13, color: 'var(--teal-dk)', fontStyle: 'italic' }}>저장된 아카이브가 없습니다</span>
                )}
              </div>
            </div>
            {emailPanel(archiveReport?.ok ? archiveReport : null)}
          </div>

          {/* Full-width archive report */}
          <div className="bn-report-card">
            <div className="bn-report-header">
              <span className="bn-report-title">{archiveReport?.reportTitle || '아카이브 리포트'}</span>
            </div>
            <div className="bn-report-body">
              {archiveReportLoading && <div className="bn-loading"><Spinner /><span>불러오는 중...</span></div>}
              {!archiveReportLoading && !archiveReport && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--teal-dk)', fontSize: 14 }}>
                  왼쪽 목록에서 주차를 선택하세요.
                </div>
              )}
              {!archiveReportLoading && archiveReport && (
                archiveReport.ok === false
                  ? <div style={{ color: '#c00', padding: 16 }}>{archiveReport.error}</div>
                  : <ReportBody data={archiveReport} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportBody({ data }: { data: ReportData }) {
  const ws    = data.windowsStart ? fmtKorFull(data.windowsStart) : ''
  const we    = data.windowsEnd   ? fmtKorFull(data.windowsEnd)   : ''
  const range = ws + (we ? ' – ' + we : '')
  const title = data.reportTitle || ('이번 주 뷰티 브리핑 — ' + range)
  const keywords = data.keywords || []

  return (
    <div>
      <div className="bn-briefing-title">
        {title}
        {data.fromArchive && <span className="bn-cache-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>📁 아카이브</span>}
      </div>
      {range && <div style={{ fontSize: 12, color: 'var(--teal-dk)', marginBottom: 16 }}>📅 {range}</div>}
      {(data.categories || []).map((cat, ci) => {
        const count = cat.count != null ? cat.count : cat.items.length
        return (
          <div key={ci} className="bn-cat">
            <div className="bn-cat-title">{cat.emoji} {cat.name}</div>
            <div className="bn-cat-count">
              이번 주 트렌드 시그널이 감지된 뉴스는 총 <span className="bn-cat-count-num">{count}</span>건입니다.
            </div>
            {cat.items.map((item, ii) => (
              <div key={ii} className="bn-article">
                <div className="bn-article-header">
                  {item.link
                    ? <a className="bn-article-link" href={item.link} target="_blank" rel="noopener">{item.title}</a>
                    : <span className="bn-article-link">{item.title}</span>
                  }
                  {item.source && <span className="bn-source">{item.source}{item.pubDate ? ' · ' + item.pubDate : ''}</span>}
                </div>
                <div className="bn-article-summary">{item.summary}</div>
              </div>
            ))}
          </div>
        )
      })}
      {keywords.length > 0 && (
        <div className="bn-keywords-section">
          <div className="bn-keywords-title">트렌드 키워드</div>
          {keywords.map((kw, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{kw.tag}</div>
              <div className="bn-keywords-body">{kw.explanation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
