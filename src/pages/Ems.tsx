import { useEffect, useState } from 'react'
import { gasGet, gasPost } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'

interface EmsStats {
  total?: number
  preparing?: number
  pending?: number
  inTransit?: number
  delivered?: number
}

interface EmsData {
  ok?: boolean
  error?: string
  stats?: EmsStats
  headers?: string[]
  rows?: string[][]
  statusCol?: number
  emailCol?: number
  statusColors?: Record<string, string>
}

interface ClientData {
  ok?: boolean
  error?: string
  headers?: string[]
  rows?: string[][]
}

interface CombinedRow {
  email: string
  name: string
  handle: string
  platform: string
  follower: string
  fullAddr: string
  product: string
  rowId: string
  emsNum: string
  usArrival: string
  registered: string
  statusText: string
  lastUpdate: string
  emailSent: string
}

const STATUS_COLORS: Record<string, string> = {
  'Preparing': '#94a3b8',
  'In Transit': '#6a95a5',
  'Delivered': '#27ae60',
  'Pending': '#d97706',
  'Exception': '#e74c3c',
}

function buildColMap(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {}
  ;(headers || []).forEach((h, i) => { m[String(h).trim().toLowerCase()] = i })
  return m
}

function get(row: string[], cm: Record<string, number>, key: string): string {
  const i = cm[key.toLowerCase()]
  return i !== undefined ? (row[i] || '') : ''
}

export default function Ems() {
  const { showToast } = useToast()
  const [trackingData, setTrackingData] = useState<EmsData | null>(null)
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Client Modal
  const [showClientModal, setShowClientModal] = useState(false)
  const [clientForm, setClientForm] = useState({
    name: '', followers: '', platform: 'TikTok', handle: '', email: '', phone: '',
    product: '', addr1: '', addr2: '', city: '', state: '', zip: '', country: 'United States',
  })
  const [clientSaving, setClientSaving] = useState(false)

  // Tracking Modal
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [trackingForm, setTrackingForm] = useState({ rowId: '', emsNum: '', arrival: '', registered: 'No', status: 'Preparing' })
  const [trackingName, setTrackingName] = useState('')
  const [trackingSaving, setTrackingSaving] = useState(false)

  useEffect(() => { loadEms() }, [])

  async function loadEms() {
    setLoading(true)
    try {
      const [td, cd] = await Promise.all([
        gasGet<EmsData>('getEmsData'),
        gasGet<ClientData>('getClientData'),
      ])
      setTrackingData(td)
      setClientData(cd)
      const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      setSyncMsg(`마지막 동기화: ${now}`)
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
      setSyncMsg('동기화 실패')
    }
    setLoading(false)
  }

  async function syncAllTracking() {
    setSyncMsg('배송 동기화 진행 중...')
    try {
      const result: { ok?: boolean; updated?: number; skipped?: number; error?: string } = await gasPost({ action: 'syncAllTracking' })
      if (result.ok) {
        setSyncMsg(`동기화 완료 — ${result.updated || 0}개 업데이트, ${result.skipped || 0}개 스킵`)
        setTrackingData(null); setClientData(null)
        loadEms()
      } else {
        setSyncMsg('오류: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (e: unknown) { setSyncMsg('오류: ' + (e as Error).message) }
  }

  async function submitClientForm() {
    if (!clientForm.name || !clientForm.email || !clientForm.handle || !clientForm.addr1 || !clientForm.city || !clientForm.state || !clientForm.zip || !clientForm.country) {
      showToast('필수 항목을 입력하세요.', 'error'); return
    }
    setClientSaving(true)
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({ action: 'addClient', ...clientForm })
      if (res.ok) {
        showToast('클라이언트 등록 완료', 'success')
        setShowClientModal(false)
        setClientForm({ name: '', followers: '', platform: 'TikTok', handle: '', email: '', phone: '', product: '', addr1: '', addr2: '', city: '', state: '', zip: '', country: 'United States' })
        loadEms()
      } else showToast(res.error || '오류', 'error')
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    setClientSaving(false)
  }

  async function submitTrackingForm() {
    setTrackingSaving(true)
    try {
      const res: { ok?: boolean; error?: string } = await gasPost({
        action: 'updateClientInfo',
        rowId: trackingForm.rowId,
        emsNumber: trackingForm.emsNum,
        usArrival: trackingForm.arrival,
        registered: trackingForm.registered,
        status: trackingForm.status,
      })
      if (res.ok) {
        showToast('운송장 정보 업데이트 완료', 'success')
        setShowTrackingModal(false)
        loadEms()
      } else showToast(res.error || '오류', 'error')
    } catch (e: unknown) { showToast((e as Error).message, 'error') }
    setTrackingSaving(false)
  }

  // Build combined rows
  const tcm = trackingData ? buildColMap(trackingData.headers || []) : {}
  const ccm = clientData ? buildColMap(clientData.headers || []) : {}

  const clientMap: Record<string, string[]> = {}
  ;(clientData?.rows || []).forEach(r => {
    const key = (r[ccm['e-mail'] ?? ccm['email'] ?? 5] || '').trim().toLowerCase()
    if (key) clientMap[key] = r
  })
  const trackingMap: Record<string, string[]> = {}
  const emailCol = trackingData?.emailCol ?? tcm['email address'] ?? tcm['email'] ?? -1
  ;(trackingData?.rows || []).forEach((r, i) => {
    const key = emailCol >= 0 ? (r[emailCol] || '').trim().toLowerCase() : '__row_' + i
    if (key) trackingMap[key] = r
  })

  let allEmails = Array.from(new Set([...Object.keys(clientMap), ...Object.keys(trackingMap)]))
  if (allEmails.length === 0 && (trackingData?.rows || []).length > 0) {
    ;(trackingData?.rows || []).forEach((r, i) => { const k = '__row_' + i; trackingMap[k] = r; allEmails.push(k) })
  }

  const statusColors = trackingData?.statusColors || STATUS_COLORS

  const combinedRows: CombinedRow[] = allEmails.map(email => {
    const c = clientMap[email] || null
    const t = trackingMap[email] || null
    const statusText = t ? (t[tcm['status'] ?? 5] || '') : ''

    return {
      email,
      name: (c ? c[ccm['name'] ?? 3] : '') || (t ? t[tcm['name'] ?? 1] : '') || '',
      handle: c ? (c[ccm['handle'] ?? ccm['account'] ?? 1] || '') : '',
      platform: c ? (c[ccm['platform'] ?? 0] || '') : '',
      follower: c ? (c[ccm['followers'] ?? ccm['follower'] ?? 2] || '—') : '—',
      fullAddr: c ? [c[ccm['address line 1'] ?? 6], c[ccm['address line 2'] ?? 7], c[ccm['city'] ?? 8], ((c[ccm['state'] ?? 9] || '') + ' ' + (c[ccm['zip'] ?? 10] || '')).trim(), c[ccm['country'] ?? 11]].filter(Boolean).join(', ') : '',
      product: c ? (c[ccm['product'] ?? ccm['협찬품'] ?? 13] || '') : '',
      rowId: t ? (t[tcm['no'] ?? 0] || '') : '',
      emsNum: t ? (t[tcm['ems number'] ?? tcm['ems_number'] ?? 2] || '') : '',
      usArrival: t ? (t[tcm['us arrival'] ?? 3] || '—') : '—',
      registered: t ? (t[tcm['registered?'] ?? tcm['registered'] ?? 4] || 'No') : '—',
      statusText,
      lastUpdate: t ? (t[tcm['last update'] ?? 6] || '—') : '—',
      emailSent: t ? (t[tcm['email sent?'] ?? tcm['email sent'] ?? 7] || 'No') : '—',
    }
  }).filter(row => {
    if (filterStatus !== 'all' && row.statusText !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (![row.name, row.handle, row.emsNum, row.email].join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = trackingData?.stats || {}

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📦</span>
        <div>
          <div className="page-banner-title">EMS 글로벌 배송 &amp; 통합 관리 시스템</div>
          <div className="page-banner-desc">클라이언트 정보와 배송 트래킹을 하나의 통합 뷰로 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={() => setShowClientModal(true)}>+ 신규 클라이언트 등록</button>
          <button className="page-banner-btn page-banner-btn--secondary" onClick={syncAllTracking}>배송 동기화</button>
          <button className="page-banner-btn page-banner-btn--secondary" onClick={loadEms}><span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침</button>
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && (
        <>
          <div className="cards">
            <div className="card"><div className="card-label">총 관리 대상</div><div className="card-value">{stats.total || 0}</div></div>
            <div className="card"><div className="card-label">배송 준비중</div><div className="card-value">{stats.preparing ?? stats.pending ?? 0}</div></div>
            <div className="card"><div className="card-label">배송 중</div><div className="card-value" style={{ color: 'var(--blue-dk)' }}>{stats.inTransit || 0}</div></div>
            <div className="card highlight"><div className="card-label">배송 완료</div><div className="card-value" style={{ color: 'var(--green)' }}>{stats.delivered || 0}</div><div className="card-sub">{stats.total ? Math.round((stats.delivered || 0) / stats.total * 100) : 0}% 완료율</div></div>
          </div>

          <div className="ems-toolbar">
            <div className="section-title section-title--inline">MiMuse 배송 &amp; 클라이언트 통합 대장</div>
            <span className="ems-sync-msg">{syncMsg}</span>
          </div>

          <div className="filters" style={{ marginBottom: 16, marginTop: 16 }}>
            <input type="text" placeholder="이름, 이메일, 운송장 번호로 검색..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, minWidth: 200, maxWidth: 360 }} />
            <div className="filter-group">
              <label>배송 상태:</label>
              {[['all', '전체'], ['Preparing', '배송준비중'], ['In Transit', '배송중'], ['Delivered', '완료']].map(([v, l]) => (
                <button key={v} className={'ems-filter-btn' + (filterStatus === v ? ' active' : '')} onClick={() => setFilterStatus(v)}>{l}</button>
              ))}
            </div>
          </div>

          {combinedRows.length === 0
            ? <div className="empty">데이터가 없습니다.</div>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>No</th><th>이름</th><th>플랫폼</th><th>팔로워</th><th>이메일</th>
                      <th>협찬품</th><th>배송 주소</th><th>EMS 번호</th>
                      <th>US 도착</th><th>통관</th><th>상태</th><th>마지막 업데이트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedRows.map((row, i) => {
                      const badgeColor = statusColors[row.statusText] || '#888'
                      return (
                        <tr key={i}>
                          <td style={{ fontSize: 11, color: 'var(--gray-5)' }}>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{row.name || '—'}</td>
                          <td>
                            {row.platform === 'TikTok'
                              ? <span className="platform-badge" style={{ background: '#111', color: '#fff' }}>TikTok</span>
                              : row.platform === 'Instagram'
                              ? <span className="platform-badge" style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', color: '#fff' }}>Instagram</span>
                              : <span className="platform-badge" style={{ background: 'var(--gray-2)', color: 'var(--gray-5)' }}>{row.platform || '—'}</span>}
                            {row.handle && <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 2 }}>@{row.handle}</div>}
                          </td>
                          <td className="num" style={{ fontSize: 12 }}>{row.follower}</td>
                          <td style={{ fontSize: 12 }}>
                            {row.email.startsWith('__row_')
                              ? <span style={{ color: 'var(--gray-5)' }}>—</span>
                              : <a href={`mailto:${row.email}`} style={{ color: 'var(--blue-dk)' }}>{row.email}</a>}
                          </td>
                          <td style={{ fontSize: 11 }}>{row.product || '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--gray-6)', maxWidth: 200 }}>{row.fullAddr || '—'}</td>
                          <td>
                            {!row.rowId
                              ? <span style={{ color: '#aaa', fontSize: 11 }}>미등록</span>
                              : row.emsNum
                              ? (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.emsNum}</span>
                                    <button onClick={() => { setTrackingForm({ rowId: row.rowId, emsNum: row.emsNum, arrival: row.usArrival === '—' ? '' : row.usArrival, registered: row.registered === '—' ? 'No' : row.registered, status: row.statusText || 'Preparing' }); setTrackingName(row.name); setShowTrackingModal(true) }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-dk)', fontSize: 13 }}>✎</button>
                                  </div>
                                  <a href={`https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${encodeURIComponent(row.emsNum)}#`} target="_blank"
                                    style={{ fontSize: 11, color: 'var(--blue-dk)' }}>↗ 우체국 조회</a>
                                </div>
                              )
                              : <button onClick={() => { setTrackingForm({ rowId: row.rowId, emsNum: '', arrival: '', registered: 'No', status: 'Preparing' }); setTrackingName(row.name); setShowTrackingModal(true) }}
                                  style={{ padding: '3px 10px', background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid var(--blue)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                  + 운송장 입력
                                </button>}
                          </td>
                          <td style={{ fontSize: 12 }}>{row.usArrival}</td>
                          <td>
                            {row.registered === '—'
                              ? <span style={{ color: '#aaa' }}>—</span>
                              : row.registered === 'Yes'
                              ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Pass</span>
                              : <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Pending</span>}
                          </td>
                          <td>
                            {row.statusText
                              ? <span style={{ background: badgeColor, color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{row.statusText}</span>
                              : <span style={{ color: '#aaa', fontSize: 11 }}>—</span>}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--gray-5)' }}>{row.lastUpdate}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {/* Client Registration Modal */}
      <Modal open={showClientModal} onClose={() => setShowClientModal(false)} title="📋 클라이언트 주소지 수집 등록">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          {[
            { id: 'name', label: '인플루언서 성명 (NAME)', required: true, placeholder: '예: Jennie Lee' },
            { id: 'followers', label: '팔로워 수', placeholder: '예: 45K' },
          ].map(f => (
            <div key={f.id}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}{f.required && <span style={{ color: '#e74c3c' }}> *</span>}</label>
              <input placeholder={f.placeholder} value={(clientForm as Record<string, string>)[f.id]} onChange={e => setClientForm(prev => ({ ...prev, [f.id]: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>플랫폼 <span style={{ color: '#e74c3c' }}>*</span></label>
            <select value={clientForm.platform} onChange={e => setClientForm(prev => ({ ...prev, platform: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff' }}>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>계정 핸들 <span style={{ color: '#e74c3c' }}>*</span></label>
            <input placeholder="@jennie_beauty" value={clientForm.handle} onChange={e => setClientForm(prev => ({ ...prev, handle: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>E-mail <span style={{ color: '#e74c3c' }}>*</span></label>
            <input type="email" placeholder="jennie@example.com" value={clientForm.email} onChange={e => setClientForm(prev => ({ ...prev, email: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>연락처 (PHONE)</label>
            <input placeholder="+1 234-567-890" value={clientForm.phone} onChange={e => setClientForm(prev => ({ ...prev, phone: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>배송 희망 협찬품</label>
          <input placeholder="예: 가을 수분 세럼 패키지" value={clientForm.product} onChange={e => setClientForm(prev => ({ ...prev, product: e.target.value }))}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '16px 0 8px' }}>🗺 글로벌 배송 주소 (Shipping Address)</div>
        {[
          { id: 'addr1', label: 'Address Line 1', required: true, placeholder: 'Street address, P.O. box' },
          { id: 'addr2', label: 'Address Line 2', placeholder: 'Apartment, suite, unit' },
        ].map(f => (
          <div key={f.id} style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}{f.required && <span style={{ color: '#e74c3c' }}> *</span>}</label>
            <input placeholder={f.placeholder} value={(clientForm as Record<string, string>)[f.id]} onChange={e => setClientForm(prev => ({ ...prev, [f.id]: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          {[['city', 'City', true], ['state', 'State / Province', true], ['zip', 'ZIP / Postal Code', true], ['country', 'Country', true]].map(([id, label, req]) => (
            <div key={id as string}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{label as string}{req && <span style={{ color: '#e74c3c' }}> *</span>}</label>
              <input value={(clientForm as Record<string, string>)[id as string]} onChange={e => setClientForm(prev => ({ ...prev, [id as string]: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => setShowClientModal(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={submitClientForm} disabled={clientSaving}>{clientSaving ? '저장 중...' : '저장 & 동기화'}</button>
        </div>
      </Modal>

      {/* Tracking Modal */}
      <Modal open={showTrackingModal} onClose={() => setShowTrackingModal(false)} title="🏷 EMS 운송장 등록 및 수정">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 16 }}>{trackingName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>EMS Number</label>
            <input placeholder="EG123456789KR" value={trackingForm.emsNum} onChange={e => setTrackingForm(prev => ({ ...prev, emsNum: e.target.value.toUpperCase() }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>US Arrival Date</label>
            <input type="date" value={trackingForm.arrival} onChange={e => setTrackingForm(prev => ({ ...prev, arrival: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>통관 여부</label>
            <select value={trackingForm.registered} onChange={e => setTrackingForm(prev => ({ ...prev, registered: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff' }}>
              <option value="No">No</option>
              <option value="Yes">Yes (심사 승인)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>운송 상태</label>
            <select value={trackingForm.status} onChange={e => setTrackingForm(prev => ({ ...prev, status: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff' }}>
              <option value="Preparing">Preparing (배송 준비 중)</option>
              <option value="In Transit">In Transit (배송 중)</option>
              <option value="Delivered">Delivered (도착 완료)</option>
            </select>
          </div>
        </div>
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => setShowTrackingModal(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={submitTrackingForm} disabled={trackingSaving}>{trackingSaving ? '저장 중...' : '정보 업데이트'}</button>
        </div>
      </Modal>
    </div>
  )
}
