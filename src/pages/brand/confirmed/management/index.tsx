import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Globe, Info, Mail, Package, Phone, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import { ReportCard, ReportStat } from '@/components/ReportCard'
import { archiveDetailPath } from '../archive/slug'
import {
  Button,
  FormGrid,
  FormInput,
  FormSection,
  ModalFooter,
  PageToolbar,
} from '@/components/ui'
import type { BrandConfirmedContext } from '../index'

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

interface ConfirmedBrand {
  id:              string
  brand_name:      string
  contact_name:    string | null
  position:        string | null
  email:           string | null
  phone:           string | null
  website:         string | null
  product:         string | null
  product_en:      string | null
  production_cost: string | null
  received:        boolean
  notes:           string | null
  phase_id:        string | null
}

const EMPTY_FORM = {
  brand_name:      '',
  contact_name:    '',
  position:        '',
  email:           '',
  phone:           '',
  website:         '',
  product:         '',
  product_en:      '',
  production_cost: '',
  notes:           '',
}
type Form = typeof EMPTY_FORM

function formatWebsiteUrl(website: string) {
  return website.startsWith('http') ? website : `https://${website}`
}

export default function BrandConfirmedManagement() {
  const { selectedPhaseId } = usePhase()
  const { showToast, showConfirm } = useToast()
  const { refreshStats } = useOutletContext<BrandConfirmedContext>()

  const [rows,    setRows]    = useState<ConfirmedBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  const [showAdd,  setShowAdd]  = useState(false)
  const [addForm,  setAddForm]  = useState<Form>({ ...EMPTY_FORM })
  const [adding,   setAdding]   = useState(false)

  const [viewRow,  setViewRow]  = useState<ConfirmedBrand | null>(null)
  const [showView, setShowView] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editId,   setEditId]   = useState('')
  const [editForm, setEditForm] = useState<Form>({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({})
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => { load() }, [selectedPhaseId])

  async function load() {
    if (!selectedPhaseId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('confirmed_brands')
      .select('*')
      .eq('phase_id', selectedPhaseId)
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setRows((data ?? []) as ConfirmedBrand[])
    setLoading(false)
    await refreshStats()
  }

  async function addBrand() {
    if (!addForm.brand_name.trim()) { showToast('브랜드명을 입력해주세요.', 'error'); return }
    setAdding(true)
    const { error } = await supabase.from('confirmed_brands').insert({
      phase_id:        selectedPhaseId,
      brand_name:      addForm.brand_name.trim(),
      contact_name:    addForm.contact_name.trim()    || null,
      position:        addForm.position.trim()        || null,
      email:           addForm.email.trim()           || null,
      phone:           addForm.phone.trim()           || null,
      website:         addForm.website.trim()         || null,
      product:         addForm.product.trim()         || null,
      product_en:      addForm.product_en.trim()      || null,
      production_cost: addForm.production_cost.trim() || null,
      notes:           addForm.notes.trim()           || null,
    })
    if (error) { showToast(error.message, 'error'); setAdding(false); return }
    showToast('확정 브랜드가 추가되었습니다', 'success')
    setShowAdd(false); setAddForm({ ...EMPTY_FORM }); setAdding(false)
    load()
  }

  function openEdit(r: ConfirmedBrand) {
    setEditId(r.id)
    setEditForm({
      brand_name:      r.brand_name,
      contact_name:    r.contact_name    ?? '',
      position:        r.position        ?? '',
      email:           r.email           ?? '',
      phone:           r.phone           ?? '',
      website:         r.website         ?? '',
      product:         r.product         ?? '',
      product_en:      r.product_en      ?? '',
      production_cost: r.production_cost ?? '',
      notes:           r.notes           ?? '',
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!editForm.brand_name.trim()) { showToast('브랜드명을 입력해주세요.', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('confirmed_brands').update({
      brand_name:      editForm.brand_name.trim(),
      contact_name:    editForm.contact_name.trim()    || null,
      position:        editForm.position.trim()        || null,
      email:           editForm.email.trim()           || null,
      phone:           editForm.phone.trim()           || null,
      website:         editForm.website.trim()         || null,
      product:         editForm.product.trim()         || null,
      product_en:      editForm.product_en.trim()      || null,
      production_cost: editForm.production_cost.trim() || null,
      notes:           editForm.notes.trim()           || null,
    }).eq('id', editId)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('저장 완료', 'success')
    setShowEdit(false); setShowView(false); setSaving(false)
    load()
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('confirmed_brands').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.filter(r => r.id !== id))
    setShowView(false)
    await refreshStats()
  }

  async function toggleReceived(id: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('confirmed_brands').update({ received: next }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, received: next } : r))
      await refreshStats()
    }
  }

  function updateNote(id: string, value: string) {
    setNoteEdits(prev => ({ ...prev, [id]: value }))
    if (noteTimers.current[id]) clearTimeout(noteTimers.current[id])
    noteTimers.current[id] = setTimeout(async () => {
      const { error } = await supabase.from('confirmed_brands').update({ notes: value }).eq('id', id)
      if (error) showToast(error.message, 'error')
      else setRows(prev => prev.map(r => r.id === id ? { ...r, notes: value } : r))
    }, 800)
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return [r.brand_name, r.contact_name, r.email, r.product]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })
  const pg = paginate(filtered, page)

  const modalForm = (form: Form, setForm: (f: Form) => void) => (
    <div className="ui-form">
      <FormSection title="필수 입력" />
      <FormInput
        label="브랜드"
        required
        value={form.brand_name}
        onChange={e => setForm({ ...form, brand_name: e.target.value })}
        placeholder="브랜드명 입력"
      />

      <FormSection title="선택 입력" />
      <FormGrid>
        <FormInput label="담당자" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="이름 입력" />
        <FormInput label="직급" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="직급 입력" />
        <FormInput label="이메일" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@brand.com" />
        <FormInput label="휴대폰" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" />
        <FormInput label="홈페이지" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://" />
        <FormInput label="제품" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="제품명 (한국어)" />
        <FormInput label="제품 (영문)" value={form.product_en} onChange={e => setForm({ ...form, product_en: e.target.value })} placeholder="Product name in English" />
        <FormInput label="생산원가" value={form.production_cost} onChange={e => setForm({ ...form, production_cost: e.target.value })} placeholder="예: $12.50" />
      </FormGrid>
      <FormInput label="비고" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="메모" />
    </div>
  )

  return (
    <div>
      <PageToolbar
        search={{
          value: search,
          onChange: v => { setSearch(v); setPage(1) },
          placeholder: '브랜드, 담당자, 이메일, 제품으로 검색...',
        }}
        count={filtered.length}
        actions={
          <Button variant="primary" onClick={() => { setEditId(''); setAddForm({ ...EMPTY_FORM }); setShowAdd(true) }}>
            + 추가
          </Button>
        }
      />

      <div className="ui-panel">
        <div className="ui-panel__scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1100 }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 110 }} />
              <col style={{ minWidth: 140 }} />
            </colgroup>
            <thead>
              <tr className="table-head-row">
                {['No.', '브랜드', '담당자', '직급', '휴대폰', '홈페이지', '생산원가', '제품 받음', '비고'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 || i === 7 ? 'center' : 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>등록된 확정 브랜드가 없습니다.</td></tr>
              ) : pg.pageItems.map((r, i) => {
                const noteVal = noteEdits[r.id] !== undefined ? noteEdits[r.id] : (r.notes ?? '')
                return (
                  <tr key={r.id} onClick={() => { setViewRow(r); setShowView(true) }}
                    style={{ borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', background: r.received ? '#f0fdf4' : undefined }}
                    onMouseEnter={e => (e.currentTarget.style.background = r.received ? '#dcfce7' : 'var(--gray-1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = r.received ? '#f0fdf4' : '')}>
                    <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-5)', padding: '0 8px', height: 50 }}>{pg.startIdx + i + 1}</td>
                    <td style={{ padding: '0 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)', wordBreak: 'break-word' }}>{r.brand_name}</span>
                        {r.product && <span style={{ fontSize: 11, color: 'var(--gray-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0 12px', fontSize: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: 'var(--gray-7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.contact_name || <span style={{ color: 'var(--gray-3)' }}>—</span>}</span>
                        {r.email && <a href={`mailto:${r.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#1558b0', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</a>}
                      </div>
                    </td>
                    <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-6)', wordBreak: 'break-word' }}>{r.position || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                    <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)' }}>{r.phone || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                    <td style={{ padding: '0 12px' }}>
                      {r.website
                        ? <a href={r.website.startsWith('http') ? r.website : 'https://' + r.website} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="video-link" style={{ fontSize: 12 }}>↗ 방문</a>
                        : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)' }}>{r.production_cost || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleReceived(r.id, r.received)}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                          border: `1.5px solid ${r.received ? '#6ee7b7' : '#e2e8f0'}`,
                          background: r.received ? '#d1fae5' : '#f1f5f9',
                          color: r.received ? '#065f46' : '#94a3b8',
                          fontWeight: 700, fontSize: 13,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        {r.received ? '✓' : '—'}
                      </button>
                    </td>
                    <td style={{ padding: '6px 12px' }} onClick={e => e.stopPropagation()}>
                      <textarea
                        value={noteVal}
                        onChange={e => updateNote(r.id, e.target.value)}
                        placeholder="메모..."
                        rows={1}
                        style={{ width: '100%', height: 32, fontSize: 11, padding: '3px 6px', border: '1px solid transparent', borderRadius: 6, background: noteVal ? 'var(--gray-1)' : 'transparent', outline: 'none', fontFamily: 'inherit', color: 'var(--gray-7)', cursor: 'text', resize: 'none', lineHeight: 1.5 }}
                        onFocus={e => { e.currentTarget.style.border = '1px solid var(--gray-3)'; e.currentTarget.style.background = '#fff' }}
                        onBlur={e => { e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.background = noteVal ? 'var(--gray-1)' : 'transparent' }}
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
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="확정 브랜드 추가"
        footer={
          <ModalFooter
            cancel={{ label: '취소', onClick: () => setShowAdd(false) }}
            confirm={{
              label: '추가',
              onClick: addBrand,
              disabled: adding || !addForm.brand_name.trim(),
              loading: '추가 중...',
            }}
          />
        }
      >
        {modalForm(addForm, setAddForm)}
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal
          open={showView}
          onClose={() => setShowView(false)}
          title={`확정 브랜드 · ${viewRow.brand_name}`}
          size="lg"
        >
          <div style={{ background: 'var(--gray-0)', margin: '-4px -4px 0', padding: '4px 4px 0', borderRadius: '0 0 12px 12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <ReportCard icon={<User size={18} />} title="담당자">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ReportStat label="담당자" value={viewRow.contact_name || '—'} />
                  <ReportStat label="직급" value={viewRow.position || '—'} />
                </div>
              </ReportCard>

              <ReportCard icon={<Mail size={18} />} title="연락처">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--gray-7)' }}>
                    <Mail size={15} style={{ color: 'var(--gray-4)', flexShrink: 0, marginTop: 2 }} />
                    {viewRow.email ? (
                      <a href={`mailto:${viewRow.email}`} style={{ color: 'var(--blue-dk)', textDecoration: 'none', wordBreak: 'break-all' }}>{viewRow.email}</a>
                    ) : '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-7)' }}>
                    <Phone size={15} style={{ color: 'var(--gray-4)', flexShrink: 0 }} />
                    {viewRow.phone || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--gray-7)' }}>
                    <Globe size={15} style={{ color: 'var(--gray-4)', flexShrink: 0, marginTop: 2 }} />
                    {viewRow.website ? (
                      <a
                        href={formatWebsiteUrl(viewRow.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="video-link"
                        style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}
                      >
                        ↗ {viewRow.website}
                      </a>
                    ) : '—'}
                  </div>
                </div>
              </ReportCard>
            </div>

            <ReportCard icon={<Package size={18} />} title="제품 정보">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, padding: '4px 0' }}>
                <ReportStat label="제품" value={viewRow.product || '—'} />
                <ReportStat label="제품 (영문)" value={viewRow.product_en || '—'} />
                <ReportStat label="생산원가" value={viewRow.production_cost || '—'} />
                <ReportStat
                  label="제품 수령"
                  value={viewRow.received
                    ? <span style={{ fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px' }}>✓ 받음</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#94a3b8', borderRadius: 20, padding: '2px 10px' }}>미수령</span>}
                />
                <ReportStat
                  label="자료 아카이브"
                  value={(
                    <Link
                      to={archiveDetailPath(viewRow, rows)}
                      className="video-link"
                      style={{ fontSize: 13, fontWeight: 600 }}
                      onClick={() => setShowView(false)}
                    >
                      ↗ 아카이브 보기
                    </Link>
                  )}
                />
              </div>
            </ReportCard>

            <div style={{ marginTop: 14 }}>
              <ReportCard icon={<Info size={18} />} title="비고">
                <div style={{
                  fontSize: 13,
                  color: viewRow.notes?.trim() ? 'var(--gray-7)' : 'var(--gray-4)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  padding: '4px 0',
                }}>
                  {viewRow.notes?.trim() || '—'}
                </div>
              </ReportCard>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingBottom: 4 }}>
              <button
                type="button"
                className="modal-btn-cancel"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                onClick={() => showConfirm('삭제하시겠습니까?', () => { void deleteRow(viewRow.id) })}
              >
                삭제
              </button>
              <div className="modal-actions" style={{ marginTop: 0 }}>
                <button type="button" className="modal-btn-cancel" onClick={() => setShowView(false)}>닫기</button>
                <button type="button" className="modal-btn-confirm" onClick={() => { setShowView(false); openEdit(viewRow) }}>✎ 편집</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="확정 브랜드 편집"
        footer={
          <ModalFooter
            cancel={{ label: '취소', onClick: () => setShowEdit(false) }}
            confirm={{
              label: '저장',
              onClick: saveEdit,
              disabled: saving || !editForm.brand_name.trim(),
              loading: '저장 중...',
            }}
          />
        }
      >
        {modalForm(editForm, setEditForm)}
      </Modal>
    </div>
  )
}
