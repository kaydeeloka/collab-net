import { useEffect, useState } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import Spinner from '../../../components/Spinner'

interface Recipient {
  email: string
  name?: string
}

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

interface TiktokReport {
  period: string
  focus: string
  videos: Video[]
  hashtags: Hashtag[]
}

interface TrendDraft {
  subject: string
  body: string
  date: string
  ts: number
}

interface ArchiveGroup {
  label: string
  items: TrendDraft[]
}

export const TIKTOK_HASHTAGS_PREVIEW: { tag: string; volume: Volume; category: string }[] = [
  { tag: '#SkinLongevity',       volume: 'HIGH',   category: 'Skincare' },
  { tag: '#PerfumeTok',          volume: 'HIGH',   category: 'Fragrance' },
  { tag: '#LooksmaxxingWomen',   volume: 'RISING', category: 'Cross-category' },
  { tag: '#CloudSkin',           volume: 'HIGH',   category: 'Makeup' },
  { tag: '#ProjectPan2026',      volume: 'MEDIUM', category: 'Cross-category' },
  { tag: '#KBeauty',             volume: 'HIGH',   category: 'Skincare' },
]

const TIKTOK_PREVIEW: TiktokReport = {
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
    },
    {
      title: '@songofskin — "PDRN Slug" KAHI Multi Stick',
      link: 'https://tiktok.com/@songofskin/video/7433417173869071659',
      creator: '@songofskin',
      views: '8,362 likes · steady long-tail engagement',
      whyEn: '@songofskin reframed the KAHI multi-stick balm not as just a moisturizer but as a "PDRN slug" — borrowing the beloved "slugging" ritual language and upgrading it with a clinical K-beauty ingredient. The hook: "wake up in 8 hours with reflection skin." Viewers didn\'t just watch — they saved it, because it offered both a technique and a specific product name in one concise promise. The format solved a common problem: "I want to slug but not with petroleum jelly."',
      whyKr: '"슬러깅"은 이미 미국 스킨케어 팬들이 아는 개념. 거기에 PDRN이라는 클리니컬 성분과 KAHI라는 K-뷰티 제품을 붙이는 리프레이밍이 핵심. "8시간 후 반사 피부"라는 구체적 결과 약속이 저장을 유도.',
      insightEn: 'Attaching K-beauty ingredients to already-familiar American skincare rituals (slugging, skin cycling, double cleansing) dramatically lowers the barrier to first purchase. The product doesn\'t need to be explained — the ritual already has trust.',
      insightKr: '미국인이 이미 아는 루틴 언어(슬러깅, 스킨 사이클링)에 K-뷰티 성분을 접목하면 진입 장벽이 급격히 낮아진다. "새로운 루틴"보다 "익숙한 루틴의 업그레이드"로 포지셔닝하는 게 미국 시장 침투 속도를 높이는 열쇠.',
    },
    {
      title: 'Nara Smith — DIY Beef Tallow Moisturizer',
      link: 'https://tiktok.com/@naraazizasmith/video/7369320237163941163',
      creator: '@naraazizasmith',
      views: '3.6M likes · 30.7K comments',
      whyEn: 'Nara\'s ASMR cooking style — the soft voice, the aesthetic kitchen, the "husband ran out of moisturizer so we just made our own" framing — made DIY beef tallow feel like a lifestyle choice, not a fringe trend. The video went viral originally in 2024, but resurfaced in May 2026 after GQ reported on it with a dermatologist quote in-article, giving the trend a second life. #beeftallow has 131,000+ TikTok videos. The anti-brand, back-to-basics sentiment is a direct counter to the over-marketed K-beauty ingredient stacking narrative.',
      whyKr: 'ASMR 스타일 + "남편이 보습제 떨어져서 직접 만든" 서사가 DIY를 라이프스타일로 포장. 2024년 원본이 2026년 5월 GQ 기사로 다시 바이럴. "브랜드 없이 내 손으로"라는 반(反)마케팅 심리가 저변에 깔림. #beeftallow 게시물 13만 1천개 돌파.',
      insightEn: 'The beef tallow wave reveals a consumer segment that distrusts complex formulations. For K-beauty, this is a signal to communicate ingredient simplicity — not complexity — to this demographic. "Only 5 essential ingredients" is now a marketing asset.',
      insightKr: '비프 탤로우 트렌드는 복잡한 성분 배합에 불신을 가진 소비층의 존재를 드러낸다. K-뷰티가 이 층에 접근할 때는 단순 성분 강조가 효과적. "5가지 핵심 성분만" 메시지가 마케팅 자산이 되는 시대.',
    },
  ],
  hashtags: [
    {
      tag: '#SkinLongevity',
      volume: 'HIGH' as Volume,
      category: 'Skincare',
      descEn: 'The dominant macro-trend of 2026 on BeautyTok. Users are openly rejecting the old "anti-aging" framing and replacing it with a forward-looking philosophy: strengthen skin now so it ages well. Creators document multi-month routines with ceramides, peptides, and PDRN serums, framing skincare as a long-term investment rather than a quick fix. The content resonates because it feels scientific, disciplined, and anti-impulse.',
      descKr: '2026년 BeautyTok의 압도적인 매크로 트렌드. "안티에이징" 대신 "지금부터 피부를 강하게"라는 철학으로 전환 중. 세라마이드·펩타이드·PDRN 중심의 장기 루틴 콘텐츠가 주류. 빠른 효과보다 과학적 접근을 선호하는 Gen Z 소비 심리와 맞닿아 있음.',
      subTags: ['#skincarebarrier', '#slowskincare', '#pdrn'],
    },
    {
      tag: '#PerfumeTok · #Smellmaxxing',
      volume: 'HIGH' as Volume,
      category: 'Fragrance',
      descEn: '#PerfumeTok has now surpassed 6 billion views and fragrance is the #1 trending product category on TikTok Shop US. The sub-trend #Smellmaxxing — where creators build "aura" through layered fragrance stacks — has gone fully mainstream. Niche scents go from unknown to sold-out in hours through emotional creator storytelling.',
      descKr: '#PerfumeTok 누적 조회수 60억 돌파. 향수는 현재 미국 TikTok Shop 1위 카테고리. #Smellmaxxing은 향수를 레이어드하여 "아우라"를 만드는 서브트렌드. 니치 향수가 크리에이터의 감성 스토리텔링으로 수 시간 내 품절되는 현상 지속. K-브랜드의 향수 카테고리 진입 적기.',
      subTags: ['#fragrancetok', '#scentwardrobe', '#nichefragrance'],
    },
    {
      tag: '#LooksmaxxingWomen',
      volume: 'RISING' as Volume,
      category: 'Cross-category',
      descEn: 'Originally a male-coded internet subculture, "looksmaxxing" has migrated to female-identified spaces on TikTok in a major way in late May 2026. Teen girls and young women are adopting ultra-precise skincare stacks, face-sculpting routines, and cosmetic procedure research. Specialists are issuing warnings about the psychological toll.',
      descKr: '원래 남성 온라인 커뮤니티에서 시작된 외모 최적화 문화가 2026년 5월 여성 TikTok으로 본격 확산. 10대 여성 중심으로 정밀 스킨케어 루틴, 페이스 스컬프팅, 시술 리서치 콘텐츠가 폭발적 증가. 전문가들의 경고도 잇따르는 양면적 트렌드.',
      subTags: ['#looksmaxxing', '#softmaxxing', '#skincareoptimization'],
    },
    {
      tag: '#ProjectPan2026',
      volume: 'MEDIUM' as Volume,
      category: 'Cross-category',
      descEn: 'Creators pledge to finish existing products before buying new ones — showing off "panned" product bottoms with pride. The r/ProjectPan Reddit community sees 34K weekly visitors. Reflects genuine economic caution among 18-30 year-olds dealing with tariff-driven price increases and a cautious job market.',
      descKr: '기존 제품 다 쓰기 전까지 새 것 안 산다는 미션. 관세 인상 등 경기 불안 속 18-30세의 절약 심리를 반영. 롱런 베스트셀러, 리필 패키징, 고효율 소용량 제품에 유리한 트렌드.',
      subTags: ['#projectpan', '#destashbeauty', '#useupchallenge'],
    },
    {
      tag: '#CloudSkin · #CleanGirlEvolved',
      volume: 'HIGH' as Volume,
      category: 'Makeup + Skincare',
      descEn: 'Glass skin is being replaced on FYP by "cloud skin" — a blurred, soft-focus, filter-like finish. #cleangirlmakeup reached 8.9B views by April 2026, but the 2026 version has evolved: it\'s less "no makeup" and more "expensive-looking minimalism." The aesthetic icon is Sofia Richie Grainge.',
      descKr: '글래스 스킨 이후를 잇는 "클라우드 스킨": 디지털 필터 같은 소프트 포커스 피부 연출. #cleangirlmakeup은 조회수 89억 돌파했지만 2026버전은 훨씬 세련됨. 소피아 리치 그레인지가 아이콘. 저렴하게 보이는 걸 극도로 경계하는 미니멀 럭셔리 미학.',
      subTags: ['#cloudskin', '#cleangirl2026', '#softglow'],
    },
    {
      tag: '#KBeauty · #SKIN1004',
      volume: 'HIGH' as Volume,
      category: 'Skincare',
      descEn: '#kbeauty has 2.7 million TikTok posts and continues to grow. Centella-based formulas, overnight wrapping masks, and the Beauty of Joseon Rice Sunscreen are the week\'s most mentioned K-beauty heroes. TikTok is now functioning as a "first search" for K-beauty product discovery — 65% of Gen Z discover beauty products here first.',
      descKr: '#kbeauty 게시물 270만 개 돌파. SKIN1004, 뷰티오브조선, 메디큐브 브랜드 태그가 GRWM 콘텐츠에 지속 등장. 센텔라 포뮬러, 메디큐브 콜라겐 나잇 랩핑 마스크, 뷰티오브조선 라이스 선크림이 이번 주 K뷰티 히어로. TikTok이 K뷰티 1차 검색 채널로 완전히 자리잡음.',
      subTags: ['#kbeauty', '#koreanskincare', '#skin1004'],
    },
  ],
}

const VOL: Record<Volume, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: '#dcfce7', text: '#16a34a', label: '● HIGH' },
  RISING: { bg: '#ffedd5', text: '#ea580c', label: '↑ RISING' },
  MEDIUM: { bg: '#dbeafe', text: '#2563eb', label: '● MEDIUM' },
}

function groupDrafts(drafts: TrendDraft[]): { order: string[]; groups: Record<string, ArchiveGroup> } {
  const groups: Record<string, ArchiveGroup> = {}
  const order: string[] = []
  drafts.forEach(d => {
    const dt = new Date(d.ts)
    const mk = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0')
    const ml = dt.getFullYear() + '년 ' + (dt.getMonth() + 1) + '월'
    if (!groups[mk]) { groups[mk] = { label: ml, items: [] }; order.push(mk) }
    groups[mk].items.push(d)
  })
  return { order, groups }
}

function TiktokReportBody({ data, fromArchive = false, showHeader = false }: { data: TiktokReport; fromArchive?: boolean; showHeader?: boolean }) {
  const [videoLang, setVideoLang] = useState<Record<number, 'kr' | 'en'>>({})
  const lang = (i: number) => videoLang[i] ?? 'kr'
  const toggle = (i: number) => setVideoLang(p => ({ ...p, [i]: lang(i) === 'kr' ? 'en' : 'kr' }))

  return (
    <>
      {showHeader && (
        <div className="bn-briefing-title">
          Weekly US TikTok Beauty Insight — {data.period}
          {fromArchive && <span className="bn-cache-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>📁 아카이브</span>}
        </div>
      )}
      {showHeader && data.period && (
        <div style={{ fontSize: 12, color: 'var(--teal-dk)', marginBottom: 16 }}>📅 {data.period} · {data.focus}</div>
      )}

      <div className="bn-report-card" style={{ marginBottom: 20, boxShadow: showHeader ? undefined : 'none', border: showHeader ? undefined : 'none' }}>
        <div className="bn-report-header">
          <span className="bn-report-title">🎬 바이럴 영상 — 이번 주 화제 영상 분석</span>
          <span style={{ fontSize: 12, color: 'var(--teal-dk)' }}>{data.videos.length}건</span>
        </div>
        <div className="bn-report-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {data.videos.map((v, i) => {
            const l = lang(i)
            return (
              <div key={i} style={{ border: '1px solid var(--surface-md)', borderRadius: 10, overflow: 'hidden' }}>
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
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 16, lineHeight: 1.4 }}>{v.title}</div>
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

      <div className="bn-report-card" style={showHeader ? undefined : { boxShadow: 'none', border: 'none', marginBottom: 0 }}>
        <div className="bn-report-header">
          <span className="bn-report-title"># 급상승 해시태그 & 트렌드 키워드</span>
          <span style={{ fontSize: 12, color: 'var(--teal-dk)' }}>{data.hashtags.length}건</span>
        </div>
        <div className="bn-report-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {data.hashtags.map((h, i) => {
              const v = VOL[h.volume]
              return (
                <div key={i} style={{ border: '1px solid var(--surface-md)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--surface-md)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.3 }}>{h.tag}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12, background: v.bg, color: v.text }}>{v.label}</span>
                      <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 12, background: 'var(--blue-lt)', color: 'var(--teal-dk)', border: '1px solid var(--teal-lt)' }}>{h.category}</span>
                    </div>
                  </div>
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
    </>
  )
}

function ArchiveDraftBody({ draft }: { draft: TrendDraft }) {
  return (
    <div>
      <div className="bn-briefing-title">
        {draft.subject || '틱톡 트렌드 리포트'}
        <span className="bn-cache-badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>📁 아카이브</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--teal-dk)', marginBottom: 16 }}>📅 {draft.date}</div>
      <div style={{ fontSize: 14, color: 'var(--gray-7)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
        {draft.body || '내용이 없습니다.'}
      </div>
    </div>
  )
}

function buildTiktokEmailHtml(data: TiktokReport): string {
  const title = '이번 주 틱톡 트렌드 — ' + data.period
  let h = `<html><body style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#222">`
  h += `<h1 style="font-size:20px;border-bottom:2px solid #ee0979;padding-bottom:8px">🎵 MiMuse ${title}</h1>`
  h += `<p style="font-size:12px;color:#888;margin-top:4px">📅 ${data.period} · ${data.focus}</p>`

  h += `<h2 style="font-size:16px;margin-top:28px">🎬 바이럴 영상</h2>`
  h += `<p style="font-size:12px;color:#888;margin:4px 0 10px">이번 주 화제 영상 <strong style="color:#1a73e8">${data.videos.length}</strong>건</p>`
  for (const v of data.videos) {
    h += `<div style="background:#f9f9f9;border-left:3px solid #ee0979;padding:12px;margin-bottom:12px;border-radius:4px">`
    h += `<div style="font-weight:600;font-size:14px">${v.link ? `<a href="${v.link}" style="color:#222;text-decoration:none">${v.title}</a>` : v.title}</div>`
    h += `<div style="font-size:11px;color:#888;margin-bottom:6px">${v.creator} · ${v.views}</div>`
    h += `<div style="font-size:13px;line-height:1.6;margin-bottom:6px"><strong>왜 떴나:</strong> ${v.whyKr}</div>`
    h += `<div style="font-size:13px;line-height:1.6"><strong>인사이트:</strong> ${v.insightKr}</div>`
    if (v.link) h += `<a href="${v.link}" style="font-size:11px;color:#1a73e8" target="_blank">TikTok 보기</a>`
    h += `</div>`
  }

  h += `<h2 style="font-size:16px;margin-top:28px"># 급상승 해시태그</h2>`
  h += `<p style="font-size:12px;color:#888;margin:4px 0 10px">트렌드 키워드 <strong style="color:#1a73e8">${data.hashtags.length}</strong>건</p>`
  for (const tag of data.hashtags) {
    const vol = VOL[tag.volume].label
    h += `<div style="background:#f9f9f9;border-left:3px solid #f5c518;padding:12px;margin-bottom:12px;border-radius:4px">`
    h += `<div style="font-weight:600;font-size:14px">${tag.tag} <span style="font-size:11px;color:#888">(${vol} · ${tag.category})</span></div>`
    h += `<div style="font-size:13px;line-height:1.6">${tag.descKr}</div>`
    h += `</div>`
  }

  const dashUrl = 'https://mimuse-automation-dashboard.vercel.app/trend/tiktok'
  h += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;text-align:center">`
  h += `<a href="${dashUrl}" target="_blank" style="display:inline-block;background:#ee0979;color:#fff;font-weight:700;font-size:13px;padding:12px 28px;border-radius:8px;text-decoration:none">📊 대시보드 틱톡 트렌드 바로가기</a>`
  h += `</div></body></html>`
  return h
}

export default function TiktokTrend() {
  const [activeTab, setActiveTab] = useState<'week' | 'archive'>('week')

  const [recipients, setRecipients]       = useState<Recipient[]>([])
  const [selectedRcpt, setSelectedRcpt]   = useState<Set<string>>(new Set())
  const [emailStatus, setEmailStatus]     = useState('')
  const [emailSending, setEmailSending]   = useState(false)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editName, setEditName]         = useState('')
  const [editEmail, setEditEmail]         = useState('')
  const [showAddForm, setShowAddForm]     = useState(false)
  const [addName, setAddName]             = useState('')
  const [addEmail, setAddEmail]           = useState('')
  const [rcptSaving, setRcptSaving]       = useState(false)

  const [drafts, setDrafts] = useState<TrendDraft[]>([])
  const [archiveListLoading, setArchiveListLoading] = useState(false)
  const [archiveReportLoading, setArchiveReportLoading] = useState(false)
  const [archiveGroups, setArchiveGroups] = useState<Record<string, ArchiveGroup>>({})
  const [archiveOrder, setArchiveOrder] = useState<string[]>([])
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [selectedTs, setSelectedTs] = useState<number | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<TrendDraft | null>(null)

  useEffect(() => { loadRecipients() }, [])

  useEffect(() => {
    if (activeTab === 'archive' && drafts.length === 0 && !archiveListLoading) {
      refreshArchiveList()
    }
  }, [activeTab])

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

  async function sendTiktokEmail(data: TiktokReport) {
    const rcpts = [...selectedRcpt].filter(Boolean)
    if (!rcpts.length) { alert('수신자를 선택하세요.'); return }
    setEmailSending(true)
    setEmailStatus('')
    try {
      const subject  = '[MiMuse] 주간 틱톡 트렌드 · ' + data.period
      const htmlBody = buildTiktokEmailHtml(data)
      const result: { ok: boolean; sent?: number; error?: string } = await gasPost({
        action: 'sendBeautyNewsEmail',
        recipients: rcpts,
        htmlBody,
        subject,
      })
      if (!result.ok) throw new Error(result.error || '발송 실패')
      setEmailStatus('완료 — ' + result.sent + '명에게 발송 완료')
    } catch (e: unknown) {
      setEmailStatus('오류: ' + (e as Error).message)
    }
    setEmailSending(false)
  }

  async function refreshArchiveList() {
    setArchiveListLoading(true)
    try {
      const data = await gasGet<{ drafts?: TrendDraft[]; error?: string }>('getAllTrendDrafts')
      const list = (data.drafts || []).filter(d => d.ts)
      setDrafts(list)
      const { order, groups } = groupDrafts(list)
      setArchiveGroups(groups)
      setArchiveOrder(order)
      if (order.length > 0) setOpenMonths(new Set([order[0]]))
    } catch {}
    finally { setArchiveListLoading(false) }
  }

  async function loadArchive(ts: number) {
    setArchiveReportLoading(true)
    setSelectedTs(ts)
    try {
      const draft = drafts.find(d => d.ts === ts) ?? null
      setSelectedDraft(draft)
    } finally {
      setArchiveReportLoading(false)
    }
  }

  const weekBriefingPanel = (
    <div className="bn-date-card">
      <div className="bn-date-card-header">
        <span className="bn-date-card-icon">📅</span>
        <span className="bn-date-card-label">이번 주 브리핑</span>
      </div>
      <div className="bn-date-card-body">
        <div className="bn-date-card-range">{TIKTOK_PREVIEW.period}</div>
        <div className="bn-date-card-meta">
          <span className="bn-date-card-meta-label">바이럴 영상</span>
          <span className="bn-date-card-meta-value">{TIKTOK_PREVIEW.videos.length}건</span>
        </div>
        <div className="bn-date-card-meta">
          <span className="bn-date-card-meta-label">급상승 해시태그</span>
          <span className="bn-date-card-meta-value">{TIKTOK_PREVIEW.hashtags.length}건</span>
        </div>
        <div className="bn-date-card-keywords">
          {TIKTOK_PREVIEW.hashtags.map(h => (
            <span key={h.tag} className="bn-date-card-kw">{h.tag.split(' · ')[0]}</span>
          ))}
        </div>
      </div>
      <button type="button" className="bn-action-btn"
        onClick={() => document.getElementById('tiktok-report')?.scrollIntoView({ behavior: 'smooth' })}>
        이번 주 트렌드 보기 ↓
      </button>
    </div>
  )

  const emailPanel = (
    <div className="bn-email-panel">
      <div className="bn-email-header">
        <span className="bn-email-icon">@</span>
        <span className="bn-email-title">이메일 발송</span>
        <button type="button" className="bn-rcpt-add-btn" onClick={() => { setShowAddForm(v => !v); setEditingEmail(null) }} title="수신자 추가">+</button>
      </div>

      <div className="bn-panel-body">
        {showAddForm && (
          <div className="bn-rcpt-form">
            <input className="bn-rcpt-input" placeholder="이름 (선택)" value={addName} onChange={e => setAddName(e.target.value)} />
            <input className="bn-rcpt-input" placeholder="이메일 *" type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRecipient()} />
            <div className="bn-rcpt-form-btns">
              <button type="button" className="bn-rcpt-save" onClick={addRecipient} disabled={rcptSaving || !addEmail.trim()}>추가</button>
              <button type="button" className="bn-rcpt-cancel" onClick={() => { setShowAddForm(false); setAddEmail(''); setAddName('') }}>취소</button>
            </div>
          </div>
        )}

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
                    <button type="button" className="bn-rcpt-save" onClick={() => saveEdit(r.email)} disabled={rcptSaving || !editEmail.trim()}>저장</button>
                    <button type="button" className="bn-rcpt-cancel" onClick={() => setEditingEmail(null)}>취소</button>
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
                    <button type="button" className="bn-rcpt-edit-btn" onClick={() => startEdit(r)} title="수정">✎</button>
                    <button type="button" className="bn-archive-del" onClick={() => deleteRecipient(r.email)} title="삭제">×</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bn-email-status" style={{ color: emailStatus.startsWith('완료') ? '#4caf50' : emailStatus.startsWith('오류') ? '#f44336' : undefined }}>
          {emailStatus}
        </div>
      </div>

      <button type="button" className="bn-action-btn" onClick={() => sendTiktokEmail(TIKTOK_PREVIEW)} disabled={emailSending || selectedRcpt.size === 0}>
        {emailSending ? '발송 중...' : '지금 즉시 전체 발송'}
      </button>
    </div>
  )

  const archiveBriefingPanel = (
    <div className="bn-date-card">
      <div className="bn-date-card-header">
        <span className="bn-date-card-icon">📅</span>
        <span className="bn-date-card-label">주간 브리핑</span>
      </div>
      <div className="bn-date-card-body">
        {archiveReportLoading && <div className="bn-date-card-loading"><Spinner sm /> 불러오는 중...</div>}
        {!archiveReportLoading && selectedDraft && (
          <>
            <div className="bn-date-card-range" style={{ fontSize: 16 }}>{selectedDraft.subject || '틱톡 트렌드 리포트'}</div>
            <div className="bn-date-card-meta">
              <span className="bn-date-card-meta-label">저장일</span>
              <span className="bn-date-card-meta-value">{selectedDraft.date}</span>
            </div>
          </>
        )}
        {!archiveReportLoading && !selectedDraft && (
          <div className="bn-date-card-empty">왼쪽 목록에서 주차를 선택하세요.</div>
        )}
      </div>
      <button type="button" className="bn-action-btn"
        disabled={!selectedDraft}
        onClick={() => document.getElementById('tiktok-archive-report')?.scrollIntoView({ behavior: 'smooth' })}>
        아카이브 리포트 보기 ↓
      </button>
    </div>
  )

  const archiveListPanel = (
    <div className="bn-archive-panel">
      <div className="bn-archive-header">
        <span className="bn-archive-title">📁 주간 아카이브</span>
        <span className="bn-archive-hint">최대 12주</span>
      </div>
      <div className="bn-archive-list">
        {archiveListLoading && <div className="bn-archive-loading"><Spinner sm /> 불러오는 중...</div>}
        {!archiveListLoading && archiveOrder.length === 0 && (
          <div className="bn-archive-empty">저장된 아카이브가 없습니다.<br />Outlook 초안에 트렌드 리포트가 있으면 표시됩니다.</div>
        )}
        {archiveOrder.map(mk => {
          const g    = archiveGroups[mk]
          const open = openMonths.has(mk)
          return (
            <div key={mk} className="bn-arch-group">
              <button type="button" className={`bn-arch-month${open ? ' open' : ''}`} onClick={() => {
                const next = new Set(openMonths)
                open ? next.delete(mk) : next.add(mk)
                setOpenMonths(next)
              }}>
                <span className="bn-arch-month-label">{g.label}</span>
                <span className="bn-arch-month-right">
                  <span className="bn-arch-month-count">{g.items.length}건</span>
                  <span className="bn-arch-month-chevron">{open ? '▾' : '›'}</span>
                </span>
              </button>
              {open && g.items.map(d => {
                const isSelected = d.ts === selectedTs
                return (
                  <div key={d.ts}
                    className={`bn-archive-item${isSelected ? ' selected' : ''}`}
                    onClick={() => loadArchive(d.ts)}>
                    <div className="bn-archive-item-date">{d.date}</div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-banner">
        <span className="page-banner-deco">🎵</span>
        <div>
          <div className="page-banner-title">틱톡 트렌드 분석</div>
          <div className="page-banner-desc">Weekly US TikTok Beauty Insight Report · 미국 뷰티 틱톡 주간 인사이트</div>
        </div>
      </div>

      <div className="bn-tab-bar">
        <button type="button" className={`bn-tab-btn${activeTab === 'week' ? ' active' : ''}`} onClick={() => setActiveTab('week')}>
          이번 주 트렌드
        </button>
        <button type="button" className={`bn-tab-btn${activeTab === 'archive' ? ' active' : ''}`} onClick={() => setActiveTab('archive')}>
          아카이브
        </button>
      </div>

      {activeTab === 'week' && (
        <div>
          <div className="bn-half-row">
            {weekBriefingPanel}
            {emailPanel}
          </div>

          <div className="bn-report-card" id="tiktok-report">
            <div className="bn-report-header">
              <span className="bn-report-title">틱톡 트렌드 리포트</span>
            </div>
            <div className="bn-report-body">
              <TiktokReportBody data={TIKTOK_PREVIEW} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'archive' && (
        <div>
          <div className="bn-half-row">
            {archiveListPanel}
            {archiveBriefingPanel}
          </div>

          <div className="bn-report-card" id="tiktok-archive-report">
            <div className="bn-report-body">
              {archiveReportLoading && <div className="bn-loading"><Spinner /><span>리포트를 불러오는 중...</span></div>}
              {!archiveReportLoading && !selectedDraft && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--teal-dk)', fontSize: 14 }}>
                  왼쪽 목록에서 주차를 선택하세요.
                </div>
              )}
              {!archiveReportLoading && selectedDraft && (
                <ArchiveDraftBody draft={selectedDraft} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
