import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'

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
      <div className="page-banner">
        <span className="page-banner-deco">🗃️</span>
        <div>
          <div className="page-banner-title">브랜드 DB</div>
          <div className="page-banner-desc">일반 DB와 퍼스널 DB를 통합 관리합니다.</div>
        </div>
      </div>

      {stats && (
        <div className="cards" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-label">총 일반 브랜드</div>
            <div className="card-value">{stats.generalCount}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-5)' }}> 명</span></div>
          </div>
          <div className="card">
            <div className="card-label">총 퍼스널 브랜드</div>
            <div className="card-value">{stats.personalCount}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-5)' }}> 명</span></div>
          </div>
          <div className="card highlight">
            <div className="card-label">컨택 예정</div>
            <div className="card-value" style={{ color: 'var(--yellow-text)' }}>
              {stats.contactedCount}
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-5)' }}> / {stats.generalCount + stats.personalCount}</span>
            </div>
            <div className="card-sub">
              {stats.generalCount + stats.personalCount
                ? Math.round(stats.contactedCount / (stats.generalCount + stats.personalCount) * 100)
                : 0}% 완료율
            </div>
          </div>
        </div>
      )}

      <div className="ftab-bar">
        {tabs.map(t => (
          <button key={t.path}
            className={'ftab' + (activeTab === t.path ? ' active' : '')}
            onClick={() => navigate(t.path)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="ftab-content">
        <Outlet />
      </div>
    </div>
  )
}
