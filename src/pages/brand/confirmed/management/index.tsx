import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../../lib/supabase'
import { usePhase } from '../../../../contexts/PhaseContext'
import { useToast } from '../../../../contexts/ToastContext'
import Modal from '../../../../components/Modal'
import Pagination from '../../../../components/Pagination'
import { archiveDetailPath } from '../archive/slug'
import type { ConfirmedBrand as ArchiveBrandRef } from '../archive/shared'

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
  production_cost: '',
  notes:           '',
}
type Form = typeof EMPTY_FORM

function formatWebsiteUrl(website: string) {
  return website.startsWith('http') ? website : `https://${website}`
}

function toArchiveBrandRef(r: ConfirmedBrand): ArchiveBrandRef {
  return {
    id: r.id,
    brand_name: r.brand_name,
    product: r.product,
    received: r.received,
  }
}

function archiveLinkFor(brand: ConfirmedBrand, allRows: ConfirmedBrand[]) {
  const brands = [...allRows]
    .sort((a, b) => a.brand_name.localeCompare(b.brand_name))
    .map(toArchiveBrandRef)
  return archiveDetailPath(toArchiveBrandRef(brand), brands)
}

export default function BrandConfirmedManagement() {
  const { selectedPhaseId } = usePhase()
  const { showToast }     = useToast()

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
  }

  async function toggleReceived(id: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('confirmed_brands').update({ received: next }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else setRows(prev => prev.map(r => r.id === id ? { ...r, received: next } : r))
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

  const receivedCount = rows.filter(r => r.received).length
  const pendingCount  = rows.length - receivedCount
  const viewArchivePath = viewRow ? archiveLinkFor(viewRow, rows) : null

const modalForm = (form: Form, setForm: (f: Form) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>필수 입력</div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>
          브랜드<span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>
        </label>
        <input value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })}
          placeholder="브랜드명 입력"
          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 2px' }}>선택 입력</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>담당자</label>
          <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="이름 입력"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>직급</label>
          <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="직급 입력"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>이메일</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@brand.com"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>휴대폰</label>
          <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>홈페이지</label>
          <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>제품</label>
          <input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} placeholder="제품명 입력"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>생산원가</label>
          <input value={form.production_cost} onChange={e => setForm({ ...form, production_cost: e.target.value })} placeholder="예: $12.50"
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>비고</label>
        <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="메모"
          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
    </div>
  )

  return (
    <div>
      {/* Stats */}
      <div className="cards" style={{ marginBottom: 20 }}>
        <div className="card highlight">
          <div className="card-label">총 확정 브랜드</div>
          <div className="card-value" style={{ color: 'var(--teal-dk)' }}>{rows.length}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--gray-5)' }}> 개</span></div>
        </div>
        <div className="card">
          <div className="card-label">제품 받음</div>
          <div className="card-value" style={{ color: 'var(--green)' }}>{receivedCount}</div>
          <div className="card-sub">{rows.length ? Math.round(receivedCount / rows.length * 100) : 0}% 수령</div>
        </div>
        <div className="card">
          <div className="card-label">미수령</div>
          <div className="card-value" style={{ color: '#d97706' }}>{pendingCount}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="브랜드, 담당자, 이메일, 제품으로 검색..."
          style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', width: 300, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>{filtered.length} 건</span>
        <button
          onClick={() => { setEditId(''); setAddForm({ ...EMPTY_FORM }); setShowAdd(true) }}
          style={{ marginLeft: 'auto', padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#fff', fontFamily: 'inherit' }}>
          + 추가
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>
        <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 180px)' }}>
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
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--gray-1)' }}>
                {['No.', '브랜드', '담당자', '직급', '휴대폰', '홈페이지', '생산원가', '제품 받음', '비고'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 || i === 7 ? 'center' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-6)', borderBottom: '2px solid var(--gray-2)', whiteSpace: 'nowrap' }}>
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

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="확정 브랜드 추가">
        {modalForm(addForm, setAddForm)}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="modal-btn-cancel" onClick={() => setShowAdd(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={addBrand} disabled={adding || !addForm.brand_name.trim()}>
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={showView} onClose={() => setShowView(false)} title={viewRow.brand_name}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 12px',
              background: viewRow.received ? '#d1fae5' : '#f1f5f9',
              color:      viewRow.received ? '#065f46' : '#94a3b8' }}>
              {viewRow.received ? '✓ 제품 받음' : '미수령'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { label: '담당자',   value: viewRow.contact_name },
              { label: '직급',     value: viewRow.position },
              { label: '휴대폰',   value: viewRow.phone },
              { label: '제품',     value: viewRow.product },
              { label: '생산원가', value: viewRow.production_cost },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 80, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, color: value ? 'var(--gray-8)' : 'var(--gray-3)' }}>{value || '—'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 80, flexShrink: 0 }}>이메일</span>
              {viewRow.email
                ? <a href={`mailto:${viewRow.email}`} style={{ fontSize: 13, color: 'var(--blue-dk)', textDecoration: 'none' }}>{viewRow.email}</a>
                : <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>}
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 80, flexShrink: 0 }}>홈페이지</span>
              {viewRow.website ? (
                <a
                  href={formatWebsiteUrl(viewRow.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--blue-dk)', textDecoration: 'none', wordBreak: 'break-all' }}
                >
                  {viewRow.website}
                </a>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 80, flexShrink: 0 }}>자료 아카이브</span>
              {viewArchivePath ? (
                <Link
                  to={viewArchivePath}
                  onClick={() => setShowView(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '7px 14px',
                    borderRadius: 8,
                    background: 'var(--teal-dk)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  {viewRow.brand_name} 아카이브
                </Link>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>
              )}
            </div>
            {viewRow.notes && (
              <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 80, flexShrink: 0 }}>비고</span>
                <span style={{ fontSize: 13, color: 'var(--gray-7)' }}>{viewRow.notes}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => { if (window.confirm('삭제하시겠습니까?')) deleteRow(viewRow.id) }}
              style={{ padding: '7px 14px', border: '1px solid var(--red)', borderRadius: 8, background: '#fff', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              삭제
            </button>
            <button onClick={() => { setShowView(false); openEdit(viewRow) }}
              style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: 'var(--teal-dk)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ✎ 편집
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="확정 브랜드 편집">
        {modalForm(editForm, setEditForm)}
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="modal-btn-cancel" onClick={() => setShowEdit(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={saveEdit} disabled={saving || !editForm.brand_name.trim()}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
