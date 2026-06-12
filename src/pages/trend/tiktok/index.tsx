import { useState } from 'react'

type Volume = 'HIGH' | 'RISING' | 'MEDIUM'

interface Video {
  title: string
  link: string
  creator: string
  views: string
  whyEn: string
  whyKr: string
  insightEn: string
  insightKr: string
}

interface Hashtag {
  tag: string
  volume: Volume
  category: string
  descEn: string
  descKr: string
  subTags: string[]
}

export const TIKTOK_HASHTAGS_PREVIEW: { tag: string; volume: Volume; category: string }[] = [
  { tag: '#SkinLongevity',       volume: 'HIGH',   category: 'Skincare' },
  { tag: '#PerfumeTok',          volume: 'HIGH',   category: 'Fragrance' },
  { tag: '#LooksmaxxingWomen',   volume: 'RISING', category: 'Cross-category' },
  { tag: '#CloudSkin',           volume: 'HIGH',   category: 'Makeup' },
  { tag: '#ProjectPan2026',      volume: 'MEDIUM', category: 'Cross-category' },
  { tag: '#KBeauty',             volume: 'HIGH',   category: 'Skincare' },
]

const TIKTOK_PREVIEW = {
  period: 'May 26–29, 2026',
  focus: 'Real videos · Product intel · Brand moves',
  videos: [
    {
      title: 'Kylie Jenner Uses Medicube Age-R Booster Pro',
      link: 'https://tiktok.com/@kyliejenner/video/7574926110643801374',
      creator: '@kyliejenner',
      views: '1.1M+ likes · 3,545 comments',
      whyEn: 'A 15-second clip of Kylie Jenner gliding a sleek silver EMS device across her face — no voice-over, no product explanation, just skin, device, and the caption "@medicube global." The extreme brevity worked perfectly for TikTok\'s attention economy: it felt like a genuine glimpse, not a scripted ad. The "Hailey Bieber skin" cultural shorthand was already established, so the second Kylie endorsed the same device + PDRN serum stack, the message spread instantly: this is the celebrity glass skin device.',
      whyKr: '15초짜리 클립에 설명 없이 기기를 얼굴에 갖다 대는 장면만. 짧을수록 진짜처럼 보이는 TikTok 법칙 그대로. 헤일리 비버가 먼저 메디큐브를 입에 올렸고, 카일리가 뒤따르자 "셀럽 유리 피부 루틴 = 메디큐브" 공식이 완성됐다.',
      insightEn: 'Celebrity-device endorsements work when the product already has strong creator grassroots adoption — Kylie\'s post was the capstone, not the ignition. K-beauty devices need that creator base before the celebrity moment lands.',
      insightKr: '셀럽 협찬이 통하는 건 이미 크리에이터 기반이 깔려있을 때다. Medicube는 일반 크리에이터들이 먼저 입소문을 내놨고, 카일리는 그 위에 불을 붙였다. K-뷰티 디바이스 진입 시 셀럽 이전 크리에이터 레이어 구축이 필수 순서.',
    } as Video,
    {
      title: '@songofskin — "PDRN Slug" KAHI Multi Stick',
      link: 'https://tiktok.com/@songofskin/video/7433417173869071659',
      creator: '@songofskin',
      views: '8,362 likes · steady long-tail engagement',
      whyEn: '@songofskin reframed the KAHI multi-stick balm not as just a moisturizer but as a "PDRN slug" — borrowing the beloved "slugging" ritual language and upgrading it with a clinical K-beauty ingredient. The hook: "wake up in 8 hours with reflection skin." Viewers didn\'t just watch — they saved it, because it offered both a technique and a specific product name in one concise promise. The format solved a common problem: "I want to slug but not with petroleum jelly."',
      whyKr: '"슬러깅"은 이미 미국 스킨케어 팬들이 아는 개념. 거기에 PDRN이라는 클리니컬 성분과 KAHI라는 K-뷰티 제품을 붙이는 리프레이밍이 핵심. "8시간 후 반사 피부"라는 구체적 결과 약속이 저장을 유도.',
      insightEn: 'Attaching K-beauty ingredients to already-familiar American skincare rituals (slugging, skin cycling, double cleansing) dramatically lowers the barrier to first purchase. The product doesn\'t need to be explained — the ritual already has trust.',
      insightKr: '미국인이 이미 아는 루틴 언어(슬러깅, 스킨 사이클링)에 K-뷰티 성분을 접목하면 진입 장벽이 급격히 낮아진다. "새로운 루틴"보다 "익숙한 루틴의 업그레이드"로 포지셔닝하는 게 미국 시장 침투 속도를 높이는 열쇠.',
    } as Video,
    {
      title: 'Nara Smith — DIY Beef Tallow Moisturizer',
      link: 'https://tiktok.com/@naraazizasmith/video/7369320237163941163',
      creator: '@naraazizasmith',
      views: '3.6M likes · 30.7K comments',
      whyEn: 'Nara\'s ASMR cooking style — the soft voice, the aesthetic kitchen, the "husband ran out of moisturizer so we just made our own" framing — made DIY beef tallow feel like a lifestyle choice, not a fringe trend. The video went viral originally in 2024, but resurfaced in May 2026 after GQ reported on it with a dermatologist quote in-article, giving the trend a second life. #beeftallow has 131,000+ TikTok videos. The anti-brand, back-to-basics sentiment is a direct counter to the over-marketed K-beauty ingredient stacking narrative.',
      whyKr: 'ASMR 스타일 + "남편이 보습제 떨어져서 직접 만든" 서사가 DIY를 라이프스타일로 포장. 2024년 원본이 2026년 5월 GQ 기사로 다시 바이럴. "브랜드 없이 내 손으로"라는 반(反)마케팅 심리가 저변에 깔림. #beeftallow 게시물 13만 1천개 돌파.',
      insightEn: 'The beef tallow wave reveals a consumer segment that distrusts complex formulations. For K-beauty, this is a signal to communicate ingredient simplicity — not complexity — to this demographic. "Only 5 essential ingredients" is now a marketing asset.',
      insightKr: '비프 탤로우 트렌드는 복잡한 성분 배합에 불신을 가진 소비층의 존재를 드러낸다. K-뷰티가 이 층에 접근할 때는 단순 성분 강조가 효과적. "5가지 핵심 성분만" 메시지가 마케팅 자산이 되는 시대.',
    } as Video,
  ],
  hashtags: [
    {
      tag: '#SkinLongevity',
      volume: 'HIGH' as Volume,
      category: 'Skincare',
      descEn: 'The dominant macro-trend of 2026 on BeautyTok. Users are openly rejecting the old "anti-aging" framing and replacing it with a forward-looking philosophy: strengthen skin now so it ages well. Creators document multi-month routines with ceramides, peptides, and PDRN serums, framing skincare as a long-term investment rather than a quick fix. The content resonates because it feels scientific, disciplined, and anti-impulse.',
      descKr: '2026년 BeautyTok의 압도적인 매크로 트렌드. "안티에이징" 대신 "지금부터 피부를 강하게"라는 철학으로 전환 중. 세라마이드·펩타이드·PDRN 중심의 장기 루틴 콘텐츠가 주류. 빠른 효과보다 과학적 접근을 선호하는 Gen Z 소비 심리와 맞닿아 있음.',
      subTags: ['#skincarebarrier', '#slowskincare', '#pdrn'],
    } as Hashtag,
    {
      tag: '#PerfumeTok · #Smellmaxxing',
      volume: 'HIGH' as Volume,
      category: 'Fragrance',
      descEn: '#PerfumeTok has now surpassed 6 billion views and fragrance is the #1 trending product category on TikTok Shop US. The sub-trend #Smellmaxxing — where creators build "aura" through layered fragrance stacks — has gone fully mainstream. Niche scents go from unknown to sold-out in hours through emotional creator storytelling.',
      descKr: '#PerfumeTok 누적 조회수 60억 돌파. 향수는 현재 미국 TikTok Shop 1위 카테고리. #Smellmaxxing은 향수를 레이어드하여 "아우라"를 만드는 서브트렌드. 니치 향수가 크리에이터의 감성 스토리텔링으로 수 시간 내 품절되는 현상 지속. K-브랜드의 향수 카테고리 진입 적기.',
      subTags: ['#fragrancetok', '#scentwardrobe', '#nichefragrance'],
    } as Hashtag,
    {
      tag: '#LooksmaxxingWomen',
      volume: 'RISING' as Volume,
      category: 'Cross-category',
      descEn: 'Originally a male-coded internet subculture, "looksmaxxing" has migrated to female-identified spaces on TikTok in a major way in late May 2026. Teen girls and young women are adopting ultra-precise skincare stacks, face-sculpting routines, and cosmetic procedure research. Specialists are issuing warnings about the psychological toll.',
      descKr: '원래 남성 온라인 커뮤니티에서 시작된 외모 최적화 문화가 2026년 5월 여성 TikTok으로 본격 확산. 10대 여성 중심으로 정밀 스킨케어 루틴, 페이스 스컬프팅, 시술 리서치 콘텐츠가 폭발적 증가. 전문가들의 경고도 잇따르는 양면적 트렌드.',
      subTags: ['#looksmaxxing', '#softmaxxing', '#skincareoptimization'],
    } as Hashtag,
    {
      tag: '#ProjectPan2026',
      volume: 'MEDIUM' as Volume,
      category: 'Cross-category',
      descEn: 'Creators pledge to finish existing products before buying new ones — showing off "panned" product bottoms with pride. The r/ProjectPan Reddit community sees 34K weekly visitors. Reflects genuine economic caution among 18-30 year-olds dealing with tariff-driven price increases and a cautious job market.',
      descKr: '기존 제품 다 쓰기 전까지 새 것 안 산다는 미션. 관세 인상 등 경기 불안 속 18-30세의 절약 심리를 반영. 롱런 베스트셀러, 리필 패키징, 고효율 소용량 제품에 유리한 트렌드.',
      subTags: ['#projectpan', '#destashbeauty', '#useupchallenge'],
    } as Hashtag,
    {
      tag: '#CloudSkin · #CleanGirlEvolved',
      volume: 'HIGH' as Volume,
      category: 'Makeup + Skincare',
      descEn: 'Glass skin is being replaced on FYP by "cloud skin" — a blurred, soft-focus, filter-like finish. #cleangirlmakeup reached 8.9B views by April 2026, but the 2026 version has evolved: it\'s less "no makeup" and more "expensive-looking minimalism." The aesthetic icon is Sofia Richie Grainge.',
      descKr: '글래스 스킨 이후를 잇는 "클라우드 스킨": 디지털 필터 같은 소프트 포커스 피부 연출. #cleangirlmakeup은 조회수 89억 돌파했지만 2026버전은 훨씬 세련됨. 소피아 리치 그레인지가 아이콘. 저렴하게 보이는 걸 극도로 경계하는 미니멀 럭셔리 미학.',
      subTags: ['#cloudskin', '#cleangirl2026', '#softglow'],
    } as Hashtag,
    {
      tag: '#KBeauty · #SKIN1004',
      volume: 'HIGH' as Volume,
      category: 'Skincare',
      descEn: '#kbeauty has 2.7 million TikTok posts and continues to grow. Centella-based formulas, overnight wrapping masks, and the Beauty of Joseon Rice Sunscreen are the week\'s most mentioned K-beauty heroes. TikTok is now functioning as a "first search" for K-beauty product discovery — 65% of Gen Z discover beauty products here first.',
      descKr: '#kbeauty 게시물 270만 개 돌파. SKIN1004, 뷰티오브조선, 메디큐브 브랜드 태그가 GRWM 콘텐츠에 지속 등장. 센텔라 포뮬러, 메디큐브 콜라겐 나잇 랩핑 마스크, 뷰티오브조선 라이스 선크림이 이번 주 K뷰티 히어로. TikTok이 K뷰티 1차 검색 채널로 완전히 자리잡음.',
      subTags: ['#kbeauty', '#koreanskincare', '#skin1004'],
    } as Hashtag,
  ],
}

const VOL: Record<Volume, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: '#dcfce7', text: '#16a34a', label: '● HIGH' },
  RISING: { bg: '#ffedd5', text: '#ea580c', label: '↑ RISING' },
  MEDIUM: { bg: '#dbeafe', text: '#2563eb', label: '● MEDIUM' },
}

export default function TiktokTrend() {
  const [videoLang, setVideoLang] = useState<Record<number, 'kr' | 'en'>>({})
  const lang = (i: number) => videoLang[i] ?? 'kr'
  const toggle = (i: number) => setVideoLang(p => ({ ...p, [i]: lang(i) === 'kr' ? 'en' : 'kr' }))

  return (
    <div className="page">
      <div className="page-banner">
        <span className="page-banner-deco">🎵</span>
        <div>
          <div className="page-banner-title">틱톡 트렌드 분석</div>
          <div className="page-banner-desc">Weekly US TikTok Beauty Insight Report · 미국 뷰티 틱톡 주간 인사이트</div>
        </div>
      </div>

      {/* Meta strip */}
      <div className="bn-engine-card">
        <div className="bn-engine-left">
          <span className="bn-engine-icon">🎵</span>
          <div>
            <div className="bn-engine-title">Weekly US TikTok Beauty Insight</div>
            <div className="bn-engine-desc">Period: {TIKTOK_PREVIEW.period} · {TIKTOK_PREVIEW.focus}</div>
          </div>
        </div>
      </div>

      {/* ── Viral Videos ── */}
      <div className="bn-report-card" style={{ marginBottom: 20 }}>
        <div className="bn-report-header">
          <span className="bn-report-title">🎬 바이럴 영상 — 이번 주 화제 영상 분석</span>
          <span style={{ fontSize: 12, color: 'var(--teal-dk)' }}>{TIKTOK_PREVIEW.videos.length}건</span>
        </div>
        <div className="bn-report-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {TIKTOK_PREVIEW.videos.map((v, i) => {
            const l = lang(i)
            return (
              <div key={i} style={{ border: '1px solid var(--surface-md)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Card header */}
                <div style={{ padding: '12px 18px', background: 'var(--surface)', borderBottom: '1px solid var(--surface-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#ee0979,#ff6a00)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎵</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{v.creator}</div>
                      <div style={{ fontSize: 11, color: 'var(--teal-dk)' }}>👁 {v.views}</div>
                    </div>
                  </div>
                  <a href={v.link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#010101', borderRadius: 20, padding: '6px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    🔗 TikTok 보기
                  </a>
                </div>

                {/* Card body */}
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.4 }}>{v.title}</div>

                  {/* Why section */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal-dk)', letterSpacing: '.4px' }}>🧠 왜 떴나 분석</div>
                      <button onClick={() => toggle(i)} style={{ fontSize: 11, padding: '3px 12px', borderRadius: 12, border: '1px solid var(--surface-md)', background: l === 'en' ? 'var(--teal-dk)' : 'var(--surface)', color: l === 'en' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', fontWeight: 700, transition: 'all .12s' }}>
                        {l === 'kr' ? 'KR → EN' : 'EN → KR'}
                      </button>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gray-6)', lineHeight: 1.75, background: 'var(--surface)', padding: '12px 14px', borderRadius: 8, borderLeft: '3px solid var(--teal)' }}>
                      {l === 'kr' ? v.whyKr : v.whyEn}
                    </div>
                  </div>

                  {/* Insight */}
                  <div style={{ background: '#fffbeb', borderRadius: 8, padding: '12px 14px', borderLeft: '3px solid #f5c518' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#92680a', marginBottom: 6 }}>💡 뷰티 프로젝트 인사이트</div>
                    <div style={{ fontSize: 13, color: '#5a4000', lineHeight: 1.75 }}>
                      {l === 'kr' ? v.insightKr : v.insightEn}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Trending Hashtags ── */}
      <div className="bn-report-card">
        <div className="bn-report-header">
          <span className="bn-report-title"># 급상승 해시태그 & 트렌드 키워드</span>
          <span style={{ fontSize: 12, color: 'var(--teal-dk)' }}>{TIKTOK_PREVIEW.hashtags.length}건</span>
        </div>
        <div className="bn-report-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {TIKTOK_PREVIEW.hashtags.map((h, i) => {
              const v = VOL[h.volume]
              return (
                <div key={i} style={{ border: '1px solid var(--surface-md)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Tag header */}
                  <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--surface-md)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.3 }}>{h.tag}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: v.bg, color: v.text }}>{v.label}</span>
                      <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 12, background: 'var(--blue-lt)', color: 'var(--teal-dk)', border: '1px solid var(--teal-lt)' }}>{h.category}</span>
                    </div>
                  </div>
                  {/* Tag body */}
                  <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--gray-6)', lineHeight: 1.7 }}>{h.descKr}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                      {h.subTags.map(st => (
                        <span key={st} style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal-dk)', background: 'var(--blue-lt)', padding: '3px 10px', borderRadius: 12, border: '1px solid var(--teal-lt)' }}>{st}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
