import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { PageTabs, StatCard, StatCards } from '@/components/ui'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'

interface Stats {
  generalCount:  number
  personalCount: number
  contactedCount: number
}

export default function BrandDb() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { selectedPhaseId } = usePhase()
  const [stats, setStats] = useState<Stats | null>(null)

  const tabs = [
    { path: '/brand/db/general',  label: '일반 DB'  },
    { path: '/brand/db/personal', label: '퍼스널 DB' },
  ]
  const activeTab = tabs.find(t => pathname.startsWith(t.path))?.path ?? tabs[0].path

  useEffect(() => { loadStats() }, [selectedPhaseId])

  async function loadStats() {
    if (!selectedPhaseId) { setStats({ generalCount: 0, personalCount: 0, contactedCount: 0 }); return }
    const [{ data: general }, { data: personal }] = await Promise.all([
      supabase.from('brand_general').select('contacted').eq('phase_id', selectedPhaseId),
      supabase.from('brand_personal').select('contacted').eq('phase_id', selectedPhaseId),
    ])
    const generalCount   = general?.length ?? 0
    const personalCount  = personal?.length ?? 0
    const contactedCount = (general?.filter((r: any) => r.contacted).length ?? 0)
                         + (personal?.filter((r: any) => r.contacted).length ?? 0)
    setStats({ generalCount, personalCount, contactedCount })
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="브랜드 DB"
          description="일반 DB와 퍼스널 DB를 통합 관리합니다."
        />
      </PageHeroBanner>

      {stats && (
        <StatCards className="stat-cards--tall" columns="1fr 1fr 1fr" style={{ marginBottom: 20 }}>
          <StatCard variant="metric" align="left" label="총 일반 브랜드" value={stats.generalCount} unit="명" />
          <StatCard variant="metric" align="left" label="총 퍼스널 브랜드" value={stats.personalCount} unit="명" />
          <StatCard
            highlight
            variant="metric"
            align="left"
            label="컨택 예정"
            value={stats.contactedCount}
            valueColor="var(--yellow-text)"
            valueSuffix={(
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>
                {' '}/ {stats.generalCount + stats.personalCount}
              </span>
            )}
            footer={`${stats.generalCount + stats.personalCount ? Math.round(stats.contactedCount / (stats.generalCount + stats.personalCount) * 100) : 0}% 완료율`}
          />
        </StatCards>
      )}

      <PageTabs
        tabs={tabs.map(t => ({ id: t.path, label: t.label }))}
        active={activeTab}
        onChange={path => navigate(path)}
      />

      <div className="ftab-content">
        <Outlet />
      </div>
    </div>
  )
}
