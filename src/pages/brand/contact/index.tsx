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
import { FilterSegmentBar } from '@/components/FilterSegmentBar'
import { Button, StatCard, StatCards } from '@/components/ui'
import { formatShortContactDate } from '@/lib/contact/contact-count'

import { fetchEmailTemplates, type EmailTemplate } from '@/lib/template/email-templates'
import { EmailTemplatePreviewModal } from '@/components/EmailTemplatePreview'

function applyPlaceholders(text: string, row: { brand: string; name: string | null; position: string | null }) {
  return text
    .replace(/\{\{브랜드명\}\}/g, row.brand || '')
    .replace(/\{\{담당자\}\}/g,   row.name || '')
    .replace(/\{\{직함\}\}/g,     row.position || '')
}

const TYPES = ['일반', '퍼스널']
const TYPE_FILTER_OPTIONS = [
  { value: '전체', label: '전체' },
  { value: '일반', label: '일반' },
  { value: '퍼스널', label: '퍼스널' },
]
const TYPE_COLOR: Record<string, string> = {
  '일반':   '#3b82f6',
  '퍼스널': '#ec4899',
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
  source:      'general' | 'personal'
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

  const [activeType,       setActiveType]       = useState('전체')
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

  const load = useCallback(async () => {
    if (!selectedPhaseId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: gen, error: genErr }, { data: per, error: perErr }] = await Promise.all([
      supabase.from('brand_general').select('id, brand_name, email, telephone, website, phase_id, status, send_count, reply_count, last_contact_at, last_reply_at, notes').eq('contacted', true).eq('phase_id', selectedPhaseId).order('last_reply_at', { ascending: false, nullsFirst: false }),
      supabase.from('brand_personal').select('id, brand_name, contact_name, position, personal_email, personal_phone, website, phase_id, status, send_count, reply_count, last_contact_at, last_reply_at, notes').eq('contacted', true).eq('phase_id', selectedPhaseId).order('last_reply_at', { ascending: false, nullsFirst: false }),
    ])
    if (genErr) { showToast('일반 DB 오류: ' + genErr.message, 'error'); setLoading(false); return }
    if (perErr) { showToast('퍼스널 DB 오류: ' + perErr.message, 'error'); setLoading(false); return }
    const generalRows: BrandRow[] = (gen ?? []).map((r: any) => ({
      id: r.id, source: 'general' as const,
      brand: r.brand_name, name: null,
      position: null,
      email: Array.isArray(r.email) ? r.email[0] ?? null : r.email,
      phone: r.telephone ?? null, website: r.website ?? null, phase_id: r.phase_id ?? null,
      status: r.status ?? '',
      send_count: r.send_count ?? 0, reply_count: r.reply_count ?? 0,
      last_contact_at: r.last_contact_at ?? null, last_reply_at: r.last_reply_at ?? null, notes: r.notes,
    }))
    const personalRows: BrandRow[] = (per ?? []).map((r: any) => ({
      id: r.id, source: 'personal' as const,
      brand: r.brand_name, name: r.contact_name,
      position: r.position ?? null,
      email: Array.isArray(r.personal_email) ? r.personal_email[0] ?? null : r.personal_email,
      phone: r.personal_phone ?? null, website: r.website ?? null, phase_id: r.phase_id ?? null,
      status: r.status ?? '',
      send_count: r.send_count ?? 0, reply_count: r.reply_count ?? 0,
      last_contact_at: r.last_contact_at ?? null, last_reply_at: r.last_reply_at ?? null, notes: r.notes,
    }))
    setRows([...generalRows, ...personalRows])
    setLoading(false)
  }, [selectedPhaseId, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setPage(1)
    setCheckedIds(new Set())
  }, [selectedPhaseId])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, activeType, statusFilter])

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
    const table = row.source === 'general' ? 'brand_general' : 'brand_personal'
    const { data, error: readErr } = await supabase
      .from(table)
      .select('send_count')
      .eq('id', row.id)
      .single()
    if (readErr) { showToast(readErr.message, 'error'); return false }

    const patch: Partial<BrandRow> = {
      send_count: (data?.send_count ?? 0) + 1,
      status: 'yes',
      last_contact_at: sentAt,
    }
    const { error } = await supabase.from(table).update(patch).eq('id', row.id)
    if (error) { showToast(error.message, 'error'); return false }

    setRows(prev => prev.map(r => r.id === row.id && r.source === row.source ? { ...r, ...patch } : r))
    return true
  }, [showToast])

  const updateField = useCallback(async (row: BrandRow, patch: Partial<BrandRow>) => {
    const table = row.source === 'general' ? 'brand_general' : 'brand_personal'
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
    const { error } = await supabase.from(table).update(dbPatch).eq('id', row.id)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.map(r => r.id === row.id && r.source === row.source ? { ...r, ...patch } : r))

    // Auto-create confirmed_brands entry when status becomes 'accept'
    if (patch.status === 'accept' && row.status !== 'accept' && row.phase_id) {
      const { data: existing } = await supabase
        .from('confirmed_brands')
        .select('id')
        .eq('phase_id', row.phase_id)
        .eq('brand_name', row.brand)
        .maybeSingle()
      if (!existing) {
        await supabase.from('confirmed_brands').insert({
          phase_id:     row.phase_id,
          brand_name:   row.brand,
          contact_name: row.name,
          position:     row.position,
          email:        row.email,
          phone:        row.phone,
          website:      row.website,
        })
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

  const syncReplies = useCallback(async () => {
    const candidates = rows.filter(r => {
      const email = r.email?.trim()
      if (!email) return false
      return r.send_count > 0 || ['yes', 'noreply', 'reply'].includes(r.status)
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
        const row = candidates.find(r => r.email!.toLowerCase() === reply.email.toLowerCase())
        if (!row || !isNewReply(row, reply)) continue

        const table = row.source === 'general' ? 'brand_general' : 'brand_personal'
        const { data: fresh, error: readErr } = await supabase
          .from(table)
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

        const { error } = await supabase.from(table).update(patch).eq('id', row.id)
        if (error) { showToast(error.message, 'error'); continue }

        newReplies++
        if (reply.messageId) messageIds.push(reply.messageId)
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
    }
  }, [rows, showToast, load, applyDeliveryBounces])

  const updateNote = useCallback((row: BrandRow, value: string) => {
    const key = row.id + row.source
    setNoteEdits(prev => ({ ...prev, [key]: value }))
    if (noteTimers.current[key]) clearTimeout(noteTimers.current[key])
    noteTimers.current[key] = setTimeout(() => updateField(row, { notes: value }), 800)
  }, [updateField])

  const rowKey = (r: BrandRow) => r.id + r.source

  const filtered = rows.filter(r => {
    if (activeType === '일반'   && r.source !== 'general')  return false
    if (activeType === '퍼스널' && r.source !== 'personal') return false
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
        const result = await cancelBrandContact(row.id, row.source)
        if (!result.ok) {
          showToast(result.error || '컨택 취소 실패', 'error')
          return
        }
        setRows(prev => prev.filter(r => !(r.id === row.id && r.source === row.source)))
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
          const result = await cancelBrandContact(row.id, row.source)
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

      {/* Banner */}
      <div style={{ background: 'var(--blue-lt)', border: '1px solid rgba(159,186,197,.4)', borderRadius: 14, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue-dk)', marginBottom: 4 }}>브랜드 컨택 관리</h1>
          <p style={{ fontSize: 13, color: '#555' }}>컨택 대상 브랜드의 상태를 관리하고 이메일을 발송합니다.</p>
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
          <button onClick={() => { load(); setCheckedIds(new Set()) }}
            style={{ padding: '7px 14px', background: '#fff', color: '#334', fontWeight: 700, fontSize: 12, borderRadius: 10, border: '1px solid var(--gray-3)', cursor: 'pointer' }}>
            ↻ 새로고침
          </button>
        </div>
      </div>

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
            footer={(
              <>
                {TYPES.map((t, i) => {
                  const count = rows.filter(r => t === '일반' ? r.source === 'general' : r.source === 'personal').length
                  return (
                    <span key={t}>
                      {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                      <span style={{ color: TYPE_COLOR[t] }}>{t} <strong>{count}</strong></span>
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
            unit="건 답장"
            valueColor="#d97706"
            footer={`${replyPct}% 회신율`}
          />
        </StatCards>
      )}

      {/* Filter bar */}
      <FilterSegmentBar
        label="유형"
        ariaLabel="유형 필터"
        value={activeType}
        onChange={v => { setActiveType(v); setPage(1) }}
        style={{ marginBottom: 16 }}
        options={TYPE_FILTER_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
      >
        <input
          type="text"
          placeholder="브랜드명, 담당자, 이메일 검색..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
        />
      </FilterSegmentBar>

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
              {checkedIds.size > 0 && (
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
            emptyLabel="템플릿 없음 — 브랜드 템플릿 관리에서 추가하세요"
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
                    <th style={{ ...thBase, width: 36, padding: '9px 8px', textAlign: 'center' }}>
                      <input type="checkbox"
                        title="현재 페이지 전체 선택"
                        checked={pg.pageItems.length > 0 && pg.pageItems.every(r => checkedIds.has(rowKey(r)))}
                        onChange={e => setCheckedIds(prev => {
                          const pageIds = pg.pageItems.map(rowKey)
                          const { next, rejected } = tryToggleBulkPage(prev, pageIds, e.target.checked)
                          if (rejected) showToast(bulkSendLimitMessage(), 'error')
                          return next
                        })} />
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
                  {pg.pageItems.map(row => {
                    const status = row.status ?? ''
                    const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE['']
                    const typeColor = row.source === 'general' ? TYPE_COLOR['일반'] : TYPE_COLOR['퍼스널']
                    const key = rowKey(row)
                    const noteVal = noteEdits[key] !== undefined ? noteEdits[key] : (row.notes ?? '')
                    const contactDateLabel = formatShortContactDate(row.last_contact_at)
                    const replyDateLabel = formatShortContactDate(row.last_reply_at)
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--gray-2)', borderLeft: `3px solid ${typeColor}`, minHeight: 48 }}>
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <input type="checkbox" checked={checkedIds.has(key)} onChange={e => {
                            const { next, rejected } = tryToggleBulkSelection(checkedIds, key, e.target.checked)
                            if (rejected) showToast(bulkSendLimitMessage(), 'error')
                            setCheckedIds(next)
                          }} />
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
                              ? <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '2px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {row.send_count}차 발송{contactDateLabel ? ` ${contactDateLabel}` : ''}
                                </span>
                              : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                            {(row.reply_count ?? 0) > 0 && (
                              <span style={{ fontSize: 11, background: '#fef3c7', color: '#d97706', borderRadius: 6, padding: '2px 7px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {row.reply_count}차 회신{replyDateLabel ? ` ${replyDateLabel}` : ''}
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
