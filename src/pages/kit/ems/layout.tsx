import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { countReshipNeeded, countReshipCompleted, fetchReshipmentMap } from '../../../lib/ems-errors'
import Spinner from '../../../components/Spinner'

export const INFLUENCER_TARGET = 50

export interface EmsStats {
  total:          number
  targetPct:      number
  delivered:      number
  inTransit:      number
  shippingErrors: number
  reshipNeeded:     number
  reshipCompleted:  number
  errorTotal:       number
}

export interface EmsLayoutContext {
  refreshStats:       () => Promise<void>
  notifyReshipChange: () => void
  reshipVersion:      number
}

export function useEmsLayout() {
  return useOutletContext<EmsLayoutContext>()
}

const TABS = [
  { path: '/kit/ems',        label: '배송 추적' },
  { path: '/kit/ems/errors', label: '배송 오류 관리' },
] as const

async function fetchEmsStats(): Promise<EmsStats> {
  const [{ data, error }, reshipMap] = await Promise.all([
    supabase
      .from('confirmed_influencers')
      .select(`
        id,
        influencers!inner(handle, display_name),
        ems_tracking(status)
      `),
    fetchReshipmentMap(),
  ])

  if (error) throw error

  const rows = (data || []).map((ci: any) => {
    const ems    = (ci.ems_tracking || [])[0] || {}
    const reship = reshipMap.get(ci.id)
    return {
      status:        ems.status      || null,
      reship_id:     reship?.id      || null,
      reship_status: reship?.status  || null,
    }
  })

  const total          = rows.length
  const targetPct      = Math.min(Math.round(total / INFLUENCER_TARGET * 100), 100)
  const delivered      = rows.filter(r => r.status === 'Delivered').length
  const inTransit      = rows.filter(r => r.status === 'In Transit' || r.status === 'Preparing').length
  const shippingErrors = rows.filter(r => r.reship_id).length
  const errorRows      = rows.filter(r => r.reship_status).map(r => ({ status: r.reship_status! }))
  const reshipNeeded   = countReshipNeeded(errorRows)
  const reshipCompleted = countReshipCompleted(errorRows)
  const errorTotal     = errorRows.length

  return { total, targetPct, delivered, inTransit, shippingErrors, reshipNeeded, reshipCompleted, errorTotal }
}

function EmsStatsCards({ stats }: { stats: EmsStats }) {
  const { total, targetPct, delivered, inTransit, shippingErrors, reshipNeeded, reshipCompleted } = stats
  return (
    <div className="cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      <div className="card highlight">
        <div className="card-label">총 관리 대상</div>
        <div style={{ textAlign: 'left', paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'flex-start' }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>{total}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
          </div>
          <div className="card-sub" style={{ marginTop: 0 }}>{total} / {INFLUENCER_TARGET}명 · {targetPct}%</div>
          <div style={{ marginTop: 8, height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${targetPct}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
          </div>
        </div>
      </div>
      <div className="card highlight">
        <div className="card-label">배송</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'start', width: '100%' }}>
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#14532d', letterSpacing: '-1px' }}>{delivered}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>배송 완료</div>
            <div className="card-sub" style={{ marginTop: 0 }}>{total ? Math.round(delivered / total * 100) : 0}% 완료율</div>
          </div>
          <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#1e40af', letterSpacing: '-1px' }}>{inTransit}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}>배송 중</div>
          </div>
          <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#991b1b', letterSpacing: '-1px' }}>{shippingErrors}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
            </div>
            <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>재발송</div>
          </div>
        </div>
      </div>
      <div className="card highlight">
        <div className="card-label">재배송</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'start', width: '100%' }}>
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#991b1b', letterSpacing: '-1px' }}>{reshipNeeded}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>건</span>
            </div>
            <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>재배송 필요</div>
          </div>
          <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#14532d', letterSpacing: '-1px' }}>{reshipCompleted}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>건</span>
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>재배송 완료</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EmsLayout() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const activeTab    = pathname.startsWith('/kit/ems/errors') ? '/kit/ems/errors' : '/kit/ems'
  const [stats, setStats]             = useState<EmsStats | null>(null)
  const [loading, setLoading]         = useState(true)
  const [reshipVersion, setReshipVersion] = useState(0)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      setStats(await fetchEmsStats())
    } catch {
      setStats({ total: 0, targetPct: 0, delivered: 0, inTransit: 0, shippingErrors: 0, reshipNeeded: 0, reshipCompleted: 0, errorTotal: 0 })
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats, pathname, reshipVersion])

  const notifyReshipChange = useCallback(() => {
    setReshipVersion(v => v + 1)
  }, [])

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <div>
          <div className="page-banner-title">EMS 글로벌 배송 &amp; 통합 관리 시스템</div>
          <div className="page-banner-desc">확정 인플루언서의 배송 정보를 통합 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button type="button" className="page-banner-btn page-banner-btn--secondary" onClick={loadStats}>
            <span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침
          </button>
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
      {!loading && stats && <EmsStatsCards stats={stats} />}

      <div className="bn-tab-bar" style={{ marginTop: 16, marginBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.path}
            type="button"
            className={`bn-tab-btn${activeTab === t.path ? ' active' : ''}`}
            onClick={() => navigate(t.path)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 16 }}>
        <Outlet context={{ refreshStats: loadStats, notifyReshipChange, reshipVersion }} />
      </div>
    </div>
  )
}
