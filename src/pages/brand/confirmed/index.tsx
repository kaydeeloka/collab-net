import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { PageTabs, StatCard, StatCards } from '@/components/ui'

export interface BrandConfirmedContext {
  refreshStats: () => Promise<void>
}

export default function BrandConfirmed() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { selectedPhaseId } = usePhase()
  const [stats, setStats] = useState({ total: 0, received: 0, pending: 0 })

  const tabs = [
    { path: '/brand/confirmed/management', label: '브랜드 관리' },
    { path: '/brand/confirmed/archive',    label: '자료 아카이브' },
  ]

  const activeTab = tabs.find(t => pathname.startsWith(t.path))?.path ?? tabs[0].path

  const loadStats = useCallback(async () => {
    if (!selectedPhaseId) {
      setStats({ total: 0, received: 0, pending: 0 })
      return
    }
    const { data, error } = await supabase
      .from('confirmed_brands')
      .select('received')
      .eq('phase_id', selectedPhaseId)
    if (error) return
    const rows = data ?? []
    const received = rows.filter(r => r.received).length
    setStats({ total: rows.length, received, pending: rows.length - received })
  }, [selectedPhaseId])

  useEffect(() => { loadStats() }, [loadStats, pathname])

  const { total, received, pending } = stats

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🎯</span>
        <div>
          <div className="page-banner-title">확정 브랜드</div>
          <div className="page-banner-desc">확정 브랜드별 로고·제품 이미지·전성분표 등 자료를 업로드하고 관리합니다.</div>
        </div>
        {total > 0 && (
          <div className="page-banner-actions">
            <span style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'var(--teal-dk)',
              background: 'var(--white)', border: '1px solid var(--teal-lt)', borderRadius: 'var(--r-pill)',
            }}>
              확정 브랜드 {total}
            </span>
          </div>
        )}
      </div>

      <StatCards className="stat-cards--tall" columns="1fr 1fr 1fr" style={{ marginBottom: 20 }}>
        <StatCard highlight variant="metric" align="left" label="총 확정 브랜드" value={total} unit="개" valueColor="var(--teal-dk)" />
        <StatCard
          variant="metric"
          align="left"
          label="제품 받음"
          value={received}
          valueColor="var(--green)"
          footer={`${total ? Math.round(received / total * 100) : 0}% 수령`}
        />
        <StatCard variant="metric" align="left" label="미수령" value={pending} valueColor="#d97706" />
      </StatCards>

      <PageTabs
        tabs={tabs.map(t => ({ id: t.path, label: t.label }))}
        active={activeTab}
        onChange={path => navigate(path)}
      />

      <Outlet context={{ refreshStats: loadStats }} />
    </div>
  )
}
