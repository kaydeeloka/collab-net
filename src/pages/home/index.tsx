import { Link, useOutletContext } from 'react-router-dom'
import { ClipboardList, Package, BarChart2, TrendingUp, Building2 } from 'lucide-react'
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

export default function Dashboard() {
  const { dbOptions, activeDbId, switchPhase } = useOutletContext<PhaseCtx>()
  const { viewPhaseId, phases } = usePhase()
  const currentPhase  = phases.find(p => p.id === (viewPhaseId ?? activeDbId))
  const dispatchDate  = currentPhase?.kit_send_date ? parseKstDateOnly(currentPhase.kit_send_date) : null
  const deadlineDate  = currentPhase?.ended_at      ? parseKstDateOnly(currentPhase.ended_at.split('T')[0]) : null

  const statsListup = '<div class="fstat"><div class="fstat-val" style="color:var(--green)">3<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 3명</span></div><div class="fstat-lbl">발송 완료</div></div><div class="fstat"><div class="fstat-val" style="color:#d97706">2</div><div class="fstat-lbl">회신</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">6<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 1,000명</span></div><div class="fstat-lbl">서치 완료</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">4<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 50명 (8%)</span></div><div class="fstat-lbl">확정 인플루언서</div></div>'
  const statsOutreach = '<div class="fstat"><div class="fstat-val" style="color:var(--green)">1<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 3개</span></div><div class="fstat-lbl">발송</div></div><div class="fstat"><div class="fstat-val" style="color:#d97706">2</div><div class="fstat-lbl">회신</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">5</div><div class="fstat-lbl">전체 브랜드 DB</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">2</div><div class="fstat-lbl">확정 브랜드</div></div>'
  const statsEms = '<div class="fstat"><div class="fstat-val" style="color:var(--green)">1</div><div class="fstat-lbl">배송 완료</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">2</div><div class="fstat-lbl">배송 중</div></div><div class="fstat"><div class="fstat-val" style="color:#e53935">1</div><div class="fstat-lbl">오류/미수취</div></div>'
  const statsMonitoring = '<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">5<span style="font-size:16px;font-weight:500;color:var(--gray-5)"> / 4명</span></div><div class="fstat-lbl">리뷰 업로드</div></div><div class="fstat"><div class="fstat-val">2</div><div class="fstat-lbl">브랜드별 리뷰</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">3</div><div class="fstat-lbl">Collab-Net 리뷰</div></div>'
  const newsKeywords = [
    { tag: '#BarrierFirst', explanation: '피부 장벽 케어와 보습 루틴이 미국 뷰티 크리에이터 콘텐츠에서 주목받고 있습니다.' },
    { tag: '#GlowTint', explanation: '가볍고 촉촉한 베이스 메이크업 제품이 데일리 콘텐츠의 핵심 포맷으로 자리 잡고 있습니다.' },
  ]

  return (
    <div className="page">

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        marginBottom: 16, borderRadius: 10, background: '#eff6ff',
        border: '1px solid #bfdbfe', color: '#1e40af', fontSize: 12,
      }}>
        <span style={{ fontSize: 15 }} aria-hidden="true">ⓘ</span>
        <span><strong>Demo mode</strong> · 지금은 화면 안내를 위한 샘플 데이터를 표시하고 있습니다. Supabase를 연결하면 실제 캠페인 데이터로 전환할 수 있습니다.</span>
      </div>

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
            <div className="page-hero-title">Collab-Net</div>
            <h1 className="page-hero-title">대시보드</h1>
          </div>
          <p className="page-hero-desc">
            인플루언서 협업 캠페인 현황을 한눈에 확인하세요
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

      {/* ── Trend ── */}
      <div style={{
        background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
        padding: '18px 22px', marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={15} color="#10b981" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)' }}>오늘의 트렌드 요약</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* 뷰티 뉴스 */}
          <div style={{
            flex: 1, background: 'var(--gray-0)', borderRadius: 10, padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 10,
            border: '1.5px solid var(--teal-lt)', minHeight: 110,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--teal-dk)', letterSpacing: '-0.3px' }}>뷰티 뉴스 트렌드 키워드</div>
              <Link to="/trend/beauty-news" style={{
                fontSize: 11, fontWeight: 700, color: 'var(--teal-dk)',
                background: 'var(--blue-lt)', border: '1px solid var(--teal-lt)',
                borderRadius: 20, padding: '3px 10px', textDecoration: 'none',
                transition: 'background .15s',
              }}>뉴스 브리핑 보기 →</Link>
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
              }}>틱톡 트렌드 보기 →</Link>
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

      {/* ── Status cards 2×2 ── */}
      {(() => {
        const cards = [
          {
            to: '/influencer/search', icon: <ClipboardList size={20} />,
            title: '인플루언서 리스트업', desc: '인플루언서 서치 · DB 관리',
            stats: statsListup, color: '#3b82f6', go: '인플루언서 보기',
          },
          {
            to: '/brand/db/general', icon: <Building2 size={20} />,
            title: '브랜드 리스트업', desc: '브랜드 컨택 현황 · 확정 브랜드 관리',
            stats: statsOutreach, color: '#8b5cf6', go: '브랜드 보기',
          },
          {
            to: '/kit/ems', icon: <Package size={20} />,
            title: 'EMS 배송 트래킹', desc: '키트 배송 현황 · 키트 관리',
            stats: statsEms, color: '#10b981', go: '배송 현황 보기',
          },
          {
            to: '/influencer/monitoring', icon: <BarChart2 size={20} />,
            title: '인플루언서 모니터링', desc: '리뷰 모니터링 현황 · 콘텐츠 성과',
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

    </div>
  )
}
