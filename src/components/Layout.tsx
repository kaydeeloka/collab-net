import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Home, TrendingUp, Users, Building2, Package, Activity, Archive, Globe, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { phaseNum, escHtml, normalizePhaseNameInput, suggestNextPhaseName } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { usePhase } from '@/contexts/PhaseContext'
import StickyBar, { type StickyBarGroup, type StickyBarNavChild, type StickyBarNavSubChild } from '@/components/StickyBar'
import Modal from '@/components/Modal'
import { archiveSectionFromPath, archivePhaseSlugFromPath, archiveSectionPath, phaseFromArchiveSlug } from '@/pages/archive/archive-slug'

interface NavSubChild extends StickyBarNavSubChild {}
interface NavChild extends StickyBarNavChild {}
interface SideGroup extends StickyBarGroup { icon: ReactNode; children: NavChild[] }

const GROUPS: SideGroup[] = [
  {
    label: 'HOME', icon: <Home size={22} />, defaultTo: '/', prefix: '/',
    children: [],
  },
  {
    label: 'TREND', icon: <TrendingUp size={22} />, defaultTo: '/trend/beauty-news', prefix: '/trend',
    children: [
      {
        to: '/trend/beauty-news',
        label: '뷰티 뉴스',
        activeWhen: p => p === '/trend/beauty-news' || p.startsWith('/trend/beauty-news-archive'),
      },
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
      { to: '/kit/ems', label: 'EMS 배송 추적', activeWhen: p => p === '/kit/ems' || p.startsWith('/kit/ems/') },
      { to: '/kit/ems-template', label: '템플릿 관리' },
      { to: '/kit/ems-data',  label: 'EMS 발송 데이터' },
    ],
  },
  {
    label: 'MONITORING', icon: <Activity size={22} />, defaultTo: '/influencer/monitoring', prefix: '/influencer/monitoring',
    children: [
      { to: '/influencer/monitoring', label: '리뷰 모니터링', activeWhen: p => p === '/influencer/monitoring' || p === '/influencer/monitoring-list' },
      { to: '/influencer/monitoring-report', label: '콘텐츠 성과', end: true },
    ],
  },
  {
    label: 'ARCHIVE', icon: <Archive size={22} />, defaultTo: '/archive', prefix: '/archive',
    children: [],
  },
]

function getActiveGroup(pathname: string) {
  if (pathname === '/' || pathname.startsWith('/home/')) return 'HOME'
  const matches = GROUPS.filter(g => g.prefix !== '/' && pathname.startsWith(g.prefix))
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.prefix.length - a.prefix.length)[0].label
}

export default function Layout() {
  const { showToast } = useToast()

  const [openSub,       setOpenSub]       = useState<string | null>(null)
  const subTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  // ── Phase state (from PhaseContext → Supabase) ──
  const { selectedPhaseId, activePhaseId, viewPhaseId, phases: phaseList, switchPhase: ctxSwitchPhase } = usePhase()

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
  const [editConcept,    setEditConcept]    = useState('')
  const [editLoading,    setEditLoading]    = useState(false)
  const [editStatus,     setEditStatus]     = useState('')

  // New phase form fields
  const [newPhaseName,        setNewPhaseName]        = useState('')
  const [newPhaseConcept,     setNewPhaseConcept]     = useState('')
  const [newPhaseStartDate,   setNewPhaseStartDate]   = useState('')
  const [newPhaseEndDate,     setNewPhaseEndDate]      = useState('')
  const [newPhaseKitDate,     setNewPhaseKitDate]      = useState('')
  const [newPhaseSheetsUrl,   setNewPhaseSheetsUrl]    = useState('')

  const activeDbId  = viewPhaseId ?? ''
  const dbOptions   = phaseList.map(p => ({ id: p.id, label: p.name })).sort((a, b) => phaseNum(a.label) - phaseNum(b.label))
  const phaseBadge  = phaseList.find(p => p.id === viewPhaseId)?.name || '—'

  async function switchPhase(id: string) {
    if (!id || id === activeDbId) return
    await ctxSwitchPhase(id)
    showToast(`「${phaseList.find(p => p.id === id)?.name}」 전환 완료`, 'success')
  }

  function resetNewPhaseForm() {
    setNewPhaseName(''); setNewPhaseConcept(''); setNewPhaseStartDate(''); setNewPhaseEndDate('')
    setNewPhaseKitDate(''); setNewPhaseSheetsUrl(''); setNewPhaseStatus('')
  }

  function openNewPhaseModal() {
    setShowManage(false)
    setNewPhaseName(suggestNextPhaseName(phaseList))
    setNewPhaseConcept('')
    setNewPhaseStartDate('')
    setNewPhaseEndDate('')
    setNewPhaseKitDate('')
    setNewPhaseSheetsUrl('')
    setNewPhaseStatus('')
    setShowNewPhase(true)
  }

  async function confirmNewPhase() {
    const name = normalizePhaseNameInput(newPhaseName)
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
        project_concept:  newPhaseConcept.trim() || null,
      })
      if (error) { setNewPhaseStatus('오류: ' + error.message); return }
      setNewPhaseStatus('완료!')
      setTimeout(() => { showToast(`「${name}」 생성되었습니다`, 'success'); window.location.reload() }, 500)
    } catch (e: unknown) {
      setNewPhaseStatus('오류: ' + (e as Error).message)
    } finally { setNewPhaseLoading(false) }
  }

  function openEditPhase(p: { id: string; name: string; started_at?: string | null; ended_at?: string | null; kit_send_date?: string | null; google_sheets_url?: string | null; project_concept?: string | null }) {
    setEditPhaseId(p.id)
    setEditPhaseName(p.name)
    setEditStartDate(p.started_at ? p.started_at.split('T')[0] : '')
    setEditEndDate(p.ended_at ? p.ended_at.split('T')[0] : '')
    setEditKitDate(p.kit_send_date ?? '')
    setEditSheetsUrl(p.google_sheets_url ?? '')
    setEditConcept(p.project_concept ?? '')
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
        project_concept:   editConcept.trim() || null,
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

  useEffect(() => { setOpenSub(null) }, [pathname])
  useEffect(() => () => { if (subTimer.current) clearTimeout(subTimer.current) }, [])

  useEffect(() => {
    const section = archiveSectionFromPath(pathname)
    const urlPhaseSlug = archivePhaseSlugFromPath(pathname)
    if (!section || !urlPhaseSlug || !viewPhaseId) return

    const phase = phaseList.find(p => p.id === viewPhaseId)
    if (!phase) return

    const urlPhase = phaseFromArchiveSlug(phaseList, urlPhaseSlug)
    if (!urlPhase || urlPhase.id !== viewPhaseId) {
      navigate(archiveSectionPath(phase, section), { replace: true })
    }
  }, [viewPhaseId, pathname, phaseList, navigate])

  const activeLabel = getActiveGroup(pathname)
  const activeGroup = GROUPS.find(g => g.label === activeLabel)

  const stickyGroup = useMemo((): StickyBarGroup | null => {
    if (!activeGroup) return null
    if (activeGroup.label !== 'ARCHIVE') return activeGroup

    const phaseSlug = archivePhaseSlugFromPath(pathname)
    if (!phaseSlug) return { ...activeGroup, children: [] }

    const phase = phaseFromArchiveSlug(phaseList, phaseSlug)
    if (!phase) return { ...activeGroup, children: [] }

    return {
      ...activeGroup,
      children: [
        { to: archiveSectionPath(phase, 'design'), label: '디자인 자료' },
        { to: archiveSectionPath(phase, 'season'), label: '시즌 컬렉션' },
        { to: archiveSectionPath(phase, 'brand-report'), label: '브랜드별 리포트', end: true },
      ],
    }
  }, [activeGroup, pathname, phaseList])

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

        {stickyGroup && (
          <StickyBar
            group={stickyGroup}
            pathname={pathname}
            openSub={openSub}
            onSubEnter={onSubEnter}
            onSubLeave={onSubLeave}
          />
        )}

        <div className="main-scroll">
          <Outlet context={{ dbOptions, activeDbId, switchPhase }} />
        </div>
      </div>

      {/* ── Phase Management modal ── */}
      <Modal open={showManage} onClose={() => setShowManage(false)} title="차수 관리">
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>보고 있는 차수</span>
          <span className="phase-badge-nav" style={{ marginLeft: 8 }}>{phaseBadge}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className="new-phase-btn" onClick={openNewPhaseModal}>
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
                  {p.id === viewPhaseId && p.id !== activePhaseId && (
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
            <label className="modal-label">차수 *</label>
            <input
              className="modal-input"
              type="text"
              placeholder="예: 3차"
              maxLength={20}
              value={newPhaseName}
              onChange={e => setNewPhaseName(e.target.value)}
              onBlur={() => setNewPhaseName(prev => normalizePhaseNameInput(prev))}
              autoFocus
            />
          </div>
          <div>
            <label className="modal-label">프로젝트 컨셉</label>
            <textarea
              className="modal-input"
              rows={3}
              placeholder="예: A Seollal collection — 설날을 테마로 한 시즌 키트"
              value={newPhaseConcept}
              onChange={e => setNewPhaseConcept(e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }}
            />
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
          <button className="modal-btn-confirm" onClick={confirmNewPhase} disabled={newPhaseLoading || !normalizePhaseNameInput(newPhaseName)}>
            {newPhaseLoading ? '처리 중...' : '생성'}
          </button>
        </div>
        {newPhaseStatus && <div className="modal-status" style={{ color: newPhaseStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>{newPhaseStatus}</div>}
      </Modal>

      {/* Edit Phase */}
      <Modal open={showEditPhase} onClose={() => setShowEditPhase(false)} title={`「${editPhaseName}」 수정`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="modal-label">프로젝트 컨셉</label>
            <textarea
              className="modal-input"
              rows={3}
              placeholder="시즌 컬렉션에 표시할 프로젝트 컨셉"
              value={editConcept}
              onChange={e => setEditConcept(e.target.value)}
              style={{ resize: 'vertical', minHeight: 72 }}
            />
          </div>
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
