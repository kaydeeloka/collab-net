import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ListFilter, MailCheck } from 'lucide-react'
import { gasPost } from '@/lib/api'
import {
  backfillAcceptedToConfirmed,
  removeInfluencerOnUnaccept,
  syncInfluencerOnAccept,
} from '@/lib/confirm-influencer'
import {
  checkOutlookConnected,
  compareByRecentReply,
  fetchOutlookReplies,
  isNewReply,
  markRepliesReadInOutlook,
  replyTimestamp,
  shouldAutoMarkReply,
  toIsoTimestamp,
} from '@/lib/reply-sync'
import { logOutboundOutreach } from '@/lib/outreach-log'
import { supabase } from '@/lib/supabase'
import { supabaseNow } from '@/lib/kst-time'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import { TableActionBar } from '@/components/StickyBar'
import { Button, StatCard, StatCards } from '@/components/ui'
import {
  coerceContactCount,
  contactCountStyle,
  formatContactCount,
  nextContactCountAfterSend,
  formatShortContactDate,
} from '@/lib/contact-count'
import { fetchEmailTemplates, type EmailTemplate } from '@/lib/email-templates'

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
  { value: 'target',   label: '컨택 예정', bg: '#e0f2fe', color: '#0369a1' },
  { value: 'yes',      label: '발송 완료', bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'reply',    label: '단순 회신', bg: '#fef3c7', color: '#d97706' },
  { value: 'positive', label: '긍정 검토', bg: '#d1fae5', color: '#065f46' },
  { value: 'negative', label: '부정 검토', bg: '#fee2e2', color: '#991b1b' },
  { value: 'reject',   label: '거절',     bg: '#fecaca', color: '#dc2626' },
  { value: 'accept',   label: '확정',     bg: '#bbf7d0', color: '#14532d' },
  { value: 'noreply',  label: '미회신',   bg: '#f1f5f9', color: '#64748b' },
  { value: 'paid',     label: '유가 협업', bg: '#ede9fe', color: '#7c3aed' },
]
const STATUS_STYLE = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, { bg: s.bg, color: s.color }]))

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
  platform: string | null
  status: string
  contact_count: number
  last_contact_at: string | null
  last_reply_at: string | null
  reply_count: number | null
  memo: string | null
  source_phase_id: string | null
  tiers: { rank: string; label: string; category: string } | null
}

// ─── Templates ────────────────────────────────────────────────────────────────

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
function bulkSendConfirmMessage(count: number, tpl: { name: string; title: string }) {
  return `${count}명에게 일괄 발송하시겠습니까?\n템플릿: ${tpl.name}\n제목: ${tpl.title || '(제목 없음)'}`
}
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

function ContactCountEditor({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false)
  const style = contactCountStyle(count)

  const commit = (raw: string) => {
    setEditing(false)
    const v = Math.max(0, parseInt(raw, 10) || 0)
    if (v !== count) onChange(v)
  }

  if (count === 0 && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{
          fontSize: 11,
          fontWeight: 700,
          border: `1px solid ${style.color}55`,
          borderRadius: 8,
          padding: '3px 10px',
          background: style.bg,
          color: style.color,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        미컨택
      </button>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <input
        type="number"
        min={0}
        autoFocus={count === 0}
        defaultValue={count > 0 ? count : ''}
        placeholder={count === 0 ? 'N' : undefined}
        key={`cc-${count}-${editing}`}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setEditing(false); (e.target as HTMLInputElement).blur() }
        }}
        style={{
          width: 44,
          padding: '3px 4px',
          fontSize: 11,
          fontWeight: 700,
          textAlign: 'center',
          border: `1px solid ${style.color}55`,
          borderRadius: 8,
          background: style.bg,
          color: style.color,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {count > 0 && (
        <span style={{ fontSize: 11, fontWeight: 700, color: style.color }}>차 컨택</span>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Outreach() {
  const { showToast, showConfirm } = useToast()
  const { viewPhaseId, phases } = usePhase()
  const phaseNameById = Object.fromEntries(phases.map(p => [p.id, p.name]))

  // ── Data ──
  const [influencers,    setInfluencers]    = useState<Influencer[]>([])
  const [loading,        setLoading]        = useState(true)

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
  const [syncingReplies,  setSyncingReplies]  = useState(false)
  const [showBulkPreview, setShowBulkPreview] = useState(false)
  const [templates,       setTemplates]       = useState<EmailTemplate[]>([])

  // ── Memo inline edits ──
  const [memoEdits, setMemoEdits] = useState<Record<string, string>>({})
  const memoTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Load ──
  const loadInfluencers = useCallback(async () => {
    if (!viewPhaseId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('influencers')
      .select('id, handle, display_name, email, followers, following, following_ratio, video_count, engagement_rate, profile_url, platform, status, contact_count, last_contact_at, last_reply_at, reply_count, memo, source_phase_id, tiers(rank, label, category)')
      .eq('phase_id', viewPhaseId)
      .order('last_reply_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      contact_count: coerceContactCount(r.contact_count),
    }))
    setInfluencers(mapped as unknown as Influencer[])

    const accepted = (mapped as Influencer[]).filter(r => r.status === 'accept')
    if (accepted.length) {
      const { synced, failed, deduped, errors } = await backfillAcceptedToConfirmed(viewPhaseId, accepted)
      if (deduped > 0) showToast(`확정 목록 중복 ${deduped}건 정리됨`, 'success')
      if (synced > 0) showToast(`${synced}명 확정 목록에 반영됨`, 'success')
      if (failed > 0) showToast(`확정 등록 실패 ${failed}건: ${errors[0]}`, 'error')
    }

    setLoading(false)
  }, [viewPhaseId, showToast])

  useEffect(() => { loadInfluencers() }, [loadInfluencers])

  useEffect(() => {
    fetchEmailTemplates('influencer')
      .then(setTemplates)
      .catch(() => showToast('템플릿을 불러오지 못했습니다', 'error'))
  }, [showToast])

  useEffect(() => {
    if (!showRoundFilter && !showStatusFilter) return
    const handler = (e: MouseEvent) => {
      if (roundFilterRef.current && !roundFilterRef.current.contains(e.target as Node)) setShowRoundFilter(false)
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setShowStatusFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRoundFilter, showStatusFilter])

  const syncReplies = useCallback(async () => {
    const candidates = influencers.filter(r => {
      const email = r.email?.trim()
      if (!email) return false
      return (r.contact_count ?? 0) > 0 || ['yes', 'noreply', 'reply'].includes(r.status || '')
    })
    if (!candidates.length) {
      showToast('회신 확인할 발송 대상이 없습니다', 'error')
      return
    }

    setSyncingReplies(true)
    try {
      const auth = await checkOutlookConnected()
      if (!auth.configured || !auth.authorized) {
        showToast('Outlook 미연결 — GAS Script Properties 설정 및 authorizeOutlook() 인증이 필요합니다', 'error')
        return
      }

      const syncItems = candidates.map(r => ({
        email: r.email!,
        since: toIsoTimestamp(r.last_contact_at),
        lastReplyAt: toIsoTimestamp(r.last_reply_at),
      }))
      const replies = await fetchOutlookReplies(syncItems)

      const messageIds: string[] = []
      let newReplies = 0
      let statusUpdates = 0

      for (const reply of replies) {
        const inf = candidates.find(r => r.email!.toLowerCase() === reply.email.toLowerCase())
        if (!inf || !isNewReply(inf, reply)) continue

        const replyAt = replyTimestamp(reply)
        const patch: Partial<Influencer> = {
          last_reply_at: replyAt,
          reply_count: (inf.reply_count ?? 0) + 1,
        }

        if (shouldAutoMarkReply(inf.status || '')) {
          patch.status = 'reply'
          statusUpdates++
        }

        const { error } = await supabase.from('influencers').update(patch).eq('id', inf.id)
        if (error) { showToast(error.message, 'error'); continue }

        newReplies++
        if (reply.messageId) messageIds.push(reply.messageId)
      }

      if (messageIds.length) await markRepliesReadInOutlook(messageIds)

      setPage(1)
      await loadInfluencers()

      if (newReplies === 0) {
        showToast('새 회신 없음 (이미 반영된 회신이거나 마지막 발송 이후 회신 없음)', 'success')
      } else {
        showToast(`새 회신 ${newReplies}건 반영 · 상태 ${statusUpdates}건 업데이트`, 'success')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '회신 확인 실패', 'error')
    } finally {
      setSyncingReplies(false)
    }
  }, [influencers, loadInfluencers, showToast])

  // ── Field update helpers ──
  const updateField = useCallback(async (id: string, patch: Partial<Influencer>) => {
    const inf = influencers.find(r => r.id === id)
    const finalPatch = { ...patch }

    // increment reply_count when status moves to a reply-type value
    const replyStatuses = ['reply', 'positive', 'negative']
    if (patch.status && replyStatuses.includes(patch.status) && inf?.status && !replyStatuses.includes(inf.status)) {
      finalPatch.reply_count = (inf.reply_count ?? 0) + 1
    }
    if (patch.status && replyStatuses.includes(patch.status)) {
      finalPatch.last_reply_at = supabaseNow()
    }

    const { error } = await supabase.from('influencers').update(finalPatch).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setInfluencers(prev => prev.map(r => r.id === id ? { ...r, ...finalPatch } : r))

    // sync to confirmed_influencers when status is accept
    if (patch.status === 'accept' && inf && viewPhaseId) {
      const result = await syncInfluencerOnAccept(inf, viewPhaseId)
      if (!result.ok) {
        showToast('확정 등록 실패: ' + result.error, 'error')
      } else {
        showToast(`${inf.display_name || inf.handle} 확정 등록 완료`, 'success')
      }
    }

    // remove from confirmed_influencers when status changes away from 'accept'
    if (patch.status !== undefined && patch.status !== 'accept' && inf?.status === 'accept') {
      const result = await removeInfluencerOnUnaccept(id)
      if (!result.ok) showToast('확정 취소 실패: ' + result.error, 'error')
      else showToast(`${inf.display_name || inf.handle} 확정 취소됨`, 'success')
    }
  }, [showToast, influencers, viewPhaseId])

  const sendOutreachToInfluencer = useCallback(async (
    inf: Influencer,
    tpl: Pick<EmailTemplate, 'id' | 'name' | 'title' | 'body'>,
  ) => {
    if (!inf.email) return
    const subject = applyPlaceholders(tpl.title, inf)
    const body = applyPlaceholders(tpl.body, inf)
    const sentAt = supabaseNow()
    await gasPost({ action: 'sendOutreachEmail', to: inf.email, subject, body })
    await logOutboundOutreach({
      influencer_id: inf.id,
      subject,
      body,
      template_name: tpl.name,
      template_id: tpl.id,
      sent_at: sentAt,
    })
    const nextCount = nextContactCountAfterSend(inf.contact_count)
    await updateField(inf.id, { contact_count: nextCount, status: 'yes', last_contact_at: sentAt })
  }, [updateField])

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
      if (statusFilter && (r.status || '') !== statusFilter) return false
      if (roundFilter && String(r.contact_count ?? 0) !== roundFilter) return false
      return true
    })
    .sort((a, b) => compareByRecentReply(a, b))
  const pg = paginate(filtered, page)

  const sentCount      = influencers.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.status)).length
  const repliedCount   = influencers.filter(r => ['reply','negotiate'].includes(r.status)).length
  const acceptCount    = influencers.filter(r => r.status === 'accept').length
  const negotiateCount = influencers.filter(r => r.status === 'negotiate').length
  const tierBreakdown = TIERS.map(t => {
    const all  = influencers.filter(r => r.tiers?.rank === t)
    const sent = all.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.status)).length
    return { tier: t, count: all.length, sent }
  })

  const sentPct = influencers.length > 0 ? Math.round(sentCount / influencers.length * 100) : 0
  const replyPct  = sentCount > 0 ? Math.round(repliedCount / sentCount * 100) : 0

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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={syncReplies}
            disabled={syncingReplies || loading}
            title="마지막 발송 이후 새 회신만 확인합니다 (가장 최신 메일 기준)"
            style={{ padding: '7px 14px', background: '#fff', color: '#d97706', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid #fcd34d', cursor: syncingReplies ? 'wait' : 'pointer', opacity: syncingReplies ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MailCheck size={14} />
            {syncingReplies ? '확인 중…' : '회신 확인'}
          </button>
          <button onClick={() => { loadInfluencers(); setCheckedIds(new Set()) }}
            style={{ padding: '7px 14px', background: '#fff', color: '#334', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid var(--gray-3)', cursor: 'pointer' }}>
            ↻ 새로고침
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {loading && <div className="loader"><Spinner /></div>}
      {!loading && (
        <StatCards className="stat-cards--tall" columns="2fr 1fr 1fr 1fr" style={{ marginBottom: 28 }}>
          <StatCard
            variant="metric"
            align="left"
            label="전체 타겟 리스트"
            value={influencers.length}
            unit="명"
            footer={(
              <>
                {tierBreakdown.map((t, i) => {
                  const color = TIER_COLOR[t.tier]
                  return (
                    <span key={t.tier}>
                      {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                      <span style={{ color }}>{t.tier.replace('순위', '')}순위 <strong>{t.sent}/{t.count}</strong></span>
                    </span>
                  )
                })}
              </>
            )}
          />
          <StatCard
            variant="metric"
            align="left"
            label="발송 성과율"
            value={sentCount}
            valueSuffix={<span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>/ {influencers.length} 발송됨</span>}
            progress={influencers.length > 0 ? Math.min(sentCount / influencers.length * 100, 100) : 0}
            footer={`${sentPct}% 완료`}
          />
          <StatCard
            highlight
            variant="metric"
            align="left"
            label="답장 수신 통계"
            value={repliedCount}
            unit="명 답장"
            valueColor="#d97706"
            footer={`${replyPct}% 회신율`}
          />
          <StatCard
            highlight
            label="확정 / 협의"
            variant="split"
            columns={[
              { value: acceptCount, unit: '명', valueColor: '#14532d', label: '확정', labelColor: '#16a34a' },
              { value: negotiateCount, unit: '명', valueColor: '#1e3a5f', label: '협의 중', labelColor: '#2563eb' },
            ]}
          />
        </StatCards>
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
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>

        <TableActionBar
          selectedCount={checkedIds.size}
          unit="명"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowBulkPreview(true)}>
                미리보기
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkSending || checkedIds.size === 0}
                onClick={() => {
                  const tpl = templates[bulkTplIdx]
                  if (!tpl) return
                  showConfirm(bulkSendConfirmMessage(checkedIds.size, tpl), async () => {
                    setBulkSending(true)
                    const ids = Array.from(checkedIds)
                    for (const id of ids) {
                      const inf = filtered.find(r => r.id === id)
                      if (!inf || !inf.email) continue
                      await sendOutreachToInfluencer(inf, tpl)
                    }
                    setBulkSending(false); setCheckedIds(new Set())
                    showToast(`${ids.length}명에게 발송 완료`, 'success')
                  }, { confirmLabel: '발송', confirmColor: 'var(--blue-dk)' })
                }}
              >
                {bulkSending ? '발송 중...' : '일괄 발송'}
              </Button>
              {checkedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCheckedIds(new Set())}>
                  선택 해제
                </Button>
              )}
            </>
          }
        >
          <select className="table-action-bar__select" value={bulkTplIdx} onChange={e => setBulkTplIdx(+e.target.value)}>
            {templates.map((t: { id: string; name: string }, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
          </select>
        </TableActionBar>
        {loading
          ? <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span></div>
          : <>
            <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 160px)' }}>
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
                    {/* 마지막 컨택 날짜 */}
                    <th style={{ ...thBase, minWidth: 110 }}>마지막 컨택 날짜</th>
                    {/* 비고 */}
                    <th style={{ ...thBase, minWidth: 180 }}>비고</th>
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
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 160, marginTop: 4 }}>
                            <button type="button" onClick={() => { setRoundFilter(''); setShowRoundFilter(false); setPage(1) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: !roundFilter ? 700 : 500, background: !roundFilter ? '#dbeafe' : 'transparent', color: !roundFilter ? '#1d4ed8' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                              전체
                            </button>
                            <button type="button" onClick={() => { setRoundFilter('0'); setShowRoundFilter(false); setPage(1) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: roundFilter === '0' ? 700 : 500, background: roundFilter === '0' ? '#dbeafe' : 'transparent', color: roundFilter === '0' ? '#1d4ed8' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                              미컨택
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 6px', borderTop: '1px solid var(--gray-2)' }}>
                              <input
                                type="number"
                                min={1}
                                placeholder="N"
                                defaultValue={roundFilter && roundFilter !== '0' ? roundFilter : ''}
                                key={`round-filter-${roundFilter}`}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const v = Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 0)
                                    if (v > 0) { setRoundFilter(String(v)); setShowRoundFilter(false); setPage(1) }
                                  }
                                }}
                                onBlur={e => {
                                  const raw = e.target.value.trim()
                                  if (!raw) return
                                  const v = Math.max(1, parseInt(raw, 10) || 0)
                                  if (v > 0) { setRoundFilter(String(v)); setShowRoundFilter(false); setPage(1) }
                                }}
                                style={{ width: 48, padding: '4px 6px', fontSize: 12, border: '1px solid var(--gray-3)', borderRadius: 6, outline: 'none' }}
                              />
                              <span style={{ fontSize: 11, color: 'var(--gray-6)', fontWeight: 600 }}>차 컨택</span>
                            </div>
                            {roundFilter && roundFilter !== '0' && (
                              <div style={{ fontSize: 10, color: 'var(--blue-dk)', marginTop: 6, paddingLeft: 6 }}>
                                필터: {formatContactCount(+roundFilter)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>
                      데이터가 없습니다.
                    </td></tr>
                  )}
                  {pg.pageItems.map(inf => {
                    const status     = inf.status || 'target'
                    const count      = inf.contact_count ?? 0
                    const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE['target']
                    const tc = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                    const memoVal = memoEdits[inf.id] !== undefined ? memoEdits[inf.id] : (inf.memo ?? '')
                    const contactDateLabel = formatShortContactDate(inf.last_contact_at)
                    const replyDateLabel = formatShortContactDate(inf.last_reply_at)
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
                          {inf.source_phase_id && (
                            <span style={{
                              display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 700,
                              background: '#ede9fe', color: '#6d28d9', borderRadius: 6, padding: '1px 6px',
                            }}>
                              {phaseNameById[inf.source_phase_id] ?? '이전 차수'} 이관
                            </span>
                          )}
                          {inf.handle && <a href={`https://www.tiktok.com/@${inf.handle}`} target="_blank" rel="noopener" style={{ fontSize: 11, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 500, display: 'block', marginTop: 2 }}>@{inf.handle}</a>}
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
                        {/* 마지막 컨택 날짜 */}
                        <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {inf.last_contact_at && count > 0
                              ? <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '2px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {count}차 발송{contactDateLabel ? ` ${contactDateLabel}` : ''}
                                </span>
                              : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                            {(inf.reply_count ?? 0) > 0 && (
                              <span style={{ fontSize: 11, background: '#fef3c7', color: '#d97706', borderRadius: 6, padding: '2px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {inf.reply_count}차 회신{replyDateLabel ? ` ${replyDateLabel}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* 비고 */}
                        <td style={{ padding: '0 10px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <textarea
                            value={memoVal}
                            onChange={e => updateMemo(inf.id, e.target.value)}
                            placeholder="메모 입력..."
                            rows={1}
                            style={{ width: '100%', minWidth: 140, height: 34, fontSize: 12, padding: '4px 8px', border: '1px solid transparent', borderRadius: 6, background: memoVal ? 'var(--gray-0)' : 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--gray-7)', cursor: 'text', resize: 'none', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowY: 'auto' }}
                            onFocus={e => { e.currentTarget.style.border = '1px solid var(--gray-3)'; e.currentTarget.style.background = '#fff' }}
                            onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = memoVal ? 'var(--gray-0)' : 'transparent' }}
                          />
                        </td>
                        {/* 컨택 차수 */}
                        <td style={{ padding: '0 10px', verticalAlign: 'middle' }}>
                          <ContactCountEditor
                            count={count}
                            onChange={n => updateField(inf.id, { contact_count: n })}
                          />
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)' }}>{renderWithDummy(tpl?.title || '(제목 없음)')}</div>
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
                      showConfirm(bulkSendConfirmMessage(checkedIds.size, tpl2), async () => {
                        setBulkSending(true)
                        const ids = Array.from(checkedIds)
                        for (const id of ids) {
                          const inf = filtered.find(r => r.id === id)
                          if (!inf || !inf.email) continue
                          await sendOutreachToInfluencer(inf, tpl2)
                        }
                        setBulkSending(false); setCheckedIds(new Set())
                        showToast(`${ids.length}명에게 발송 완료`, 'success')
                      }, { confirmLabel: '발송', confirmColor: 'var(--blue-dk)' })
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
    </div>
  )
}
