import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { PageTabs } from '@/components/ui'

export default function BrandConfirmed() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { selectedPhaseId } = usePhase()
  const [brandCount, setBrandCount] = useState<number | null>(null)

  const tabs = [
    { path: '/brand/confirmed/management', label: '브랜드 관리' },
    { path: '/brand/confirmed/archive',    label: '자료 아카이브' },
  ]

  const activeTab = tabs.find(t => pathname.startsWith(t.path))?.path ?? tabs[0].path

  const loadBrandCount = useCallback(async () => {
    if (!selectedPhaseId) { setBrandCount(0); return }
    const { count, error } = await supabase
      .from('confirmed_brands')
      .select('*', { count: 'exact', head: true })
      .eq('phase_id', selectedPhaseId)
    setBrandCount(error ? null : (count ?? 0))
  }, [selectedPhaseId])

  useEffect(() => { loadBrandCount() }, [loadBrandCount, pathname])

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🎯</span>
        <div>
          <div className="page-banner-title">확정 브랜드</div>
          <div className="page-banner-desc">확정 브랜드별 로고·제품 이미지·전성분표 등 자료를 업로드하고 관리합니다.</div>
        </div>
        {brandCount !== null && (
          <div className="page-banner-actions">
            <span style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 700, color: 'var(--teal-dk)',
              background: 'var(--white)', border: '1px solid var(--teal-lt)', borderRadius: 'var(--r-pill)',
            }}>
              확정 브랜드 {brandCount}
            </span>
          </div>
        )}
      </div>

      <PageTabs
        tabs={tabs.map(t => ({ id: t.path, label: t.label }))}
        active={activeTab}
        onChange={path => navigate(path)}
      />

      <Outlet />
    </div>
  )
}
