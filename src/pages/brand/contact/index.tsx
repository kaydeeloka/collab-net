import React, { useEffect, useState, useCallback, useRef } from 'react'
import { ListFilter, MailCheck } from 'lucide-react'
import { gasPost } from '@/lib/api'
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
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Pagination from '@/components/Pagination'
import { TableActionBar } from '@/components/StickyBar'
import { Button } from '@/components/ui'
import { formatShortContactDate } from '@/lib/contact-count'

import { fetchEmailTemplates, type EmailTemplate } from '@/lib/email-templates'

const DUMMY: Record<string, { value: string; color: string }> = {
  '{{브랜드명}}':  { value: 'AmorePacific',      color: '#a07800' },
  '{{담당자}}':    { value: '김민지',             color: '#0369a1' },
  '{{이메일}}':    { value: 'brand@example.com',  color: '#b45309' },
  '{{홈페이지}}':  { value: 'https://example.com', color: '#065f46' },
}

function renderWithDummy(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []; let remaining = text; let key = 0
  while (remaining.length > 0) {
    let earliest = -1, earliestTag = ''
    for (const tag of Object.keys(DUMMY)) {
      const idx = remaining.indexOf(tag)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) { earliest = idx; earliestTag = tag }
    }
    if (earliest === -1) { parts.push(remaining); break }
    if (earliest > 0) parts.push(remaining.slice(0, earliest))
    const d = DUMMY[earliestTag]
    parts.push(<span key={key++} style={{ background: d.color + '18', color: d.color, fontWeight: 700, borderRadius: 4, padding: '0 3px', fontSize: '0.95em' }}>{d.value}</span>)
    remaining = remaining.slice(earliest + earliestTag.length)
  }
  return parts
}

function applyPlaceholders(text: string, row: { brand: string; name: string | null; email: string | null }) {
  return text
    .replace(/\{\{브랜드명\}\}/g, row.brand || '')
    .replace(/\{\{담당자\}\}/g,   row.name  || '')
    .replace(/\{\{이메일\}\}/g,   row.email || '')
}

const TYPES = ['일반', '퍼스널']
const TYPE_COLOR: Record<string, string> = {
  '일반':   '#3b82f6',
  '퍼스널': '#ec4899',
}

const STATUS_OPTIONS = [
  { value: '',         label: '컨택 예정', bg: '#e0f2fe', color: '#0369a1' },
  { value: 'yes',      label: '첫발송 완료', bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'noreply',  label: '미회신',   bg: '#f1f5f9', color: '#64748b' },
  { value: 'reply',    label: '단순 회신', bg: '#fef3c7', color: '#d97706' },
  { value: 'positive', label: '긍정 검토', bg: '#d1fae5', color: '#065f46' },
  { value: 'negative', label: '부정 검토', bg: '#fee2e2', color: '#991b1b' },
  { value: 'reject',   label: '거절',     bg: '#fecaca', color: '#dc2626' },
  { value: 'accept',   label: '확정',     bg: '#bbf7d0', color: '#14532d' },
]
const STATUS_STYLE = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, { bg: s.bg, color: s.color }]))

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
  send_count:  number
  reply_count: number
  last_reply_at: string | null
  notes:       string | null
}

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

export default function BrandContact() {
  const { showToast, showConfirm } = useToast()

  const [rows,    setRows]    = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)

  const [activeType,       setActiveType]       = useState('전체')
  const [statusFilter,     setStatusFilter]     = useState('')
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [filterDropdownPos, setFilterDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [page,             setPage]             = useState(1)
  const statusFilterRef = useRef<HTMLDivElement>(null)
  const filterBtnRef    = useRef<HTMLButtonElement>(null)

  const [checkedIds,      setCheckedIds]      = useState<Set<string>>(new Set())
  const [bulkSending,     setBulkSending]     = useState(false)
  const [syncingReplies,  setSyncingReplies]  = useState(false)
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

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!showStatusFilter) return
    const handler = (e: MouseEvent) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setShowStatusFilter(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusFilter])

  async function load() {
    setLoading(true)
    const [{ data: gen, error: genErr }, { data: per, error: perErr }] = await Promise.all([
      supabase.from('brand_general').select('id, brand_name, email, telephone, website, phase_id, status, send_count, reply_count, last_reply_at, notes').eq('contacted', true).order('last_reply_at', { ascending: false, nullsFirst: false }),
      supabase.from('brand_personal').select('id, brand_name, contact_name, position, personal_email, personal_phone, website, phase_id, status, send_count, reply_count, last_reply_at, notes').eq('contacted', true).order('last_reply_at', { ascending: false, nullsFirst: false }),
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
      send_count: r.send_count ?? 0, reply_count: r.reply_count ?? 0, last_reply_at: r.last_reply_at ?? null, notes: r.notes,
    }))
    const personalRows: BrandRow[] = (per ?? []).map((r: any) => ({
      id: r.id, source: 'personal' as const,
      brand: r.brand_name, name: r.contact_name,
      position: r.position ?? null,
      email: Array.isArray(r.personal_email) ? r.personal_email[0] ?? null : r.personal_email,
      phone: r.personal_phone ?? null, website: r.website ?? null, phase_id: r.phase_id ?? null,
      status: r.status ?? '',
      send_count: r.send_count ?? 0, reply_count: r.reply_count ?? 0, last_reply_at: r.last_reply_at ?? null, notes: r.notes,
    }))
    setRows([...generalRows, ...personalRows])
    setLoading(false)
  }

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
        dbPatch.last_reply_at = new Date().toISOString()
        patch = { ...patch, last_reply_at: dbPatch.last_reply_at as string }
      }
    }
    if (patch.send_count  !== undefined) dbPatch.send_count  = patch.send_count
    if (patch.reply_count !== undefined) dbPatch.reply_count = patch.reply_count
    if (patch.last_reply_at !== undefined) dbPatch.last_reply_at = patch.last_reply_at
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
        lastReplyAt: toIsoTimestamp(r.last_reply_at),
      }))
      const replies = await fetchOutlookReplies(syncItems)

      const messageIds: string[] = []
      let newReplies = 0
      let statusUpdates = 0

      for (const reply of replies) {
        const row = candidates.find(r => r.email!.toLowerCase() === reply.email.toLowerCase())
        if (!row || !isNewReply({ last_reply_at: row.last_reply_at }, reply)) continue

        newReplies++
        const patch: Partial<BrandRow> = {
          last_reply_at: replyTimestamp(reply),
          reply_count: row.reply_count + 1,
        }
        if (shouldAutoMarkReply(row.status)) {
          patch.status = 'reply'
          statusUpdates++
        }

        await updateField(row, patch)
        if (reply.messageId) messageIds.push(reply.messageId)
      }

      if (messageIds.length) await markRepliesReadInOutlook(messageIds)

      setPage(1)
      await load()
      if (newReplies === 0) {
        showToast('새 회신 없음 (이미 반영된 회신)', 'success')
      } else {
        showToast(`새 회신 ${newReplies}건 반영 · 상태 ${statusUpdates}건 업데이트`, 'success')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '회신 확인 실패', 'error')
    } finally {
      setSyncingReplies(false)
    }
  }, [rows, showToast, updateField])

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
    if (statusFilter && r.status !== statusFilter) return false
    return true
  }).sort((a, b) => compareByRecentReply(a, b))
  const pg = paginate(filtered, page)

  const sentCount    = rows.filter(r => r.send_count > 0).length
  const repliedCount = rows.filter(r => ['reply', 'positive', 'negative', 'accept'].includes(r.status)).length

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>전체 컨택 리스트</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{rows.length}</span>
              <span style={{ fontSize: 14, color: 'var(--gray-5)' }}>건</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
              {TYPES.map((t, i) => {
                const count = rows.filter(r => t === '일반' ? r.source === 'general' : r.source === 'personal').length
                return (
                  <span key={t}>
                    {i > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                    <span style={{ color: TYPE_COLOR[t] }}>{t} <strong>{count}</strong></span>
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--gray-2)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>발송 성과율</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--gray-8)', letterSpacing: '-1px' }}>{sentCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>/ {rows.length} 발송됨</span>
            </div>
            <div style={{ height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${rows.length > 0 ? Math.min(sentCount / rows.length * 100, 100) : 0}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{rows.length > 0 ? Math.round(sentCount / rows.length * 100) : 0}% 완료</div>
          </div>
          <div style={{ background: 'var(--gray-0)', borderRadius: 14, border: '1px solid var(--yellow-md)', padding: '20px 24px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 8 }}>답장 수신 통계</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-1px' }}>{repliedCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>건 답장</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{sentCount > 0 ? Math.round(repliedCount / sentCount * 100) : 0}% 회신율</div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {['전체', ...TYPES].map(t => {
          const active = activeType === t
          const color = t === '전체' ? '#64748b' : (TYPE_COLOR[t] ?? '#64748b')
          return (
            <button key={t} onClick={() => { setActiveType(t); setPage(1) }}
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
                  {rows.filter(r => t === '일반' ? r.source === 'general' : r.source === 'personal').length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--gray-3)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>

        <TableActionBar
          selectedCount={checkedIds.size}
          unit="건"
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowBulkPreview(true)} disabled={templates.length === 0}>
                미리보기
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkSending || checkedIds.size === 0 || templates.length === 0}
                onClick={() => {
                  const tpl = templates[bulkTplIdx]
                  if (!tpl) return
                  showConfirm(`${checkedIds.size}건에게 일괄 발송하시겠습니까?`, async () => {
                    setBulkSending(true)
                    for (const key of Array.from(checkedIds)) {
                      const row = filtered.find(r => rowKey(r) === key)
                      if (!row || !row.email) continue
                      await gasPost({ action: 'sendOutreachEmail', to: row.email, subject: applyPlaceholders(tpl.title, row), body: applyPlaceholders(tpl.body, row) })
                      await updateField(row, { send_count: row.send_count + 1, status: 'yes' })
                    }
                    setBulkSending(false); setCheckedIds(new Set())
                    showToast('일괄 발송 완료', 'success')
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
          {templates.length === 0
            ? <span style={{ fontSize: 12, color: 'var(--gray-5)', fontStyle: 'italic' }}>템플릿 없음 — 브랜드 템플릿 관리에서 추가하세요</span>
            : (
              <select className="table-action-bar__select" value={bulkTplIdx} onChange={e => setBulkTplIdx(+e.target.value)}>
                {templates.map((t: { id: string; name: string }, i: number) => <option key={t.id} value={i}>{t.name}</option>)}
              </select>
            )}
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
                        checked={pg.pageItems.length > 0 && pg.pageItems.every(r => checkedIds.has(rowKey(r)))}
                        onChange={e => setCheckedIds(prev => {
                          const next = new Set(prev)
                          pg.pageItems.forEach(r => e.target.checked ? next.add(rowKey(r)) : next.delete(rowKey(r)))
                          return next
                        })} />
                    </th>
                    <th style={{ ...thBase, minWidth: 160 }}>브랜드</th>
                    <th style={{ ...thBase, minWidth: 110 }}>성명</th>
                    <th style={{ ...thBase, minWidth: 90 }}>직급</th>
                    <th style={{ ...thBase, minWidth: 180 }}>이메일</th>
                    <th style={{ ...thBase, minWidth: 140 }}>
                      <div ref={statusFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>상태</span>
                        <button ref={filterBtnRef}
                          onClick={() => {
                            if (!showStatusFilter && filterBtnRef.current) {
                              const r = filterBtnRef.current.getBoundingClientRect()
                              setFilterDropdownPos({ top: r.bottom + 4, left: r.left })
                            }
                            setShowStatusFilter(p => !p)
                          }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: statusFilter ? (STATUS_STYLE[statusFilter]?.color ?? '#64748b') : 'transparent', color: statusFilter ? '#fff' : 'var(--gray-4)', cursor: 'pointer', padding: 0 }}>
                          <ListFilter size={13} />
                        </button>
                      </div>
                    </th>
                    <th style={{ ...thBase, minWidth: 110 }}>마지막 컨택 날짜</th>
                    <th style={{ ...thBase, minWidth: 180 }}>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--gray-5)', fontSize: 13 }}>
                      컨택 대상으로 설정된 브랜드가 없습니다.
                    </td></tr>
                  )}
                  {pg.pageItems.map(row => {
                    const status = row.status ?? ''
                    const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE['']
                    const typeColor = row.source === 'general' ? TYPE_COLOR['일반'] : TYPE_COLOR['퍼스널']
                    const key = rowKey(row)
                    const noteVal = noteEdits[key] !== undefined ? noteEdits[key] : (row.notes ?? '')
                    const replyDateLabel = formatShortContactDate(row.last_reply_at)
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid var(--gray-2)', borderLeft: `3px solid ${typeColor}`, height: 48 }}>
                        <td style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <input type="checkbox" checked={checkedIds.has(key)} onChange={e => {
                            const next = new Set(checkedIds); e.target.checked ? next.add(key) : next.delete(key); setCheckedIds(next)
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
                                  {row.send_count}차 발송
                                </span>
                              : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                            {row.reply_count > 0 && (
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

      {/* Status filter dropdown — fixed position to escape overflow container */}
      {showStatusFilter && filterDropdownPos && (
        <div ref={statusFilterRef}
          style={{ position: 'fixed', top: filterDropdownPos.top, left: filterDropdownPos.left, zIndex: 9999, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 140 }}>
          {[{ value: '', label: '전체' }, ...STATUS_OPTIONS.filter(o => o.value !== '')].map(o => (
            <button key={o.value} onClick={() => { setStatusFilter(o.value); setShowStatusFilter(false); setPage(1) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: statusFilter === o.value ? 700 : 500, background: statusFilter === o.value ? ((STATUS_STYLE[o.value]?.bg) ?? '#f1f5f9') : 'transparent', color: statusFilter === o.value ? ((STATUS_STYLE[o.value]?.color) ?? 'var(--gray-7)') : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk Preview Modal */}
      {showBulkPreview && templates[bulkTplIdx] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowBulkPreview(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 580, width: '90%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-8)' }}>템플릿 미리보기</div>
              <button onClick={() => setShowBulkPreview(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-5)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gray-5)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
              {templates[bulkTplIdx].name}
            </div>
            <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--gray-2)' }}>
              <div style={{ fontSize: 10, color: 'var(--gray-4)', marginBottom: 6 }}>보내는 사람 · MiMuse Team</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 10 }}>
                {renderWithDummy(templates[bulkTplIdx].title)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-7)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                {renderWithDummy(templates[bulkTplIdx].body)}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--gray-4)', marginTop: 8 }}>치환 구문은 발송 시 자동 적용됩니다</div>
          </div>
        </div>
      )}

    </div>
  )
}
