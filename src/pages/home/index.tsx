import { useEffect, useState, useCallback } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ClipboardList, Package, BarChart2, TrendingUp, Users, Building2, FileText } from 'lucide-react'
import { gasGet } from '../../lib/api'
import { useKrClock } from '../../lib/utils'
import PageSection from '../../components/PageSection'
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

function statError(msg: string) {
  return `<div style="font-size:11px;color:#c00">오류: ${String(msg).substring(0, 60)}</div>`
}

export default function Dashboard() {
  const getKrTime = useKrClock()
  const [clock, setClock] = useState(() => getKrTime())
  const { dbOptions, activeDbId, switchPhase } = useOutletContext<PhaseCtx>()

  const [statsListup,    setStatsListup]    = useState(SPINNER_HTML)
  const [statsOutreach,  setStatsOutreach]  = useState(SPINNER_HTML)
  const [statsEms,       setStatsEms]       = useState(SPINNER_HTML)
  const [statsMonitoring,setStatsMonitoring]= useState(SPINNER_HTML)

  useEffect(() => {
    const id = setInterval(() => setClock(getKrTime()), 1000)
    return () => clearInterval(id)
  }, [])

  const loadListupStats = useCallback(async () => {
    try {
      const [outreach, confirmed] = await Promise.all([
        gasGet<Record<string, { stats?: { total?: number; sent?: number; replied?: number } }>>('getOutreachData'),
        gasGet<{ rows?: unknown[][] }>('getConfirmedInfluencers'),
      ])
      let total = 0, sent = 0, replied = 0
      DB_TIERS.forEach(t => { const s = (outreach[t] || {}).stats || {}; total += s.total || 0; sent += s.sent || 0; replied += s.replied || 0 })
      const confirmedCount = (confirmed.rows || []).length
      const recruitPct = Math.round(confirmedCount / 50 * 100)
      setStatsListup(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${sent}<span style="font-size:11px;font-weight:500;color:var(--gray-5)">/${total}</span></div><div class="fstat-lbl">컨택 완료</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:#d97706">${replied}</div><div class="fstat-lbl">신규 회신</div></div>` +
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${recruitPct}%<span style="font-size:11px;font-weight:500;color:var(--gray-5)"> (${confirmedCount}/50)</span></div><div class="fstat-lbl">모집 완료</div></div>`
      )
    } catch (e: unknown) { setStatsListup(statError((e as Error).message)) }
  }, [])

  const loadOutreachStats = useCallback(async () => {
    // Brand listup — no dedicated API yet; show placeholders
    setStatsOutreach(
      `<div class="fstat"><div class="fstat-val" style="color:var(--gray-4)">—</div><div class="fstat-lbl">컨택 완료/차수</div></div>` +
      `<div class="fstat"><div class="fstat-val" style="color:var(--gray-4)">—</div><div class="fstat-lbl">신규 회신</div></div>` +
      `<div class="fstat"><div class="fstat-val" style="color:var(--gray-4)">—</div><div class="fstat-lbl">확정 브랜드</div></div>`
    )
  }, [])

  const loadEmsStats = useCallback(async () => {
    try {
      const data: { error?: string; stats?: { delivered?: number; exception?: number; pending?: number; total?: number } } = await gasGet('getEmsData')
      if (data.error) { setStatsEms(statError(data.error)); return }
      const s = data.stats || {}
      const problem = (s.exception || 0)
      setStatsEms(
        `<div class="fstat"><div class="fstat-val" style="color:var(--green)">${s.delivered || 0}</div><div class="fstat-lbl">배송 완료</div></div>` +
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
        `<div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${s.totalReviews || 0}<span style="font-size:11px;font-weight:500;color:var(--gray-5)"> / ${s.reviewInfluencers || 0}명</span></div><div class="fstat-lbl">리뷰 업로드</div></div>` +
        `<div class="fstat"><div class="fstat-val">${brandTotal}<span style="font-size:11px;font-weight:500;color:var(--gray-5)"> / 미뮤즈 ${mimuseCount}</span></div><div class="fstat-lbl">브랜드 리뷰</div></div>`
      )
    } catch (e: unknown) { setStatsMonitoring(statError((e as Error).message)) }
  }, [])

  useEffect(() => {
    loadListupStats()
    loadOutreachStats()
    loadEmsStats()
    loadMonitoringStats()
  }, [])

  return (
    <div className="page">

      {/* ── Hero ── */}
      <div className="hero">
        <div>
          <div className="hero-eyebrow">
            {dbOptions.length > 0 ? (
              <select className="phase-select" value={activeDbId} onChange={e => switchPhase(e.target.value)} title="차수 전환">
                {dbOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            ) : (
              <span className="hero-live-pill">LIVE</span>
            )}
          </div>
          <h1>MiMuse 자동화 대시보드</h1>
          <p>차수별 인플루언서 마케팅 현황을 한눈에 확인하세요</p>
        </div>
        <div className="hero-clock">
          <div className="hero-clock-date">{clock.date}</div>
          <div className="hero-clock-time">{clock.time}</div>
          <div className="hero-clock-tz">Korea Standard Time</div>
        </div>
      </div>

      {/* ── D-DAY ── */}
      <div className="page-banner" style={{ marginBottom: 32 }}>
        <span className="page-banner-deco">📅</span>
        <div style={{ flex: 1 }}>
          <div className="page-banner-title">D-DAY (발송/마감)</div>
          <div className="page-banner-desc">캠페인 발송일 및 마감일 D-DAY 현황을 관리합니다.</div>
          <div className="cards" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="card highlight"><div className="card-label">발송 D-DAY</div><div className="card-value">—</div></div>
            <div className="card"><div className="card-label">마감 D-DAY</div><div className="card-value">—</div></div>
            <div className="card"><div className="card-label">진행 중 캠페인</div><div className="card-value">—</div></div>
          </div>
        </div>
      </div>

      {/* ── Feature cards ── */}
      <div className="features-grid features-grid--4" style={{ marginBottom: 32 }}>
        <Link className="feature-card highlight" to="/influencer/search">
          <div className="feature-card-header">
            <div className="feature-icon"><ClipboardList size={26} /></div>
            <div>
              <div className="feature-title">인플루언서 리스트업</div>
              <div className="feature-desc">TikTok 크리에이터 탐색 및 인플루언서 데이터베이스 관리</div>
            </div>
          </div>
          <StatCell html={statsListup} />
          <div className="feature-go">인플루언서 보기 →</div>
        </Link>

        <Link className="feature-card" to="/brand/contact">
          <div className="feature-card-header">
            <div className="feature-icon"><Building2 size={26} /></div>
            <div>
              <div className="feature-title">브랜드 리스트업</div>
              <div className="feature-desc">브랜드 컨택 현황 및 확정 브랜드 관리</div>
            </div>
          </div>
          <StatCell html={statsOutreach} />
          <div className="feature-go">브랜드 보기 →</div>
        </Link>

        <Link className="feature-card green-top" to="/kit/ems">
          <div className="feature-card-header">
            <div className="feature-icon"><Package size={26} /></div>
            <div>
              <div className="feature-title">EMS 배송 트래킹</div>
              <div className="feature-desc">국제 배송 현황 실시간 추적 (17track API)</div>
            </div>
          </div>
          <StatCell html={statsEms} />
          <div className="feature-go">배송 현황 보기 →</div>
        </Link>

        <Link className="feature-card" to="/monitoring/reviews">
          <div className="feature-card-header">
            <div className="feature-icon"><BarChart2 size={26} /></div>
            <div>
              <div className="feature-title">인플루언서 모니터링</div>
              <div className="feature-desc">콘텐츠 성과 및 MiMuse 언급 모니터링</div>
            </div>
          </div>
          <StatCell html={statsMonitoring} />
          <div className="feature-go">모니터링 보기 →</div>
        </Link>
      </div>

      {/* ── Trend sections ── */}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TrendingUp size={16} style={{ color: 'var(--gray-5)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-6)' }}>오늘의 트렌드</span>
      </div>
      <div className="cards" style={{ marginBottom: 24 }}>
        <div className="card"><div className="card-label">뉴스 키워드</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">틱톡 인기 해시태그</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">급상승 트렌드</div><div className="card-value">—</div></div>
      </div>

    </div>
  )
}
