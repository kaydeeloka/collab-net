import { Outlet, useLocation, useNavigate } from 'react-router-dom'

export default function BrandConfirmed() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  const tabs = [
    { path: '/brand/confirmed/management', label: '브랜드 관리' },
    { path: '/brand/confirmed/archive',    label: '자료 아카이브' },
  ]

  const activeTab = tabs.find(t => pathname.startsWith(t.path))?.path ?? tabs[0].path

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🎯</span>
        <div>
          <div className="page-banner-title">확정 브랜드</div>
          <div className="page-banner-desc">협업 확정 브랜드의 자료 수집 및 폴더 관리 현황을 확인합니다.</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-2)' }}>
        {tabs.map(t => (
          <button key={t.path} onClick={() => navigate(t.path)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'transparent',
              color: activeTab === t.path ? 'var(--teal-dk)' : 'var(--gray-5)',
              borderBottom: activeTab === t.path ? '2px solid var(--teal-dk)' : '2px solid transparent',
              marginBottom: -2, borderRadius: 0, transition: 'all .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
