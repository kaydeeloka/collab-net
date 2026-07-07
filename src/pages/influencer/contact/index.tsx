import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ListFilter, MailCheck } from 'lucide-react'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { BULK_BOUNCE_DELAYS_MS, fetchOutlookDeliveryFailures } from '@/lib/template/delivery-failure-sync'
import BulkSendProgressModal from '@/components/BulkSendProgressModal'
import {
  BULK_SEND_MAX,
  bulkSendLimitMessage,
  getOutreachSendError,
  reportDeliveryBounces,
  runBulkOutreachSend,
  markBulkSendBounces,
  scheduleBulkDeliveryCheck,
  type BulkSendLiveState,
  sendOutreachEmail,
  tryToggleBulkPage,
  tryToggleBulkSelection,
  isBulkAllSelected,
  toggleBulkAllFiltered,
} from '@/lib/contact/outreach-email'
import {
  cancelInfluencerContact,
} from '@/lib/contact/contact-cancel'
import {
  removeInfluencerOnUnaccept,
  syncInfluencerOnAccept,
  syncMissingAcceptedToConfirmed,
} from '@/lib/influencer/confirm-influencer'
import {
  checkOutlookConnected,
  compareByRecentReply,
  fetchOutlookReplies,
  isNewReply,
  markRepliesReadInOutlook,
  replyTimestamp,
  shouldAutoMarkReply,
  toIsoTimestamp,
} from '@/lib/contact/reply-sync'
import { logOutboundOutreach } from '@/lib/contact/outreach-log'
import { supabase } from '@/lib/supabase'
import { supabaseNow } from '@/lib/kst-time'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import { TableActionBar, TableTemplateSelect } from '@/components/StickyBar'
import { Button, StatCard, StatCards } from '@/components/ui'
import { EmailTemplatePreviewModal } from '@/components/EmailTemplatePreview'
import { FilterSegmentBar } from '@/components/FilterSegmentBar'
import { DbTableRowSelect, DbTableSelectAll, dbTableRowClass } from '@/components/DbTableSelect'
import {
  coerceContactCount,
  contactCountStyle,
  formatContactCount,
  nextContactCountAfterSend,
  formatShortContactDate,
} from '@/lib/contact/contact-count'
import { fetchEmailTemplates, type EmailTemplate } from '@/lib/template/email-templates'

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
  { value: 'bounce',   label: '발송 실패', bg: '#fee2e2', color: '#b91c1c' },
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
  contacted: boolean
  contact_count: number
  last_contact_at: string | null
  last_reply_at: string | null
  reply_count: number | null
  memo: string | null
  source_phase_id: string | null
  tiers: { rank: string; label: string; category: string } | null
}

// ─── Templates ────────────────────────────────────────────────────────────────

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
const REPLY_BATCH = 25
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
  const [bulkSendModal,   setBulkSendModal]   = useState<BulkSendLiveState | null>(null)
  const [checkingDeliveryFailures, setCheckingDeliveryFailures] = useState(false)
  const [syncingReplies,  setSyncingReplies]  = useState(false)
  const [syncProgress,    setSyncProgress]    = useState<{ checked: number; total: number; found: number } | null>(null)
  const [bulkMarking,     setBulkMarking]     = useState(false)
  const [showBulkPreview, setShowBulkPreview] = useState(false)
  const [contactDateEditId, setContactDateEditId] = useState<string | null>(null)
  const [replyDateEditId,   setReplyDateEditId]   = useState<string | null>(null)
  const [sendCountEditId,   setSendCountEditId]   = useState<string | null>(null)
  const [replyCountEditId,  setReplyCountEditId]  = useState<string | null>(null)
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
      .select('id, handle, display_name, email, followers, following, following_ratio, video_count, engagement_rate, profile_url, platform, status, contacted, contact_count, last_contact_at, last_reply_at, reply_count, memo, source_phase_id, tiers(rank, label, category)')
      .eq('phase_id', viewPhaseId)
      .eq('contacted', true)
      .order('last_reply_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    const mapped = (data ?? []).map((r: any) => ({
      ...r,
      contact_count: coerceContactCount(r.contact_count),
    }))
    setInfluencers(mapped as unknown as Influencer[])
    setLoading(false)

    // Silent background repair — toast only when user sets status → accept (updateField)
    const accepted = (mapped as Influencer[]).filter(r => r.status === 'accept')
    if (accepted.length) {
      void syncMissingAcceptedToConfirmed(viewPhaseId, accepted)
    }
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

    // sync to confirmed_influencers when status becomes accept (primary path)
    if (patch.status === 'accept' && inf && viewPhaseId) {
      const merged = { ...inf, ...finalPatch }
      const result = await syncInfluencerOnAccept(merged, viewPhaseId)
      if (!result.ok) {
        showToast('확정 등록 실패: ' + result.error, 'error')
      } else {
        showToast(`${merged.display_name || merged.handle} 확정 등록 완료 — 확정 인플루언서 페이지에서 확인하세요`, 'success')
      }
    }

    // remove from confirmed_influencers when status changes away from 'accept'
    if (patch.status !== undefined && patch.status !== 'accept' && inf?.status === 'accept') {
      const result = await removeInfluencerOnUnaccept(id)
      if (!result.ok) showToast('확정 취소 실패: ' + result.error, 'error')
      else showToast(`${inf.display_name || inf.handle} 확정 취소됨`, 'success')
    }
  }, [showToast, influencers, viewPhaseId])

  const requestCancelContact = useCallback((inf: Influencer) => {
    const name = inf.display_name || inf.handle || '해당 인플루언서'
    showConfirm(
      `${name} 컨택을 취소하고 리스트업 DB로 되돌리시겠습니까?`,
      async () => {
        const result = await cancelInfluencerContact(inf.id)
        if (!result.ok) {
          showToast(result.error || '컨택 취소 실패', 'error')
          return
        }
        setInfluencers(prev => prev.filter(r => r.id !== inf.id))
        setCheckedIds(prev => {
          const next = new Set(prev)
          next.delete(inf.id)
          return next
        })
        showToast(`${name} 컨택 취소됨 — 리스트업에서 다시 확인할 수 있습니다`, 'success')
      },
      { confirmLabel: '컨택 취소', confirmColor: '#b91c1c' },
    )
  }, [showConfirm, showToast])

  const requestCancelContactBulk = useCallback(() => {
    const ids = Array.from(checkedIds)
    if (!ids.length) return
    const targets = influencers.filter(r => ids.includes(r.id))
    showConfirm(
      `선택한 ${targets.length}명 컨택을 취소하고 리스트업 DB로 되돌리시겠습니까?`,
      async () => {
        let failed = 0
        for (const inf of targets) {
          const result = await cancelInfluencerContact(inf.id)
          if (!result.ok) failed++
        }
        if (failed) {
          showToast(`${failed}건 컨택 취소 실패`, 'error')
        } else {
          showToast(`${targets.length}명 컨택 취소됨`, 'success')
        }
        setInfluencers(prev => prev.filter(r => !ids.includes(r.id)))
        setCheckedIds(new Set())
      },
      { confirmLabel: '컨택 취소', confirmColor: '#b91c1c' },
    )
  }, [checkedIds, influencers, showConfirm, showToast])

  const sendOutreachToInfluencer = useCallback(async (
    inf: Influencer,
    tpl: Pick<EmailTemplate, 'id' | 'name' | 'title' | 'body'>,
  ) => {
    if (!inf.email) return
    const subject = applyPlaceholders(tpl.title, inf)
    const body = applyPlaceholders(tpl.body, inf)
    const sentAt = supabaseNow()
    const res = await sendOutreachEmail({ to: inf.email, subject, body })
    const sendErr = getOutreachSendError(res)
    if (sendErr) throw new Error(sendErr)
    await logOutboundOutreach({
      influencer_id: inf.id,
      subject,
      body,
      template_name: tpl.name,
      template_id: tpl.id,
      sent_at: sentAt,
    })
    const { data: fresh, error: readErr } = await supabase
      .from('influencers')
      .select('contact_count')
      .eq('id', inf.id)
      .single()
    if (readErr) throw new Error(readErr.message)
    const nextCount = nextContactCountAfterSend(fresh?.contact_count)
    await updateField(inf.id, { contact_count: nextCount, status: 'yes', last_contact_at: sentAt })
  }, [updateField])

  const recordSendAfterEmail = useCallback(async (inf: Influencer, sentAt: string) => {
    const { data: fresh, error: readErr } = await supabase
      .from('influencers')
      .select('contact_count')
      .eq('id', inf.id)
      .single()
    if (readErr) { showToast(readErr.message, 'error'); return false }
    const nextCount = nextContactCountAfterSend(fresh?.contact_count)
    await updateField(inf.id, { contact_count: nextCount, status: 'yes', last_contact_at: sentAt })
    return true
  }, [updateField, showToast])

  const applyDeliveryBounces = useCallback(async (
    items: Array<{ id: string; email: string; label: string; since?: string | null }>,
    options?: { bulk?: boolean },
  ): Promise<Array<{ email: string; label: string; reason?: string }>> => {
    const candidates = items
      .filter(r => r.email.trim())
      .map(r => ({ email: r.email, since: r.since || undefined, label: r.label, id: r.id }))
    if (!candidates.length) return []

    const failures = await fetchOutlookDeliveryFailures(
      candidates,
      options?.bulk ? { delaysMs: BULK_BOUNCE_DELAYS_MS } : undefined,
    )
    const bounced: Array<{ email: string; label: string; reason?: string }> = []
    for (const f of failures) {
      const row = candidates.find(c => c.email.toLowerCase() === f.email.toLowerCase())
      if (!row) continue
      await updateField(row.id, { status: 'bounce' })
      bounced.push({ email: row.email, label: row.label, reason: f.reason })
    }
    if (bounced.length) reportDeliveryBounces(showToast, bounced)
    return bounced
  }, [updateField, showToast])

  const syncReplies = useCallback(async () => {
    const candidates = influencers.filter(r => !!r.email?.trim())
    if (!candidates.length) {
      showToast('회신 확인할 발송 대상이 없습니다', 'error')
      return
    }

    setSyncingReplies(true)
    setSyncProgress({ checked: 0, total: candidates.length, found: 0 })
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

      const messageIds: string[] = []
      let newReplies = 0
      let statusUpdates = 0
      let totalChecked = 0

      for (let i = 0; i < syncItems.length; i += REPLY_BATCH) {
        const batch = syncItems.slice(i, i + REPLY_BATCH)
        const replies = await fetchOutlookReplies(batch)
        totalChecked += batch.length
        setSyncProgress({ checked: totalChecked, total: candidates.length, found: newReplies })

        for (const reply of replies) {
          const inf = candidates.find(r => r.email!.toLowerCase() === reply.email.toLowerCase())
          if (!inf || !isNewReply(inf, reply)) continue

          const { data: fresh, error: readErr } = await supabase
            .from('influencers')
            .select('reply_count, status, last_contact_at, last_reply_at')
            .eq('id', inf.id)
            .single()
          if (readErr || !fresh) { showToast(readErr?.message ?? '회신 반영 실패', 'error'); continue }
          if (!isNewReply(fresh, reply)) continue

          const replyAt = replyTimestamp(reply)
          const patch: Partial<Influencer> = {
            last_reply_at: replyAt,
            reply_count: (fresh.reply_count ?? 0) + 1,
          }

          if (shouldAutoMarkReply(fresh.status || '')) {
            patch.status = 'reply'
            statusUpdates++
          }

          const { error } = await supabase.from('influencers').update(patch).eq('id', inf.id)
          if (error) { showToast(error.message, 'error'); continue }

          newReplies++
          if (reply.messageId) messageIds.push(reply.messageId)
          setSyncProgress({ checked: totalChecked, total: candidates.length, found: newReplies })
        }
      }

      if (messageIds.length) await markRepliesReadInOutlook(messageIds)

      try {
        await applyDeliveryBounces(candidates.map(r => ({
          id: r.id,
          email: r.email!,
          label: r.display_name || r.handle || r.email!,
          since: toIsoTimestamp(r.last_contact_at),
        })))
      } catch (bounceErr) {
        showToast(bounceErr instanceof Error ? bounceErr.message : '배송 실패 확인 실패', 'error')
      }

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
      setSyncProgress(null)
    }
  }, [influencers, loadInfluencers, showToast, applyDeliveryBounces])

  const updateMemo = useCallback((id: string, value: string) => {
    setMemoEdits(prev => ({ ...prev, [id]: value }))
    if (memoTimers.current[id]) clearTimeout(memoTimers.current[id])
    memoTimers.current[id] = setTimeout(() => {
      updateField(id, { memo: value })
    }, 800)
  }, [updateField])

  // ── Derived ──
  const filtered = influencers
    .filter((r: Influencer) => {
      if (activeTier !== '전체' && r.tiers?.rank !== activeTier) return false
      if (statusFilter && (r.status || '') !== statusFilter) return false
      if (roundFilter && String(r.contact_count ?? 0) !== roundFilter) return false
      return true
    })
    .sort((a, b) => compareByRecentReply(a, b))
  const pg = paginate(filtered, page)
  const allFilteredSelected = isBulkAllSelected(checkedIds, filtered.map(r => r.id))

  const requestBulkMarkComplete = useCallback(() => {
    const keys = Array.from(checkedIds)
    if (!keys.length) {
      showToast('선택한 항목이 없습니다', 'error')
      return
    }
    const targets = filtered.filter(r => keys.includes(r.id) && r.status === 'target')
    if (!targets.length) {
      showToast('컨택 예정 상태인 선택 항목이 없습니다', 'error')
      return
    }
    showConfirm(
      `선택한 ${targets.length}명을 발송 완료로 표시하시겠습니까?\n(Outlook 등 외부에서 발송한 경우 수동 반영)`,
      async () => {
        setBulkMarking(true)
        try {
          const sentAt = supabaseNow()
          let updated = 0
          for (const inf of targets) {
            const ok = await recordSendAfterEmail(inf, sentAt)
            if (ok) updated++
          }
          setCheckedIds(new Set())
          await loadInfluencers()
          showToast(`${updated}명 발송 완료로 반영`, 'success')
        } finally {
          setBulkMarking(false)
        }
      },
      { confirmLabel: '완료 처리', confirmColor: 'var(--blue-dk)' },
    )
  }, [checkedIds, filtered, showConfirm, showToast, loadInfluencers, recordSendAfterEmail])

  const toggleSelectAllFiltered = useCallback(() => {
    const { next, truncated } = toggleBulkAllFiltered(checkedIds, filtered.map(r => r.id))
    setCheckedIds(next)
    if (truncated) showToast(bulkSendLimitMessage(), 'error')
  }, [checkedIds, filtered, showToast])

  const executeBulkSend = useCallback(async (tpl: Pick<EmailTemplate, 'id' | 'name' | 'title' | 'body'>) => {
    const ids = Array.from(checkedIds)
    const batchStartedAt = supabaseNow()
    const sentRows: Influencer[] = []
    const entries = ids.map(id => {
      const inf = filtered.find(r => r.id === id)
      return {
        key: id,
        label: inf?.display_name || inf?.handle || inf?.email || id,
        email: inf?.email || undefined,
        item: id,
      }
    })

    setBulkSendModal({
      running: true,
      rows: entries.map(e => ({ key: e.key, label: e.label, email: e.email, status: 'pending' as const })),
      progress: { current: 0, total: entries.length, failed: 0 },
    })
    setBulkSending(true)
    try {
      await runBulkOutreachSend(entries, async (id) => {
        const inf = filtered.find(r => r.id === id)
        if (!inf || !inf.email) return 'skipped'
        await sendOutreachToInfluencer(inf, tpl)
        sentRows.push(inf)
        return 'sent'
      }, setBulkSendModal)
    } finally {
      setBulkSending(false)
      setCheckedIds(new Set())
    }

    await loadInfluencers()

    if (sentRows.length) {
      const bounceItems = sentRows.map(inf => ({
        id: inf.id,
        email: inf.email!,
        label: inf.display_name || inf.handle || inf.email!,
        since: batchStartedAt,
      }))
      scheduleBulkDeliveryCheck(
        bounceItems,
        items => applyDeliveryBounces(items, { bulk: true }),
        {
          showToast,
          onStart: () => setCheckingDeliveryFailures(true),
          onFinish: () => setCheckingDeliveryFailures(false),
          onBounces: bounced => {
            if (bounced.length) {
              setBulkSendModal(prev => (prev ? markBulkSendBounces(prev, bounced) : prev))
            }
          },
          reload: loadInfluencers,
        },
      )
    }
  }, [checkedIds, filtered, sendOutreachToInfluencer, applyDeliveryBounces, loadInfluencers, showToast])

  const repliedCount   = influencers.filter(r => ['reply','negotiate'].includes(r.status)).length
  const acceptCount    = influencers.filter(r => r.status === 'accept').length
  const negotiateCount = influencers.filter(r => r.status === 'negotiate').length
  const tierBreakdown = TIERS.map(t => {
    const all  = influencers.filter(r => r.tiers?.rank === t)
    const sent = all.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.status)).length
    return { tier: t, count: all.length, sent }
  })

  const sentForReply = influencers.filter(r => ['yes','reply','negotiate','accept','reject'].includes(r.status)).length
  const replyPct = sentForReply > 0 ? Math.round(repliedCount / sentForReply * 100) : 0

  const thBase: React.CSSProperties = {
    padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px',
    background: 'var(--gray-1)', borderBottom: '2px solid var(--gray-3)',
    position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap',
  }

  return (
    <div className="page page--fill" style={{ paddingLeft: 28, paddingRight: 28 }}>

      <PageHeroBanner>
        <PageHeroBannerContent
          title="인플루언서 컨택 리스트업"
          description="선정된 인플루언서에게 아웃리치 이메일을 발송하고 컨택 상태·회신 여부를 관리합니다."
          actions={(
            <>
              <button
                onClick={syncReplies}
                disabled={syncingReplies || loading}
                title="마지막 발송 이후 새 회신만 확인합니다 (가장 최신 메일 기준)"
                className="page-banner-btn"
                style={{ background: '#fff', color: '#d97706', border: '1px solid #fcd34d', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: syncingReplies ? 0.7 : 1, cursor: syncingReplies ? 'wait' : 'pointer' }}
              >
                <MailCheck size={14} />
                {syncingReplies ? '확인 중…' : '회신 확인'}
              </button>
              <button className="page-banner-btn page-banner-btn--secondary"
                onClick={() => { loadInfluencers(); setCheckedIds(new Set()) }}>
                <span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침
              </button>
            </>
          )}
        />
      </PageHeroBanner>

      {syncProgress && (
        <div style={{ background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: 'var(--gray-6)', fontWeight: 600 }}>
              회신 확인 중... {syncProgress.checked} / {syncProgress.total}건
            </span>
            <span style={{ color: '#d97706', fontWeight: 700 }}>
              {syncProgress.found > 0 ? `${syncProgress.found}건 회신 감지` : '회신 탐색 중'}
            </span>
          </div>
          <div style={{ height: 5, background: 'var(--gray-2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, background: 'var(--blue)',
              width: `${Math.round((syncProgress.checked / syncProgress.total) * 100)}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      {loading && <div className="loader"><Spinner /></div>}
      {!loading && (
        <StatCards className="stat-cards--tall" columns="2fr 1fr 1fr" style={{ marginBottom: 28 }}>
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
      <FilterSegmentBar
        label="순위"
        ariaLabel="티어 필터"
        value={activeTier}
        onChange={v => { setActiveTier(v); setPage(1) }}
        style={{ marginBottom: 16 }}
        options={[
          { value: '전체', label: '전체' },
          ...TIERS.map(t => ({ value: t, label: t })),
        ]}
      />

      {/* ── Table ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>

        <TableActionBar
          selectedCount={checkedIds.size}
          maxSelection={BULK_SEND_MAX}
          unit="명"
          statusActions={
            <>
              <button
                type="button"
                className={`table-action-bar__select-all${allFilteredSelected ? ' is-active' : ''}`}
                disabled={filtered.length === 0}
                onClick={toggleSelectAllFiltered}
              >
                {allFilteredSelected ? '전체 해제' : '전체 선택'}
              </button>
              {checkedIds.size > 0 && !allFilteredSelected && (
                <button
                  type="button"
                  className="table-action-bar__clear-selection"
                  onClick={() => setCheckedIds(new Set())}
                >
                  선택 해제 ({checkedIds.size})
                </button>
              )}
              {checkingDeliveryFailures && (
                <span className="table-action-bar__pending-badge" title="메일이 수신자에게 전달되지 못한 경우를 받은편지함에서 확인 중입니다">
                  <span className="table-action-bar__pending-badge-dot" aria-hidden />
                  발송 실패 확인 중…
                </span>
              )}
            </>
          }
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={bulkMarking || checkedIds.size === 0}
                onClick={requestBulkMarkComplete}
                title="컨택 예정 항목만 발송 완료로 표시 (외부 발송 수동 반영)"
              >
                {bulkMarking ? '처리 중…' : '일괄 완료'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkSending || checkedIds.size === 0}
                onClick={() => {
                  const tpl = templates[bulkTplIdx]
                  if (!tpl) return
                  if (checkedIds.size > BULK_SEND_MAX) {
                    showToast(bulkSendLimitMessage(), 'error')
                    return
                  }
                  showConfirm(bulkSendConfirmMessage(checkedIds.size, tpl), async () => {
                    await executeBulkSend(tpl)
                  }, { confirmLabel: '발송', confirmColor: 'var(--blue-dk)' })
                }}
              >
                일괄 발송
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={checkedIds.size === 0}
                onClick={requestCancelContactBulk}
                style={{ color: '#b91c1c', borderColor: '#fecaca' }}
              >
                컨택 취소
              </Button>
            </>
          }
        >
          <TableTemplateSelect
            value={bulkTplIdx}
            onChange={setBulkTplIdx}
            options={templates}
          />
          <Button variant="ghost" size="sm" onClick={() => setShowBulkPreview(true)} disabled={templates.length === 0}>
            미리보기
          </Button>
        </TableActionBar>
        {loading
          ? <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span></div>
          : <>
            <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 160px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    {/* Checkbox */}
                    <th style={{ ...thBase, width: 40, padding: '9px 8px', textAlign: 'center' }}>
                      <DbTableSelectAll
                        checked={pg.pageItems.length > 0 && pg.pageItems.every(r => checkedIds.has(r.id))}
                        indeterminate={pg.pageItems.some(r => checkedIds.has(r.id)) && !pg.pageItems.every(r => checkedIds.has(r.id))}
                        onChange={checked => {
                          const pageIds = pg.pageItems.map(r => r.id)
                          const { next, rejected } = tryToggleBulkPage(checkedIds, pageIds, checked)
                          if (rejected) showToast(bulkSendLimitMessage(), 'error')
                          setCheckedIds(next)
                        }}
                      />
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
                    <th style={{ ...thBase, width: 88, textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>
                      컨택 대상으로 설정된 인플루언서가 없습니다.
                    </td></tr>
                  )}
                  {pg.pageItems.map((inf, i) => {
                    const status     = inf.status || 'target'
                    const count      = inf.contact_count ?? 0
                    const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE['target']
                    const tc = inf.tiers?.rank ? TIER_COLOR[inf.tiers.rank] : undefined
                    const memoVal = memoEdits[inf.id] !== undefined ? memoEdits[inf.id] : (inf.memo ?? '')
                    const contactDateLabel = formatShortContactDate(inf.last_contact_at)
                    const replyDateLabel = formatShortContactDate(inf.last_reply_at)
                    return (
                      <tr key={inf.id} className={dbTableRowClass(checkedIds.has(inf.id))} style={{ borderBottom: '1px solid var(--gray-2)', borderLeft: tc ? `3px solid ${tc}` : undefined, height: 48 }}>
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <DbTableRowSelect
                            rowNumber={i + 1}
                            checked={checkedIds.has(inf.id)}
                            onChange={checked => {
                              const { next, rejected } = tryToggleBulkSelection(checkedIds, inf.id, checked)
                              if (rejected) showToast(bulkSendLimitMessage(), 'error')
                              setCheckedIds(next)
                            }}
                          />
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
                            {count > 0
                              ? <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '2px 7px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  {sendCountEditId === inf.id ? (
                                    <input
                                      type="number"
                                      defaultValue={count}
                                      autoFocus
                                      min={0}
                                      onClick={e => e.stopPropagation()}
                                      onBlur={e => {
                                        setSendCountEditId(null)
                                        const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                                        if (v !== count) updateField(inf.id, { contact_count: v })
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                      style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #1d4ed8', background: 'transparent', color: '#1d4ed8', fontWeight: 700, outline: 'none', width: 28, padding: 0, fontFamily: 'inherit', textAlign: 'center' }}
                                    />
                                  ) : (
                                    <button onClick={() => setSendCountEditId(inf.id)} title="차수 편집"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #93c5fd', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#1d4ed8', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4 }}>
                                      {count}
                                    </button>
                                  )}
                                  차 발송
                                  {contactDateEditId === inf.id ? (
                                    <input
                                      type="date"
                                      defaultValue={inf.last_contact_at?.slice(0, 10) ?? ''}
                                      autoFocus
                                      onClick={e => e.stopPropagation()}
                                      onBlur={e => {
                                        setContactDateEditId(null)
                                        if (e.target.value) updateField(inf.id, { last_contact_at: `${e.target.value}T00:00:00+09:00` })
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                      style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #1d4ed8', background: 'transparent', color: '#1d4ed8', fontWeight: 700, outline: 'none', width: 90, padding: 0, fontFamily: 'inherit' }}
                                    />
                                  ) : (
                                    <button onClick={() => setContactDateEditId(inf.id)} title="날짜 편집"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #93c5fd', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#1d4ed8', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4, opacity: contactDateLabel ? 1 : 0.6 }}>
                                      {contactDateLabel ?? '날짜'}
                                    </button>
                                  )}
                                </span>
                              : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                            {(inf.reply_count ?? 0) > 0 && (
                              <span style={{ fontSize: 11, background: '#fef3c7', color: '#d97706', borderRadius: 6, padding: '2px 7px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                {replyCountEditId === inf.id ? (
                                  <input
                                    type="number"
                                    defaultValue={inf.reply_count ?? 0}
                                    autoFocus
                                    min={0}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => {
                                      setReplyCountEditId(null)
                                      const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                                      if (v !== (inf.reply_count ?? 0)) updateField(inf.id, { reply_count: v })
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                    style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #d97706', background: 'transparent', color: '#d97706', fontWeight: 700, outline: 'none', width: 28, padding: 0, fontFamily: 'inherit', textAlign: 'center' }}
                                  />
                                ) : (
                                  <button onClick={() => setReplyCountEditId(inf.id)} title="차수 편집"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #fcd34d', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#d97706', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4 }}>
                                    {inf.reply_count}
                                  </button>
                                )}
                                차 회신
                                {replyDateEditId === inf.id ? (
                                  <input
                                    type="date"
                                    defaultValue={inf.last_reply_at?.slice(0, 10) ?? ''}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => {
                                      setReplyDateEditId(null)
                                      if (e.target.value) updateField(inf.id, { last_reply_at: `${e.target.value}T00:00:00+09:00` })
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                    style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #d97706', background: 'transparent', color: '#d97706', fontWeight: 700, outline: 'none', width: 90, padding: 0, fontFamily: 'inherit' }}
                                  />
                                ) : (
                                  <button onClick={() => setReplyDateEditId(inf.id)} title="날짜 편집"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #fcd34d', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#d97706', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4, opacity: replyDateLabel ? 1 : 0.6 }}>
                                    {replyDateLabel ?? '날짜'}
                                  </button>
                                )}
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
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => requestCancelContact(inf)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              borderRadius: 999,
                              border: '1px solid #fecaca',
                              background: '#fff',
                              color: '#b91c1c',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            컨택 취소
                          </button>
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

      <EmailTemplatePreviewModal
        open={showBulkPreview}
        onClose={() => setShowBulkPreview(false)}
        templateName={templates[bulkTplIdx]?.name}
        title={templates[bulkTplIdx]?.title ?? ''}
        body={templates[bulkTplIdx]?.body ?? ''}
        domain="influencer"
        footer={(
          <>
            <button type="button" onClick={() => setShowBulkPreview(false)}
              style={{ padding: '6px 14px', background: 'var(--gray-1)', color: 'var(--gray-6)', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              닫기
            </button>
            <button
              type="button"
              disabled={checkedIds.size === 0 || checkedIds.size > BULK_SEND_MAX}
              onClick={() => {
                setShowBulkPreview(false)
                const tpl2 = templates[bulkTplIdx]
                if (!tpl2) return
                if (checkedIds.size > BULK_SEND_MAX) {
                  showToast(bulkSendLimitMessage(), 'error')
                  return
                }
                showConfirm(bulkSendConfirmMessage(checkedIds.size, tpl2), async () => {
                  await executeBulkSend(tpl2)
                }, { confirmLabel: '발송', confirmColor: 'var(--blue-dk)' })
              }}
              style={{ padding: '6px 14px', background: checkedIds.size === 0 ? 'var(--gray-3)' : 'var(--blue-dk)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: checkedIds.size === 0 ? 'default' : 'pointer', opacity: checkedIds.size === 0 ? 0.5 : 1 }}
            >
              {checkedIds.size > 0 ? `${checkedIds.size}명 일괄 발송` : '일괄 발송'}
            </button>
          </>
        )}
      />

      <BulkSendProgressModal
        open={bulkSendModal !== null}
        state={bulkSendModal}
        unit="명"
        onClose={() => setBulkSendModal(null)}
      />
    </div>
  )
}
