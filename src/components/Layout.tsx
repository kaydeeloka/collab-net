import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { gasGet } from '../lib/api'
import { useKrClock } from '../lib/utils'

interface PhaseInfo    { ok: boolean; activePhase?: string }
interface NavSubChild  { label: string; to: string }
interface NavChild     { label: string; to: string; end?: boolean; sub?: NavSubChild[] }
interface NavGroup     { label: string; children: NavChild[] }

const NAV: NavGroup[] = [
  {
    label: 'HOME',
    children: [
      { to: '/',                       label: '대시보드',              end: true },
      { to: '/home/dday',              label: 'D-DAY (발송/마감)'               },
      { to: '/home/trend-summary',     label: '오늘의 트렌드 요약'              },
      { to: '/home/influencer-status', label: '인플루언서 현황'                 },
      { to: '/home/brand-status',      label: '브랜드 현황'                     },
      { to: '/home/delivery-status',   label: '배송 현황'                       },
      { to: '/home/review-upload',     label: '리뷰 업로드 현황'                },
    ],
  },
  {
    label: 'TREND',
    children: [
      { to: '/trend/news',   label: '뉴스 트렌드 분석' },
      { to: '/trend/tiktok', label: '틱톡 트렌드 분석' },
    ],
  },
  {
    label: 'INFLUENCER',
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
    label: 'BRAND',
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
    label: 'KIT',
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
    label: 'MONITORING',
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

function isGroupActive(group: NavGroup, pathname: string) {
  return group.children.some(c =>
    c.end ? pathname === c.to : pathname === c.to || pathname.startsWith(c.to + '/')
  )
}

export default function Layout() {
  const [phaseBadge, setPhaseBadge]   = useState('—')
  const [navClock,   setNavClock]     = useState('')
  const [openGroup,  setOpenGroup]    = useState<string | null>(null)
  const [openSub,    setOpenSub]      = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getKrTime  = useKrClock()
  const { pathname } = useLocation()

  useEffect(() => {
    const tick = () => { const t = getKrTime(); setNavClock(t.navDate + '  ' + t.navTime) }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => {
    gasGet<PhaseInfo>('getPhaseInfo')
      .then(d => { if (d.ok) setPhaseBadge(d.activePhase || '—') })
      .catch(() => {})
  }, [])

  // Auto-expand sub-accordion to match current path
  useEffect(() => {
    for (const g of NAV) {
      for (const c of g.children) {
        if (c.sub?.some(s => pathname === s.to || pathname.startsWith(s.to + '/'))) {
          setOpenSub(c.to); return
        }
      }
    }
  }, [pathname])

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const onEnter = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenGroup(label)
  }
  const onLeave = () => {
    closeTimer.current = setTimeout(() => setOpenGroup(null), 200)
  }

  return (
    <>
      <nav>
        <img className="logo" src="/img/logo-03.png" alt="MiMuse" />
        <div className="tabs">
          {NAV.map(group => {
            const active = isGroupActive(group, pathname)
            const isOpen = openGroup === group.label
            return (
              <div
                key={group.label}
                className="nav-group"
                onMouseEnter={() => onEnter(group.label)}
                onMouseLeave={onLeave}
              >
                <button
                  className={'tab' + (active ? ' active' : '')}
                  onClick={() => setOpenGroup(isOpen ? null : group.label)}
                  aria-expanded={isOpen}
                >
                  {group.label}<span className="nav-chevron">▾</span>
                </button>

                {isOpen && (
                  <div className="nav-dropdown">
                    {group.children.map(child => {
                      const hasSub  = !!child.sub?.length
                      const subOpen = openSub === child.to
                      return (
                        <div key={child.to}>
                          <div className="nav-dd-row">
                            <NavLink
                              to={child.to}
                              end={child.end}
                              onClick={() => hasSub && setOpenSub(subOpen ? null : child.to)}
                              className={({ isActive }) =>
                                'nav-dropdown-item' + (isActive ? ' active' : '')
                              }
                            >
                              {child.label}
                            </NavLink>
                            {hasSub && (
                              <button
                                className="nav-sub-toggle"
                                onClick={e => {
                                  e.preventDefault(); e.stopPropagation()
                                  setOpenSub(subOpen ? null : child.to)
                                }}
                                aria-label="toggle sub-menu"
                              >
                                {subOpen ? '▴' : '▾'}
                              </button>
                            )}
                          </div>

                          {hasSub && subOpen && (
                            <div className="nav-dropdown-sub">
                              {child.sub!.map(s => (
                                <NavLink
                                  key={s.to}
                                  to={s.to}
                                  className={({ isActive }) =>
                                    'nav-dropdown-subitem' + (isActive ? ' active' : '')
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="nav-right">
          <span className="nav-clock">{navClock}</span>
          <span className="phase-badge-nav">{phaseBadge}</span>
        </div>
      </nav>
      <Outlet />
    </>
  )
}
