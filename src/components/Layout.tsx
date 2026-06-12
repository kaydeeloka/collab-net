import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Home, TrendingUp, Users, Building2, Package, Activity, Archive, Globe, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { phaseNum, escHtml, useKrClock } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { usePhase } from '@/contexts/PhaseContext'
import Modal from '@/components/Modal'

interface NavSubChild { label: string; to: string; end?: boolean }
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
      { to: '/influencer/contact', label: '인플루언서 컨택' },
      { to: '/influencer/confirmed', label: '확정 인플루언서' },
      { to: '/influencer/template', label: '템플릿 관리' },
    ],
  },
  {
    label: 'BRAND', icon: <Building2 size={22} />, defaultTo: '/brand/db', prefix: '/brand',
    children: [
      { to: '/brand/db',       label: '브랜드 DB' },
      { to: '/brand/contact',  label: '브랜드 컨택' },
      { to: '/brand/confirmed', label: '확정 브랜드' },
      { to: '/brand/template', label: '템플릿 관리' },
    ],
  },
  {
    label: 'KIT', icon: <Package size={22} />, defaultTo: '/kit/ems', prefix: '/kit',
    children: [
      { to: '/kit/ems',       label: 'EMS 배송 추적' },
      { to: '/kit/ems/check', label: '배송 오류 관리' },
    ],
  },
  {
    label: 'MONITORING', icon: <Activity size={22} />, defaultTo: '/monitoring/reviews', prefix: '/monitoring',
    children: [
      { to: '/monitoring/reviews', label: '리뷰 모니터링' },
    ],
  },
  {
    label: 'ARCHIVE', icon: <Archive size={22} />, defaultTo: '/archive/design', prefix: '/archive',
    children: [
      { to: '/archive/design',         label: '디자인 자료 아카이브' },
      { to: '/archive/overall-report', label: '전체 리포트 아카이브' },
      { to: '/archive/brand-report',   label: '브랜드 리포트 아카이브' },
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

  const [navClock,      setNavClock]      = useState('')
  const [openSub,       setOpenSub]       = useState<string | null>(null)
  const subTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const getKrTime = useKrClock()
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  // ── Phase state (from PhaseContext → Supabase) ──
  const { selectedPhaseId, activePhaseId, phases: phaseList, switchPhase: ctxSwitchPhase } = usePhase()

  const [showManage,     setShowManage]     = useState(false)
  const [showNewPhase,   setShowNewPhase]   = useState(false)
  const [newPhaseStatus, setNewPhaseStatus] = useState('')
  const [newPhaseLoading,setNewPhaseLoading]= useState(false)
  const [showDeleteModal,setShowDeleteModal]= useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState('')
  const [deleteLoading,  setDeleteLoading]  = useState(false)

  // Edit phase
  const [showEditPhase,  setShowEditPhase]  = useState(false)
  const [editPhaseId,    setEditPhaseId]    = useState('')
  const [editPhaseName,  setEditPhaseName]  = useState('')
  const [editStartDate,  setEditStartDate]  = useState('')
  const [editEndDate,    setEditEndDate]    = useState('')
  const [editKitDate,    setEditKitDate]    = useState('')
  const [editSheetsUrl,  setEditSheetsUrl]  = useState('')
  const [editLoading,    setEditLoading]    = useState(false)
  const [editStatus,     setEditStatus]     = useState('')

  // New phase form fields
  const [newPhaseName,        setNewPhaseName]        = useState('')
  const [newPhaseStartDate,   setNewPhaseStartDate]   = useState('')
  const [newPhaseEndDate,     setNewPhaseEndDate]      = useState('')
  const [newPhaseKitDate,     setNewPhaseKitDate]      = useState('')
  const [newPhaseSheetsUrl,   setNewPhaseSheetsUrl]    = useState('')

  const activeDbId  = selectedPhaseId ?? ''
  const dbOptions   = phaseList.map(p => ({ id: p.id, label: p.name })).sort((a, b) => phaseNum(a.label) - phaseNum(b.label))
  const phaseBadge  = phaseList.find(p => p.id === selectedPhaseId)?.name || '—'

  async function switchPhase(id: string) {
    if (!id || id === activeDbId) return
    await ctxSwitchPhase(id)
    showToast(`「${phaseList.find(p => p.id === id)?.name}」 전환 완료`, 'success')
  }

  function resetNewPhaseForm() {
    setNewPhaseName(''); setNewPhaseStartDate(''); setNewPhaseEndDate('')
    setNewPhaseKitDate(''); setNewPhaseSheetsUrl(''); setNewPhaseStatus('')
  }

  async function confirmNewPhase() {
    const name = newPhaseName.trim()
    if (!name) return
    setNewPhaseLoading(true)
    setNewPhaseStatus('차수 생성 중...')
    try {
      const { error } = await supabase.from('phases').insert({
        name,
        is_active:        false,
        started_at:       newPhaseStartDate  || null,
        ended_at:         newPhaseEndDate    || null,
        kit_send_date:    newPhaseKitDate    || null,
        google_sheets_url: newPhaseSheetsUrl.trim() || null,
      })
      if (error) { setNewPhaseStatus('오류: ' + error.message); return }
      setNewPhaseStatus('완료!')
      setTimeout(() => { showToast(`「${name}」 생성되었습니다`, 'success'); window.location.reload() }, 500)
    } catch (e: unknown) {
      setNewPhaseStatus('오류: ' + (e as Error).message)
    } finally { setNewPhaseLoading(false) }
  }

  function openEditPhase(p: { id: string; name: string; started_at?: string | null; ended_at?: string | null; kit_send_date?: string | null; google_sheets_url?: string | null }) {
    setEditPhaseId(p.id)
    setEditPhaseName(p.name)
    setEditStartDate(p.started_at ? p.started_at.split('T')[0] : '')
    setEditEndDate(p.ended_at ? p.ended_at.split('T')[0] : '')
    setEditKitDate(p.kit_send_date ?? '')
    setEditSheetsUrl(p.google_sheets_url ?? '')
    setEditStatus('')
    setShowManage(false)
    setShowEditPhase(true)
  }

  async function executeEditPhase() {
    if (!editPhaseId) return
    setEditLoading(true)
    setEditStatus('저장 중...')
    try {
      const { error } = await supabase.from('phases').update({
        started_at:        editStartDate  || null,
        ended_at:          editEndDate    || null,
        kit_send_date:     editKitDate    || null,
        google_sheets_url: editSheetsUrl.trim() || null,
      }).eq('id', editPhaseId)
      if (error) { setEditStatus('오류: ' + error.message); return }
      setEditStatus('완료!')
      setTimeout(() => { showToast(`「${editPhaseName}」 수정 완료`, 'success'); window.location.reload() }, 500)
    } catch (e: unknown) {
      setEditStatus('오류: ' + (e as Error).message)
    } finally { setEditLoading(false) }
  }

  async function executeDeletePhase() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const phase = phaseList.find(p => p.name === deleteTarget)
      if (!phase) return
      const { error } = await supabase.from('phases').delete().eq('id', phase.id)
      setShowDeleteModal(false)
      if (error) { showToast(error.message, 'error'); return }
      showToast(`「${deleteTarget}」 삭제 완료`, 'success')
      window.location.reload()
    } catch (e: unknown) {
      setShowDeleteModal(false); showToast((e as Error).message, 'error')
    } finally { setDeleteLoading(false) }
  }

  useEffect(() => {
    const tick = () => { const t = getKrTime(); setNavClock(t.navDate + '  ' + t.navTime) }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])



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
    <div className="app-layout app-layout--collapsed">

      {/* ── Sidebar ── */}
      <aside className="sidebar sidebar--collapsed">

        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-logo-link" title="홈으로">
            <img className="sidebar-logo-icon" src="/img/logo-black.svg" alt="MiMuse" />
          </NavLink>
        </div>

        <div className="sidebar-nav">
          {GROUPS.map(group => {
            const isActive = activeLabel === group.label
            return (
              <div key={group.label} className="sidebar-group">
                <button
                  className={`sidebar-item${isActive ? ' active' : ''}`}
                  data-label={group.label}
                  onClick={() => navigate(group.defaultTo)}
                >
                  <span className="sidebar-icon">{group.icon}</span>
                </button>
              </div>
            )
          })}
        </div>

        <div className="sidebar-footer">
          <a
            href="https://mimuse.imweb.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-website-btn"
            data-label="미뮤즈 웹사이트"
          >
            <Globe size={22} />
          </a>
          <button
            className="sidebar-phase-btn"
            onClick={() => setShowManage(true)}
            data-label="차수 관리"
          >
            <Settings size={22} />
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
                          end={s.end}
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
              {activePhaseId && activePhaseId !== activeDbId && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                  🟢 활성: {phaseList.find(p => p.id === activePhaseId)?.name}
                </span>
              )}
              {dbOptions.length > 0 ? (
                <select
                  className="phase-select"
                  value=""
                  onChange={e => { if (e.target.value) switchPhase(e.target.value) }}
                  title="차수 전환"
                >
                  <option value="" disabled>{phaseBadge}</option>
                  {dbOptions.filter(o => o.id !== activeDbId).map(o => (
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
          <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>보고 있는 차수</span>
          <span className="phase-badge-nav" style={{ marginLeft: 8 }}>{phaseBadge}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="new-phase-btn" onClick={() => { setShowManage(false); setShowNewPhase(true) }}>
            + 새 차수 시작
          </button>
        </div>
        {phaseList.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-5)', marginBottom: 8 }}>차수 목록</div>
            {phaseList.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                  {p.id === activePhaseId && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '2px 7px' }}>활성</span>
                  )}
                  {p.id === selectedPhaseId && p.id !== activePhaseId && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '2px 7px' }}>보는 중</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {p.started_at && <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>{p.started_at.split('T')[0]} ~ {p.ended_at?.split('T')[0] ?? '?'}</span>}
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--blue-dk)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    onClick={() => openEditPhase(p)}
                  >
                    수정
                  </button>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    onClick={() => { setShowManage(false); setDeleteTarget(p.name || ''); setShowDeleteModal(true) }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </Modal>

      {/* New Phase */}
      <Modal open={showNewPhase} onClose={() => { setShowNewPhase(false); resetNewPhaseForm() }} title="새 차수 시작">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="modal-label">차수 이름 *</label>
            <input className="modal-input" type="text" placeholder="예: 3차, Q3-2025" maxLength={30}
              value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="modal-label">프로젝트 시작일</label>
              <input className="modal-input" type="date" value={newPhaseStartDate} onChange={e => setNewPhaseStartDate(e.target.value)} />
            </div>
            <div>
              <label className="modal-label">프로젝트 마감일</label>
              <input className="modal-input" type="date" value={newPhaseEndDate} onChange={e => setNewPhaseEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="modal-label">키트 발송일</label>
            <input className="modal-input" type="date" value={newPhaseKitDate} onChange={e => setNewPhaseKitDate(e.target.value)} />
          </div>
          <div>
            <label className="modal-label">구글 시트 연동 링크</label>
            <input className="modal-input" type="url" placeholder="https://docs.google.com/spreadsheets/..." value={newPhaseSheetsUrl} onChange={e => setNewPhaseSheetsUrl(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={() => { setShowNewPhase(false); resetNewPhaseForm() }}>취소</button>
          <button className="modal-btn-confirm" onClick={confirmNewPhase} disabled={newPhaseLoading || !newPhaseName.trim()}>
            {newPhaseLoading ? '처리 중...' : '생성'}
          </button>
        </div>
        {newPhaseStatus && <div className="modal-status" style={{ color: newPhaseStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>{newPhaseStatus}</div>}
      </Modal>

      {/* Edit Phase */}
      <Modal open={showEditPhase} onClose={() => setShowEditPhase(false)} title={`「${editPhaseName}」 날짜 수정`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="modal-label">프로젝트 시작일</label>
              <input className="modal-input" type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
            </div>
            <div>
              <label className="modal-label">프로젝트 마감일</label>
              <input className="modal-input" type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="modal-label">키트 발송일</label>
            <input className="modal-input" type="date" value={editKitDate} onChange={e => setEditKitDate(e.target.value)} />
          </div>
          <div>
            <label className="modal-label">구글 시트 연동 링크</label>
            <input className="modal-input" type="url" placeholder="https://docs.google.com/spreadsheets/..." value={editSheetsUrl} onChange={e => setEditSheetsUrl(e.target.value)} />
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={() => setShowEditPhase(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={executeEditPhase} disabled={editLoading}>
            {editLoading ? '저장 중...' : '저장'}
          </button>
        </div>
        {editStatus && <div className="modal-status" style={{ color: editStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>{editStatus}</div>}
      </Modal>

      {/* Delete Phase */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="차수 삭제" titleColor="var(--red)">
        <div className="modal-desc" dangerouslySetInnerHTML={{ __html: `「<strong>${escHtml(deleteTarget)}</strong>」 차수 데이터베이스를 삭제하시겠습니까?` }} />
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
