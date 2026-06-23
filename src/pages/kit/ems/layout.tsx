import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { countReshipNeeded, countReshipCompleted, fetchReshipmentMap } from '@/lib/ems/ems-errors'
import { isEmsDelivered, isEmsInTransit } from '@/lib/ems/ems-tracking-status'
import { usePhase } from '@/contexts/PhaseContext'
import Spinner from '@/components/Spinner'
import { PageTabs, StatCard, StatCards } from '@/components/ui'

export const INFLUENCER_TARGET = 50

export interface EmsStats {
  total:            number
  totalParcels:     number
  primaryParcels:   number
  reshipParcels:    number
  delivered:        number
  inTransit:        number
  shippingErrors:   number
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

async function fetchEmsStats(phaseId: string | null): Promise<EmsStats> {
  const empty: EmsStats = {
    total: 0, totalParcels: 0, primaryParcels: 0, reshipParcels: 0,
    delivered: 0, inTransit: 0, shippingErrors: 0,
    reshipNeeded: 0, reshipCompleted: 0, errorTotal: 0,
  }
  if (!phaseId) return empty

  const [{ data, error }, reshipMap] = await Promise.all([
    supabase
      .from('confirmed_influencers')
      .select(`
        id,
        influencers!inner(handle, display_name),
        ems_tracking(status, ems_number, application_number)
      `)
      .eq('phase_id', phaseId),
    fetchReshipmentMap(phaseId),
  ])

  if (error) throw error

  const rows = (data || []).map((ci: any) => {
    const ems    = (ci.ems_tracking || [])[0] || {}
    const reship = reshipMap.get(ci.id)
    return {
      status:             ems.status             || null,
      ems_number:         ems.ems_number         || null,
      application_number: ems.application_number || null,
      reship_id:          reship?.id             || null,
      reship_status:      reship?.status         || null,
    }
  })

  const total            = rows.length
  const primaryParcels   = rows.filter(r =>
    !!(r.ems_number || '').trim() || !!(r.application_number || '').trim(),
  ).length
  const reshipParcels    = rows.filter(r => r.reship_id).length
  const totalParcels     = primaryParcels + reshipParcels
  const delivered        = rows.filter(r => isEmsDelivered(r.status)).length
  const inTransit        = rows.filter(r => isEmsInTransit(r.status)).length
  const shippingErrors   = reshipParcels
  const errorRows        = rows.filter(r => r.reship_status).map(r => ({ status: r.reship_status! }))
  const reshipNeeded     = countReshipNeeded(errorRows)
  const reshipCompleted  = countReshipCompleted(errorRows)
  const errorTotal       = errorRows.length

  return {
    total, totalParcels, primaryParcels, reshipParcels,
    delivered, inTransit, shippingErrors,
    reshipNeeded, reshipCompleted, errorTotal,
  }
}

function EmsStatsCards({ stats }: { stats: EmsStats }) {
  const { total, totalParcels, primaryParcels, reshipParcels, delivered, inTransit, shippingErrors, reshipNeeded, reshipCompleted } = stats
  const pct = (n: number) => (total ? Math.round(n / total * 100) : 0)

  return (
    <StatCards className="ems-stats-cards" columns="repeat(3, minmax(0, 1fr))">
      <StatCard
        label="전체 배송"
        variant="metric"
        align="left"
        value={totalParcels}
        unit="건"
        footer={(
          <>
            <span style={{ color: 'var(--teal-dk)', fontWeight: 700 }}>원배송</span>
            <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{primaryParcels}건</strong>
            <span style={{ margin: '0 6px', color: 'var(--gray-3)' }}>·</span>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>재발송/오류</span>
            <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{reshipParcels}건</strong>
          </>
        )}
      />
      <StatCard
        highlight
        label="배송"
        variant="split"
        columns={[
          { value: delivered, unit: '명', valueColor: '#14532d', label: '배송 완료', labelColor: '#16a34a', sub: `${pct(delivered)}% 완료율` },
          { value: inTransit, unit: '명', valueColor: '#1e40af', label: '배송 중', labelColor: 'var(--blue-dk)', hideSub: true },
          { value: shippingErrors, unit: '명', valueColor: '#991b1b', label: '재발송', labelColor: '#dc2626', hideSub: true },
        ]}
      />
      <StatCard
        highlight
        label="재배송"
        variant="split"
        columns={[
          { value: reshipNeeded, unit: '건', valueColor: '#991b1b', label: '재배송 필요', labelColor: '#dc2626', hideSub: true },
          { value: reshipCompleted, unit: '건', valueColor: '#14532d', label: '재배송 완료', labelColor: '#16a34a', hideSub: true },
        ]}
      />
    </StatCards>
  )
}

export default function EmsLayout() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const activeTab    = pathname.startsWith('/kit/ems/errors') ? '/kit/ems/errors' : '/kit/ems'
  const [stats, setStats]             = useState<EmsStats | null>(null)
  const [loading, setLoading]         = useState(true)
  const [reshipVersion, setReshipVersion] = useState(0)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      setStats(await fetchEmsStats(viewPhaseId))
    } catch {
      setStats({ total: 0, totalParcels: 0, primaryParcels: 0, reshipParcels: 0, delivered: 0, inTransit: 0, shippingErrors: 0, reshipNeeded: 0, reshipCompleted: 0, errorTotal: 0 })
    }
    setLoading(false)
  }, [viewPhaseId])

  useEffect(() => { if (!phaseLoading) loadStats() }, [loadStats, pathname, reshipVersion, phaseLoading])

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

      <PageTabs
        className="page-tab-bar--compact"
        style={{ marginTop: 16 }}
        tabs={TABS.map(t => ({ id: t.path, label: t.label }))}
        active={activeTab}
        onChange={path => navigate(path)}
      />

      <div style={{ paddingTop: 16 }}>
        <Outlet context={{ refreshStats: loadStats, notifyReshipChange, reshipVersion }} />
      </div>
    </div>
  )
}
