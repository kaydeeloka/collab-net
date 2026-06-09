import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ListFilter } from 'lucide-react'
import { gasPost } from '../../../lib/api'
import { supabase } from '../../../lib/supabase'
import { usePhase } from '../../../contexts/PhaseContext'
import { fmtNum } from '../../../lib/utils'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Pagination from '../../../components/Pagination'
import ConfirmToast, { useConfirmToast } from '../../../components/ConfirmToast'

// ─── Constants ────────────────────────────────────────────────────────────────
const TIERS = ['1순위', '2순위', '3순위', '4순위', '5순위']

const TIER_COLOR: Record<string, string> = {
  '1순위': '#6366f1',
  '2순위': '#10b981',
  '3순위': '#3b82f6',
  '4순위': '#f59e0b',
  '5순위': '#ec4899',
}

const STATUS_OPTIONS = [
  { value: '',         label: '컨택 예정', bg: '#e0f2fe', color: '#0369a1' },
  { value: 'target',   label: '컨택 예정', bg: '#e0f2fe', color: '#0369a1' },
  { value: 'yes',      label: '보냄',     bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'noreply',  label: '미회신',   bg: '#f1f5f9', color: '#64748b' },
  { value: 'reply',    label: '단순 회신', bg: '#fef3c7', color: '#d97706' },
  { value: 'positive', label: '긍정 검토', bg: '#d1fae5', color: '#065f46' },
  { value: 'negative', label: '부정 검토', bg: '#fee2e2', color: '#991b1b' },
  { value: 'reject',   label: '거절',     bg: '#fecaca', color: '#dc2626' },
  { value: 'accept',   label: '확정',     bg: '#bbf7d0', color: '#14532d' },
  { value: 'paid',     label: '유가 협업', bg: '#ede9fe', color: '#7c3aed' },
]
const STATUS_STYLE = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, { bg: s.bg, color: s.color }]))

const CONTACT_ROUNDS = ['미컨택', '1차 컨택', '2차 컨택']

const ROUND_COLOR: Record<string, { bg: string; color: string }> = {
  '미컨택':   { bg: '#f1f5f9', color: '#94a3b8' },
  '1차 컨택': { bg: '#dbeafe', color: '#1d4ed8' },
  '2차 컨택': { bg: '#ede9fe', color: '#7c3aed' },
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Influencer {
  id: string
  handle: string
  display_name: string | null
  email: string | null
  followers: number
  following: number
  following_ratio: string | null
  video_count: number
  engagement_rate: number
  profile_url: string | null
  outreach: string
  status: string | null
  contact_round: string | null
  first_sent_at: string | null
  reply_count: number | null
  progress_stage: string | null
  progress_count: number | null
  memo: string | null
  tiers: { rank: string; label: string; category: string } | null
}

// ─── Templates ────────────────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: 'temp_01',
    name: '[선물증정] 신제품 론칭 패키지 기프트 제안',
    subject: '[MiMuse] {{이름}}님, 미뮤즈 가을 시즌 신제품 VIP 기프트 증정 제안',
    body: `안녕하세요 {{이름}}님!\n프리미엄 뷰티 브랜드 MiMuse(미뮤즈) 글로벌 커뮤니케이션 팀입니다.\n\n평소 {{이름}}님의 TikTok 채널({{핸들}})을 통해 전달하시는 세련된 감성과 독창적인 리뷰 스타일에 깊은 인상을 받았습니다.\n\n이번 론칭하는 수분 세럼 패키지를 맞이하여 기프팅 선물을 전달드리고자 메일 드립니다.\n\n배송을 위해 성함, 연락처, 배송 정보를 회신 주시면 조속히 발송하겠습니다.\n\nMiMuse 드림.`,
  },
  {
    id: 'temp_02',
    name: '[리마인더] 1차 기프트 제안 리마인더',
    subject: '[MiMuse] {{이름}}님, 이전 기프트 패키지 증정 관련 재문의',
    body: `안녕하세요 {{이름}}님, MiMuse 글로벌 팀입니다.\n\n이전 메일을 통해 전달해 드렸던 신제품 선물 기프팅 제안에 대해 재문의 드립니다.\n\n{{이름}}님 채널({{핸들}})이 저희 제품과 잘 어울릴 것 같아 특별히 연락드립니다.\n\n배송 정보를 회신 주시면 즉시 절차를 진행하겠습니다.\n감사합니다.`,
  },
]

function loadTemplates() {
  try { const v = localStorage.getItem('mm_email_templates'); return v ? JSON.parse(v) : DEFAULT_TEMPLATES } catch { return DEFAULT_TEMPLATES }
}
function saveTemplates(t: typeof DEFAULT_TEMPLATES) {
  localStorage.setItem('mm_email_templates', JSON.stringify(t))
}

const DUMMY_VALUES: Record<string, { value: string; color: string }> = {
  '{{이름}}':   { value: 'MiMuse Creator',    color: '#a07800' },
  '{{핸들}}':   { value: '@mimuse_creator',    color: '#0369a1' },
  '{{이메일}}': { value: 'creator@mimuse.com', color: '#b45309' },
  '{{팔로워}}': { value: '42,800',             color: '#065f46' },
  '{{조회수}}': { value: '18,500',             color: '#be123c' },
}
function renderWithDummy(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text; let key = 0
  while (remaining.length > 0) {
    let earliest = -1, earliestTag = ''
    for (const tag of Object.keys(DUMMY_VALUES)) {
      const idx = remaining.indexOf(tag)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) { earliest = idx; earliestTag = tag }
    }
    if (earliest === -1) { parts.push(remaining); break }
    if (earliest > 0) parts.push(remaining.slice(0, earliest))
    const d = DUMMY_VALUES[earliestTag]
    parts.push(<span key={key++} style={{ background: d.color + '18', color: d.color, fontWeight: 700, borderRadius: 4, padding: '0 3px', fontSize: '0.95em' }}>{d.value}</span>)
    remaining = remaining.slice(earliest + earliestTag.length)
  }
  return parts
}

function applyPlaceholders(text: string, inf: Influencer | null) {
  if (!inf) return text
  return text
    .replace(/\{\{이름\}\}/g, inf.display_name || inf.handle)
    .replace(/\{\{핸들\}\}/g,  '@' + inf.handle)
    .replace(/\{\{이메일\}\}/g, inf.email || '')
    .replace(/\{\{팔로워\}\}/g, fmtNum(String(inf.followers)))
    .replace(/\{\{조회수\}\}/g,  '—')
}

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Outreach() {
  const { showToast }     = useToast()
  const { activePhaseId } = usePhase()
  const confirmToast      = useConfirmToast()

  // ── Data ──
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading,     setLoading]     = useState(true)

  // ── Filter / pagination ──
  const [activeTier,    setActiveTier]    = useState('전체')
  const [statusFilter,     setStatusFilter]     = useState('')
  const [roundFilter,      setRoundFilter]      = useState('')
  const [showRoundFilter,  setShowRoundFilter]  = useState(false)
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [page,             setPage]             = useState(1)
  const roundFilterRef  = useRef<HTMLDivElement>(null)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  // ── Bulk / template ──
  const [checkedIds,      setCheckedIds]      = useState<Set<string>>(new Set())
  const [bulkTplIdx,      setBulkTplIdx]      = useState(0)
  const [bulkSending,     setBulkSending]     = useState(false)
  const [showBulkPreview, setShowBulkPreview] = useState(false)
  const [templates,       setTemplates]       = useState(loadTemplates)

  // ── Memo inline edits ──
  const [memoEdits, setMemoEdits] = useState<Record<string, string>>({})
  const memoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Load ──
  const loadInfluencers = useCallback(async () => {
    if (!activePhaseId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('influencers')
      .select('id, handle, display_name, email, followers, following, following_ratio, video_count, engagement_rate, profile_url, outreach, status, contact_round, first_sent_at, reply_count, progress_stage, progress_count, memo, tiers(rank, label, category)')
      .eq('phase_id', activePhaseId)
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    const targetStatuses = ['', 'target', null]
    const corrected = (data ?? []).map((r: any) =>
      !targetStatuses.includes(r.status) && (r.contact_round ?? '미컨택') === '미컨택'
        ? { ...r, contact_round: '1차 컨택' }
        : r
    )
    // persist corrections to DB
    const toFix = corrected.filter((r: any, i: number) => r.contact_round !== (data as any[])[i].contact_round)
    if (toFix.length > 0) {
      await supabase.from('influencers').upsert(toFix.map((r: any) => ({ id: r.id, contact_round: '1차 컨택' })))
    }
    setInfluencers(corrected as unknown as Influencer[])
    setLoading(false)
  }, [activePhaseId])

  useEffect(() => { loadInfluencers() }, [loadInfluencers])

  useEffect(() => {
    if (!showRoundFilter && !showStatusFilter) return
    const handler = (e: MouseEvent) => {
      if (roundFilterRef.current && !roundFilterRef.current.contains(e.target as Node)) setShowRoundFilter(false)
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setShowStatusFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRoundFilter, showStatusFilter])


  // ── Field update helpers ──
  const updateField = useCallback(async (id: string, patch: Partial<Influencer>) => {
    const inf = influencers.find(r => r.id === id)
    const finalPatch = { ...patch }

    // stamp first_sent_at once when status becomes 'yes' (보냄)
    if (patch.status === 'yes' && inf && !inf.first_sent_at) {
      finalPatch.first_sent_at = new Date().toISOString()
    }

    // increment reply_count when status moves to a reply-type value
    const replyStatuses = ['reply', 'positive', 'negative']
    if (patch.status && replyStatuses.includes(patch.status) && inf?.status && !replyStatuses.includes(inf.status)) {
      finalPatch.reply_count = (inf.reply_count ?? 0) + 1
    }

    // auto-upgrade contact_round from 미컨택 → 1차 컨택 when status is no longer 컨택 예정
    const targetStatuses = ['', 'target']
    if (patch.status && !targetStatuses.includes(patch.status) && (inf?.contact_round ?? '미컨택') === '미컨택' && !patch.contact_round) {
      finalPatch.contact_round = '1차 컨택'
    }

    const { error } = await supabase.from('influencers').update(finalPatch).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setInfluencers(prev => prev.map(r => r.id === id ? { ...r, ...finalPatch } : r))
  }, [showToast, influencers])

  const updateMemo = useCallback((id: string, value: string) => {
    setMemoEdits(prev => ({ ...prev, [id]: value }))
    if (memoTimers.current[id]) clearTimeout(memoTimers.current[id])
    memoTimers.current[id] = setTimeout(() => {
      updateField(id, { memo: value })
    }, 800)
  }, [updateField])

  // ── Derived ──
  const filtered = influencers
    .filter(r => {
      if (activeTier !== '전체' && r.tiers?.rank !== activeTier) return false
      if (statusFilter && (r.status ?? '') !== statusFilter) return false
      if (roundFilter && (r.contact_round ?? '미컨택') !== roundFilter) return false
      return true
    })
    .sort((a, b) => {
      const aAccepted = (a.status ?? '') === 'accept' ? 1 : 0
      const bAccepted = (b.status ?? '') === 'accept' ? 1 : 0
      return aAccepted - bAccepted
    })
  const pg = paginate(filtered, page)

  const sentCount    = influencers.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.outreach)).length
  const repliedCount = influencers.filter(r => ['reply','negotiate'].includes(r.outreach)).length
  const tierBreakdown = TIERS.map(t => {
    const all  = influencers.filter(r => r.tiers?.rank === t)
    const sent = all.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.outreach)).length
    return { tier: t, count: all.length, sent }
  })

  const thBase: React.CSSProperties = {
    padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'var(--gray-1)', borderBottom: '2px solid var(--gray-3)',
    position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap',
  }

  return (
    <div className="page page--fill" style={{ paddingLeft: 28, paddingRight: 28 }}>

      {/* ── Banner ── */}
      <div style={{ background: 'var(--blue-lt)', border: '1px solid rgba(159,186,197,.4)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue-dk)', marginBottom: 4 }}>인플루언서 컨택 관리</h1>
          <p style={{ fontSize: 13, color: '#555' }}>컨택 차수와 상태를 관리하고 일괄 발송합니다.</p>
        </div>
        <button onClick={() => { loadInfluencers(); setCheckedIds(new Set()) }}
          style={{ padding: '7px 14px', background: '#fff', color: '#334', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid var(--gray-3)', cursor: 'pointer' }}>
          ↻ 새로고침
        </button>
      </div>

      {/* ── Stats ── */}
      {loading && <div className="loader"><Spinner /></div>}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>전체 타겟 리스트</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{influencers.length}</span>
              <span style={{ fontSize: 14, color: 'var(--gray-5)' }}>명</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {tierBreakdown.map((t, i) => {
                const color = TIER_COLOR[t.tier]
                return (
                  <span key={t.tier}>
                    {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                    <span style={{ color }}>{t.tier.replace('순위', '')}순위 <strong>{t.sent}/{t.count}</strong></span>
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>발송 성과율</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{sentCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>/ {influencers.length} 발송됨</span>
            </div>
            <div style={{ height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${influencers.length > 0 ? Math.min(sentCount / influencers.length * 100, 100) : 0}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{influencers.length > 0 ? Math.round(sentCount / influencers.length * 100) : 0}% 완료</div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--yellow-md)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>답장 수신 통계</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-1px' }}>{repliedCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명 답장</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {sentCount > 0 ? Math.round(repliedCount / sentCount * 100) : 0}% 회신율
            </div>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Tier buttons */}
        {['전체', ...TIERS].map(t => {
          const active = activeTier === t
          const color = t === '전체' ? '#64748b' : (TIER_COLOR[t] ?? '#64748b')
          return (
            <button key={t} onClick={() => { setActiveTier(t); setPage(1) }}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `2px solid ${active ? color : 'transparent'}`,
                background: active ? color : 'var(--gray-1)',
                color: active ? '#fff' : 'var(--gray-5)',
                transition: 'all .15s',
              }}>
              {t}
              {t !== '전체' && (
                <span style={{ marginLeft: 5, opacity: 0.8, fontSize: 11 }}>
                  {influencers.filter(r => r.tiers?.rank === t).length}
                </span>
              )}
            </button>
          )
        })}

      </div>

      {/* ── Table ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>

        {/* Bulk toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--gray-2)', background: checkedIds.size > 0 ? '#f0f5ff' : 'var(--gray-0)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, minWidth: 70, color: checkedIds.size > 0 ? 'var(--blue-dk)' : 'var(--gray-4)' }}>
            {checkedIds.size > 0 ? `${checkedIds.size}명 선택됨` : '선택 없음'}
          </span>
          <div style={{ width: 1, height: 18, background: 'var(--gray-3)', flexShrink: 0 }} />
          <select value={bulkTplIdx} onChange={e => setBulkTplIdx(+e.target.value)}
            style={{ flex: 1, minWidth: 160, maxWidth: 300, fontSize: 12, border: '1px solid var(--gray-3)', borderRadius: 7, padding: '5px 10px', background: '#fff', outline: 'none', fontFamily: 'inherit', color: 'var(--gray-7)' }}>
            {templates.map((t: any, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
          </select>
          <button onClick={() => setShowBulkPreview(true)}
            style={{ padding: '5px 12px', background: '#fff', color: 'var(--gray-7)', border: '1px solid var(--gray-3)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: 'auto' }}>
            미리보기
          </button>
          <button disabled={bulkSending || checkedIds.size === 0}
            onClick={() => {
              const tpl = templates[bulkTplIdx]
              if (!tpl) return
              confirmToast.show(`${checkedIds.size}명에게 일괄 발송하시겠습니까?`, async () => {
                setBulkSending(true)
                const ids = Array.from(checkedIds)
                for (const id of ids) {
                  const inf = filtered.find(r => r.id === id)
                  if (!inf || !inf.email) continue
                  await gasPost({ action: 'sendOutreachEmail', to: inf.email, subject: applyPlaceholders(tpl.subject, inf), body: applyPlaceholders(tpl.body, inf) })
                  const nextRound = (inf.contact_round ?? '미컨택') === '미컨택' ? '1차 컨택' : '2차 컨택'
                  await updateField(id, { contact_round: nextRound, status: 'yes' })
                }
                setBulkSending(false); setCheckedIds(new Set())
                showToast(`${ids.length}명에게 발송 완료`, 'success')
              })
            }}
            style={{ padding: '5px 14px', background: checkedIds.size === 0 ? 'var(--gray-2)' : 'var(--blue-dk)', color: checkedIds.size === 0 ? 'var(--gray-5)' : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: checkedIds.size === 0 ? 'default' : 'pointer', opacity: checkedIds.size === 0 ? 0.55 : 1, flexShrink: 0 }}>
            {bulkSending ? '발송 중...' : '일괄 발송'}
          </button>
          {checkedIds.size > 0 && (
            <button onClick={() => setCheckedIds(new Set())}
              style={{ padding: '5px 10px', background: 'transparent', color: 'var(--gray-5)', border: '1px solid var(--gray-3)', borderRadius: 7, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
              선택 해제
            </button>
          )}
        </div>
        {loading
          ? <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span></div>
          : <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    {/* Checkbox */}
                    <th style={{ ...thBase, width: 36, padding: '9px 8px', textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={pg.pageItems.length > 0 && pg.pageItems.every(r => checkedIds.has(r.id))}
                        onChange={e => setCheckedIds(prev => {
                          const next = new Set(prev)
                          pg.pageItems.forEach(r => e.target.checked ? next.add(r.id) : next.delete(r.id))
                          return next
                        })} />
                    </th>
                    {/* 이름 */}
                    <th style={{ ...thBase, minWidth: 180 }}>이름</th>
                    {/* 이메일 */}
                    <th style={{ ...thBase, minWidth: 160 }}>이메일</th>
                    {/* 팔로워 */}
                    <th style={{ ...thBase, textAlign: 'right', minWidth: 80 }}>팔로워</th>
                    {/* 상태 */}
                    <th style={{ ...thBase, minWidth: 140 }}>
                      <div ref={statusFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                        <span>상태</span>
                        <button onClick={() => { setShowStatusFilter(p => !p); setShowRoundFilter(false) }}
                          title="상태 필터"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: statusFilter ? (STATUS_STYLE[statusFilter]?.color ?? '#64748b') : 'transparent', color: statusFilter ? '#fff' : 'var(--gray-4)', cursor: 'pointer', padding: 0 }}>
                          <ListFilter size={13} />
                        </button>
                        {showStatusFilter && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 140, marginTop: 4 }}>
                            {[{ value: '', label: '전체' }, ...STATUS_OPTIONS.filter(o => o.value !== '')].map(o => (
                              <button key={o.value} onClick={() => { setStatusFilter(o.value); setShowStatusFilter(false); setPage(1) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: statusFilter === o.value ? 700 : 500, background: statusFilter === o.value ? ((STATUS_STYLE[o.value]?.bg) ?? '#f1f5f9') : 'transparent', color: statusFilter === o.value ? ((STATUS_STYLE[o.value]?.color) ?? 'var(--gray-7)') : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    {/* 현황 */}
                    <th style={{ ...thBase, minWidth: 90 }}>현황</th>
                    {/* 컨택 차수 */}
                    <th style={{ ...thBase, minWidth: 160 }}>
                      <div ref={roundFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                        <span>컨택 차수</span>
                        <button onClick={() => { setShowRoundFilter(p => !p); setShowStatusFilter(false) }}
                          title="컨택 차수 필터"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: roundFilter ? '#1d4ed8' : 'transparent', color: roundFilter ? '#fff' : 'var(--gray-4)', cursor: 'pointer', padding: 0 }}>
                          <ListFilter size={13} />
                        </button>
                        {showRoundFilter && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 140, marginTop: 4 }}>
                            {['', ...CONTACT_ROUNDS].map(r => (
                              <button key={r} onClick={() => { setRoundFilter(r); setShowRoundFilter(false); setPage(1) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: roundFilter === r ? 700 : 500, background: roundFilter === r ? '#dbeafe' : 'transparent', color: roundFilter === r ? '#1d4ed8' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {r === '' ? '전체' : r}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    {/* 비고 */}
                    <th style={{ ...thBase, minWidth: 180 }}>비고</th>
                    {/* 액션 */}
                    <th style={{ ...thBase, textAlign: 'right', minWidth: 90 }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>
                      데이터가 없습니다.
                    </td></tr>
                  )}
                  {pg.pageItems.map(inf => {
                    const status     = inf.status ?? ''
                    const round      = inf.contact_round ?? '미컨택'
                    const roundStyle = ROUND_COLOR[round] ?? ROUND_COLOR['미컨택']
                    const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE['']
                    const tc = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                    const memoVal = memoEdits[inf.id] !== undefined ? memoEdits[inf.id] : (inf.memo ?? '')
                    return (
                      <tr key={inf.id} style={{ borderBottom: '1px solid var(--gray-2)', borderLeft: tc ? `3px solid ${tc}` : undefined, height: 48 }}>
                        {/* Checkbox */}
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <input type="checkbox" checked={checkedIds.has(inf.id)} onChange={e => {
                            const next = new Set(checkedIds); e.target.checked ? next.add(inf.id) : next.delete(inf.id); setCheckedIds(next)
                          }} />
                        </td>
                        {/* 이름 + 핸들 */}
                        <td style={{ padding: '0 12px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{inf.display_name || inf.handle}</div>
                          {inf.handle && <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500 }}>@{inf.handle}</a>}
                        </td>
                        {/* 이메일 */}
                        <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, verticalAlign: 'middle' }}>
                          {inf.email || '—'}
                        </td>
                        {/* 팔로워 */}
                        <td style={{ padding: '0 12px', fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--gray-7)', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                          {fmtNum(String(inf.followers))}
                        </td>
                        {/* 상태 */}
                        <td style={{ padding: '0 10px', verticalAlign: 'middle' }}>
                          <select value={status} onChange={e => updateField(inf.id, { status: e.target.value })}
                            style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${statusStyle.color}55`, borderRadius: 20, padding: '3px 8px', background: statusStyle.bg, color: statusStyle.color, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        {/* 현황 */}
                        <td style={{ padding: '0 10px', verticalAlign: 'middle' }}>
                          {inf.first_sent_at
                            ? <span style={{ fontSize: 10, background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '2px 6px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {(() => { const d = new Date(inf.first_sent_at); return `${d.getMonth() + 1}/${d.getDate()}` })()}
                                {(inf.reply_count ?? 0) > 0 && <span style={{ marginLeft: 4 }}>{inf.reply_count}회</span>}
                              </span>
                            : <span style={{ fontSize: 11, color: 'var(--gray-3)' }}>—</span>
                          }
                        </td>
                        {/* 컨택 차수 + 건수 */}
                        <td style={{ padding: '0 10px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <select value={round} onChange={e => updateField(inf.id, { contact_round: e.target.value })}
                              style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${roundStyle.color}55`, borderRadius: 20, padding: '3px 8px', background: roundStyle.bg, color: roundStyle.color, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                              {CONTACT_ROUNDS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {round !== '미컨택' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <input type='number' min={1}
                                  value={inf.progress_count ?? ''}
                                  onChange={e => updateField(inf.id, { progress_count: e.target.value ? Number(e.target.value) : null })}
                                  placeholder='0'
                                  style={{ width: 36, fontSize: 11, fontWeight: 600, padding: '3px 4px', border: `1px solid ${roundStyle.color}55`, borderRadius: 6, outline: 'none', textAlign: 'center', fontFamily: 'inherit', color: roundStyle.color, background: roundStyle.bg }}
                                />
                                <span style={{ fontSize: 10, color: 'var(--gray-5)' }}>건</span>
                              </div>
                            )}
                          </div>
                        </td>
                        {/* 비고 */}
                        <td style={{ padding: '4px 10px', verticalAlign: 'middle' }}>
                          <textarea
                            value={memoVal}
                            onChange={e => updateMemo(inf.id, e.target.value)}
                            placeholder="메모 입력..."
                            rows={2}
                            style={{ width: '100%', minWidth: 140, fontSize: 12, padding: '4px 8px', border: '1px solid transparent', borderRadius: 6, background: memoVal ? 'var(--gray-0)' : 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--gray-7)', cursor: 'text', resize: 'none', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                            onFocus={e => { e.currentTarget.style.border = '1px solid var(--gray-3)'; e.currentTarget.style.background = '#fff' }}
                            onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = memoVal ? 'var(--gray-0)' : 'transparent' }}
                          />
                        </td>
                        {/* 액션 */}
                        <td style={{ padding: '0 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                          {(() => {
                            const isTerminal = ['accept', 'reject', 'paid'].includes(status)
                            const isResend   = ['yes', 'noreply'].includes(status)
                            const btnLabel   = isTerminal ? (status === 'accept' ? '확정' : status === 'reject' ? '거절' : '유가') : isResend ? '✉ 재발송' : '✉ 발송'
                            return (
                              <button
                                title={isTerminal ? '최종 확정된 상태입니다' : '이 인플루언서에게 선택된 템플릿 발송'}
                                disabled={isTerminal}
                                onClick={() => {
                                  if (isTerminal) return
                                  const tpl = templates[bulkTplIdx]
                                  if (!tpl || !inf.email) { showToast('이메일 주소가 없습니다.', 'error'); return }
                                  confirmToast.show(`${inf.display_name || inf.handle}에게 발송하시겠습니까?`, async () => {
                                    await gasPost({ action: 'sendOutreachEmail', to: inf.email!, subject: applyPlaceholders(tpl.subject, inf), body: applyPlaceholders(tpl.body, inf) })
                                    const nextRound = round === '미컨택' ? '1차 컨택' : '2차 컨택'
                                    await updateField(inf.id, { contact_round: nextRound, status: 'yes' })
                                    showToast('발송 완료', 'success')
                                  })
                                }}
                                style={{ padding: '4px 10px', background: isTerminal ? 'var(--gray-2)' : 'var(--yellow)', color: isTerminal ? 'var(--gray-5)' : 'var(--yellow-text)', border: `1px solid ${isTerminal ? 'var(--gray-3)' : 'var(--yellow-md)'}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: isTerminal ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: isTerminal ? 0.6 : 1 }}>
                                {btnLabel}
                              </button>
                            )
                          })()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total}
              startIdx={pg.startIdx} endIdx={pg.endIdx}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(pg.totalPages, p + 1))} />
          </>
        }
      </div>

      {/* ── 미리보기 모달 ── */}
      {showBulkPreview && (() => {
        const tpl = templates[bulkTplIdx]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowBulkPreview(false)}>
            <div style={{ background: '#fff', borderRadius: 16, width: 560, maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--gray-2)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>미리보기 — {tpl?.name}</span>
                <button onClick={() => setShowBulkPreview(false)}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--gray-2)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <div style={{ background: 'var(--gray-1)', padding: '12px 20px', borderBottom: '1px solid var(--gray-2)' }}>
                  <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 3 }}>보내는 사람 · MiMuse Team &lt;beautyproject@cranecomm.com&gt;</div>
                  <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 8 }}>
                    받는 사람 · <span style={{ color: DUMMY_VALUES['{{이름}}'].color, fontWeight: 700 }}>{DUMMY_VALUES['{{이름}}'].value}</span>
                    {' <'}<span style={{ color: DUMMY_VALUES['{{이메일}}'].color, fontWeight: 700 }}>{DUMMY_VALUES['{{이메일}}'].value}</span>{'>'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>{renderWithDummy(tpl?.subject || '(제목 없음)')}</div>
                </div>
                <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                  {tpl?.body ? renderWithDummy(tpl.body) : <span style={{ color: 'var(--gray-4)' }}>본문 없음</span>}
                </div>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>치환 구문은 발송 시 자동 적용됩니다</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowBulkPreview(false)}
                    style={{ padding: '6px 14px', background: 'var(--gray-1)', color: 'var(--gray-6)', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>닫기</button>
                  <button disabled={checkedIds.size === 0}
                    onClick={() => {
                      setShowBulkPreview(false)
                      const tpl2 = templates[bulkTplIdx]
                      if (!tpl2) return
                      confirmToast.show(`${checkedIds.size}명에게 일괄 발송하시겠습니까?`, async () => {
                        setBulkSending(true)
                        const ids = Array.from(checkedIds)
                        for (const id of ids) {
                          const inf = filtered.find(r => r.id === id)
                          if (!inf || !inf.email) continue
                          await gasPost({ action: 'sendOutreachEmail', to: inf.email, subject: applyPlaceholders(tpl2.subject, inf), body: applyPlaceholders(tpl2.body, inf) })
                          const nextRound = (inf.contact_round ?? '미컨택') === '미컨택' ? '1차 컨택' : '2차 컨택'
                          await updateField(id, { contact_round: nextRound })
                        }
                        setBulkSending(false); setCheckedIds(new Set())
                        showToast(`${ids.length}명에게 발송 완료`, 'success')
                      })
                    }}
                    style={{ padding: '6px 14px', background: checkedIds.size === 0 ? 'var(--gray-3)' : 'var(--blue-dk)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: checkedIds.size === 0 ? 'default' : 'pointer', opacity: checkedIds.size === 0 ? 0.5 : 1 }}>
                    {checkedIds.size > 0 ? `${checkedIds.size}명 일괄 발송` : '일괄 발송'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <ConfirmToast state={confirmToast.state} onHide={confirmToast.hide} confirmLabel="발송" confirmColor="var(--blue-dk)" />
    </div>
  )
}
