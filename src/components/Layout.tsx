import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Home, TrendingUp, Users, Building2, Package, Activity, Globe, Settings } from 'lucide-react'
import { gasGet, gasPost } from '../lib/api'
import { phaseNum, buildPhaseDbOptions, escHtml, useKrClock } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'

interface PhaseInfo {
  ok: boolean
  activePhase?    : string
  activeOutreachId?: string
  phase1SheetId?  : string
  phases?         : { name?: string; outreachId?: string }[]
}
interface NavSubChild { label: string; to: string }
interface NavChild    { label: string; to: string; end?: boolean; sub?: NavSubChild[] }
interface SideGroup   { label: string; icon: ReactNode; defaultTo: string; prefix: string; children: NavChild[] }

const GROUPS: SideGroup[] = [
  {
    label: 'HOME', icon: <Home size={22} />, defaultTo: '/', prefix: '/',
    children: [],
  },
  {
    label: 'TREND', icon: <TrendingUp size={22} />, defaultTo: '/trend/news', prefix: '/trend',
    children: [
      { to: '/trend/news',   label: '뉴스 트렌드 분석' },
      { to: '/trend/tiktok', label: '틱톡 트렌드 분석' },
    ],
  },
  {
    label: 'INFLUENCER', icon: <Users size={22} />, defaultTo: '/influencer/search', prefix: '/influencer',
    children: [
      { to: '/influencer/search', label: '인플루언서 서치' },
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
    label: 'BRAND', icon: <Building2 size={22} />, defaultTo: '/brand/db', prefix: '/brand',
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
    label: 'KIT', icon: <Package size={22} />, defaultTo: '/kit/ems', prefix: '/kit',
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
    label: 'MONITORING', icon: <Activity size={22} />, defaultTo: '/monitoring/reviews', prefix: '/monitoring',
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
  const { showToast } = useToast()

  const [collapsed,     setCollapsed]     = useState(false)
  const [sideExpanded,  setSideExpanded]  = useState<string | null>(null)
  const [navClock,      setNavClock]      = useState('')
  const [openSub,       setOpenSub]       = useState<string | null>(null)
  const subTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getKrTime = useKrClock()
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  // ── Phase state ──
  const [phaseInfo,    setPhaseInfo]    = useState<PhaseInfo | null>(null)
  const [activeDbId,   setActiveDbId]   = useState('')

  // Phase management modals
  const [showManage,     setShowManage]     = useState(false)
  const [showNewPhase,   setShowNewPhase]   = useState(false)
  const [newPhaseName,   setNewPhaseName]   = useState('')
  const [newPhaseStatus, setNewPhaseStatus] = useState('')
  const [newPhaseLoading,setNewPhaseLoading]= useState(false)

  const [showLinkPhase,  setShowLinkPhase]  = useState(false)
  const [linkName,       setLinkName]       = useState('')
  const [linkId,         setLinkId]         = useState('')
  const [linkStatus,     setLinkStatus]     = useState('')
  const [linkLoading,    setLinkLoading]    = useState(false)

  const [showDeleteModal,setShowDeleteModal]= useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState('')
  const [deleteTrash,    setDeleteTrash]    = useState(false)
  const [deleteLoading,  setDeleteLoading]  = useState(false)

  async function loadPhaseInfo() {
    try {
      const d = await gasGet<PhaseInfo>('getPhaseInfo')
      if (d.ok) {
        setPhaseInfo(d)
        setActiveDbId((d.activeOutreachId || '').trim())
      }
    } catch {}
  }

  async function switchPhase(id: string) {
    if (!id || id === activeDbId) return
    try {
      const r: { error?: string } = await gasPost({ action: 'setActiveDatabase', outreachId: id })
      if (r.error) { showToast(r.error, 'error'); return }
      window.location.reload()
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  async function confirmNewPhase() {
    const name = newPhaseName.trim()
    if (!name) return
    setNewPhaseLoading(true)
    setNewPhaseStatus('새 스프레드시트 생성 중... (약 10~20초 소요)')
    try {
      const r: { error?: string } = await gasPost({ action: 'createNewPhase', phaseName: name })
      if (r.error) { setNewPhaseStatus('오류: ' + r.error); return }
      setNewPhaseStatus('완료!')
      setTimeout(() => { showToast(`「${name}」 생성되었습니다`, 'success'); window.location.reload() }, 600)
    } catch (e: unknown) {
      setNewPhaseStatus('오류: ' + (e as Error).message)
    } finally { setNewPhaseLoading(false) }
  }

  async function confirmLinkPhase() {
    const name = linkName.trim()
    if (!name) return
    setLinkLoading(true); setLinkStatus('연결 중...')
    try {
      const r: { error?: string } = await gasPost({ action: 'linkPhase', phaseName: name, outreachId: linkId.trim() || undefined })
      if (r.error) { setLinkStatus('오류: ' + r.error); return }
      setLinkStatus('완료!')
      setTimeout(() => { showToast(`「${name}」 연결 완료`, 'success'); window.location.reload() }, 500)
    } catch (e: unknown) {
      setLinkStatus('오류: ' + (e as Error).message)
    } finally { setLinkLoading(false) }
  }

  async function executeDeletePhase() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const r: { error?: string } = await gasPost({ action: 'deletePhase', phaseName: deleteTarget, trashSheet: deleteTrash })
      setShowDeleteModal(false)
      if (r.error) { showToast(r.error, 'error'); return }
      showToast(`「${deleteTarget}」 삭제 완료`, 'success')
      window.location.reload()
    } catch (e: unknown) {
      setShowDeleteModal(false); showToast((e as Error).message, 'error')
    } finally { setDeleteLoading(false) }
  }

  const phaseBadge = phaseInfo?.activePhase || '—'
  const dbOptions  = phaseInfo ? buildPhaseDbOptions(phaseInfo) : []
  const phaseList  = (() => {
    const list = [...(phaseInfo?.phases || [])]
    const p1id = (phaseInfo?.phase1SheetId || '').trim()
    if (p1id && !list.find(p => p.name === '1차')) list.push({ name: '1차', outreachId: p1id })
    return list.sort((a, b) => phaseNum(b.name || '') - phaseNum(a.name || ''))
  })()

  useEffect(() => {
    const tick = () => { const t = getKrTime(); setNavClock(t.navDate + '  ' + t.navTime) }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  useEffect(() => { loadPhaseInfo() }, [])

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
          {!collapsed && <img className="sidebar-logo" src="/img/logo-black.svg" alt="MiMuse" />}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            {collapsed ? '☰' : '‹'}
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
                    if (collapsed || group.children.length === 0) { navigate(group.defaultTo); return }
                    if (!isExpanded) navigate(group.defaultTo)
                    setSideExpanded(isExpanded ? null : group.label)
                  }}
                >
                  <span className="sidebar-icon">{group.icon}</span>
                  <span className="sidebar-label">{group.label}</span>
                  {!collapsed && group.children.length > 0 && (
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
          {!collapsed && <div className="sidebar-clock">{navClock}</div>}
          <a
            href="https://mimuse.imweb.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-website-btn"
            title="미뮤즈 웹사이트"
          >
            {collapsed ? <Globe size={22} /> : '미뮤즈 웹사이트'}
          </a>
          <button
            className="sidebar-phase-btn"
            onClick={() => setShowManage(true)}
            title="차수 관리"
          >
            {collapsed ? <Settings size={22} /> : '차수 관리'}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-area">

        {/* Sticky children tab bar */}
        {activeGroup && activeGroup.children.length > 0 && (
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
                          className={({ isActive }) => 'children-bar-sub-item' + (isActive ? ' active' : '')}
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
              {dbOptions.length > 0 ? (
                <select
                  className="phase-select"
                  value={activeDbId}
                  onChange={e => switchPhase(e.target.value)}
                  title="차수 전환"
                >
                  {dbOptions.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <span className="phase-badge-nav">{phaseBadge}</span>
              )}
            </div>

          </div>
        )}

        <Outlet context={{ dbOptions, activeDbId, switchPhase }} />
      </div>

      {/* ── Phase Management modal ── */}
      <Modal open={showManage} onClose={() => setShowManage(false)} title="차수 관리">
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>현재 차수</span>
          <span className="phase-badge-nav" style={{ marginLeft: 8 }}>{phaseBadge}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="new-phase-btn" onClick={() => { setShowManage(false); setShowNewPhase(true) }}>
            + 새 차수 시작
          </button>
          <button className="new-phase-btn" style={{ background: 'var(--gray-1)', color: 'var(--gray-6)', border: '1px solid var(--gray-3)' }}
            onClick={() => { setShowManage(false); setLinkName(''); setLinkId(''); setShowLinkPhase(true) }}>
            기존 DB 연결
          </button>
        </div>
        {phaseList.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-5)', marginBottom: 8 }}>차수 목록</div>
            {phaseList.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-2)' }}>
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  onClick={() => { setShowManage(false); setDeleteTarget(p.name || ''); setDeleteTrash(false); setShowDeleteModal(true) }}
                >
                  삭제
                </button>
              </div>
            ))}
          </>
        )}
      </Modal>

      {/* New Phase */}
      <Modal open={showNewPhase} onClose={() => { setShowNewPhase(false); setNewPhaseName(''); setNewPhaseStatus('') }} title="새 차수 시작">
        <div className="modal-desc">현재 차수 데이터는 <strong>Google Sheets에 그대로 보관</strong>됩니다.<br />새 빈 데이터베이스(스프레드시트)가 자동 생성됩니다.</div>
        <label className="modal-label">새 차수 이름</label>
        <input className="modal-input" type="text" placeholder="예: 3차, Q3-2025" maxLength={30}
          value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmNewPhase() }} autoFocus />
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => { setShowNewPhase(false); setNewPhaseName(''); setNewPhaseStatus('') }}>취소</button>
          <button className="modal-btn-confirm" onClick={confirmNewPhase} disabled={newPhaseLoading}>
            {newPhaseLoading ? '생성 중...' : '생성'}
          </button>
        </div>
        {newPhaseStatus && <div className="modal-status" style={{ color: newPhaseStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>{newPhaseStatus}</div>}
      </Modal>

      {/* Link Existing DB */}
      <Modal open={showLinkPhase} onClose={() => { setShowLinkPhase(false); setLinkName(''); setLinkId(''); setLinkStatus('') }} title="기존 DB 연결">
        <div className="modal-desc">새 스프레드시트를 만들지 않고 <strong>기존 Google Sheets</strong>를 차수로 등록합니다.</div>
        <label className="modal-label">차수 이름</label>
        <input className="modal-input" type="text" placeholder="예: 테스트, 1.5차" maxLength={30}
          value={linkName} onChange={e => setLinkName(e.target.value)} autoFocus />
        <label className="modal-label" style={{ marginTop: 10 }}>스프레드시트 ID <span style={{ fontWeight: 400, color: 'var(--gray-5)' }}>(비우면 1차 DB 사용)</span></label>
        <input className="modal-input" type="text" placeholder="Google Sheets 스프레드시트 ID"
          value={linkId} onChange={e => setLinkId(e.target.value)} />
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => { setShowLinkPhase(false); setLinkName(''); setLinkId(''); setLinkStatus('') }}>취소</button>
          <button className="modal-btn-confirm" onClick={confirmLinkPhase} disabled={linkLoading || !linkName.trim()}>
            {linkLoading ? '연결 중...' : '연결'}
          </button>
        </div>
        {linkStatus && <div className="modal-status" style={{ color: linkStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>{linkStatus}</div>}
      </Modal>

      {/* Delete Phase */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="차수 삭제" titleColor="var(--red)">
        <div className="modal-desc" dangerouslySetInnerHTML={{ __html: `「<strong>${escHtml(deleteTarget)}</strong>」 차수 데이터베이스를 삭제하시겠습니까?` }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--red)', cursor: 'pointer' }}>
          <input type="checkbox" checked={deleteTrash} onChange={e => setDeleteTrash(e.target.checked)} style={{ width: 15, height: 15 }} />
          시트도 삭제 (Google Drive 휴지통으로 이동)
        </label>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={() => setShowDeleteModal(false)}>취소</button>
          <button className="modal-btn-confirm" style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={executeDeletePhase} disabled={deleteLoading}>
            {deleteLoading ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </Modal>

    </div>
  )
}
