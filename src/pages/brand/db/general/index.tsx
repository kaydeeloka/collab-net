import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { usePhase } from '@/contexts/PhaseContext'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import BrandDbPhaseImport from '@/components/BrandDbPhaseImport'

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

interface BrandGeneral {
  id:               string
  brand_name:       string
  company:          string | null
  email:            string[] | null
  telephone:        string | null
  website:          string | null
  product_category: string | null
  overseas:         boolean
  contacted:        boolean
  phase_id:         string | null
  source_phase_id:  string | null
  created_at:       string
}

const EMPTY_FORM = {
  brand_name:       '',
  company:          '',
  email:            [''],
  telephone:        '',
  website:          '',
  product_category: '',
  overseas:         false,
  phase_id:         '',
}
type Form = typeof EMPTY_FORM

export default function BrandDbGeneral() {
  const { showToast, showConfirm } = useToast()
  const { selectedPhaseId, phases } = usePhase()
  const phaseNameById = Object.fromEntries(phases.map(p => [p.id, p.name]))
  const navigate = useNavigate()

  const [rows,     setRows]     = useState<BrandGeneral[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [bulkLoading,  setBulkLoading]  = useState(false)

  // add modal
  const [showAdd,  setShowAdd]  = useState(false)
  const [addForm,  setAddForm]  = useState<Form>({ ...EMPTY_FORM, email: [''] })
  const [adding,   setAdding]   = useState(false)

  // view modal
  const [viewRow,  setViewRow]  = useState<BrandGeneral | null>(null)
  const [showView, setShowView] = useState(false)

  // edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editId,   setEditId]   = useState('')
  const [editForm, setEditForm] = useState<Form>({ ...EMPTY_FORM, email: [''] })
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [selectedPhaseId])

  async function load() {
    if (!selectedPhaseId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('brand_general')
      .select('*')
      .eq('phase_id', selectedPhaseId)
      .order('brand_name', { ascending: true })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setRows((data ?? []).map(r => ({
      ...r,
      email: Array.isArray(r.email)
        ? r.email
        : typeof r.email === 'string' && r.email
          ? [r.email]
          : null
    })) as BrandGeneral[])
    setLoading(false)
  }

  function cleanEmails(emails: string[]) {
    const clean = emails.map(e => e.trim()).filter(Boolean)
    return clean.length ? clean : null
  }

  async function addBrand() {
    if (!addForm.brand_name.trim() || !addForm.email.some(e => e.trim()) || !addForm.website.trim()) return
    setAdding(true)
    const { error } = await supabase.from('brand_general').insert({
      brand_name:       addForm.brand_name.trim(),
      company:          addForm.company.trim()          || null,
      email:            cleanEmails(addForm.email),
      telephone:        addForm.telephone.trim()        || null,
      website:          addForm.website.trim()          || null,
      product_category: addForm.product_category.trim() || null,
      overseas:         addForm.overseas,
      phase_id:         addForm.phase_id                || null,
    })
    if (error) { showToast(error.message, 'error'); setAdding(false); return }
    showToast('브랜드가 추가되었습니다', 'success')
    setShowAdd(false)
    setAddForm({ ...EMPTY_FORM, email: [''], phase_id: selectedPhaseId ?? '' })
    setAdding(false)
    load()
  }

  function openView(r: BrandGeneral) {
    setViewRow(r)
    setShowView(true)
  }

  function openEdit(r: BrandGeneral) {
    setEditId(r.id)
    setEditForm({
      brand_name:       r.brand_name,
      company:          r.company          ?? '',
      email:            r.email?.length ? r.email : [''],
      telephone:        r.telephone        ?? '',
      website:          r.website          ?? '',
      product_category: r.product_category ?? '',
      overseas:         r.overseas,
      phase_id:         r.phase_id         ?? '',
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('brand_general').update({
      brand_name:       editForm.brand_name.trim(),
      company:          editForm.company.trim()          || null,
      email:            cleanEmails(editForm.email),
      telephone:        editForm.telephone.trim()        || null,
      website:          editForm.website.trim()          || null,
      product_category: editForm.product_category.trim() || null,
      overseas:         editForm.overseas,
      phase_id:         editForm.phase_id                || null,
    }).eq('id', editId)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('저장 완료', 'success')
    setShowEdit(false)
    setShowView(false)
    setSaving(false)
    load()
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('brand_general').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.filter(r => r.id !== id))
    setShowView(false)
  }

  async function toggleContacted(id: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('brand_general').update({ contacted: next }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else setRows(prev => prev.map(r => r.id === id ? { ...r, contacted: next } : r))
  }

  async function bulkMarkContacted() {
    if (!selected.size) return
    setBulkLoading(true)
    const ids = Array.from(selected)
    const { error } = await supabase.from('brand_general').update({ contacted: true }).in('id', ids)
    if (!error) {
      setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, contacted: true } : r))
      setSelected(new Set())
      navigate('/brand/contact')
    } else showToast(error.message, 'error')
    setBulkLoading(false)
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return [r.brand_name, r.company, r.telephone, r.website, r.product_category, ...(r.email ?? [])]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })
  const sorted = [...filtered].sort((a, b) => {
    const byName = a.brand_name.localeCompare(b.brand_name, 'ko', { sensitivity: 'base' })
    if (byName !== 0) return byName
    return a.contacted === b.contacted ? 0 : a.contacted ? 1 : -1
  })
  const pg = paginate(sorted, page)

  // Shared text field renderer (excludes email which is handled separately)
  const formField = (
    label: string,
    key: keyof Omit<Form, 'overseas' | 'email' | 'phase_id'>,
    form: Form,
    setForm: (f: Form) => void,
    opts?: { placeholder?: string; required?: boolean }
  ) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>
        {label}{opts?.required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      <input
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={opts?.placeholder}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  )

  const emailListEditor = (form: Form, setForm: (f: Form) => void, required?: boolean) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>
        이메일{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {form.email.map((e, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={e}
              onChange={ev => {
                const next = [...form.email]
                next[idx] = ev.target.value
                setForm({ ...form, email: next })
              }}
              placeholder="contact@brand.com"
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
            {form.email.length > 1 && (
              <button type="button"
                onClick={() => setForm({ ...form, email: form.email.filter((_, i) => i !== idx) })}
                style={{ padding: '5px 9px', fontSize: 13, lineHeight: 1, borderRadius: 6, border: '1px solid var(--gray-3)', background: '#fff0f0', color: '#c00', cursor: 'pointer', fontFamily: 'inherit' }}>
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button"
          onClick={() => setForm({ ...form, email: [...form.email, ''] })}
          style={{ alignSelf: 'flex-start', padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: '1.5px dashed var(--teal)', background: '#f0fdfa', color: 'var(--teal-dk)', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '.2px' }}>
          + 이메일 추가
        </button>
      </div>
    </div>
  )

  const overseasToggle = (form: Form, setForm: (f: Form) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px' }}>해외 진출 여부</label>
      <button
        type="button"
        onClick={() => setForm({ ...form, overseas: !form.overseas })}
        style={{
          padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
          border: `1.5px solid ${form.overseas ? '#6ee7b7' : '#e2e8f0'}`,
          background: form.overseas ? '#d1fae5' : '#f1f5f9',
          color: form.overseas ? '#065f46' : '#94a3b8',
        }}>
        {form.overseas ? '✓ 있음' : '— 없음'}
      </button>
    </div>
  )

  return (
    <div>
      {/* Toolbar + Search */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="브랜드명, 이메일, 회사 명으로 검색..."
          style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', width: 300, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>{filtered.length} 건</span>
        {selected.size > 0 && (
          <button
            onClick={bulkMarkContacted}
            disabled={bulkLoading}
            style={{ padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--blue-dk)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {bulkLoading ? '처리 중...' : `일괄 컨택 예정 (${selected.size}개)`}
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrandDbPhaseImport table="brand_general" onImported={load} />
          <button
            onClick={() => { setAddForm({ ...EMPTY_FORM, email: [''], phase_id: selectedPhaseId ?? '' }); setShowAdd(true) }}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#fff', fontFamily: 'inherit' }}>
            + DB 추가
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>
        <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 180px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 210 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ minWidth: 160 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr className="table-head-row">
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={pg.pageItems.length > 0 && pg.pageItems.every(r => selected.has(r.id))}
                    onChange={e => {
                      if (e.target.checked) setSelected(prev => new Set([...prev, ...pg.pageItems.map(r => r.id)]))
                      else setSelected(prev => { const next = new Set(prev); pg.pageItems.forEach(r => next.delete(r.id)); return next })
                    }}
                    style={{ cursor: 'pointer', width: 14, height: 14 }}
                  />
                </th>
                {['브랜드명', '이메일', '홈페이지', '회사 명', '내선번호', '판매 제품 카테고리', '해외 진출', '컨택 대상'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>등록된 브랜드가 없습니다.</td></tr>
              ) : pg.pageItems.map((r) => (
                <tr key={r.id} onClick={() => openView(r)}
                  style={{ borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', background: selected.has(r.id) ? '#eff6ff' : r.contacted ? '#f0fdf4' : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = selected.has(r.id) ? '#dbeafe' : r.contacted ? '#dcfce7' : 'var(--gray-1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = selected.has(r.id) ? '#eff6ff' : r.contacted ? '#f0fdf4' : '')}>
                  <td style={{ textAlign: 'center', padding: '0 8px', height: 50 }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={e => {
                        setSelected(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(r.id)
                          else next.delete(r.id)
                          return next
                        })
                      }}
                      style={{ cursor: 'pointer', width: 14, height: 14 }}
                    />
                  </td>
                  <td style={{ padding: '0 12px', fontWeight: 700, fontSize: 13, color: 'var(--gray-8)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{r.brand_name}</span>
                      {r.source_phase_id && (
                        <span style={{
                          display: 'inline-block', fontSize: 10, fontWeight: 700, width: 'fit-content',
                          background: '#eef8f7', color: 'var(--teal-dk)', borderRadius: 6, padding: '1px 6px',
                        }}>
                          {phaseNameById[r.source_phase_id] ?? '이전 차수'} 이관
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0 12px', fontSize: 12 }}>
                    {r.email?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <a href={`mailto:${r.email[0]}`} onClick={e => e.stopPropagation()} style={{ color: '#1558b0', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {r.email[0]}
                        </a>
                        {r.email.length > 1 && (
                          <span style={{ fontSize: 10, color: 'var(--gray-5)', fontWeight: 600 }}>+{r.email.length - 1} more</span>
                        )}
                      </div>
                    ) : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0 12px' }}>
                    {r.website
                      ? <a href={r.website.startsWith('http') ? r.website : 'https://' + r.website} target="_blank" rel="noopener"
                          onClick={e => e.stopPropagation()} className="video-link" style={{ fontSize: 12 }}>↗ 방문</a>
                      : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)' }}>{r.company || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)' }}>{r.telephone || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.product_category || <span style={{ color: 'var(--gray-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0 12px', textAlign: 'center' }}>
                    {r.overseas
                      ? <span style={{ fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px' }}>있음</span>
                      : <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleContacted(r.id, r.contacted)}
                      style={{
                        padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                        border: `1.5px solid ${r.contacted ? '#6ee7b7' : '#e2e8f0'}`,
                        background: r.contacted ? '#d1fae5' : '#f1f5f9',
                        color: r.contacted ? '#065f46' : '#94a3b8',
                      }}>
                      {r.contacted ? '✓ 컨택' : '컨택'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pg.page} totalPages={pg.totalPages} total={pg.total}
          startIdx={pg.startIdx} endIdx={pg.endIdx}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(pg.totalPages, p + 1))} />
      </div>

      {/* ── Add Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="브랜드 DB 추가">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>필수 입력</div>
          {formField('브랜드 명', 'brand_name', addForm, setAddForm, { required: true, placeholder: '예: MiMuse' })}
          {emailListEditor(addForm, setAddForm, true)}
          {formField('홈페이지', 'website', addForm, setAddForm, { required: true, placeholder: 'https://www.brand.com' })}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 2px' }}>선택 입력</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {formField('회사 명', 'company', addForm, setAddForm, { placeholder: '회사명 입력' })}
            {formField('내선번호', 'telephone', addForm, setAddForm, { placeholder: '02-1234-5678' })}
          </div>
          {formField('판매 제품 카테고리', 'product_category', addForm, setAddForm, { placeholder: '예: 스킨케어, 색조화장품' })}
          {overseasToggle(addForm, setAddForm)}
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="modal-btn-cancel" onClick={() => setShowAdd(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={addBrand}
            disabled={adding || !addForm.brand_name.trim() || !addForm.email.some(e => e.trim()) || !addForm.website.trim()}>
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      {viewRow && (
        <Modal open={showView} onClose={() => setShowView(false)} title={viewRow.brand_name}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Emails */}
            {viewRow.email?.length ? (
              <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110, flexShrink: 0 }}>이메일</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {viewRow.email.map((e, i) => (
                    <a key={i} href={`mailto:${e}`} style={{ fontSize: 13, color: 'var(--blue-dk)', textDecoration: 'none' }}>{e}</a>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110, flexShrink: 0 }}>이메일</span>
                <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>
              </div>
            )}
            {[
              { label: '회사 명',    value: viewRow.company },
              { label: '내선번호',   value: viewRow.telephone },
              { label: '판매 제품',  value: viewRow.product_category },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, color: value ? 'var(--gray-8)' : 'var(--gray-3)' }}>{value || '—'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110, flexShrink: 0 }}>홈페이지</span>
              {viewRow.website
                ? <a href={viewRow.website.startsWith('http') ? viewRow.website : 'https://' + viewRow.website} target="_blank" rel="noopener" className="video-link" style={{ fontSize: 13, wordBreak: 'break-all' }}>↗ {viewRow.website}</a>
                : <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>}
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110 }}>해외 진출</span>
              {viewRow.overseas
                ? <span style={{ fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px' }}>있음</span>
                : <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => showConfirm('이 브랜드를 삭제하시겠습니까?', () => { void deleteRow(viewRow.id) })}
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

      {/* ── Edit Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="브랜드 정보 편집">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>필수 입력</div>
          {formField('브랜드 명', 'brand_name', editForm, setEditForm, { required: true })}
          {emailListEditor(editForm, setEditForm, true)}
          {formField('홈페이지', 'website', editForm, setEditForm, { required: true })}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 2px' }}>선택 입력</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {formField('회사 명', 'company', editForm, setEditForm)}
            {formField('내선번호', 'telephone', editForm, setEditForm)}
          </div>
          {formField('판매 제품 카테고리', 'product_category', editForm, setEditForm)}
          {overseasToggle(editForm, setEditForm)}
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="modal-btn-cancel" onClick={() => setShowEdit(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={saveEdit}
            disabled={saving || !editForm.brand_name.trim() || !editForm.email.some(e => e.trim()) || !editForm.website.trim()}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
