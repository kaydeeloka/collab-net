import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useToast } from '../../../../contexts/ToastContext'
import { usePhase } from '../../../../contexts/PhaseContext'
import Modal from '../../../../components/Modal'
import Pagination from '../../../../components/Pagination'

const PAGE_SIZE = 25
function paginate<T>(items: T[], page: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safe = Math.min(page, totalPages)
  const startIdx = (safe - 1) * PAGE_SIZE
  return { pageItems: items.slice(startIdx, startIdx + PAGE_SIZE), total, totalPages, page: safe, startIdx, endIdx: Math.min(startIdx + PAGE_SIZE, total) }
}

interface BrandPersonal {
  id:               string
  brand_name:       string
  contact_name:     string | null
  department:       string | null
  position:         string | null
  personal_email:   string | null
  personal_phone:   string | null
  website:          string | null
  rep_email:        string | null
  telephone:        string | null
  product_category: string | null
  overseas:         boolean
  contacted:        boolean
  phase_id:         string | null
  created_at:       string
}

const EMPTY_FORM = {
  brand_name:       '',
  contact_name:     '',
  department:       '',
  position:         '',
  personal_email:   '',
  personal_phone:   '',
  website:          '',
  rep_email:        '',
  telephone:        '',
  product_category: '',
  overseas:         false,
  phase_id:         '',
}
type Form = typeof EMPTY_FORM

export default function BrandDbPersonal() {
  const { showToast } = useToast()
  const { activePhaseId } = usePhase()

  const [rows,    setRows]    = useState<BrandPersonal[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Form>({ ...EMPTY_FORM })
  const [adding,  setAdding]  = useState(false)

  const [viewRow,  setViewRow]  = useState<BrandPersonal | null>(null)
  const [showView, setShowView] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editId,   setEditId]   = useState('')
  const [editForm, setEditForm] = useState<Form>({ ...EMPTY_FORM })
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { load() }, [activePhaseId])

  async function load() {
    if (!activePhaseId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('brand_personal')
      .select('*')
      .eq('phase_id', activePhaseId)
      .order('created_at', { ascending: false })
    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setRows((data ?? []) as BrandPersonal[])
    setLoading(false)
  }

  async function addBrand() {
    if (!addForm.brand_name.trim()) {
      showToast('브랜드명을 입력해주세요.', 'error'); return
    }
    setAdding(true)
    const { error } = await supabase.from('brand_personal').insert({
      brand_name:       addForm.brand_name.trim(),
      contact_name:     addForm.contact_name.trim()     || null,
      department:       addForm.department.trim()       || null,
      position:         addForm.position.trim()         || null,
      personal_email:   addForm.personal_email.trim()   || null,
      personal_phone:   addForm.personal_phone.trim()   || null,
      website:          addForm.website.trim()          || null,
      rep_email:        addForm.rep_email.trim()        || null,
      telephone:        addForm.telephone.trim()        || null,
      product_category: addForm.product_category.trim() || null,
      overseas:         addForm.overseas,
      phase_id:         addForm.phase_id                || null,
    })
    if (error) { showToast(error.message, 'error'); setAdding(false); return }
    showToast('브랜드가 추가되었습니다', 'success')
    setShowAdd(false); setAddForm({ ...EMPTY_FORM, phase_id: activePhaseId ?? '' }); setAdding(false)
    load()
  }

  function openView(r: BrandPersonal) { setViewRow(r); setShowView(true) }

  function openEdit(r: BrandPersonal) {
    setEditId(r.id)
    setEditForm({
      brand_name:       r.brand_name,
      contact_name:     r.contact_name     ?? '',
      department:       r.department       ?? '',
      position:         r.position         ?? '',
      personal_email:   r.personal_email   ?? '',
      personal_phone:   r.personal_phone   ?? '',
      website:          r.website          ?? '',
      rep_email:        r.rep_email        ?? '',
      telephone:        r.telephone        ?? '',
      product_category: r.product_category ?? '',
      overseas:         r.overseas,
      phase_id:         r.phase_id         ?? '',
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!editForm.brand_name.trim()) {
      showToast('브랜드명을 입력해주세요.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('brand_personal').update({
      brand_name:       editForm.brand_name.trim(),
      contact_name:     editForm.contact_name.trim()     || null,
      department:       editForm.department.trim()       || null,
      position:         editForm.position.trim()         || null,
      personal_email:   editForm.personal_email.trim()   || null,
      personal_phone:   editForm.personal_phone.trim()   || null,
      website:          editForm.website.trim()          || null,
      rep_email:        editForm.rep_email.trim()        || null,
      telephone:        editForm.telephone.trim()        || null,
      product_category: editForm.product_category.trim() || null,
      overseas:         editForm.overseas,
      phase_id:         editForm.phase_id                || null,
    }).eq('id', editId)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('저장 완료', 'success')
    setShowEdit(false); setShowView(false); setSaving(false)
    load()
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('brand_personal').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    setRows(prev => prev.filter(r => r.id !== id))
    setShowView(false)
  }

  async function toggleContacted(id: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('brand_personal').update({ contacted: next }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else setRows(prev => prev.map(r => r.id === id ? { ...r, contacted: next } : r))
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return [r.brand_name, r.contact_name, r.department, r.personal_email, r.website]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })
  const sorted = [...filtered].sort((a, b) => (a.contacted === b.contacted ? 0 : a.contacted ? 1 : -1))
  const pg = paginate(sorted, page)

  const field = (
    label: string,
    key: keyof Omit<Form, 'overseas' | 'phase_id'>,
    form: Form,
    setForm: (f: Form) => void,
    opts?: { placeholder?: string; required?: boolean; type?: string }
  ) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>
        {label}{opts?.required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={opts?.placeholder}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  )

  const overseasBtn = (form: Form, setForm: (f: Form) => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px' }}>해외 진출 여부</label>
      <button type="button" onClick={() => setForm({ ...form, overseas: !form.overseas })}
        style={{ padding: '5px 14px', fontSize: 12, fontWeight: 700, borderRadius: 20, cursor: 'pointer', border: `1.5px solid ${form.overseas ? '#6ee7b7' : '#e2e8f0'}`, background: form.overseas ? '#d1fae5' : '#f1f5f9', color: form.overseas ? '#065f46' : '#94a3b8' }}>
        {form.overseas ? '✓ 있음' : '— 없음'}
      </button>
    </div>
  )

  const modalFields = (form: Form, setForm: (f: Form) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>필수 입력</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {field('브랜드명', 'brand_name',     form, setForm, { required: true })}
        {field('성명',     'contact_name',   form, setForm, { required: true })}
      </div>
      {field('개인 이메일', 'personal_email', form, setForm, { required: true, type: 'email' })}
      {field('홈페이지',    'website',        form, setForm, { required: true, placeholder: 'https://' })}

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '6px 0 2px' }}>선택 입력</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {field('부서',               'department',      form, setForm)}
        {field('직급',               'position',        form, setForm)}
        {field('개인 전화번호',      'personal_phone',  form, setForm, { type: 'tel' })}
        {field('내선 번호',          'telephone',       form, setForm)}
        {field('대표 메일',          'rep_email',       form, setForm, { type: 'email' })}
        {field('판매 제품 카테고리', 'product_category', form, setForm)}
      </div>
      {overseasBtn(form, setForm)}
    </div>
  )

  const infoRow = (label: string, value: string | null | undefined, isLink = false) => (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--gray-1)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110, flexShrink: 0 }}>{label}</span>
      {isLink && value
        ? <a href={value.startsWith('http') ? value : 'https://' + value} target="_blank" rel="noopener" className="video-link" style={{ fontSize: 13 }}>↗ 방문</a>
        : <span style={{ fontSize: 13, color: value ? 'var(--gray-8)' : 'var(--gray-3)' }}>{value || '—'}</span>}
    </div>
  )

  return (
    <div>
      {/* Toolbar + Search */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="브랜드명, 성명, 이메일로 검색..."
          style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--gray-3)', borderRadius: 8, outline: 'none', width: 300, fontFamily: 'inherit' }}
        />
        <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>{filtered.length} 건</span>
        <button
          onClick={() => { setAddForm({ ...EMPTY_FORM, phase_id: activePhaseId ?? '' }); setShowAdd(true) }}
          style={{ marginLeft: 'auto', padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--teal)', color: '#fff', fontFamily: 'inherit' }}>
          + DB 추가
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'clip' }}>
        <div style={{ overflowX: 'auto', overflowY: 'scroll', maxHeight: 'calc(100vh - 180px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 900 }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 120 }} />
              <col style={{ minWidth: 130 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--gray-1)' }}>
                {['No.', '브랜드명', '성명', '부서', '직급', '개인 이메일', '개인 전화번호', '홈페이지', '해외 진출', '컨택 대상'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: i === 0 || i === 9 ? 'center' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-6)', borderBottom: '2px solid var(--gray-2)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--gray-5)' }}>등록된 브랜드가 없습니다.</td></tr>
              ) : pg.pageItems.map((r, i) => (
                <tr key={r.id} onClick={() => openView(r)}
                  style={{ borderBottom: '1px solid var(--gray-2)', cursor: 'pointer', background: r.contacted ? '#f0fdf4' : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = r.contacted ? '#dcfce7' : 'var(--gray-1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = r.contacted ? '#f0fdf4' : '')}>
                  <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-5)', padding: '0 8px', height: 44 }}>{i + 1}</td>
                  <td style={{ padding: '0 12px', fontWeight: 700, fontSize: 13, color: 'var(--gray-8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.brand_name}</td>
                  <td style={{ padding: '0 12px', fontSize: 13, color: 'var(--gray-7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.contact_name}</td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.department}</td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.position}</td>
                  <td style={{ padding: '0 12px', fontSize: 12 }}>
                    {r.personal_email
                      ? <a href={`mailto:${r.personal_email}`} onClick={e => e.stopPropagation()} style={{ color: '#1558b0', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.personal_email}</a>
                      : <span style={{ color: 'var(--gray-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0 12px', fontSize: 12, color: 'var(--gray-7)' }}>{r.personal_phone || <span style={{ color: 'var(--gray-3)' }}>—</span>}</td>
                  <td style={{ padding: '0 12px' }}>
                    {r.website
                      ? <a href={r.website.startsWith('http') ? r.website : 'https://' + r.website} target="_blank" rel="noopener"
                          onClick={e => e.stopPropagation()} className="video-link" style={{ fontSize: 12 }}>↗ 방문</a>
                      : <span style={{ fontSize: 12, color: 'var(--gray-3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0 12px', textAlign: 'center' }}>
                    {r.overseas
                      ? <span style={{ fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px' }}>있음</span>
                      : <span style={{ fontSize: 11, color: 'var(--gray-4)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleContacted(r.id, r.contacted)}
                      style={{ padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer', border: `1.5px solid ${r.contacted ? '#6ee7b7' : '#e2e8f0'}`, background: r.contacted ? '#d1fae5' : '#f1f5f9', color: r.contacted ? '#065f46' : '#94a3b8' }}>
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

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="퍼스널 브랜드 DB 추가">
        {modalFields(addForm, setAddForm)}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={() => setShowAdd(false)}
            style={{ padding: '8px 18px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'var(--gray-1)', color: 'var(--gray-6)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={addBrand} disabled={adding}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--teal-dk)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.6 : 1 }}>
            {adding ? '추가 중...' : '추가'}
          </button>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRow && (
        <Modal open={showView} onClose={() => setShowView(false)} title={viewRow.brand_name}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {infoRow('성명',      viewRow.contact_name ?? null)}
            {infoRow('부서',        viewRow.department)}
            {infoRow('직급',        viewRow.position)}
            {infoRow('개인 이메일', viewRow.personal_email)}
            {infoRow('개인 전화',   viewRow.personal_phone)}
            {infoRow('홈페이지',    viewRow.website, true)}
            {infoRow('대표 메일',   viewRow.rep_email)}
            {infoRow('내선 번호',   viewRow.telephone)}
            {infoRow('판매 제품',   viewRow.product_category)}
            <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', minWidth: 110 }}>해외 진출</span>
              {viewRow.overseas
                ? <span style={{ fontSize: 11, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 10px' }}>있음</span>
                : <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>—</span>}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <button onClick={() => { if (window.confirm('삭제하시겠습니까?')) deleteRow(viewRow.id) }}
              style={{ padding: '7px 14px', border: '1px solid var(--red)', borderRadius: 8, background: '#fff', color: 'var(--red)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>삭제</button>
            <button onClick={() => { setShowView(false); openEdit(viewRow) }}
              style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: 'var(--teal-dk)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>수정</button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="브랜드 정보 수정">
        {modalFields(editForm, setEditForm)}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={() => setShowEdit(false)}
            style={{ padding: '8px 18px', border: '1px solid var(--gray-3)', borderRadius: 8, background: 'var(--gray-1)', color: 'var(--gray-6)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={saveEdit} disabled={saving}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: 'var(--teal-dk)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
