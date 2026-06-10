import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useToast } from '../../../../contexts/ToastContext'
import Modal from '../../../../components/Modal'
import Spinner from '../../../../components/Spinner'

interface BrandGeneral {
  id:               string
  brand_name:       string
  email:            string | null
  phone:            string | null
  website:          string | null
  product_category: string | null
  overseas:         boolean
  contacted:        boolean
  created_at:       string
}

const EMPTY_FORM = {
  brand_name:       '',
  email:            '',
  phone:            '',
  website:          '',
  product_category: '',
  overseas:         false,
}
type Form = typeof EMPTY_FORM

export default function BrandDbMail() {
  const { showToast } = useToast()

  const [rows,     setRows]     = useState<BrandGeneral[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')

  // add modal
  const [showAdd,  setShowAdd]  = useState(false)
  const [addForm,  setAddForm]  = useState<Form>({ ...EMPTY_FORM })
  const [adding,   setAdding]   = useState(false)

  // view modal
  const [viewRow,  setViewRow]  = useState<BrandGeneral | null>(null)
  const [showView, setShowView] = useState(false)

  // edit modal
  const [showEdit, setShowEdit] = useState(false)
  const [editId,   setEditId]   = useState('')
  const [editForm, setEditForm] = useState<Form>({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('brand_general')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setRows((data ?? []) as BrandGeneral[])
    setLoading(false)
  }

  async function addBrand() {
    if (!addForm.brand_name.trim()) return
    setAdding(true)
    const { error } = await supabase.from('brand_general').insert({
      brand_name:       addForm.brand_name.trim(),
      email:            addForm.email.trim()            || null,
      phone:            addForm.phone.trim()            || null,
      website:          addForm.website.trim()          || null,
      product_category: addForm.product_category.trim() || null,
      overseas:         addForm.overseas,
    })
    if (error) { showToast(error.message, 'error'); setAdding(false); return }
    showToast('브랜드가 추가되었습니다', 'success')
    setShowAdd(false)
    setAddForm({ ...EMPTY_FORM })
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
      email:            r.email            ?? '',
      phone:            r.phone            ?? '',
      website:          r.website          ?? '',
      product_category: r.product_category ?? '',
      overseas:         r.overseas,
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('brand_general').update({
      brand_name:       editForm.brand_name.trim(),
      email:            editForm.email.trim()            || null,
      phone:            editForm.phone.trim()            || null,
      website:          editForm.website.trim()          || null,
      product_category: editForm.product_category.trim() || null,
      overseas:         editForm.overseas,
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

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return [r.brand_name, r.email, r.phone, r.website, r.product_category]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })

  // Shared field renderer
  const formField = (
    label: string,
    key: keyof Omit<Form, 'overseas'>,
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
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
      />
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
      {/* Toolbar */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="page-banner-btn" onClick={() => { setAddForm({ ...EMPTY_FORM }); setShowAdd(true) }}>+ DB 추가</button>
        <button className="page-banner-btn page-banner-btn--secondary" style={{ marginLeft: 'auto' }} onClick={load}>
          {loading ? <Spinner sm /> : '↻'} 새로고침
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="브랜드명, 이메일, 전화번호로 검색..."
          style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', width: 300, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>{filtered.length} 건</span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>
        <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 300px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 860 }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ minWidth: 160 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--gray-1)' }}>
                {['No.', '브랜드명', '이메일', '전화번호', '홈페이지', '판매 제품 종류', '해외 진출', '컨택 대상'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 ? 'center' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-6)', borderBottom: '2px solid var(--gray-2)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>등록된 브랜드가 없습니다.</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.id} onClick={() => openView(r)}
                  style={{ borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', background: r.contacted ? '#f0fdf4' : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = r.contacted ? '#dcfce7' : 'var(--gray-1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = r.contacted ? '#f0fdf4' : '')}>
                  <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-5)', padding: '0 8px', height: 44 }}>{i + 1}</td>
                  <td style={{ padding: '0 12px', fontWeight: 700, fontSize: 13, color: 'var(--gray-8)' }}>{r.brand_name}</td>
                  <td style={{ padding: '0 12px', fontSize: 12 }}>
                    {r.email
                      ? <a href={`mailto:${r.email}`} onClick={e => e.stopPropagation()} style={{ color: '#1558b0', textDecoration: 'none' }}>{r.email}</a>
                      : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)' }}>{r.phone || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                  <td style={{ padding: '0 12px' }}>
                    {r.website
                      ? <a href={r.website.startsWith('http') ? r.website : 'https://' + r.website} target="_blank" rel="noopener"
                          onClick={e => e.stopPropagation()} className="video-link" style={{ fontSize: 12 }}>↗ 열기</a>
                      : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                  </td>
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
      </div>

      {/* ── Add Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="브랜드 DB 추가">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>필수 입력</div>
          {formField('브랜드명', 'brand_name', addForm, setAddForm, { required: true, placeholder: '예: MiMuse' })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {formField('이메일', 'email', addForm, setAddForm, { required: true, placeholder: 'contact@brand.com' })}
            {formField('전화번호', 'phone', addForm, setAddForm, { required: true, placeholder: '02-1234-5678' })}
          </div>
          {formField('홈페이지', 'website', addForm, setAddForm, { required: true, placeholder: 'https://www.brand.com' })}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 2px' }}>선택 입력</div>
          {formField('판매 제품 종류', 'product_category', addForm, setAddForm, { placeholder: '예: 스킨케어, 색조화장품' })}
          {overseasToggle(addForm, setAddForm)}
        </div>
        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button className="modal-btn-cancel" onClick={() => setShowAdd(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={addBrand} disabled={adding || !addForm.brand_name.trim()}>
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </Modal>

      {/* ── View Modal ── */}
      {viewRow && (
        <Modal open={showView} onClose={() => setShowView(false)} title={viewRow.brand_name}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[
                { label: '이메일',      value: viewRow.email,    href: viewRow.email ? `mailto:${viewRow.email}` : null },
                { label: '전화번호',    value: viewRow.phone,    href: null },
                { label: '판매 제품 종류', value: viewRow.product_category, href: null },
                { label: '해외 진출',   value: viewRow.overseas ? '있음' : '없음', href: null },
              ].map(({ label, value, href }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-8)', fontWeight: 500 }}>
                    {value
                      ? href
                        ? <a href={href} style={{ color: 'var(--blue-dk)', textDecoration: 'none' }}>{value}</a>
                        : value
                      : <span style={{ color: 'var(--gray-4)' }}>—</span>}
                  </div>
                </div>
              ))}
            </div>

            {viewRow.website && (
              <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>홈페이지</div>
                <a href={viewRow.website.startsWith('http') ? viewRow.website : 'https://' + viewRow.website}
                  target="_blank" rel="noopener" className="video-link">↗ {viewRow.website}</a>
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button
              onClick={() => deleteRow(viewRow.id)}
              style={{ padding: '7px 14px', background: '#fff0f0', color: '#c00', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600, marginRight: 'auto' }}>
              삭제
            </button>
            <button className="modal-btn-cancel" onClick={() => setShowView(false)}>닫기</button>
            <button className="modal-btn-confirm" onClick={() => { setShowView(false); openEdit(viewRow) }}>✎ 편집</button>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="브랜드 정보 편집">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>필수 입력</div>
          {formField('브랜드명', 'brand_name', editForm, setEditForm, { required: true })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {formField('이메일', 'email', editForm, setEditForm, { required: true })}
            {formField('전화번호', 'phone', editForm, setEditForm, { required: true })}
          </div>
          {formField('홈페이지', 'website', editForm, setEditForm, { required: true })}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 2px' }}>선택 입력</div>
          {formField('판매 제품 종류', 'product_category', editForm, setEditForm)}
          {overseasToggle(editForm, setEditForm)}
        </div>
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
