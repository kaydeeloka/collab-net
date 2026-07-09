import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ListFilter, MailCheck } from 'lucide-react'
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
import { BULK_BOUNCE_DELAYS_MS, fetchOutlookDeliveryFailures } from '@/lib/template/delivery-failure-sync'
import { cancelBrandContact } from '@/lib/contact/contact-cancel'
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
import { supabase } from '@/lib/supabase'
import { supabaseNow } from '@/lib/kst-time'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import { TableActionBar, TableTemplateSelect } from '@/components/StickyBar'
import { DbTableRowSelect, DbTableSelectAll, dbTableRowClass } from '@/components/DbTableSelect'
import { Button, StatCard, StatCards } from '@/components/ui'
import { formatShortContactDate } from '@/lib/contact/contact-count'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'

import { fetchEmailTemplates, type EmailTemplate } from '@/lib/template/email-templates'
import { EmailTemplatePreviewModal } from '@/components/EmailTemplatePreview'

function applyPlaceholders(text: string, row: { brand: string; name: string | null; position: string | null }) {
  return text
    .replace(/\{\{브랜드명\}\}/g, row.brand || '')
    .replace(/\{\{담당자\}\}/g,   row.name || '')
    .replace(/\{\{직함\}\}/g,     row.position || '')
}


const STATUS_OPTIONS = [
  { value: '',         label: '컨택 예정', bg: '#e0f2fe', color: '#0369a1' },
  { value: 'yes',      label: '첫발송 완료', bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'bounce',   label: '발송 실패', bg: '#fee2e2', color: '#b91c1c' },
  { value: 'noreply',  label: '미회신',   bg: '#f1f5f9', color: '#64748b' },
  { value: 'reply',    label: '단순 회신', bg: '#fef3c7', color: '#d97706' },
  { value: 'positive', label: '긍정 검토', bg: '#d1fae5', color: '#065f46' },
  { value: 'negative', label: '부정 검토', bg: '#fee2e2', color: '#991b1b' },
  { value: 'reject',   label: '거절',     bg: '#fecaca', color: '#dc2626' },
  { value: 'accept',   label: '확정',     bg: '#bbf7d0', color: '#14532d' },
]
const STATUS_STYLE = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, { bg: s.bg, color: s.color }]))
const STATUS_FILTER_ALL = 'all'

interface BrandRow {
  id:          string
  brand:       string
  name:        string | null
  position:    string | null
  email:       string | null
  phone:       string | null
  website:     string | null
  phase_id:    string | null
  status:      string
  send_count:       number
  reply_count:      number
  last_contact_at:  string | null
  last_reply_at:    string | null
  notes:            string | null
}

const PAGE_SIZE = 25
function bulkSendConfirmMessage(count: number, tpl: { name: string; title: string }) {
  return `${count}건에게 일괄 발송하시겠습니까?\n템플릿: ${tpl.name}\n제목: ${tpl.title || '(제목 없음)'}`
}
function rowMatchesSearch(row: BrandRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [row.brand, row.name, row.position, row.email, row.phone, row.website, row.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

export default function BrandContact() {
  const { showToast, showConfirm } = useToast()
  const { selectedPhaseId } = usePhase()

  const [rows,    setRows]    = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery,      setSearchQuery]      = useState('')
  const [statusFilter,     setStatusFilter]     = useState(STATUS_FILTER_ALL)
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [page,             setPage]             = useState(1)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  const [checkedIds,      setCheckedIds]      = useState<Set<string>>(new Set())
  const [bulkSending,     setBulkSending]     = useState(false)
  const [bulkSendModal,   setBulkSendModal]   = useState<BulkSendLiveState | null>(null)
  const [checkingDeliveryFailures, setCheckingDeliveryFailures] = useState(false)
  const [syncingReplies,  setSyncingReplies]  = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ checked: number; total: number; found: number } | null>(null)
  const [bulkMarking,     setBulkMarking]     = useState(false)
  const [templates,       setTemplates]       = useState<EmailTemplate[]>([])
  const [bulkTplIdx,      setBulkTplIdx]      = useState(0)
  const [showBulkPreview, setShowBulkPreview] = useState(false)

  const reloadTemplates = useCallback(() => {
    fetchEmailTemplates('brand')
      .then(setTemplates)
      .catch(() => showToast('템플릿을 불러오지 못했습니다', 'error'))
  }, [showToast])

  useEffect(() => {
    reloadTemplates()
    const handler = () => { reloadTemplates() }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [reloadTemplates])

  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({})
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [contactDateEditId, setContactDateEditId] = useState<string | null>(null)
  const [replyDateEditId,   setReplyDateEditId]   = useState<string | null>(null)
  const [sendCountEditId,   setSendCountEditId]   = useState<string | null>(null)
  const [replyCountEditId,  setReplyCountEditId]  = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!selectedPhaseId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('brand_contacts')
      .select('id, brand_name, contact_name, position, email, personal_email, personal_phone, telephone, website, phase_id, status, send_count, reply_count, last_contact_at, last_reply_at, notes')
      .eq('contacted', true)
      .eq('phase_id', selectedPhaseId)
      .order('last_reply_at', { ascending: false, nullsFirst: false })
    if (error) { showToast('브랜드 DB 오류: ' + error.message, 'error'); setLoading(false); return }
    const mapped: BrandRow[] = (data ?? []).map((r: any) => ({
      id: r.id,
      brand: r.brand_name,
      name: r.contact_name ?? null,
      position: r.position ?? null,
      email: Array.isArray(r.email) ? r.email[0] ?? null : (r.email ?? null),
      phone: r.personal_phone ?? r.telephone ?? null,
      website: r.website ?? null,
      phase_id: r.phase_id ?? null,
      status: r.status ?? '',
      send_count: r.send_count ?? 0,
      reply_count: r.reply_count ?? 0,
      last_contact_at: r.last_contact_at ?? null,
      last_reply_at: r.last_reply_at ?? null,
      notes: r.notes ?? null,
    }))
    setRows(mapped)
    setLoading(false)
  }, [selectedPhaseId, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setPage(1)
    setCheckedIds(new Set())
  }, [selectedPhaseId])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter])

  useEffect(() => {
    if (!showStatusFilter) return
    const closeOnScroll = () => setShowStatusFilter(false)
    const handler = (e: MouseEvent) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setShowStatusFilter(false)
    }
    window.addEventListener('scroll', closeOnScroll, true)
    document.addEventListener('mousedown', handler)
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true)
      document.removeEventListener('mousedown', handler)
    }
  }, [showStatusFilter])

  const recordSendAfterEmail = useCallback(async (row: BrandRow, sentAt: string) => {
    const { data, error: readErr } = await supabase
      .from('brand_contacts')
      .select('send_count')
      .eq('id', row.id)
      .single()
    if (readErr) { showToast(readErr.message, 'error'); return false }

    const patch: Partial<BrandRow> = {
      send_count: (data?.send_count ?? 0) + 1,
      status: 'yes',
      last_contact_at: sentAt,
    }
    const { error } = await supabase.from('brand_contacts').update(patch).eq('id', row.id)
    if (error) { showToast(error.message, 'error'); return false }

    setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r))
    return true
  }, [showToast])

  const updateField = useCallback(async (row: BrandRow, patch: Partial<BrandRow>) => {
    const dbPatch: Record<string, unknown> = {}
    const REPLY_STATUSES = ['reply', 'positive', 'negative', 'reject', 'accept']
    if (patch.status !== undefined) {
      const nextStatus = patch.status
      dbPatch.status = nextStatus
      if (REPLY_STATUSES.includes(nextStatus) && !REPLY_STATUSES.includes(row.status)) {
        dbPatch.reply_count = row.reply_count + 1
        patch = { ...patch, reply_count: row.reply_count + 1 }
      }
      if (REPLY_STATUSES.includes(nextStatus)) {
        if (patch.last_reply_at === undefined) {
          dbPatch.last_reply_at = supabaseNow()
          patch = { ...patch, last_reply_at: dbPatch.last_reply_at as string }
        }
      }
    }
    if (patch.send_count       !== undefined) dbPatch.send_count       = patch.send_count
    if (patch.reply_count      !== undefined) dbPatch.reply_count      = patch.reply_count
    if (patch.last_contact_at  !== undefined) dbPatch.last_contact_at  = patch.last_contact_at
    if (patch.last_reply_at    !== undefined) dbPatch.last_reply_at    = patch.last_reply_at
    if (patch.notes       !== undefined) dbPatch.notes       = patch.notes
    const { error } = await supabase.from('brand_contacts').update(dbPatch).eq('id', row.id)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, ...patch } : r))

    // Auto-create confirmed_brands entry when status becomes 'accept'
    if (patch.status === 'accept' && row.status !== 'accept' && row.phase_id) {
      const { data: existing, error: lookupError } = await supabase
        .from('confirmed_brands')
        .select('id')
        .eq('phase_id', row.phase_id)
        .eq('brand_name', row.brand)
        .maybeSingle()
      if (lookupError) {
        showToast(`확정 브랜드 확인 실패: ${lookupError.message}`, 'error')
      } else if (!existing) {
        const { error: insertError } = await supabase.from('confirmed_brands').insert({
          phase_id:     row.phase_id,
          brand_name:   row.brand,
          contact_name: row.name,
          position:     row.position,
          email:        row.email,
          phone:        row.phone,
          website:      row.website,
        })
        if (insertError) {
          showToast(`확정 브랜드 등록 실패: ${insertError.message}`, 'error')
        }
      }
    }
  }, [showToast])

  const applyDeliveryBounces = useCallback(async (
    items: Array<{ row: BrandRow; since?: string | null }>,
    options?: { bulk?: boolean },
  ): Promise<Array<{ email: string; label: string; reason?: string }>> => {
    const candidates = items
      .filter(i => i.row.email?.trim())
      .map(i => ({
        email: i.row.email!,
        since: i.since || undefined,
        label: i.row.brand || i.row.email!,
        row: i.row,
      }))
    if (!candidates.length) return []

    const failures = await fetchOutlookDeliveryFailures(
      candidates,
      options?.bulk ? { delaysMs: BULK_BOUNCE_DELAYS_MS } : undefined,
    )
    const bounced: Array<{ email: string; label: string; reason?: string }> = []
    for (const f of failures) {
      const hit = candidates.find(c => c.email.toLowerCase() === f.email.toLowerCase())
      if (!hit) continue
      await updateField(hit.row, { status: 'bounce' })
      bounced.push({ email: hit.email, label: hit.label, reason: f.reason })
    }
    if (bounced.length) reportDeliveryBounces(showToast, bounced)
    return bounced
  }, [updateField, showToast])

  const REPLY_BATCH = 25

  const syncReplies = useCallback(async () => {
    const candidates = rows.filter(r => !!r.email?.trim())
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
      let totalFound = 0

      for (let i = 0; i < syncItems.length; i += REPLY_BATCH) {
        const batch = syncItems.slice(i, i + REPLY_BATCH)
        const replies = await fetchOutlookReplies(batch)
        totalChecked += batch.length
        totalFound += replies.length
        setSyncProgress({ checked: totalChecked, total: candidates.length, found: totalFound })

        for (const reply of replies) {
          const row = candidates.find(r => r.email!.toLowerCase() === reply.email.toLowerCase())
          if (!row || !isNewReply(row, reply)) continue

          const { data: fresh, error: readErr } = await supabase
            .from('brand_contacts')
            .select('reply_count, status, last_contact_at, last_reply_at')
            .eq('id', row.id)
            .single()
          if (readErr || !fresh) { showToast(readErr?.message ?? '회신 반영 실패', 'error'); continue }
          if (!isNewReply(fresh, reply)) continue

          const replyAt = replyTimestamp(reply)
          const patch: Partial<BrandRow> = {
            last_reply_at: replyAt,
            reply_count: (fresh.reply_count ?? 0) + 1,
          }
          if (shouldAutoMarkReply(fresh.status ?? '')) {
            patch.status = 'reply'
            statusUpdates++
          }

          const { error } = await supabase.from('brand_contacts').update(patch).eq('id', row.id)
          if (error) { showToast(error.message, 'error'); continue }

          newReplies++
          if (reply.messageId) messageIds.push(reply.messageId)
        }
      }

      if (messageIds.length) await markRepliesReadInOutlook(messageIds)

      try {
        await applyDeliveryBounces(candidates.map(row => ({
          row,
          since: toIsoTimestamp(row.last_contact_at),
        })))
      } catch (bounceErr) {
        showToast(bounceErr instanceof Error ? bounceErr.message : '배송 실패 확인 실패', 'error')
      }

      setPage(1)
      await load()
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
  }, [rows, showToast, load, applyDeliveryBounces])

  const updateNote = useCallback((row: BrandRow, value: string) => {
    setNoteEdits(prev => ({ ...prev, [row.id]: value }))
    if (noteTimers.current[row.id]) clearTimeout(noteTimers.current[row.id])
    noteTimers.current[row.id] = setTimeout(() => updateField(row, { notes: value }), 800)
  }, [updateField])

  const rowKey = (r: BrandRow) => r.id

  const filtered = rows.filter(r => {
    if (statusFilter !== STATUS_FILTER_ALL && r.status !== statusFilter) return false
    if (!rowMatchesSearch(r, searchQuery)) return false
    return true
  }).sort((a, b) => compareByRecentReply(a, b))
  const pg = paginate(filtered, page)
  const allFilteredSelected = isBulkAllSelected(checkedIds, filtered.map(rowKey))

  const requestBulkMarkComplete = useCallback(() => {
    const keys = Array.from(checkedIds)
    if (!keys.length) {
      showToast('선택한 항목이 없습니다', 'error')
      return
    }
    const targets = filtered.filter(r => keys.includes(rowKey(r)) && (r.status ?? '') === '')
    if (!targets.length) {
      showToast('컨택 예정 상태인 선택 항목이 없습니다', 'error')
      return
    }
    showConfirm(
      `선택한 ${targets.length}건을 첫발송 완료로 표시하시겠습니까?\n(Outlook 등 외부에서 발송한 경우 수동 반영)`,
      async () => {
        setBulkMarking(true)
        try {
          const sentAt = supabaseNow()
          let updated = 0
          for (const row of targets) {
            const ok = await recordSendAfterEmail(row, sentAt)
            if (ok) updated++
          }
          setCheckedIds(new Set())
          await load()
          showToast(`${updated}건 첫발송 완료로 반영`, 'success')
        } finally {
          setBulkMarking(false)
        }
      },
      { confirmLabel: '완료 처리', confirmColor: 'var(--blue-dk)' },
    )
  }, [checkedIds, filtered, showConfirm, showToast, load, recordSendAfterEmail])

  const toggleSelectAllFiltered = useCallback(() => {
    const { next, truncated } = toggleBulkAllFiltered(checkedIds, filtered.map(rowKey))
    setCheckedIds(next)
    if (truncated) showToast(bulkSendLimitMessage(), 'error')
  }, [checkedIds, filtered, showToast])

  const requestCancelContact = useCallback((row: BrandRow) => {
    const name = row.brand || row.name || '해당 브랜드'
    showConfirm(
      `${name} 컨택을 취소하고 브랜드 DB로 되돌리시겠습니까?`,
      async () => {
        const result = await cancelBrandContact(row.id)
        if (!result.ok) {
          showToast(result.error || '컨택 취소 실패', 'error')
          return
        }
        setRows(prev => prev.filter(r => r.id !== row.id))
        setCheckedIds(prev => {
          const next = new Set(prev)
          next.delete(rowKey(row))
          return next
        })
        showToast(`${name} 컨택 취소됨 — 브랜드 DB에서 다시 확인할 수 있습니다`, 'success')
      },
      { confirmLabel: '컨택 취소', confirmColor: '#b91c1c' },
    )
  }, [showConfirm, showToast])

  const requestCancelContactBulk = useCallback(() => {
    const keys = Array.from(checkedIds)
    if (!keys.length) return
    const targets = filtered.filter(r => keys.includes(rowKey(r)))
    showConfirm(
      `선택한 ${targets.length}건 컨택을 취소하고 브랜드 DB로 되돌리시겠습니까?`,
      async () => {
        let failed = 0
        for (const row of targets) {
          const result = await cancelBrandContact(row.id)
          if (!result.ok) failed++
        }
        if (failed) {
          showToast(`${failed}건 컨택 취소 실패`, 'error')
        } else {
          showToast(`${targets.length}건 컨택 취소됨`, 'success')
        }
        setRows(prev => prev.filter(r => !keys.includes(rowKey(r))))
        setCheckedIds(new Set())
      },
      { confirmLabel: '컨택 취소', confirmColor: '#b91c1c' },
    )
  }, [checkedIds, filtered, showConfirm, showToast])

  const executeBulkSend = useCallback(async (tpl: Pick<EmailTemplate, 'title' | 'body'>) => {
    const keys = Array.from(checkedIds)
    const batchStartedAt = supabaseNow()
    const sentRows: BrandRow[] = []
    const entries = keys.map(key => {
      const row = filtered.find(r => rowKey(r) === key)
      return {
        key,
        label: row?.brand || row?.email || key,
        email: row?.email || undefined,
        item: key,
      }
    })

    setBulkSendModal({
      running: true,
      rows: entries.map(e => ({ key: e.key, label: e.label, email: e.email, status: 'pending' as const })),
      progress: { current: 0, total: entries.length, failed: 0 },
    })
    setBulkSending(true)
    try {
      await runBulkOutreachSend(entries, async (key) => {
        const row = filtered.find(r => rowKey(r) === key)
        if (!row || !row.email) return 'skipped'
        const sentAt = supabaseNow()
        const res = await sendOutreachEmail({
          to: row.email,
          subject: applyPlaceholders(tpl.title, row),
          body: applyPlaceholders(tpl.body, row),
        })
        const sendErr = getOutreachSendError(res)
        if (sendErr) throw new Error(sendErr)
        if (!(await recordSendAfterEmail(row, sentAt))) throw new Error('DB 저장 실패')
        sentRows.push(row)
        return 'sent'
      }, setBulkSendModal)
    } finally {
      setBulkSending(false)
      setCheckedIds(new Set())
    }

    await load()

    if (sentRows.length) {
      const bounceItems = sentRows.map(row => ({ row, since: batchStartedAt }))
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
          reload: load,
        },
      )
    }
  }, [checkedIds, filtered, recordSendAfterEmail, applyDeliveryBounces, load, showToast])

  const repliedCount = rows.filter(r => ['reply', 'positive', 'negative', 'accept'].includes(r.status)).length
  const sentForReply = rows.filter(r => r.send_count > 0).length
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
          title="브랜드 컨택 관리"
          description="컨택 대상 브랜드에게 아웃리치 이메일을 발송하고 컨택 상태·회신 여부를 관리합니다."
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
                onClick={() => { load(); setCheckedIds(new Set()) }}>
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

      {/* Stats */}
      {loading && <div className="loader"><Spinner /></div>}
      {!loading && (
        <StatCards className="stat-cards--tall" columns="1fr 1fr" style={{ marginBottom: 28 }}>
          <StatCard
            variant="metric"
            align="left"
            label="전체 컨택 리스트"
            value={rows.length}
            unit="건"
          />
          <StatCard
            highlight
            variant="metric"
            align="left"
            label="답장 수신 통계"
            value={repliedCount}
            unit="건 답장"
            valueColor="#d97706"
            footer={`${replyPct}% 회신율`}
          />
        </StatCards>
      )}

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="브랜드명, 담당자, 이메일 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: 320, padding: '8px 14px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)' }}>

        <TableActionBar
          selectedCount={checkedIds.size}
          maxSelection={BULK_SEND_MAX}
          unit="건"
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
                title="컨택 예정 항목만 첫발송 완료로 표시 (외부 발송 수동 반영)"
              >
                {bulkMarking ? '처리 중…' : '일괄 완료'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkSending || checkedIds.size === 0 || templates.length === 0}
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
            emptyLabel="템플릿 없음 — 브랜드 에서 추가하세요"
          />
          <Button variant="ghost" size="sm" onClick={() => setShowBulkPreview(true)} disabled={templates.length === 0}>
            미리보기
          </Button>
        </TableActionBar>

        {loading
          ? <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>데이터 불러오는 중...</span></div>
          : <>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ ...thBase, width: 40, padding: '9px 8px', textAlign: 'center' }}>
                      <DbTableSelectAll
                        checked={pg.pageItems.length > 0 && pg.pageItems.every(r => checkedIds.has(rowKey(r)))}
                        indeterminate={pg.pageItems.some(r => checkedIds.has(rowKey(r))) && !pg.pageItems.every(r => checkedIds.has(rowKey(r)))}
                        onChange={checked => {
                          const pageIds = pg.pageItems.map(rowKey)
                          const { next, rejected } = tryToggleBulkPage(checkedIds, pageIds, checked)
                          if (rejected) showToast(bulkSendLimitMessage(), 'error')
                          setCheckedIds(next)
                        }}
                      />
                    </th>
                    <th style={{ ...thBase, minWidth: 160 }}>브랜드</th>
                    <th style={{ ...thBase, minWidth: 110 }}>성명</th>
                    <th style={{ ...thBase, minWidth: 90 }}>직급</th>
                    <th style={{ ...thBase, minWidth: 180 }}>이메일</th>
                    <th style={{ ...thBase, minWidth: 140 }}>
                      <div ref={statusFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                        <span>상태</span>
                        <button
                          type="button"
                          onClick={() => setShowStatusFilter(p => !p)}
                          title="상태 필터"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: statusFilter !== STATUS_FILTER_ALL ? (STATUS_STYLE[statusFilter]?.color ?? '#64748b') : 'transparent', color: statusFilter !== STATUS_FILTER_ALL ? '#fff' : 'var(--gray-4)', cursor: 'pointer', padding: 0 }}>
                          <ListFilter size={13} />
                        </button>
                        {showStatusFilter && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 140, marginTop: 4 }}>
                            {[{ value: STATUS_FILTER_ALL, label: '전체' }, ...STATUS_OPTIONS].map(o => (
                              <button key={o.value || '__pending__'} type="button" onClick={() => { setStatusFilter(o.value); setShowStatusFilter(false); setPage(1) }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: statusFilter === o.value ? 700 : 500, background: statusFilter === o.value ? ((STATUS_STYLE[o.value]?.bg) ?? '#f1f5f9') : 'transparent', color: statusFilter === o.value ? ((STATUS_STYLE[o.value]?.color) ?? 'var(--gray-7)') : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th style={{ ...thBase, minWidth: 110 }}>마지막 컨택 날짜</th>
                    <th style={{ ...thBase, minWidth: 180 }}>비고</th>
                    <th style={{ ...thBase, width: 88, textAlign: 'center' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>
                      {rows.length === 0
                        ? '컨택 대상으로 설정된 브랜드가 없습니다.'
                        : '검색 결과가 없습니다.'}
                    </td></tr>
                  )}
                  {pg.pageItems.map((row, i) => {
                    const status = row.status ?? ''
                    const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE['']
                    const key = rowKey(row)
                    const noteVal = noteEdits[key] !== undefined ? noteEdits[key] : (row.notes ?? '')
                    const contactDateLabel = formatShortContactDate(row.last_contact_at)
                    const replyDateLabel = formatShortContactDate(row.last_reply_at)
                    return (
                      <tr key={key} className={dbTableRowClass(checkedIds.has(key))} style={{ borderBottom: '1px solid var(--gray-2)', minHeight: 48 }}>
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <DbTableRowSelect
                            rowNumber={i + 1}
                            checked={checkedIds.has(key)}
                            onChange={checked => {
                              const { next, rejected } = tryToggleBulkSelection(checkedIds, key, checked)
                              if (rejected) showToast(bulkSendLimitMessage(), 'error')
                              setCheckedIds(next)
                            }}
                          />
                        </td>
                        <td style={{ padding: '0 12px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)' }}>{row.brand || '—'}</div>
                        </td>
                        <td style={{ padding: '0 12px', fontSize: 13, color: 'var(--gray-7)', verticalAlign: 'middle' }}>
                          {row.name || <span style={{ color: 'var(--gray-3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-6)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {row.position || <span style={{ color: 'var(--gray-3)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, verticalAlign: 'middle' }}>
                          {row.email || '—'}
                        </td>
                        <td style={{ padding: '0 10px', verticalAlign: 'middle' }}>
                          <select value={status} onChange={e => updateField(row, { status: e.target.value })}
                            style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${statusStyle.color}55`, borderRadius: 20, padding: '3px 8px', background: statusStyle.bg, color: statusStyle.color, outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {row.send_count > 0
                              ? <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '2px 7px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  {sendCountEditId === key ? (
                                    <input
                                      type="number"
                                      defaultValue={row.send_count}
                                      autoFocus
                                      min={0}
                                      onClick={e => e.stopPropagation()}
                                      onBlur={e => {
                                        setSendCountEditId(null)
                                        const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                                        if (v !== row.send_count) updateField(row, { send_count: v })
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                      style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #1d4ed8', background: 'transparent', color: '#1d4ed8', fontWeight: 700, outline: 'none', width: 28, padding: 0, fontFamily: 'inherit', textAlign: 'center' }}
                                    />
                                  ) : (
                                    <button onClick={() => setSendCountEditId(key)} title="차수 편집"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #93c5fd', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#1d4ed8', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4 }}>
                                      {row.send_count}
                                    </button>
                                  )}
                                  차 발송
                                  {contactDateEditId === key ? (
                                    <input
                                      type="date"
                                      defaultValue={row.last_contact_at?.slice(0, 10) ?? ''}
                                      autoFocus
                                      onClick={e => e.stopPropagation()}
                                      onBlur={e => {
                                        setContactDateEditId(null)
                                        if (e.target.value) updateField(row, { last_contact_at: `${e.target.value}T00:00:00+09:00` })
                                      }}
                                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                      style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #1d4ed8', background: 'transparent', color: '#1d4ed8', fontWeight: 700, outline: 'none', width: 90, padding: 0, fontFamily: 'inherit' }}
                                    />
                                  ) : (
                                    <button onClick={() => setContactDateEditId(key)} title="날짜 편집"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #93c5fd', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#1d4ed8', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4, opacity: contactDateLabel ? 1 : 0.6 }}>
                                      {contactDateLabel ?? '날짜'}
                                    </button>
                                  )}
                                </span>
                              : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                            {(row.reply_count ?? 0) > 0 && (
                              <span style={{ fontSize: 11, background: '#fef3c7', color: '#d97706', borderRadius: 6, padding: '2px 7px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                {replyCountEditId === key ? (
                                  <input
                                    type="number"
                                    defaultValue={row.reply_count}
                                    autoFocus
                                    min={0}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => {
                                      setReplyCountEditId(null)
                                      const v = Math.max(0, parseInt(e.target.value, 10) || 0)
                                      if (v !== row.reply_count) updateField(row, { reply_count: v })
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                    style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #d97706', background: 'transparent', color: '#d97706', fontWeight: 700, outline: 'none', width: 28, padding: 0, fontFamily: 'inherit', textAlign: 'center' }}
                                  />
                                ) : (
                                  <button onClick={() => setReplyCountEditId(key)} title="차수 편집"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #fcd34d', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#d97706', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4 }}>
                                    {row.reply_count}
                                  </button>
                                )}
                                차 회신
                                {replyDateEditId === key ? (
                                  <input
                                    type="date"
                                    defaultValue={row.last_reply_at?.slice(0, 10) ?? ''}
                                    autoFocus
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => {
                                      setReplyDateEditId(null)
                                      if (e.target.value) updateField(row, { last_reply_at: `${e.target.value}T00:00:00+09:00` })
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur() }}
                                    style={{ fontSize: 11, border: 'none', borderBottom: '1px solid #d97706', background: 'transparent', color: '#d97706', fontWeight: 700, outline: 'none', width: 90, padding: 0, fontFamily: 'inherit' }}
                                  />
                                ) : (
                                  <button onClick={() => setReplyDateEditId(key)} title="날짜 편집"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', border: '1px dashed #fcd34d', borderRadius: 4, padding: '0 3px', background: 'rgba(255,255,255,0.5)', color: '#d97706', fontWeight: 700, fontSize: 11, fontFamily: 'inherit', lineHeight: 1.4, opacity: replyDateLabel ? 1 : 0.6 }}>
                                    {replyDateLabel ?? '날짜'}
                                  </button>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0 10px', verticalAlign: 'middle', overflow: 'hidden' }}>
                          <textarea
                            value={noteVal}
                            onChange={e => updateNote(row, e.target.value)}
                            placeholder="메모 입력..."
                            rows={1}
                            style={{ width: '100%', minWidth: 140, height: 34, fontSize: 12, padding: '4px 8px', border: '1px solid transparent', borderRadius: 6, background: noteVal ? 'var(--gray-0)' : 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--gray-7)', cursor: 'text', resize: 'none', lineHeight: 1.5, overflowY: 'auto' }}
                            onFocus={e => { e.currentTarget.style.border = '1px solid var(--gray-3)'; e.currentTarget.style.background = '#fff' }}
                            onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = noteVal ? 'var(--gray-0)' : 'transparent' }}
                          />
                        </td>
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button
                            type="button"
                            onClick={() => requestCancelContact(row)}
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
        open={showBulkPreview && !!templates[bulkTplIdx]}
        onClose={() => setShowBulkPreview(false)}
        templateName={templates[bulkTplIdx]?.name}
        title={templates[bulkTplIdx]?.title ?? ''}
        body={templates[bulkTplIdx]?.body ?? ''}
        domain="brand"
      />

      <BulkSendProgressModal
        open={bulkSendModal !== null}
        state={bulkSendModal}
        unit="건"
        onClose={() => setBulkSendModal(null)}
      />

    </div>
  )
}
