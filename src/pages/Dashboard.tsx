import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { gasGet, gasPost } from '../lib/api'
import { fmtNum, phaseNum, buildPhaseDbOptions, escHtml, useKrClock } from '../lib/utils'
import { useToast } from '../contexts/ToastContext'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

interface PhaseInfo {
  ok: boolean
  activePhase?: string
  activeOutreachId?: string
  phase1SheetId?: string
  phases?: { name?: string; outreachId?: string }[]
}

interface StatSnippet {
  html: string
}

function StatCell({ html }: StatSnippet) {
  return <div className="feature-stats" dangerouslySetInnerHTML={{ __html: html }} />
}

export default function Dashboard() {
  const { showToast } = useToast()
  const getKrTime = useKrClock()

  const [clock, setClock] = useState(() => getKrTime())
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null)
  const [activeDbId, setActiveDbId] = useState('')

  const [statsListup, setStatsListup] = useState('<div class="fstat"><div class="fstat-val"><span class="spinner spinner--sm"></span></div><div class="fstat-lbl">로딩 중</div></div>')
  const [statsOutreach, setStatsOutreach] = useState('<div class="fstat"><div class="fstat-val"><span class="spinner spinner--sm"></span></div><div class="fstat-lbl">로딩 중</div></div>')
  const [statsEms, setStatsEms] = useState('<div class="fstat"><div class="fstat-val"><span class="spinner spinner--sm"></span></div><div class="fstat-lbl">로딩 중</div></div>')
  const [statsMonitoring, setStatsMonitoring] = useState('<div class="fstat"><div class="fstat-val"><span class="spinner spinner--sm"></span></div><div class="fstat-lbl">로딩 중</div></div>')

  const [showNewPhase, setShowNewPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [newPhaseStatus, setNewPhaseStatus] = useState('')
  const [newPhaseLoading, setNewPhaseLoading] = useState(false)

  const [showLinkPhase, setShowLinkPhase] = useState(false)
  const [linkName, setLinkName] = useState('')
  const [linkId, setLinkId] = useState('')
  const [linkStatus, setLinkStatus] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState('')
  const [deleteTrash, setDeleteTrash] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const DB_TIERS = ['1순위', '2순위', '3순위', '4순위', '5순위']
  const SPINNER_HTML = '<div class="fstat"><div class="fstat-val"><span class="spinner spinner--sm"></span></div><div class="fstat-lbl">로딩 중</div></div>'

  useEffect(() => {
    const id = setInterval(() => setClock(getKrTime()), 1000)
    return () => clearInterval(id)
  }, [])

  const loadListupStats = useCallback(async () => {
    try {
      const data: Record<string, { stats?: { total?: number; totalFollowers?: number } }> = await gasGet('getInfluencerList')
      if ((data as { error?: string }).error) { setStatsListup(statError((data as { error?: string }).error!)); return }
      let total = 0, totalF = 0
      DB_TIERS.forEach(t => { const d = data[t] || {}; total += d.stats?.total || 0; totalF += d.stats?.totalFollowers || 0 })
      setStatsListup(`<div class="fstat"><div class="fstat-val" style="color:var(--yellow-text)">${total}</div><div class="fstat-lbl">인플루언서</div></div><div class="fstat"><div class="fstat-val">${fmtNum(totalF)}</div><div class="fstat-lbl">총 팔로워</div></div>`)
    } catch (e: unknown) { setStatsListup(statError((e as Error).message)) }
  }, [])

  const loadOutreachStats = useCallback(async () => {
    try {
      const data: Record<string, { stats?: { total?: number; sent?: number; replied?: number } }> = await gasGet('getOutreachData')
      if ((data as { error?: string }).error) { setStatsOutreach(statError((data as { error?: string }).error!)); return }
      let total = 0, sent = 0, replied = 0
      DB_TIERS.forEach(t => { const s = (data[t] || {}).stats || {}; total += s.total || 0; sent += s.sent || 0; replied += s.replied || 0 })
      const pct = total > 0 ? Math.round(sent / total * 100) : 0
      setStatsOutreach(`<div class="fstat"><div class="fstat-val" style="color:var(--green)">${sent}</div><div class="fstat-lbl">발송 완료</div></div><div class="fstat"><div class="fstat-val">${total - sent}</div><div class="fstat-lbl">미발송</div></div><div class="fstat"><div class="fstat-val" style="color:#d97706">${replied}</div><div class="fstat-lbl">답장 수신</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${pct}%</div><div class="fstat-lbl">발송률</div></div>`)
    } catch (e: unknown) { setStatsOutreach(statError((e as Error).message)) }
  }, [])

  const loadEmsStats = useCallback(async () => {
    try {
      const data: { error?: string; stats?: { delivered?: number; inTransit?: number; total?: number } } = await gasGet('getEmsData')
      if (data.error) { setStatsEms(statError(data.error)); return }
      const s = data.stats || {}
      setStatsEms(`<div class="fstat"><div class="fstat-val" style="color:var(--green)">${s.delivered || 0}</div><div class="fstat-lbl">배송 완료</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${s.inTransit || 0}</div><div class="fstat-lbl">배송 중</div></div><div class="fstat"><div class="fstat-val">${s.total || 0}</div><div class="fstat-lbl">전체</div></div>`)
    } catch (e: unknown) { setStatsEms(statError((e as Error).message)) }
  }, [])

  const loadMonitoringStats = useCallback(async () => {
    try {
      const data: { stats?: { totalInfluencers?: number; mentions?: number }; rows?: unknown[] } = await gasGet('getMonitoringData')
      const s = data.stats || {}
      const total = s.totalInfluencers ?? (data.rows || []).length
      const mentioned = s.mentions || 0
      setStatsMonitoring(`<div class="fstat"><div class="fstat-val">${total}</div><div class="fstat-lbl">모니터링 중</div></div><div class="fstat"><div class="fstat-val" style="color:var(--blue-dk)">${mentioned}</div><div class="fstat-lbl">MiMuse 언급</div></div>`)
    } catch (e: unknown) { setStatsMonitoring(statError((e as Error).message)) }
  }, [])

  const loadPhaseInfo = useCallback(async () => {
    try {
      const data: PhaseInfo = await gasGet('getPhaseInfo')
      if (!data.ok) return
      setPhaseInfo(data)
      setActiveDbId((data.activeOutreachId || '').trim())
    } catch {}
  }, [])

  function statError(msg: string) {
    return `<div style="font-size:11px;color:#c00">오류: ${String(msg).substring(0, 60)}</div>`
  }

  function reloadAll() {
    setStatsListup(SPINNER_HTML)
    setStatsOutreach(SPINNER_HTML)
    setStatsEms(SPINNER_HTML)
    setStatsMonitoring(SPINNER_HTML)
    loadListupStats()
    loadOutreachStats()
    loadEmsStats()
    loadMonitoringStats()
  }

  useEffect(() => {
    loadPhaseInfo()
    loadListupStats()
    loadOutreachStats()
    loadEmsStats()
    loadMonitoringStats()
  }, [])

  async function switchDatabase(id: string) {
    if (!id || id === activeDbId) return
    // Set spinners only — do NOT start loads yet (race condition: old GETs can overwrite new data)
    setStatsListup(SPINNER_HTML)
    setStatsOutreach(SPINNER_HTML)
    setStatsEms(SPINNER_HTML)
    setStatsMonitoring(SPINNER_HTML)
    try {
      const r: { error?: string } = await gasPost({ action: 'setActiveDatabase', outreachId: id })
      if (r.error) { showToast(r.error, 'error'); return }
      setActiveDbId(id)
      await Promise.all([loadListupStats(), loadOutreachStats(), loadEmsStats(), loadMonitoringStats(), loadPhaseInfo()])
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
  }

  async function confirmNewPhase() {
    const name = newPhaseName.trim()
    if (!name) return
    setNewPhaseLoading(true)
    setNewPhaseStatus('새 스프레드시트 생성 중... (약 10~20초 소요)')
    try {
      const result: { error?: string } = await gasPost({ action: 'createNewPhase', phaseName: name })
      if (result.error) { setNewPhaseStatus('오류: ' + result.error); return }
      setNewPhaseStatus('완료! 데이터를 새 DB 기준으로 불러옵니다…')
      await loadPhaseInfo()
      reloadAll()
      setTimeout(() => {
        setShowNewPhase(false)
        setNewPhaseName('')
        setNewPhaseStatus('')
        showToast(`「${name}」 생성되었습니다`, 'success')
      }, 600)
    } catch (err: unknown) {
      setNewPhaseStatus('오류: ' + (err as Error).message)
    } finally {
      setNewPhaseLoading(false)
    }
  }

  async function confirmLinkPhase() {
    const name = linkName.trim()
    if (!name) return
    setLinkLoading(true)
    setLinkStatus('연결 중...')
    try {
      const result: { error?: string } = await gasPost({ action: 'linkPhase', phaseName: name, outreachId: linkId.trim() || undefined })
      if (result.error) { setLinkStatus('오류: ' + result.error); return }
      setLinkStatus('완료!')
      await loadPhaseInfo()
      setTimeout(() => {
        setShowLinkPhase(false)
        setLinkName('')
        setLinkId('')
        setLinkStatus('')
        showToast(`「${name}」 연결 완료`, 'success')
      }, 500)
    } catch (e: unknown) {
      setLinkStatus('오류: ' + (e as Error).message)
    } finally {
      setLinkLoading(false)
    }
  }

  async function executeDeletePhase() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const r: { error?: string } = await gasPost({ action: 'deletePhase', phaseName: deleteTarget, trashSheet: deleteTrash })
      setShowDeleteModal(false)
      if (r.error) { showToast(r.error, 'error'); return }
      showToast(`「${deleteTarget}」 삭제 완료`, 'success')
      reloadAll()
      await loadPhaseInfo()
    } catch (e: unknown) {
      setShowDeleteModal(false)
      showToast((e as Error).message, 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const active = phaseInfo?.activePhase || '—'
  const phases = phaseInfo?.phases || []
  const phase1Id = (phaseInfo?.phase1SheetId || '').trim()
  const archived = phases.filter(p => p.name !== active).sort((a, b) => phaseNum(b.name || '') - phaseNum(a.name || ''))
  const activeNum = phaseNum(active)
  const prevPhase = archived.find(p => phaseNum(p.name || '') === activeNum - 1) ||
    (activeNum - 1 === 1 && phase1Id ? { name: '1차', outreachId: phase1Id } : null)

  const dbOptions = phaseInfo ? buildPhaseDbOptions(phaseInfo) : []

  const phaseList = [...phases]
  if (phase1Id && !phaseList.find(p => p.name === '1차')) phaseList.push({ name: '1차', outreachId: phase1Id })
  phaseList.sort((a, b) => phaseNum(b.name || '') - phaseNum(a.name || ''))

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero">
        <div>
          <div className="hero-eyebrow">
            <span className="hero-live-pill">LIVE</span>
            <span className="hero-eyebrow-text">인플루언서 마케팅 자동화 시스템</span>
          </div>
          <h1>MiMuse 자동화 대시보드</h1>
          <p>차수별 인플루언서 마케팅 현황을 한눈에 확인하세요</p>
        </div>
        <div className="hero-clock">
          <div className="hero-clock-date">{clock.date}</div>
          <div className="hero-clock-time">{clock.time}</div>
          <div className="hero-clock-tz">Korea Standard Time</div>
        </div>
        <span className="hero-deco" aria-hidden="true">📊</span>
      </div>

      {/* Phase bar */}
      <div className="phase-bar">
        <div className="pb-top">
          <div className="phase-label-group">
            <span className="phase-now-label">현재 차수</span>
            <span className="phase-badge">{active}</span>
          </div>
          <div className="phase-history">
            {!phaseInfo && <Spinner sm />}
            {prevPhase && (
              <>
                <span className="phase-history-label">이전 차수</span>
                <span className="phase-chip-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
                  <a
                    className="phase-chip"
                    href={prevPhase.outreachId ? `https://docs.google.com/spreadsheets/d/${prevPhase.outreachId}` : '#'}
                    target="_blank" rel="noopener"
                    style={{ textDecoration: 'none' }}
                  >
                    ↗ {prevPhase.name}
                  </a>
                </span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="new-phase-btn" onClick={() => setShowNewPhase(true)}>+ 새 차수 시작</button>
            <button className="new-phase-btn" style={{ background: 'var(--gray-1)', color: 'var(--gray-6)', border: '1px solid var(--gray-3)' }}
              onClick={() => { setShowLinkPhase(true); setLinkName(''); setLinkId('') }}>
              🔗 기존 DB 연결
            </button>
          </div>
        </div>

        {phaseInfo && (
          <div className="pb-tools" style={{ display: 'flex' }}>
            <div className="phase-db-wrap">
              <span className="phase-db-label">대시보드 DB</span>
              <select
                className="phase-db-select"
                value={activeDbId}
                onChange={e => switchDatabase(e.target.value)}
              >
                {dbOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            {phaseList.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
                <span className="phase-danger-label">차수 삭제</span>
                <select
                  className="phase-db-select"
                  style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                  value=""
                  onChange={e => {
                    const name = decodeURIComponent(e.target.value)
                    if (name) { setDeleteTarget(name); setDeleteTrash(false); setShowDeleteModal(true) }
                  }}
                >
                  <option value="" disabled>기록에서 제거…</option>
                  {phaseList.map(p => (
                    <option key={p.name} value={encodeURIComponent(p.name || '')}>{p.name}</option>
                  ))}
                </select>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div className="section-title--dash">데이터</div>
      <div className="features-grid features-grid--4">
        <Link className="feature-card highlight" to="/listup">
          <div className="feature-card-header">
            <div className="feature-icon">📋</div>
            <div>
              <div className="feature-title">인플루언서 리스트업</div>
              <div className="feature-desc">TikTok 크리에이터 탐색 및 인플루언서 데이터베이스 관리</div>
            </div>
          </div>
          <StatCell html={statsListup} />
          <div className="feature-go">데이터베이스 보기</div>
        </Link>

        <Link className="feature-card" to="/outreach">
          <div className="feature-card-header">
            <div className="feature-icon">📧</div>
            <div>
              <div className="feature-title">아웃리치</div>
              <div className="feature-desc">이메일 발송 현황 및 인플루언서 컨택 관리</div>
            </div>
          </div>
          <StatCell html={statsOutreach} />
          <div className="feature-go">아웃리치 보기</div>
        </Link>

        <Link className="feature-card green-top" to="/ems">
          <div className="feature-card-header">
            <div className="feature-icon">📦</div>
            <div>
              <div className="feature-title">EMS 배송 트래킹</div>
              <div className="feature-desc">국제 배송 현황 실시간 추적 (17track API)</div>
            </div>
          </div>
          <StatCell html={statsEms} />
          <div className="feature-go">배송 현황 보기</div>
        </Link>

        <Link className="feature-card" to="/monitoring">
          <div className="feature-card-header">
            <div className="feature-icon">📊</div>
            <div>
              <div className="feature-title">인플루언서 모니터링</div>
              <div className="feature-desc">콘텐츠 성과 및 MiMuse 언급 모니터링</div>
            </div>
          </div>
          <StatCell html={statsMonitoring} />
          <div className="feature-go">모니터링 보기</div>
        </Link>
      </div>

      {/* New Phase Modal */}
      <Modal open={showNewPhase} onClose={() => { setShowNewPhase(false); setNewPhaseName(''); setNewPhaseStatus('') }} title="새 차수 시작">
        <div className="modal-desc">
          현재 차수 데이터는 <strong>Google Sheets에 그대로 보관</strong>됩니다.<br />
          새 빈 데이터베이스(스프레드시트)가 자동 생성됩니다.
        </div>
        <label className="modal-label">새 차수 이름</label>
        <input
          className="modal-input"
          type="text"
          placeholder="예: 3차, Q3-2025"
          maxLength={30}
          value={newPhaseName}
          onChange={e => setNewPhaseName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmNewPhase() }}
          autoFocus
        />
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => { setShowNewPhase(false); setNewPhaseName(''); setNewPhaseStatus('') }}>취소</button>
          <button className="modal-btn-confirm" onClick={confirmNewPhase} disabled={newPhaseLoading}>
            {newPhaseLoading ? '생성 중...' : '생성'}
          </button>
        </div>
        {newPhaseStatus && (
          <div className="modal-status" style={{ color: newPhaseStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>
            {newPhaseStatus}
          </div>
        )}
      </Modal>

      {/* Link Existing DB Modal */}
      <Modal open={showLinkPhase} onClose={() => { setShowLinkPhase(false); setLinkName(''); setLinkId(''); setLinkStatus('') }} title="기존 DB 연결">
        <div className="modal-desc">
          새 스프레드시트를 만들지 않고 <strong>기존 Google Sheets</strong>를 차수로 등록합니다.<br />
          스프레드시트 ID를 비워두면 <strong>1차 데이터베이스</strong>로 연결됩니다.
        </div>
        <label className="modal-label">차수 이름</label>
        <input
          className="modal-input"
          type="text"
          placeholder="예: 테스트용, 1.5차"
          maxLength={30}
          value={linkName}
          onChange={e => setLinkName(e.target.value)}
          autoFocus
        />
        <label className="modal-label" style={{ marginTop: 10 }}>스프레드시트 ID <span style={{ fontWeight: 400, color: 'var(--gray-5)' }}>(비우면 1차 DB 사용)</span></label>
        <input
          className="modal-input"
          type="text"
          placeholder="Google Sheets 스프레드시트 ID"
          value={linkId}
          onChange={e => setLinkId(e.target.value)}
        />
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => { setShowLinkPhase(false); setLinkName(''); setLinkId(''); setLinkStatus('') }}>취소</button>
          <button className="modal-btn-confirm" onClick={confirmLinkPhase} disabled={linkLoading || !linkName.trim()}>
            {linkLoading ? '연결 중...' : '연결'}
          </button>
        </div>
        {linkStatus && (
          <div className="modal-status" style={{ color: linkStatus.startsWith('오류') ? '#c00' : 'var(--green)' }}>
            {linkStatus}
          </div>
        )}
      </Modal>

      {/* Delete Phase Modal */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="차수 삭제" titleColor="var(--red)">
        <div className="modal-desc"
          dangerouslySetInnerHTML={{ __html: `「<strong>${escHtml(deleteTarget)}</strong>」 차수 데이터베이스를 삭제하시겠습니까?` }}
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--red)', cursor: 'pointer' }}>
          <input type="checkbox" checked={deleteTrash} onChange={e => setDeleteTrash(e.target.checked)} style={{ width: 15, height: 15 }} />
          시트도 삭제 (Google Drive 휴지통으로 이동)
        </label>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="modal-btn-cancel" onClick={() => setShowDeleteModal(false)}>취소</button>
          <button
            className="modal-btn-confirm"
            style={{ background: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={executeDeletePhase}
            disabled={deleteLoading}
          >
            {deleteLoading ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
