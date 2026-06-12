import { useEffect, useState, type CSSProperties } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Pagination from '../../../components/Pagination'
import Modal from '../../../components/Modal'

interface EmsDataRow {
  id:              string
  influencer_id:   string | null
  seq:             number | null
  name:            string
  country:         string | null
  zip:             string | null
  email:           string | null
  address_line_1:  string | null
  address_line_2:  string | null
  address_detail:  string | null
  city:            string | null
  state:           string | null
  phone:           string | null
  phone_cc:        string
  phone_area:      string
  phone_1:         string
  phone_2:         string
}

type EditField = 'name_email' | 'country' | 'zip' | 'address' | 'city' | 'state' | 'phone'

interface EditForm {
  name:   string
  email:  string
  country: string
  zip:    string
  addr1:  string
  addr2:  string
  city:   string
  state:  string
  phone:  string
}

function parsePhone(phone: string | null): Pick<EmsDataRow, 'phone_cc' | 'phone_area' | 'phone_1' | 'phone_2'> {
  if (!phone?.trim()) return { phone_cc: '', phone_area: '', phone_1: '', phone_2: '' }
  const digits = phone.replace(/\D/g, '')
  let d = digits
  let cc = '1'
  if (d.length === 11 && d.startsWith('1')) {
    cc = '1'
    d = d.slice(1)
  } else if (d.length === 10) {
    cc = '1'
  } else if (d.length > 10) {
    cc = d.slice(0, d.length - 10)
    d = d.slice(-10)
  }
  if (d.length >= 10) {
    return { phone_cc: cc, phone_area: d.slice(0, 3), phone_1: d.slice(3, 7), phone_2: d.slice(7, 10) }
  }
  return { phone_cc: '', phone_area: '', phone_1: phone.trim(), phone_2: '' }
}

function formatPhoneDisplay(r: EmsDataRow): string {
  if (r.phone?.trim()) return r.phone
  const { phone_cc, phone_area, phone_1, phone_2 } = r
  if (phone_cc && phone_area && phone_1 && phone_2) {
    return `+${phone_cc} ${phone_area}-${phone_1}-${phone_2}`
  }
  const parts = [phone_cc && `+${phone_cc}`, phone_area, phone_1, phone_2].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

const TH: CSSProperties = {
  background: '#1a3a6e',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  padding: '10px 8px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  borderRight: '1px solid #2a4a7e',
  lineHeight: 1.35,
}

const TD: CSSProperties = {
  fontSize: 12,
  padding: '8px 10px',
  borderBottom: '1px solid var(--gray-2)',
  borderRight: '1px solid var(--gray-2)',
  verticalAlign: 'middle',
}

const EDIT_TD: CSSProperties = {
  ...TD,
  cursor: 'pointer',
}

const EXCEL_HEADERS = [
  'No (seq)',
  '받는 분 이름(Name)',
  'E-mail(필수사항)',
  '국가(Country)',
  '우편번호(ZipCode)',
  '받는 분 주소(Detail)',
  '받는 분 주소(City)',
  '받는 분 주소(State)',
  '연락처(Mobile No.) 국가번호 / 호',
  '연락처(Mobile No.) 지역번호 / 호',
  '연락처(Mobile No.) 전화번호 1 / 호1',
  '연락처(Mobile No.) 전화번호 2 / 호2',
] as const

const FIELD_LABELS: Record<EditField, string> = {
  name_email: '이름 · 이메일',
  country:    '국가',
  zip:        '우편번호',
  address:    '주소 (Detail)',
  city:       '도시',
  state:      '주/도',
  phone:      '연락처',
}

function mapCiToRow(ci: {
  id: string
  influencer_id: string | null
  seq: number | null
  email: string | null
  phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  influencers?: { display_name: string | null; handle: string | null } | null
}): EmsDataRow {
  const inf = ci.influencers
  const name = inf?.display_name || inf?.handle || '—'
  const detail = [ci.address_line_1, ci.address_line_2].filter(Boolean).join(', ') || null
  const phoneParts = parsePhone(ci.phone)
  return {
    id:             ci.id,
    influencer_id:  ci.influencer_id,
    seq:            ci.seq ?? null,
    name,
    country:        ci.country || null,
    zip:            ci.zip || null,
    email:          ci.email || null,
    address_line_1: ci.address_line_1 || null,
    address_line_2: ci.address_line_2 || null,
    address_detail: detail,
    city:           ci.city || null,
    state:          ci.state || null,
    phone:          ci.phone || null,
    ...phoneParts,
  }
}

function downloadEmsExcel(data: EmsDataRow[]) {
  const sheetData: (string | number)[][] = [
    [...EXCEL_HEADERS],
    ...data.map(r => [
      r.seq ?? '',
      r.name,
      r.email ?? '',
      r.country ?? '',
      r.zip ?? '',
      r.address_detail ?? '',
      r.city ?? '',
      r.state ?? '',
      r.phone_cc,
      r.phone_area,
      r.phone_1,
      r.phone_2,
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!cols'] = [
    { wch: 8 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
    { wch: 36 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 10 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'EMS 발송 데이터')
  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `EMS_발송데이터_${date}.xlsx`)
}

function rowToForm(row: EmsDataRow): EditForm {
  return {
    name:    row.name === '—' ? '' : row.name,
    email:   row.email || '',
    country: row.country || '',
    zip:     row.zip || '',
    addr1:   row.address_line_1 || '',
    addr2:   row.address_line_2 || '',
    city:    row.city || '',
    state:   row.state || '',
    phone:   row.phone || formatPhoneDisplay(row) === '—' ? '' : (row.phone || formatPhoneDisplay(row)),
  }
}

function applyFormToRow(row: EmsDataRow, field: EditField, form: EditForm): EmsDataRow {
  const next = { ...row }
  if (field === 'name_email') {
    next.name = form.name || '—'
    next.email = form.email || null
  }
  if (field === 'country') next.country = form.country || null
  if (field === 'zip') next.zip = form.zip || null
  if (field === 'address') {
    next.address_line_1 = form.addr1 || null
    next.address_line_2 = form.addr2 || null
    next.address_detail = [form.addr1, form.addr2].filter(Boolean).join(', ') || null
  }
  if (field === 'city') next.city = form.city || null
  if (field === 'state') next.state = form.state || null
  if (field === 'phone') {
    next.phone = form.phone || null
    Object.assign(next, parsePhone(form.phone || null))
  }
  return next
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--gray-3)',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
}

export default function EmsData() {
  const { showToast } = useToast()
  const [rows,       setRows]       = useState<EmsDataRow[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [editRow,    setEditRow]    = useState<EmsDataRow | null>(null)
  const [editField,  setEditField]  = useState<EditField | null>(null)
  const [editForm,   setEditForm]   = useState<EditForm | null>(null)
  const [saving,     setSaving]     = useState(false)
  const PAGE_SIZE = 25

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('confirmed_influencers')
        .select(`
          id, seq, email, phone, influencer_id,
          address_line_1, address_line_2, city, state, zip, country,
          influencers!inner(display_name, handle)
        `)
        .order('seq', { ascending: true, nullsFirst: false })

      if (error) throw error
      setRows((data || []).map((ci: any) => mapCiToRow(ci)))
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setLoading(false)
  }

  function openEdit(row: EmsDataRow, field: EditField) {
    setEditRow(row)
    setEditField(field)
    setEditForm(rowToForm(row))
  }

  function closeEdit() {
    setEditRow(null)
    setEditField(null)
    setEditForm(null)
  }

  async function saveEdit() {
    if (!editRow || !editField || !editForm) return
    setSaving(true)
    try {
      if (editField === 'name_email') {
        if (editRow.influencer_id && editForm.name.trim()) {
          const { error } = await supabase
            .from('influencers')
            .update({ display_name: editForm.name.trim() })
            .eq('id', editRow.influencer_id)
          if (error) throw error
        }
        const { error } = await supabase
          .from('confirmed_influencers')
          .update({ email: editForm.email.trim() || null })
          .eq('id', editRow.id)
        if (error) throw error
      } else {
        const payload: Record<string, string | null> = {}
        if (editField === 'country') payload.country = editForm.country.trim() || null
        if (editField === 'zip')     payload.zip     = editForm.zip.trim() || null
        if (editField === 'address') {
          payload.address_line_1 = editForm.addr1.trim() || null
          payload.address_line_2 = editForm.addr2.trim() || null
        }
        if (editField === 'city')  payload.city  = editForm.city.trim() || null
        if (editField === 'state') payload.state = editForm.state.trim() || null
        if (editField === 'phone') payload.phone = editForm.phone.trim() || null

        const { error } = await supabase
          .from('confirmed_influencers')
          .update(payload)
          .eq('id', editRow.id)
        if (error) throw error
      }

      const updated = applyFormToRow(editRow, editField, editForm)
      setRows(prev => prev.map(r => r.id === editRow.id ? updated : r))
      showToast('저장 완료', 'success')
      closeEdit()
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSaving(false)
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return [String(r.seq), r.name, r.email, r.zip, r.country, r.address_detail, r.city, r.state, r.phone, formatPhoneDisplay(r)]
      .join(' ').toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const startIdx   = (safePage - 1) * PAGE_SIZE
  const paged      = filtered.slice(startIdx, startIdx + PAGE_SIZE)

  const withAddress = rows.filter(r => r.address_detail && r.email).length

  function handleDownload() {
    if (!rows.length) {
      showToast('다운로드할 데이터가 없습니다.', 'info')
      return
    }
    downloadEmsExcel(rows)
    showToast(`${rows.length}건 Excel 다운로드 완료`, 'success')
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco"><FileSpreadsheet size={28} /></span>
        <div>
          <div className="page-banner-title">EMS 발송 데이터</div>
          <div className="page-banner-desc">확정 인플루언서(seq) 배송 정보를 우체국 EMS 양식 형식으로 확인합니다. 셀을 클릭하면 수정할 수 있습니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={handleDownload} disabled={loading || rows.length === 0}>
            <Download size={15} /> Excel 다운로드
          </button>
          <button className="page-banner-btn page-banner-btn--secondary" onClick={loadData}>
            <span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침
          </button>
        </div>
      </div>

      <div className="cards">
        <div className="card highlight"><div className="card-label">총 인원</div><div className="card-value">{rows.length}</div></div>
        <div className="card"><div className="card-label">주소·이메일 완료</div><div className="card-value" style={{ color: 'var(--green)' }}>{withAddress}</div></div>
        <div className="card"><div className="card-label">미완료</div><div className="card-value" style={{ color: '#e67e22' }}>{rows.length - withAddress}</div></div>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="seq, 이름, 이메일, 우편번호, 주소 검색..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, minWidth: 200, maxWidth: 400 }}
        />
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && (
        <>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1000, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>No<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(seq)</span></th>
                  <th style={TH}>받는 분 이름<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(Name)</span><br />E-mail(필수사항)</th>
                  <th style={TH}>국가<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(Country)</span></th>
                  <th style={TH}>우편번호<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(ZipCode)</span></th>
                  <th style={TH}>받는 분 주소<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(Detail)</span></th>
                  <th style={TH}>받는 분 주소<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(City)</span></th>
                  <th style={TH}>받는 분 주소<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(State)</span></th>
                  <th style={TH}>연락처<br /><span style={{ fontWeight: 400, opacity: 0.85 }}>(Mobile No.)</span></th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
                  : paged.map((r, i) => (
                    <tr key={r.id}>
                      <td style={{ ...TD, textAlign: 'center', color: 'var(--gray-5)', fontWeight: 600 }}>{r.seq ?? startIdx + i + 1}</td>
                      <td style={EDIT_TD} onClick={() => openEdit(r, 'name_email')} title="클릭하여 수정">
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--blue-dk)', marginTop: 3 }}>{r.email || '—'}</div>
                      </td>
                      <td style={{ ...EDIT_TD, textAlign: 'center' }} onClick={() => openEdit(r, 'country')} title="클릭하여 수정">{r.country || '—'}</td>
                      <td style={{ ...EDIT_TD, fontFamily: 'monospace', fontSize: 11 }} onClick={() => openEdit(r, 'zip')} title="클릭하여 수정">{r.zip || '—'}</td>
                      <td style={{ ...EDIT_TD, maxWidth: 220 }} onClick={() => openEdit(r, 'address')} title="클릭하여 수정">{r.address_detail || '—'}</td>
                      <td style={EDIT_TD} onClick={() => openEdit(r, 'city')} title="클릭하여 수정">{r.city || '—'}</td>
                      <td style={EDIT_TD} onClick={() => openEdit(r, 'state')} title="클릭하여 수정">{r.state || '—'}</td>
                      <td style={{ ...EDIT_TD, fontFamily: 'monospace', fontSize: 11 }} onClick={() => openEdit(r, 'phone')} title="클릭하여 수정">{formatPhoneDisplay(r)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage} totalPages={totalPages} total={filtered.length}
            startIdx={startIdx} endIdx={Math.min(startIdx + PAGE_SIZE, filtered.length)}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      <Modal
        open={!!editRow && !!editField && !!editForm}
        onClose={closeEdit}
        title={editRow && editField ? `${FIELD_LABELS[editField]} 수정 · seq ${editRow.seq ?? '—'}` : ''}
      >
        {editForm && editField && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {editField === 'name_email' && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>받는 분 이름 (Name)</label>
                  <input value={editForm.name} onChange={e => setEditForm(f => f ? { ...f, name: e.target.value } : f)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>E-mail (필수사항)</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(f => f ? { ...f, email: e.target.value } : f)} style={inputStyle} />
                </div>
              </>
            )}
            {editField === 'country' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>국가 (Country)</label>
                <input value={editForm.country} onChange={e => setEditForm(f => f ? { ...f, country: e.target.value } : f)} style={inputStyle} />
              </div>
            )}
            {editField === 'zip' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>우편번호 (ZipCode)</label>
                <input value={editForm.zip} onChange={e => setEditForm(f => f ? { ...f, zip: e.target.value } : f)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
              </div>
            )}
            {editField === 'address' && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>주소 Line 1</label>
                  <input value={editForm.addr1} onChange={e => setEditForm(f => f ? { ...f, addr1: e.target.value } : f)} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>주소 Line 2</label>
                  <input value={editForm.addr2} onChange={e => setEditForm(f => f ? { ...f, addr2: e.target.value } : f)} style={inputStyle} />
                </div>
              </>
            )}
            {editField === 'city' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>도시 (City)</label>
                <input value={editForm.city} onChange={e => setEditForm(f => f ? { ...f, city: e.target.value } : f)} style={inputStyle} />
              </div>
            )}
            {editField === 'state' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>주/도 (State)</label>
                <input value={editForm.state} onChange={e => setEditForm(f => f ? { ...f, state: e.target.value } : f)} style={inputStyle} />
              </div>
            )}
            {editField === 'phone' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>연락처 (Mobile No.)</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(f => f ? { ...f, phone: e.target.value } : f)}
                  placeholder="e.g. +1 310-555-1234"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
                <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 6 }}>Excel 다운로드 시 국가·지역·번호로 자동 분리됩니다.</div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 8 }}>
              <button className="modal-btn-cancel" onClick={closeEdit}>취소</button>
              <button className="modal-btn-confirm" onClick={saveEdit} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
