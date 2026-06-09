import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePhase } from '../../../contexts/PhaseContext'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Modal from '../../../components/Modal'


type UploadStatus = 'Pending' | 'Yes' | 'No' | 'all'

interface InfluencerRef {
  platform:     string | null
  handle:       string | null
  display_name: string | null
  followers:    number | null
  profile_url:  string | null
}

interface ConfirmedRow {
  id:             string
  email:          string | null
  upload_status:  string
  repost:         string | null
  phone:          string | null
  address_line_1: string | null
  address_line_2: string | null
  city:           string | null
  state:          string | null
  zip:            string | null
  country:        string | null
  influencers:    InfluencerRef | null
}

const EMPTY_FORM = {
  phone: '', repost: '',
  addr1: '', addr2: '', city: '', state: '', zip: '', country: '',
}

function fmtFollowers(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>
  const p = platform.toLowerCase()
  const style = p.includes('tiktok')
    ? { background: '#111', color: '#fff' }
    : p.includes('instagram')
    ? { background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff' }
    : p.includes('youtube')
    ? { background: '#ff0000', color: '#fff' }
    : p.includes('facebook')
    ? { background: '#1877f2', color: '#fff' }
    : { background: 'var(--gray-2)', color: 'var(--gray-6)' }
  return <span className="platform-badge" style={style}>{platform}</span>
}

export default function Confirmed() {
  const { activePhaseId } = usePhase()
  const { showToast }     = useToast()

  const [rows,         setRows]         = useState<ConfirmedRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [uploadFilter, setUploadFilter] = useState<UploadStatus>('all')
  const [syncMsg,      setSyncMsg]      = useState('')

  const [showView, setShowView] = useState(false)
  const [viewRow,  setViewRow]  = useState<ConfirmedRow | null>(null)

  const [showEdit,  setShowEdit]  = useState(false)
  const [editId,    setEditId]    = useState('')
  const [editForm,  setEditForm]  = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => { if (activePhaseId) load() }, [activePhaseId])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('confirmed_influencers')
      .select(`
        id, email, upload_status, repost, phone,
        address_line_1, address_line_2, city, state, zip, country,
        influencers(platform, handle, display_name, followers, profile_url)
      `)
      .eq('phase_id', activePhaseId ?? '')
      .order('created_at', { ascending: false })

    if (error) { showToast(error.message, 'error'); setLoading(false); return }
    setRows((data ?? []) as unknown as ConfirmedRow[])
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    setSyncMsg(`마지막 동기화: ${now}`)
    setLoading(false)
  }

  async function updateField(id: string, field: string, value: string) {
    const { error } = await supabase
      .from('confirmed_influencers')
      .update({ [field]: value })
      .eq('id', id)
    if (error) showToast(error.message, 'error')
    else setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function openEdit(r: ConfirmedRow) {
    setEditId(r.id)
    setEditForm({
      phone:  r.phone  || '',
      repost: r.repost || '',
      addr1:       r.address_line_1 || '',
      addr2:       r.address_line_2 || '',
      city:        r.city         || '',
      state:       r.state        || '',
      zip:         r.zip          || '',
      country:     r.country      || '',
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase
      .from('confirmed_influencers')
      .update({
        phone:          editForm.phone  || null,
        repost:         editForm.repost || null,
        address_line_1: editForm.addr1       || null,
        address_line_2: editForm.addr2       || null,
        city:           editForm.city        || null,
        state:          editForm.state       || null,
        zip:            editForm.zip         || null,
        country:        editForm.country     || null,
      })
      .eq('id', editId)
    if (error) { showToast(error.message, 'error') }
    else {
      showToast('저장 완료', 'success')
      setShowEdit(false)
      load()
    }
    setSaving(false)
  }

  const filtered = rows.filter(r => {
    if (uploadFilter !== 'all' && r.upload_status !== uploadFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const text = [
        r.influencers?.display_name,
        r.influencers?.handle,
        r.email,
      ].join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })

  const total    = rows.length
  const uploaded = rows.filter(r => r.upload_status === 'Yes').length
  const pending  = rows.filter(r => r.upload_status === 'Pending').length

  const field = (label: string, key: keyof typeof EMPTY_FORM, opts?: { type?: string; placeholder?: string }) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={opts?.type || 'text'} placeholder={opts?.placeholder}
        value={editForm[key]}
        onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
    </div>
  )

  const selectField = (label: string, key: keyof typeof EMPTY_FORM, options: string[], placeholder = '선택') => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={editForm[key]} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✅</span>
        <div>
          <div className="page-banner-title">확정 인플루언서 관리</div>
          <div className="page-banner-desc">아웃리치에서 수락된 인플루언서 목록입니다. ✎ 버튼으로 상세 정보를 추가하세요.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={load}>
            {loading ? <Spinner sm /> : <span style={{ color: 'var(--blue-dk)' }}>↻</span>} 새로고침
          </button>
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && (
        <>
          <div className="cards">
            <div className="card"><div className="card-label">총 확정 인플루언서</div><div className="card-value">{total}</div></div>
            <div className="card highlight"><div className="card-label">콘텐츠 업로드 완료</div><div className="card-value" style={{ color: 'var(--green)' }}>{uploaded}</div><div className="card-sub">{total ? Math.round(uploaded / total * 100) : 0}% 완료율</div></div>
            <div className="card"><div className="card-label">업로드 대기중</div><div className="card-value">{pending}</div></div>
            <div className="card"><div className="card-label">미업로드</div><div className="card-value">{total - uploaded - pending}</div></div>
          </div>

          <div className="ems-toolbar" style={{ marginTop: 16 }}>
            <div className="section-title section-title--inline">확정 인플루언서 목록</div>
            <span className="ems-sync-msg">{syncMsg}</span>
          </div>

          <div className="filters" style={{ marginBottom: 16, marginTop: 12 }}>
            <input type="text" placeholder="이름, 이메일, 핸들로 검색..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
            <div className="filter-group">
              <label>콘텐츠 업로드:</label>
              {(['all', 'Pending', 'Yes', 'No'] as UploadStatus[]).map((v, i) => (
                <button key={v} className={'ems-filter-btn' + (uploadFilter === v ? ' active' : '')} onClick={() => setUploadFilter(v)}>
                  {['전체', '대기', '완료', '미업로드'][i]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0
            ? <div className="empty">{rows.length === 0 ? '확정된 인플루언서가 없습니다.' : '검색 결과가 없습니다.'}</div>
            : (
              <div className="table-wrap">
                <table style={{ tableLayout: 'fixed', minWidth: 1170 }}>
                  <colgroup>
                    <col style={{ width: 36 }} />   {/* No. */}
                    <col style={{ width: 90 }} />   {/* 플랫폼 */}
                    <col style={{ width: 150 }} />  {/* NAME / 계정 */}
                    <col style={{ width: 60 }} />   {/* 팔로워 */}
                    <col style={{ width: 58 }} />   {/* 리뷰 업로드 */}
                    <col style={{ width: 80 }} />   {/* repost */}
                    <col style={{ width: 130 }} />  {/* PHONE */}
                    <col style={{ width: 140 }} />  {/* E-mail */}
                    <col style={{ width: 200 }} />  {/* Address */}
                    <col style={{ width: 60 }} />   {/* Actions */}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>No.</th>
                      <th>플랫폼</th>
                      <th>NAME</th>
                      <th style={{ textAlign: 'right' }}>팔로워</th>
                      <th style={{ textAlign: 'center' }}>리뷰 업로드</th>
                      <th style={{ textAlign: 'center' }}>repost</th>
                      <th>PHONE</th>
                      <th>E-mail</th>
                      <th>Address</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const inf       = r.influencers
                      const handle    = inf?.handle    || ''
                      const profileUrl = inf?.profile_url || ''
                      return (
                        <tr key={r.id} onClick={() => { setViewRow(r); setShowView(true) }} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-5)' }}>{i + 1}</td>
                          <td><PlatformBadge platform={inf?.platform ?? null} /></td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-8)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                {inf?.display_name || handle || '—'}
                              </span>
                              {handle && (
                                <a href={profileUrl || '#'} target="_blank" rel="noopener"
                                  style={{ fontSize: 12, color: 'var(--blue-dk)', textDecoration: 'none' }}>
                                  @{handle}
                                </a>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', overflow: 'visible' }}>{fmtFollowers(inf?.followers ?? null)}</td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={r.upload_status === 'Yes'}
                              onChange={e => updateField(r.id, 'upload_status', e.target.checked ? 'Yes' : 'Pending')}
                              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--green)' }} />
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <select value={r.repost || ''}
                              onChange={e => updateField(r.id, 'repost', e.target.value)}
                              style={{ fontSize: 12, fontWeight: 600, padding: '2px 4px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', textAlign: 'center', width: '100%' }}>
                              <option value="">—</option>
                              <option value="O">O</option>
                              <option value="▲">▲</option>
                              <option value="X">X</option>
                            </select>
                          </td>
                          <td style={{ fontSize: 11 }}>{r.phone || '—'}</td>
                          <td style={{ fontSize: 11 }}>
                            {r.email ? <a href={`mailto:${r.email}`} style={{ color: 'var(--blue-dk)' }}>{r.email}</a> : '—'}
                          </td>
                          <td style={{ fontSize: 11, whiteSpace: 'normal', lineHeight: 1.5 }}>
                            {(() => {
                              const line1 = [r.address_line_1, r.address_line_2].filter(Boolean).join(', ')
                              const line2 = [r.city, r.state && r.zip ? `${r.state} ${r.zip}` : (r.state || r.zip)].filter(Boolean).join(', ')
                              if (!line1 && !line2 && !r.country) return <span style={{ color: 'var(--gray-4)' }}>—</span>
                              return <>
                                {line1 && <div>{line1}</div>}
                                {(line2 || r.country) && (
                                  <div style={{ color: 'var(--gray-5)' }}>
                                    {[line2, r.country].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </>
                            })()}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(r)}
                              style={{ fontSize: 12, padding: '2px 8px', background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer' }}>
                              ✎
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {/* ── View Modal ── */}
      {viewRow && (() => {
        const r   = viewRow
        const inf = r.influencers
        const uploadStyle = r.upload_status === 'Yes'
          ? { bg: '#d1fae5', color: '#065f46', label: '완료' }
          : r.upload_status === 'No'
          ? { bg: '#fee2e2', color: '#991b1b', label: '미업로드' }
          : { bg: '#fef3c7', color: '#d97706', label: '대기중' }
        const addrParts = [
          r.address_line_1,
          r.address_line_2,
          r.city,
          [r.state, r.zip].filter(Boolean).join(' '),
          r.country,
        ].filter(Boolean) as string[]
        return (
          <Modal open={showView} onClose={() => setShowView(false)} title={inf?.display_name || inf?.handle || '인플루언서 정보'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--gray-2)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gray-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {(inf?.display_name || inf?.handle || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--gray-8)', marginBottom: 4 }}>{inf?.display_name || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <PlatformBadge platform={inf?.platform ?? null} />
                  {inf?.handle && (
                    <a href={inf.profile_url || '#'} target="_blank" rel="noopener"
                      style={{ fontSize: 13, color: 'var(--blue-dk)', textDecoration: 'none', fontWeight: 600 }}>
                      @{inf.handle}
                    </a>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--gray-5)' }}>
                    {inf?.followers ? fmtFollowers(inf.followers) + ' followers' : ''}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: uploadStyle.bg, color: uploadStyle.color, flexShrink: 0 }}>
                리뷰 {uploadStyle.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
              {([
                ['E-mail',  r.email],
                ['Phone',   r.phone],
                ['Repost',  r.repost],
              ] as [string, string | null][]).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-8)', fontWeight: 500 }}>
                    {label === 'E-mail' && r.email
                      ? <a href={`mailto:${r.email}`} style={{ color: 'var(--blue-dk)', textDecoration: 'none' }}>{r.email}</a>
                      : (value || '—')}
                  </div>
                </div>
              ))}
            </div>

            {addrParts.length > 0 && (
              <div style={{ background: 'var(--gray-1)', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Shipping Address</div>
                <div style={{ fontSize: 13, color: 'var(--gray-8)', lineHeight: 1.7 }}>
                  {addrParts.map((line, i) => <div key={i}>{line}</div>)}
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="modal-btn-cancel" onClick={() => setShowView(false)}>닫기</button>
              <button className="modal-btn-confirm" onClick={() => { setShowView(false); openEdit(r) }}>✎ 편집</button>
            </div>
          </Modal>
        )
      })()}

      {/* ── Edit Modal ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="인플루언서 정보 입력">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '4px 0 10px' }}>연락처</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {field('Phone', 'phone', { placeholder: '+1 310-555-0000' })}
          {selectField('Repost', 'repost', ['O', '▲', 'X'], '선택')}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 10px' }}>배송 주소</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {field('Address Line 1', 'addr1', { placeholder: 'Street address' })}
          {field('Address Line 2', 'addr2', { placeholder: 'Apartment, suite, unit (optional)' })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {field('City', 'city', { placeholder: 'Los Angeles' })}
            {field('State / Province', 'state', { placeholder: 'CA' })}
            {field('ZIP / Postal Code', 'zip', { placeholder: '90001' })}
            {field('Country', 'country', { placeholder: 'United States' })}
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => setShowEdit(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={saveEdit} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
