import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { gasGet } from '../../lib/api'
import { fmtNum, useKrClock } from '../../lib/utils'
import PageSection from '../../components/PageSection'

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
      const data: Record<string, { stats?: { total?: number; totalFollowers?: number } }> = await gasGet('getInfluencerList')
      if ((data as { error?: string }).error) { setStatsListup(statError((data as { error?: string }).error!)); return }
      let total = 0, totalF = 0
      DB_TIERS.forEach(t => { const d = data[t] || {}; total += d.stats?.total || 0; totalF += d.stats?.totalFollowers || 0 })
      setStatsListup(`<div class="fstat"><div class="fstat-val" style="color:var(--yellow-text)">${total}</div><div class="fstat-lbl">인플루언서</div></div><div class="fstat"><div class="fstat-val">${fmtNum(totalF)}</div><div class="fstat-lbl">총 팔로워</div></div>`)
    } catch (e: unknown) { setStatsListup(statError((e as Error).message)) }
  }, [])

  const loadOutreachStats = useCallback(async () => {
    try {
      const data: Record<string, { stats?: { total?: number; sent?: number; replied?: number } }> = await gasGet('getOutreachData')
      if ((data as { error?: string }).error) { setStatsOutreach(statError((data as { error?: string }).error!)); return }
      let total = 0, sent = 0, replied = 0
      DB_TIERS.forEach(t => { const s = (data[t] || {}).stats || {}; total += s.total || 0; sent += s.sent || 0; replied += s.replied || 0 })
      const pct = total > 0 ? Math.round(sent / total * 100) : 0
      setStatsOutreach(`<div class="fstat"><div class="fstat-val" style="color:var(--green)">${sent}</div><div class="fstat-lbl">발송 완료</div></div><div class="fstat"><div class="fstat-val">${total - sent}</div><div class="fstat-lbl">미발송</div></div><div class="fstat"><div class="fstat-val" style="color:#d97706">${replied}</div><div class="fstat-lbl">답장 수신</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${pct}%</div><div class="fstat-lbl">발송률</div></div>`)
    } catch (e: unknown) { setStatsOutreach(statError((e as Error).message)) }
  }, [])

  const loadEmsStats = useCallback(async () => {
    try {
      const data: { error?: string; stats?: { delivered?: number; inTransit?: number; total?: number } } = await gasGet('getEmsData')
      if (data.error) { setStatsEms(statError(data.error)); return }
      const s = data.stats || {}
      setStatsEms(`<div class="fstat"><div class="fstat-val" style="color:var(--green)">${s.delivered || 0}</div><div class="fstat-lbl">배송 완료</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${s.inTransit || 0}</div><div class="fstat-lbl">배송 중</div></div><div class="fstat"><div class="fstat-val">${s.total || 0}</div><div class="fstat-lbl">전체</div></div>`)
    } catch (e: unknown) { setStatsEms(statError((e as Error).message)) }
  }, [])

  const loadMonitoringStats = useCallback(async () => {
    try {
      const data: { stats?: { totalInfluencers?: number; mentions?: number }; rows?: unknown[] } = await gasGet('getMonitoringData')
      const s = data.stats || {}
      const total    = s.totalInfluencers ?? (data.rows || []).length
      const mentioned = s.mentions || 0
      setStatsMonitoring(`<div class="fstat"><div class="fstat-val">${total}</div><div class="fstat-lbl">모니터링 중</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${mentioned}</div><div class="fstat-lbl">MiMuse 언급</div></div>`)
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
            <span className="hero-live-pill">LIVE</span>
            <span className="hero-eyebrow-text">인플루언서 마케팅 자동화 시스템</span>
          </div>
          <h1>MiMuse 자동화 대시보드</h1>
          <p>차수별 인플루언서 마케팅 현황을 한눈에 확인하세요</p>
        </div>
        <div className="hero-clock">
          <div className="hero-clock-date">{clock.date}</div>
          <div className="hero-clock-time">{clock.time}</div>
          <div className="hero-clock-tz">Korea Standard Time</div>
        </div>
        <span className="hero-deco" aria-hidden="true">📊</span>
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
      <div className="section-title--dash">QUICK ACCESS</div>
      <div className="features-grid features-grid--4" style={{ marginBottom: 32 }}>
        <Link className="feature-card highlight" to="/influencer/search">
          <div className="feature-card-header">
            <div className="feature-icon">📋</div>
            <div>
              <div className="feature-title">인플루언서 리스트업</div>
              <div className="feature-desc">TikTok 크리에이터 탐색 및 인플루언서 데이터베이스 관리</div>
            </div>
          </div>
          <StatCell html={statsListup} />
          <div className="feature-go">데이터베이스 보기</div>
        </Link>

        <Link className="feature-card" to="/influencer/contact">
          <div className="feature-card-header">
            <div className="feature-icon">📧</div>
            <div>
              <div className="feature-title">아웃리치</div>
              <div className="feature-desc">이메일 발송 현황 및 인플루언서 컨택 관리</div>
            </div>
          </div>
          <StatCell html={statsOutreach} />
          <div className="feature-go">아웃리치 보기</div>
        </Link>

        <Link className="feature-card green-top" to="/kit/ems">
          <div className="feature-card-header">
            <div className="feature-icon">📦</div>
            <div>
              <div className="feature-title">EMS 배송 트래킹</div>
              <div className="feature-desc">국제 배송 현황 실시간 추적 (17track API)</div>
            </div>
          </div>
          <StatCell html={statsEms} />
          <div className="feature-go">배송 현황 보기</div>
        </Link>

        <Link className="feature-card" to="/monitoring/reviews">
          <div className="feature-card-header">
            <div className="feature-icon">📊</div>
            <div>
              <div className="feature-title">인플루언서 모니터링</div>
              <div className="feature-desc">콘텐츠 성과 및 MiMuse 언급 모니터링</div>
            </div>
          </div>
          <StatCell html={statsMonitoring} />
          <div className="feature-go">모니터링 보기</div>
        </Link>
      </div>

      {/* ── Status overview sections ── */}
      <div className="section-title--dash" style={{ marginBottom: 16 }}>현황 요약</div>

      <PageSection icon="📊" title="오늘의 트렌드 요약" desc="뉴스·틱톡 트렌드 분석 결과를 한눈에 요약합니다." defaultOpen={false}>
        <div className="cards">
          <div className="card"><div className="card-label">뉴스 키워드</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">틱톡 인기 해시태그</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">급상승 트렌드</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>구분</th><th>키워드</th><th>트렌드 지수</th><th>전일 대비</th><th>수집 시각</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection icon="👥" title="인플루언서 현황" desc="서치 · 컨택 · 확정 단계별 인플루언서 현황을 한눈에 확인합니다." defaultOpen={false}>
        <div className="cards">
          <div className="card"><div className="card-label">서치 완료</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">컨택 진행</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">확정</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">리뷰 업로드</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>인플루언서명</th><th>플랫폼</th><th>팔로워</th><th>컨택 상태</th><th>확정 여부</th><th>리뷰 업로드</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection icon="🏢" title="브랜드 현황" desc="컨택·확정·자료 수집 단계별 브랜드 현황을 관리합니다." defaultOpen={false}>
        <div className="cards">
          <div className="card"><div className="card-label">총 브랜드</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">컨택 진행</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">확정</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">자료 수집 완료</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>브랜드명</th><th>담당자</th><th>컨택 상태</th><th>확정 여부</th><th>로고 파일</th><th>성분 파일</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection icon="📦" title="배송 현황" desc="전체 배송 현황 요약 — 단계별 건수 및 미수취 알림을 확인합니다." defaultOpen={false}>
        <div className="cards">
          <div className="card"><div className="card-label">총 발송</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">배송 중</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">도착 완료</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">미수취 / 오류</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>인플루언서명</th><th>운송장번호</th><th>발송일</th><th>배송 상태</th><th>도착일</th><th>비고</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection icon="📝" title="리뷰 업로드 현황" desc="각 인플루언서의 리뷰 업로드 여부 및 링크를 한눈에 파악합니다." defaultOpen={false}>
        <div className="cards">
          <div className="card"><div className="card-label">업로드 완료</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">미업로드</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">업로드율</div><div className="card-value">—%</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>인플루언서명</th><th>플랫폼</th><th>업로드 여부</th><th>리뷰 링크</th><th>업로드 일자</th><th>조회수</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>

    </div>
  )
}
