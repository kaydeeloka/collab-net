import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Home, TrendingUp, Users, Building2, Package, Activity } from 'lucide-react'
import { gasGet } from '../lib/api'
import { useKrClock } from '../lib/utils'

interface PhaseInfo   { ok: boolean; activePhase?: string }
interface NavSubChild { label: string; to: string }
interface NavChild    { label: string; to: string; end?: boolean; sub?: NavSubChild[] }
interface SideGroup   { label: string; icon: ReactNode; defaultTo: string; prefix: string; children: NavChild[] }

const GROUPS: SideGroup[] = [
  {
    label: 'HOME', icon: <Home size={18} />, defaultTo: '/', prefix: '/',
    children: [
      { to: '/',                       label: '대시보드',          end: true },
      { to: '/home/dday',              label: 'D-DAY (발송/마감)'           },
      { to: '/home/trend-summary',     label: '오늘의 트렌드 요약'          },
      { to: '/home/influencer-status', label: '인플루언서 현황'             },
      { to: '/home/brand-status',      label: '브랜드 현황'                 },
      { to: '/home/delivery-status',   label: '배송 현황'                   },
      { to: '/home/review-upload',     label: '리뷰 업로드 현황'            },
    ],
  },
  {
    label: 'TREND', icon: <TrendingUp size={18} />, defaultTo: '/trend/news', prefix: '/trend',
    children: [
      { to: '/trend/news',   label: '뉴스 트렌드 분석' },
      { to: '/trend/tiktok', label: '틱톡 트렌드 분석' },
    ],
  },
  {
    label: 'INFLUENCER', icon: <Users size={18} />, defaultTo: '/influencer/search', prefix: '/influencer',
    children: [
      {
        to: '/influencer/search', label: '인플루언서 서치',
        sub: [
          { to: '/influencer/search/settings', label: '서치 조건 설정' },
          { to: '/influencer/search/explore',  label: '조건별 탐색 · 리스트업 연동' },
          { to: '/influencer/search/db',       label: 'DB 리스트' },
        ],
      },
      {
        to: '/influencer/contact', label: '인플루언서 컨택',
        sub: [
          { to: '/influencer/contact/list',      label: '컨택 대상 명단' },
          { to: '/influencer/contact/template',  label: '아웃리치 템플릿 작성 / 선택' },
          { to: '/influencer/contact/completed', label: '컨택 완료 명단 (답장 체크)' },
        ],
      },
      {
        to: '/influencer/confirmed', label: '확정 인플루언서 명단',
        sub: [
          { to: '/influencer/confirmed/shipping',   label: '배송 주소 구글폼 연동' },
          { to: '/influencer/confirmed/monitoring', label: '리뷰 모니터링 연동' },
        ],
      },
    ],
  },
  {
    label: 'BRAND', icon: <Building2 size={18} />, defaultTo: '/brand/db', prefix: '/brand',
    children: [
      {
        to: '/brand/db', label: '브랜드 DB',
        sub: [
          { to: '/brand/db/mail',     label: '대표메일 DB' },
          { to: '/brand/db/contacts', label: '개인 연락처 DB' },
        ],
      },
      {
        to: '/brand/contact', label: '브랜드 컨택',
        sub: [
          { to: '/brand/contact/list',      label: '컨택 대상 명단' },
          { to: '/brand/contact/template',  label: '아웃리치 템플릿 작성 / 선택' },
          { to: '/brand/contact/completed', label: '컨택 완료 명단 (답장 체크)' },
        ],
      },
      {
        to: '/brand/confirmed', label: '확정 브랜드 명단',
        sub: [
          { to: '/brand/confirmed/folders', label: '브랜드 별 필요 자료 폴더 생성' },
          { to: '/brand/confirmed/files',   label: '로고 파일 · 제품 성분 파일 등' },
        ],
      },
    ],
  },
  {
    label: 'KIT', icon: <Package size={18} />, defaultTo: '/kit/ems', prefix: '/kit',
    children: [
      {
        to: '/kit/ems', label: 'EMS 배송 추적',
        sub: [
          { to: '/kit/ems/daily',   label: '각 배송 단계 데일리 추적' },
          { to: '/kit/ems/check',   label: '도착 건 / 오류 건 수량 체크' },
          { to: '/kit/ems/pending', label: '미수취 건 · 아웃리치 진행' },
        ],
      },
      {
        to: '/kit/design-archive', label: '디자인 자료 아카이브',
        sub: [
          { to: '/kit/design-archive/orders', label: '발주 파일 아카이브' },
        ],
      },
    ],
  },
  {
    label: 'MONITORING', icon: <Activity size={18} />, defaultTo: '/monitoring/reviews', prefix: '/monitoring',
    children: [
      {
        to: '/monitoring/reviews', label: '리뷰 모니터링',
        sub: [
          { to: '/monitoring/reviews/upload-status', label: '인플루언서 별 리뷰 업로드 여부' },
          { to: '/monitoring/reviews/manual-check',  label: '수기 리뷰 체크 기능' },
          { to: '/monitoring/reviews/brand-check',   label: 'Mi Muse / 브랜드 리뷰 체크란' },
        ],
      },
      {
        to: '/monitoring/content', label: '리뷰 콘텐츠 수치 확인',
        sub: [
          { to: '/monitoring/content/followup', label: '리뷰 콘텐츠 수치 팔로업' },
          { to: '/monitoring/content/report',   label: '최종 수치 확인 후 리포트 작성' },
        ],
      },
      {
        to: '/monitoring/reports', label: '리포트 아카이브',
        sub: [
          { to: '/monitoring/reports/brand', label: '브랜드 별 리포트 아카이브' },
          { to: '/monitoring/reports/all',   label: '전체 리포트 아카이브' },
        ],
      },
    ],
  },
]

function getActiveGroup(pathname: string) {
  if (pathname === '/' || pathname.startsWith('/home/')) return 'HOME'
  for (const g of GROUPS) {
    if (g.prefix !== '/' && pathname.startsWith(g.prefix)) return g.label
  }
  return null
}

export default function Layout() {
  const [collapsed,     setCollapsed]     = useState(false)
  const [sideExpanded,  setSideExpanded]  = useState<string | null>(null)
  const [phaseBadge,    setPhaseBadge]    = useState('—')
  const [navClock,      setNavClock]      = useState('')
  const [openSub,       setOpenSub]       = useState<string | null>(null)
  const subTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getKrTime = useKrClock()
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  useEffect(() => {
    const tick = () => { const t = getKrTime(); setNavClock(t.navDate + '  ' + t.navTime) }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    gasGet<PhaseInfo>('getPhaseInfo')
      .then(d => { if (d.ok) setPhaseBadge(d.activePhase || '—') })
      .catch(() => {})
  }, [])

  // Auto-expand the active group in the sidebar when navigating
  useEffect(() => {
    setSideExpanded(getActiveGroup(pathname))
  }, [pathname])

  useEffect(() => { setOpenSub(null) }, [pathname])
  useEffect(() => () => { if (subTimer.current) clearTimeout(subTimer.current) }, [])

  const activeLabel = getActiveGroup(pathname)
  const activeGroup = GROUPS.find(g => g.label === activeLabel)

  const onSubEnter = (to: string) => {
    if (subTimer.current) clearTimeout(subTimer.current)
    setOpenSub(to)
  }
  const onSubLeave = () => {
    subTimer.current = setTimeout(() => setOpenSub(null), 200)
  }

  return (
    <div className={`app-layout${collapsed ? ' app-layout--collapsed' : ''}`}>

      {/* ── Sidebar ── */}
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

        <div className="sidebar-header">
          {!collapsed && <img className="sidebar-logo" src="/img/logo-03.png" alt="MiMuse" />}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <div className="sidebar-nav">
          {GROUPS.map(group => {
            const isActive   = activeLabel === group.label
            const isExpanded = sideExpanded === group.label && !collapsed
            return (
              <div key={group.label} className="sidebar-group">
                <button
                  className={`sidebar-item${isActive ? ' active' : ''}`}
                  title={collapsed ? group.label : undefined}
                  onClick={() => {
                    if (collapsed) { navigate(group.defaultTo); return }
                    // toggle accordion; navigate to default only when opening
                    if (!isExpanded) navigate(group.defaultTo)
                    setSideExpanded(isExpanded ? null : group.label)
                  }}
                >
                  <span className="sidebar-icon">{group.icon}</span>
                  <span className="sidebar-label">{group.label}</span>
                  {!collapsed && (
                    <span className="sidebar-arrow">{isExpanded ? '▴' : '▾'}</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="sidebar-children">
                    {group.children.map(child => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) =>
                          'sidebar-child' + (isActive ? ' active' : '')
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="sidebar-footer">
          {!collapsed && (
            <>
              <div className="sidebar-clock">{navClock}</div>
              <span className="phase-badge-nav">{phaseBadge}</span>
            </>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-area">

        {/* Sticky children tab bar */}
        {activeGroup && (
          <div className="children-bar">
            {activeGroup.children.map(child => {
              const hasSub  = !!child.sub?.length
              const subOpen = openSub === child.to
              return (
                <div
                  key={child.to}
                  className="children-bar-group"
                  onMouseEnter={() => hasSub && onSubEnter(child.to)}
                  onMouseLeave={() => hasSub && onSubLeave()}
                >
                  <NavLink
                    to={child.to}
                    end={child.end}
                    className={({ isActive }) => 'children-bar-tab' + (isActive ? ' active' : '')}
                  >
                    {child.label}
                    {hasSub && <span className="nav-chevron">▾</span>}
                  </NavLink>

                  {hasSub && subOpen && (
                    <div className="children-bar-dropdown">
                      {child.sub!.map(s => (
                        <NavLink
                          key={s.to}
                          to={s.to}
                          className={({ isActive }) =>
                            'children-bar-sub-item' + (isActive ? ' active' : '')
                          }
                        >
                          <span className="nav-dot">•</span>{s.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="children-bar-right">
              <span className="nav-clock">{navClock}</span>
              <span className="phase-badge-nav">{phaseBadge}</span>
            </div>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  )
}
