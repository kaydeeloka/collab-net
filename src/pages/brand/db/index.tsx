import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
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
  const { showToast }       = useToast()
  const [stats, setStats]             = useState<Stats | null>(null)
  const [sheetUpdating, setSheetUpdating] = useState(false)
  const [sheetUrl,      setSheetUrl]      = useState<string | null>(null)

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

  async function handleUpdateBrandSheet() {
    if (!selectedPhaseId) { showToast('페이즈를 선택하세요.', 'error'); return }
    setSheetUpdating(true)
    try {
      const r = await gasPost<{ ok?: boolean; error?: string; url?: string; message?: string }>({
        action: 'updateBrandSheet', phaseId: selectedPhaseId,
      })
      if (r.error) { showToast('오류: ' + r.error, 'error'); return }
      if (r.url) setSheetUrl(r.url)
      showToast(r.message || '시트 업데이트 완료', 'success')
    } catch (e: unknown) {
      showToast('오류: ' + (e as Error).message, 'error')
    } finally {
      setSheetUpdating(false)
    }
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="브랜드 DB"
          description="컨택 대상 브랜드의 담당자·연락처·상태를 일반 DB와 퍼스널 DB로 나누어 관리합니다."
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {sheetUrl && (
                <a href={sheetUrl} target="_blank" rel="noopener" className="page-banner-btn page-banner-btn--green" style={{ textDecoration: 'none' }}>
                  시트 열기
                </a>
              )}
              <button
                className="page-banner-btn page-banner-btn--secondary"
                onClick={() => { void handleUpdateBrandSheet() }}
                disabled={sheetUpdating || !selectedPhaseId}>
                {sheetUpdating ? '업데이트 중…' : '시트 업데이트'}
              </button>
            </div>
          }
        />
      </PageHeroBanner>

      {stats && (
        <StatCards className="stat-cards--tall" columns="1fr 1fr 1fr" style={{ marginBottom: 20 }}>
          <StatCard variant="metric" align="left" label="총 일반 브랜드" value={stats.generalCount} unit="명" />
          <StatCard variant="metric" align="left" label="총 퍼스널 브랜드" value={stats.personalCount} unit="명" />
          <StatCard
            highlight variant="metric" align="left" label="컨택 예정"
            value={stats.contactedCount} valueColor="var(--yellow-text)"
            valueSuffix={<span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>{' '}/ {stats.generalCount + stats.personalCount}</span>}
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
