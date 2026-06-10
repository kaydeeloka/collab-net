import { useEffect, useState, useCallback } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ClipboardList, Package, BarChart2, TrendingUp, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { gasGet } from '../../lib/api'
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

const DISPATCH_DATE  = new Date('2026-08-18T00:00:00+09:00')   // 발송일
const DEADLINE_DATE  = new Date('2026-12-31T00:00:00+09:00')   // 프로젝트 마감일 (수정 필요)

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

  const [statsListup,    setStatsListup]    = useState(SPINNER_HTML)
  const [statsOutreach,  setStatsOutreach]  = useState(SPINNER_HTML)
  const [statsEms,       setStatsEms]       = useState(SPINNER_HTML)
  const [statsMonitoring,setStatsMonitoring]= useState(SPINNER_HTML)
  const [trendKeywords,  setTrendKeywords]  = useState<string | null>(null)

  const loadListupStats = useCallback(async () => {
    if (!activeDbId) return
    try {
      const [{ data: infData }, { count: confirmedCount }] = await Promise.all([
        supabase.from('influencers').select('outreach').eq('phase_id', activeDbId),
        supabase.from('confirmed_influencers').select('*', { count: 'exact', head: true }).eq('phase_id', activeDbId),
      ])
      const total   = infData?.length ?? 0
      const sent    = infData?.filter(r => ['yes','reply','negotiate','accept'].includes(r.outreach)).length ?? 0
      const replied = infData?.filter(r => r.outreach === 'reply').length ?? 0
      const confirmed = confirmedCount ?? 0
      const recruitPct = Math.round(confirmed / 50 * 100)
      const bar = (pct: number, color: string) =>
        `<div style="width:100%;height:4px;background:#e5e7eb;border-radius:99px;margin-top:5px;overflow:hidden">` +
        `<div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:99px;transition:width .4s"></div></div>`
      setStatsListup(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${sent}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / ${total}명</span></div><div class="fstat-lbl">컨택 현황</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#d97706">${replied}</div><div class="fstat-lbl">신규 회신</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${recruitPct}%</div><div class="fstat-lbl">모집 완료</div></div>` +
        `<div class="fstat" style="border-left:1px solid #e5e7eb;padding-left:12px;margin-left:4px"><div class="fstat-val" style="color:var(--blue-dk)">${confirmed}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 50명</span></div>${bar(recruitPct,'#648085')}<div class="fstat-lbl" style="margin-top:5px">확정 인플루언서</div></div>`
      )
    } catch (e: unknown) { setStatsListup(statError((e as Error).message)) }
  }, [activeDbId])

  const loadOutreachStats = useCallback(async () => {
    setStatsOutreach(
      `<div class="fstat"><div class="fstat-val" style="color:var(--green)">0<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 0명</span></div><div class="fstat-lbl">컨택 현황</div></div>` +
      `<div class="fstat"><div class="fstat-val" style="color:#d97706">0</div><div class="fstat-lbl">신규 회신</div></div>` +
      `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">0</div><div class="fstat-lbl">확정 브랜드</div></div>`
    )
  }, [])

  const loadEmsStats = useCallback(async () => {
    try {
      const data: { error?: string; stats?: { delivered?: number; inTransit?: number; exception?: number; pending?: number; total?: number } } = await gasGet('getEmsData')
      if (data.error) { setStatsEms(statError(data.error)); return }
      const s = data.stats || {}
      const problem = (s.exception || 0)
      setStatsEms(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${s.delivered || 0}</div><div class="fstat-lbl">배송 완료</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${s.inTransit || 0}</div><div class="fstat-lbl">배송 중</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#e53935">${problem}</div><div class="fstat-lbl">오류/미수취</div></div>`
      )
    } catch (e: unknown) { setStatsEms(statError((e as Error).message)) }
  }, [])

  const loadMonitoringStats = useCallback(async () => {
    try {
      const data: { stats?: { totalReviews?: number; reviewInfluencers?: number; totalBrandReviews?: number; brandCounts?: Record<string, number> }; rows?: unknown[] } = await gasGet('getMonitoringData')
      const s = data.stats || {}
      const mimuseCount = s.brandCounts?.mimuse || 0
      const brandTotal  = s.totalBrandReviews || 0
      setStatsMonitoring(
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${s.totalReviews || 0}<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / ${s.reviewInfluencers || 0}명</span></div><div class="fstat-lbl">리뷰 업로드</div></div>` +
        `<div class="fstat"><div class="fstat-val">${brandTotal}</div><div class="fstat-lbl">브랜드 리뷰</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${mimuseCount}</div><div class="fstat-lbl">미뮤즈 리뷰</div></div>`
      )
    } catch (e: unknown) { setStatsMonitoring(statError((e as Error).message)) }
  }, [])

  useEffect(() => {
    loadListupStats()
  }, [loadListupStats])

  useEffect(() => {
    loadOutreachStats()
    loadEmsStats()
    loadMonitoringStats()
    ;(async () => {
      try {
        const list: { ok: boolean; archives?: { dateKey: string }[] } = await gasGet('getArchiveList')
        const latest = list.archives?.[0]?.dateKey
        if (latest) {
          const data: { ok: boolean; keywords?: string } = await gasGet('getArchive', { dateKey: latest })
          if (data.ok && data.keywords) setTrendKeywords(data.keywords)
        }
      } catch {}
    })()
  }, [])

  return (
    <div className="page">

      {/* ── Hero + D-DAY row ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'stretch' }}>

        {/* Hero — 3/4 */}
        <div style={{
          flex: 3, minWidth: 0,
          background: '#0d1117',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '28px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: 120, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,233,160,0.06)', pointerEvents: 'none', filter: 'blur(50px)' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 0, width: 180, height: 180, borderRadius: '50%', background: 'rgba(159,186,197,0.08)', pointerEvents: 'none', filter: 'blur(40px)' }} />

          {/* Left: title */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {dbOptions.length > 0 ? (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select value={activeDbId} onChange={e => switchPhase(e.target.value)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 28px 3px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}>
                    {dbOptions.map(o => <option key={o.id} value={o.id} style={{ background: '#1e293b' }}>{o.label}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 10, pointerEvents: 'none', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>▾</span>
                </div>
              ) : (
                <span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '1px' }}>LIVE</span>
              )}
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>인플루언서 마케팅 자동화 시스템</span>
            </div>
            <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-3px', lineHeight: 1, marginBottom: 10 }}>MiMuse 대시보드</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>미국 인플루언서 시딩 프로젝트 Mi Muse 현황을 한눈에 확인하세요</div>
          </div>

          {/* Right: 발송까지 D-DAY */}
          {(() => {
            const now = new Date()
            const diff = Math.ceil((DISPATCH_DATE.getTime() - now.getTime()) / 86_400_000)
            const dday = diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`
            const done = dbOptions.find(o => o.id === activeDbId)?.label === '1차'
            return (
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: done ? '#34d399cc' : '#ffe9a0cc', textTransform: 'uppercase', letterSpacing: '2px' }}>발송까지</div>
                <div style={{ fontSize: 52, fontWeight: 900, color: done ? '#34d399' : '#ffe9a0', letterSpacing: '-3px', lineHeight: 1 }}>{done ? '완료' : dday}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>
                  {done ? '키트 발송 완료' : `${new Date('2026-08-18').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 예정`}
                </div>
              </div>
            )
          })()}
        </div>

        {/* D-DAY — 1/3 white card */}
        {(() => {
          const phase = dbOptions.find(o => o.id === activeDbId)?.label
          const isDone = phase === '1차'
          const now = new Date()
          const diff = Math.ceil((DEADLINE_DATE.getTime() - now.getTime()) / 86_400_000)
          const dday = diff > 0 ? `D-${diff}` : diff === 0 ? 'D-Day' : `D+${Math.abs(diff)}`
          const accent = isDone ? '#10b981' : '#9FBAC5'
          const months = Math.floor(Math.max(diff, 0) / 30)
          const days = Math.max(diff, 0) % 30
          return (
            <div style={{
              flex: 1, minWidth: 0,
              background: '#0d1117',
              border: `1px solid ${accent}35`,
              borderRadius: 16,
              padding: '28px 28px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* glow blob */}
              <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 180, height: 180, borderRadius: '50%', background: `${accent}20`, filter: 'blur(50px)', pointerEvents: 'none' }} />

              {isDone ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: `${accent}cc`, textTransform: 'uppercase', letterSpacing: '2px', position: 'relative' }}>프로젝트 완료</div>
                  <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: accent, position: 'relative' }}>마감</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>모든 일정이 완료되었습니다</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: `${accent}cc`, textTransform: 'uppercase', letterSpacing: '2px', position: 'relative' }}>
                    프로젝트마감
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: accent, position: 'relative' }}>{dday}</div>
                  {diff > 0 && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>
                      {months > 0 && <span>{months}개월 </span>}{days}일
                    </div>
                  )}
                </>
              )}
              <div style={{ borderTop: `1px solid rgba(255,255,255,0.08)`, paddingTop: 14, marginTop: 6, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                    {isDone ? '1차 프로젝트' : '2026년 12월 31일'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                    {isDone ? '발송 · 리뷰 · 마감 완료' : '프로젝트 최종 마감일'}
                  </div>
                </div>
                {phase && (
                  <>
                    <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.12)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 3 }}>현재 차수</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: accent, letterSpacing: '-0.5px' }}>{phase}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })()}

      </div>{/* end hero+dday row */}

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
            to: '/monitoring/reviews', icon: <BarChart2 size={20} />,
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
          {/* 뉴스 트렌드 */}
          <div style={{
            flex: 1, background: 'var(--gray-0)', borderRadius: 10, padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: '1.5px solid var(--teal-lt)', minHeight: 110,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--teal-dk)', letterSpacing: '-0.3px' }}>뉴스 트렌드 분석</div>
              <Link to="/trend/news" style={{
                fontSize: 11, fontWeight: 700, color: 'var(--teal-dk)',
                background: 'var(--blue-lt)', border: '1px solid var(--teal-lt)',
                borderRadius: 20, padding: '3px 10px', textDecoration: 'none',
                transition: 'background .15s',
              }}>트렌드 보기 →</Link>
            </div>
            {trendKeywords ? (
              <div style={{ fontSize: 12, color: 'var(--gray-6)', lineHeight: 1.8 }}
                dangerouslySetInnerHTML={{ __html: trendKeywords.replace(/\n/g, '<br>') }}
              />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>*주간 '트렌드 키워드 요약' 부분 연동</div>
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
            <div style={{ fontSize: 12, color: 'var(--gray-4)' }}>*추후 구현</div>
          </div>
        </div>
      </div>

    </div>
  )
}
