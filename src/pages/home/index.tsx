import { useEffect, useState, useCallback } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ClipboardList, Package, BarChart2, TrendingUp, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchLatestBeautyNewsKeywords, type BeautyNewsKeyword } from '@/lib/beauty-news'
import { fetchReshipmentMap } from '@/lib/ems/ems-errors'
import { isEmsDelivered, isEmsException, isEmsInTransit } from '@/lib/ems/ems-tracking-status'
import { usePhase } from '@/contexts/PhaseContext'
import { parseKstDateOnly } from '@/lib/kst-time'
import { TIKTOK_HASHTAGS_PREVIEW } from '../trend/tiktok'
import { PageHeroBanner, PageHeroAside } from '@/components/PageHeroBanner'
interface PhaseCtx {
  dbOptions: { id: string; label: string }[]
  activeDbId: string
  switchPhase: (id: string) => void
}

interface StatSnippet { html: string }
function StatCell({ html }: StatSnippet) {
  return <div className="feature-stats" dangerouslySetInnerHTML={{ __html: html }} />
}

const SPINNER_HTML = '<div class="fstat"><div class="fstat-val"><span class="spinner spinner--sm"></span></div><div class="fstat-lbl">로딩 중</div></div>'
const DB_TIERS = ['1순위', '2순위', '3순위', '4순위', '5순위']

function calcDday(target: Date): string {
  const now   = new Date()
  const diff  = Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
  if (diff > 0)  return `D-${diff}`
  if (diff === 0) return 'D-Day'
  return `D+${Math.abs(diff)}`
}

function statError(msg: string) {
  return `<div style="font-size:11px;color:#c00">오류: ${String(msg).substring(0, 60)}</div>`
}

export default function Dashboard() {
  const { dbOptions, activeDbId, switchPhase } = useOutletContext<PhaseCtx>()
  const { viewPhaseId, phases } = usePhase()
  const currentPhase  = phases.find(p => p.id === (viewPhaseId ?? activeDbId))
  const dispatchDate  = currentPhase?.kit_send_date ? parseKstDateOnly(currentPhase.kit_send_date) : null
  const deadlineDate  = currentPhase?.ended_at      ? parseKstDateOnly(currentPhase.ended_at.split('T')[0]) : null

  const [statsListup,    setStatsListup]    = useState(SPINNER_HTML)
  const [statsOutreach,  setStatsOutreach]  = useState(SPINNER_HTML)
  const [statsEms,       setStatsEms]       = useState(SPINNER_HTML)
  const [statsMonitoring,setStatsMonitoring]= useState(SPINNER_HTML)
  const [newsKeywords,   setNewsKeywords]   = useState<BeautyNewsKeyword[]>([])

  const loadListupStats = useCallback(async () => {
    if (!activeDbId) return
    try {
      const [{ data: infData }, { count: confirmedCount }] = await Promise.all([
        supabase.from('influencers').select('status').eq('phase_id', activeDbId),
        supabase.from('confirmed_influencers').select('*', { count: 'exact', head: true }).eq('phase_id', activeDbId),
      ])
      const total   = infData?.length ?? 0
      const sent    = infData?.filter(r => r.status === 'yes').length ?? 0
      const replied = infData?.filter(r => r.status === 'reply').length ?? 0
      const confirmed = confirmedCount ?? 0
      const recruitPct = Math.round(confirmed / 50 * 100)
      const bar = (pct: number, color: string) =>
        `<div style="width:100%;height:4px;background:#e5e7eb;border-radius:99px;margin-top:5px;overflow:hidden">` +
        `<div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:99px;transition:width .4s"></div></div>`
      setStatsListup(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${sent}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / ${total}명</span></div><div class="fstat-lbl">발송 완료</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#d97706">${replied}</div><div class="fstat-lbl">회신</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${recruitPct}%</div><div class="fstat-lbl">모집 완료</div></div>` +
        `<div class="fstat" style="border-left:1px solid #e5e7eb;padding-left:12px;margin-left:4px"><div class="fstat-val" style="color:var(--blue-dk)">${confirmed}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 50명</span></div>${bar(recruitPct,'#648085')}<div class="fstat-lbl" style="margin-top:5px">확정 인플루언서</div></div>`
      )
    } catch (e: unknown) { setStatsListup(statError((e as Error).message)) }
  }, [activeDbId])

  const loadOutreachStats = useCallback(async () => {
    if (!activeDbId) return
    try {
      const [{ data: general }, { data: personal }] = await Promise.all([
        supabase.from('brand_general').select('contacted, status').eq('phase_id', activeDbId),
        supabase.from('brand_personal').select('contacted, status').eq('phase_id', activeDbId),
      ])
      const allContacted = [
        ...(general ?? []).filter((r: any) => r.contacted),
        ...(personal ?? []).filter((r: any) => r.contacted),
      ]
      const total      = allContacted.length
      const sent       = allContacted.filter((r: any) => r.status === 'yes').length
      const targetCnt  = allContacted.filter((r: any) => !r.status || r.status === '').length
      setStatsOutreach(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${sent}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / ${total}개</span></div><div class="fstat-lbl">발송</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#d97706">${targetCnt}</div><div class="fstat-lbl">컨택 예정</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${(general ?? []).length}</div><div class="fstat-lbl">일반 DB</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#8b5cf6">${(personal ?? []).length}</div><div class="fstat-lbl">퍼스널 DB</div></div>`
      )
    } catch (e: unknown) { setStatsOutreach(statError((e as Error).message)) }
  }, [activeDbId])

  const loadEmsStats = useCallback(async () => {
    if (!activeDbId) return
    try {
      const [{ data, error }, reshipMap] = await Promise.all([
        supabase
          .from('confirmed_influencers')
          .select('id, ems_tracking(status)')
          .eq('phase_id', activeDbId),
        fetchReshipmentMap(activeDbId),
      ])
      if (error) throw error
      const rows = (data || []).map((ci: any) => {
        const ems = (ci.ems_tracking || [])[0] || {}
        return {
          status:    ems.status || null,
          reship_id: reshipMap.get(ci.id)?.id ?? null,
        }
      })
      const delivered = rows.filter(r => isEmsDelivered(r.status)).length
      const inTransit = rows.filter(r => isEmsInTransit(r.status)).length
      const exception = rows.filter(r => isEmsException(r.status) || r.reship_id).length
      setStatsEms(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${delivered}</div><div class="fstat-lbl">배송 완료</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${inTransit}</div><div class="fstat-lbl">배송 중</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#e53935">${exception}</div><div class="fstat-lbl">오류/미수취</div></div>`
      )
    } catch (e: unknown) { setStatsEms(statError((e as Error).message)) }
  }, [activeDbId])

  const emptyMonitoringHtml =
    `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">0<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 0명</span></div><div class="fstat-lbl">리뷰 업로드</div></div>` +
    `<div class="fstat"><div class="fstat-val">0</div><div class="fstat-lbl">브랜드 리뷰</div></div>` +
    `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">0</div><div class="fstat-lbl">미뮤즈 리뷰</div></div>`

  const loadMonitoringStats = useCallback(async () => {
    if (!activeDbId) return
    try {
      const { data: confirmed, error: cErr } = await supabase
        .from('confirmed_influencers')
        .select('id')
        .eq('phase_id', activeDbId)
      if (cErr) throw cErr

      const confirmedIds = (confirmed || []).map(r => r.id)
      if (confirmedIds.length === 0) {
        setStatsMonitoring(emptyMonitoringHtml)
        return
      }

      const { data: platforms, error: pErr } = await supabase
        .from('influencer_platform')
        .select('id')
        .in('confirmed_influencer_id', confirmedIds)
      if (pErr) throw pErr

      const platformIds = (platforms || []).map(r => r.id)
      if (platformIds.length === 0) {
        setStatsMonitoring(emptyMonitoringHtml)
        return
      }

      const { data, error } = await supabase
        .from('monitoring')
        .select('brand, influencer_platform_id, review_link')
        .in('influencer_platform_id', platformIds)
      if (error) throw error

      const rows           = data || []
      const reviewRows     = rows.filter((r: any) => r.review_link?.startsWith('http'))
      const totalReviews   = reviewRows.length
      const reviewInfluencers = new Set(reviewRows.map((r: any) => r.influencer_platform_id)).size
      const brandCounts: Record<string, number> = {}
      reviewRows.forEach((r: any) => {
        const b = (r.brand || '').toLowerCase()
        if (b) brandCounts[b] = (brandCounts[b] || 0) + 1
      })
      const brandTotal  = Object.values(brandCounts).reduce((a, b) => a + b, 0)
      const mimuseCount = brandCounts['mimuse'] || 0
      setStatsMonitoring(
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${totalReviews}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / ${reviewInfluencers}명</span></div><div class="fstat-lbl">리뷰 업로드</div></div>` +
        `<div class="fstat"><div class="fstat-val">${brandTotal}</div><div class="fstat-lbl">브랜드 리뷰</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${mimuseCount}</div><div class="fstat-lbl">미뮤즈 리뷰</div></div>`
      )
    } catch (e: unknown) { setStatsMonitoring(statError((e as Error).message)) }
  }, [activeDbId])

  useEffect(() => {
    loadListupStats()
  }, [loadListupStats])

  useEffect(() => {
    loadOutreachStats()
  }, [loadOutreachStats])

  useEffect(() => {
    loadEmsStats()
  }, [loadEmsStats])

  useEffect(() => {
    loadMonitoringStats()
  }, [loadMonitoringStats])

  useEffect(() => {
    fetchLatestBeautyNewsKeywords().then(setNewsKeywords).catch(() => {})
  }, [])

  return (
    <div className="page">

      <PageHeroBanner
        aside={(() => {
          const phase = dbOptions.find(o => o.id === activeDbId)?.label
          const now = new Date()
          const diff = deadlineDate ? Math.ceil((deadlineDate.getTime() - now.getTime()) / 86_400_000) : null
          const isDone = diff !== null && diff < 0
          const dday = diff === null ? '—' : diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`
          const months = diff !== null ? Math.floor(Math.max(diff, 0) / 30) : 0
          const days = diff !== null ? Math.max(diff, 0) % 30 : 0
          const deadlineLabel = deadlineDate
            ? deadlineDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
            : '마감일 미설정'
          return (
            <PageHeroAside done={isDone}>
              {isDone ? (
                <>
                  <div className="page-hero-aside-label">프로젝트 완료</div>
                  <div className="page-hero-aside-value">마감</div>
                  <div className="page-hero-aside-remain">모든 일정이 완료되었습니다</div>
                </>
              ) : (
                <>
                  <div className="page-hero-aside-label">프로젝트 마감</div>
                  <div className="page-hero-aside-value">{dday}</div>
                  {diff !== null && diff > 0 && (
                    <div className="page-hero-aside-remain">
                      {months > 0 && <span>{months}개월 </span>}{days}일
                    </div>
                  )}
                </>
              )}
              <div className="page-hero-aside-foot">
                <div style={{ textAlign: 'center' }}>
                  <div className="page-hero-aside-foot-label">프로젝트 최종 마감일</div>
                  <div className="page-hero-aside-foot-value">{deadlineLabel}</div>
                </div>
                {phase && (
                  <>
                    <div className="page-hero-aside-foot-divider" />
                    <div style={{ textAlign: 'center' }}>
                      <div className="page-hero-aside-foot-label">현재 차수</div>
                      <div className="page-hero-aside-foot-value">{phase}</div>
                    </div>
                  </>
                )}
              </div>
            </PageHeroAside>
          )
        })()}
      >
        <div className="page-hero-copy">
          <div className="page-hero-meta">
            {dbOptions.length > 0 ? (
              <div className="page-hero-phase-wrap">
                <select
                  className="page-hero-phase-select"
                  value={activeDbId}
                  onChange={e => switchPhase(e.target.value)}
                >
                  {dbOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <span className="page-hero-phase-caret">▾</span>
              </div>
            ) : (
              <span className="page-hero-eyebrow">Live</span>
            )}
            <span className="page-hero-eyebrow">K-Beauty US Creator Seeding</span>
          </div>
          <div className="page-hero-brand">
            <img src="/img/logo-black.svg" alt="Mi Muse" className="page-hero-logo" />
            <h1 className="page-hero-title">대시보드</h1>
          </div>
          <p className="page-hero-desc">
            미국 인플루언서 시딩 프로젝트 Mi Muse 현황을 한눈에 확인하세요
          </p>
        </div>

        {dispatchDate && (() => {
          const now = new Date()
          const diff = Math.ceil((dispatchDate.getTime() - now.getTime()) / 86_400_000)
          const dday = diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`
          const done = diff < 0
          return (
            <div className="page-hero-countdown">
              <div className={`page-hero-countdown-label${done ? ' page-hero-countdown-label--done' : ''}`}>
                발송까지
              </div>
              <div className={`page-hero-countdown-value${done ? ' page-hero-countdown-value--done' : ''}`}>
                {done ? '완료' : dday}
              </div>
              <div className="page-hero-countdown-sub">
                {done
                  ? '키트 발송 완료'
                  : `${dispatchDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 예정`}
              </div>
            </div>
          )
        })()}
      </PageHeroBanner>

      {/* ── Status cards 2×2 ── */}
      {(() => {
        const cards = [
          {
            to: '/influencer/search', icon: <ClipboardList size={20} />,
            title: '인플루언서 리스트업', desc: 'TikTok 크리에이터 탐색 · DB 관리',
            stats: statsListup, color: '#3b82f6', go: '인플루언서 보기',
          },
          {
            to: '/brand/db/general', icon: <Building2 size={20} />,
            title: '브랜드 리스트업', desc: '브랜드 컨택 현황 · 확정 브랜드 관리',
            stats: statsOutreach, color: '#8b5cf6', go: '브랜드 보기',
          },
          {
            to: '/kit/ems', icon: <Package size={20} />,
            title: 'EMS 배송 트래킹', desc: '키트 배송 현황 ',
            stats: statsEms, color: '#10b981', go: '배송 현황 보기',
          },
          {
            to: '/influencer/monitoring', icon: <BarChart2 size={20} />,
            title: '인플루언서 모니터링', desc: '콘텐츠 성과 · MiMuse 언급 분석',
            stats: statsMonitoring, color: '#f97316', go: '모니터링 보기',
          },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: 16, marginBottom: 28 }}>
            {cards.map(c => (
              <Link key={c.to} to={c.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                  padding: '20px 22px', borderTop: `3px solid ${c.color}`,
                  transition: 'box-shadow .15s, transform .15s',
                  display: 'flex', flexDirection: 'column', gap: 14, height: '100%',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)'; (e.currentTarget as HTMLDivElement).style.transform = 'none' }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: c.color + '15', color: c.color, flexShrink: 0,
                    }}>{c.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>{c.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-4)', marginTop: 1 }}>{c.desc}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <StatCell html={c.stats} />

                  {/* Footer */}
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: c.color,
                    display: 'flex', alignItems: 'center', gap: 4,
                    borderTop: '1px solid var(--gray-1)', paddingTop: 10, marginTop: 'auto',
                  }}>
                    {c.go} <span style={{ fontSize: 14 }}>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      })()}

      {/* ── Trend ── */}
      <div style={{
        background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: '18px 22px', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={15} color="#10b981" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)' }}>오늘의 트렌드</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* 뷰티 뉴스 */}
          <div style={{
            flex: 1, background: 'var(--gray-0)', borderRadius: 10, padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: '1.5px solid var(--teal-lt)', minHeight: 110,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--teal-dk)', letterSpacing: '-0.3px' }}>뷰티 뉴스</div>
              <Link to="/trend/beauty-news" style={{
                fontSize: 11, fontWeight: 700, color: 'var(--teal-dk)',
                background: 'var(--blue-lt)', border: '1px solid var(--teal-lt)',
                borderRadius: 20, padding: '3px 10px', textDecoration: 'none',
                transition: 'background .15s',
              }}>트렌드 보기 →</Link>
            </div>
            {newsKeywords.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {newsKeywords.map(kw => (
                  <div key={kw.tag}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{kw.tag}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-5)', lineHeight: 1.55 }}>{kw.explanation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>저장된 트렌드 키워드가 없습니다.</div>
            )}
          </div>

          {/* 틱톡 트렌드 */}
          <div style={{
            flex: 1, background: 'var(--gray-0)', borderRadius: 10, padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: '1.5px solid var(--teal-lt)', minHeight: 110,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--teal-dk)', letterSpacing: '-0.3px' }}>틱톡 트렌드 분석</div>
              <Link to="/trend/tiktok" style={{
                fontSize: 11, fontWeight: 700, color: 'var(--teal-dk)',
                background: 'var(--blue-lt)', border: '1px solid var(--teal-lt)',
                borderRadius: 20, padding: '3px 10px', textDecoration: 'none',
                transition: 'background .15s',
              }}>트렌드 보기 →</Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TIKTOK_HASHTAGS_PREVIEW.map(h => {
                const volColor = h.volume === 'HIGH' ? { bg: '#dcfce7', text: '#16a34a' }
                  : h.volume === 'RISING' ? { bg: '#ffedd5', text: '#ea580c' }
                  : { bg: '#dbeafe', text: '#2563eb' }
                return (
                  <span key={h.tag} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                    background: volColor.bg, color: volColor.text,
                  }}>{h.tag}</span>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-3)', marginTop: 2 }}>May 26–29, 2026 · US TikTok Beauty</div>
          </div>
        </div>
      </div>

    </div>
  )
}
