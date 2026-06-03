import { useEffect, useState } from 'react'
import { gasGet, gasPost } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Modal from '../../../components/Modal'

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

interface TrackingEvent {
  date: string
  time: string
  status: string
  location: string
  remark: string
}

interface TrackingDetail {
  ok: boolean
  error?: string
  pending?: boolean
  number?: string
  carrier?: string
  statusLabel?: string
  statusColor?: string
  lastTime?: string
  lastEvent?: string
  history?: TrackingEvent[]
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

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailData, setDetailData] = useState<TrackingDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailNum, setDetailNum] = useState('')

  async function openDetail(emsNum: string) {
    setDetailNum(emsNum)
    setDetailData(null)
    setShowDetailModal(true)
    setDetailLoading(true)
    try {
      const res = await gasPost<TrackingDetail>({ action: 'get17TrackInfo', number: emsNum })
      setDetailData(res)
    } catch (e: unknown) {
      setDetailData({ ok: false, error: (e as Error).message })
    }
    setDetailLoading(false)
  }

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

  // Build client lookups — by email AND by name (fallback)
  const clientByEmail: Record<string, string[]> = {}
  const clientByName: Record<string, string[]> = {}
  ;(clientData?.rows || []).forEach(r => {
    const email = (r[ccm['e-mail'] ?? ccm['email'] ?? 5] || '').trim().toLowerCase()
    const name  = (r[ccm['name'] ?? 3] || '').trim().toLowerCase()
    if (email) clientByEmail[email] = r
    if (name)  clientByName[name]   = r
  })

  const emailCol = trackingData?.emailCol ?? tcm['email address'] ?? tcm['email'] ?? -1
  const trackingRows = trackingData?.rows || []

  // Track which clients have been matched so we don't show them as "client-only"
  const matchedClientEmails = new Set<string>()

  const trackingCombined: CombinedRow[] = trackingRows.map((t, i) => {
    const tEmail = emailCol >= 0 ? (t[emailCol] || '').trim().toLowerCase() : ''
    const tName  = (t[tcm['name'] ?? 0] || '').trim().toLowerCase()

    // Match client: email first, then name fallback
    const c = (tEmail && clientByEmail[tEmail]) || (tName && clientByName[tName]) || null

    if (c) {
      const cEmail = (c[ccm['e-mail'] ?? ccm['email'] ?? 5] || '').trim().toLowerCase()
      if (cEmail) matchedClientEmails.add(cEmail)
    }

    const email = tEmail || `__row_${i}`
    const statusText = t[tcm['status'] ?? 4] || ''
    return {
      email,
      name: (t[tcm['name'] ?? 0] || '') || (c ? c[ccm['name'] ?? 3] : '') || '',
      handle: c ? (c[ccm['handle'] ?? ccm['account'] ?? 1] || '') : '',
      platform: c ? (c[ccm['platform'] ?? 0] || '') : '',
      follower: c ? (c[ccm['followers'] ?? ccm['follower'] ?? 2] || '—') : '—',
      fullAddr: c ? [c[ccm['address line 1'] ?? 6], c[ccm['address line 2'] ?? 7], c[ccm['city'] ?? 8], ((c[ccm['state'] ?? 9] || '') + ' ' + (c[ccm['zip'] ?? 10] || '')).trim(), c[ccm['country'] ?? 11]].filter(Boolean).join(', ') : '',
      product: c ? (c[ccm['product'] ?? ccm['협찬품'] ?? 13] || '') : '',
      rowId: t[tcm['no'] ?? 0] || String(i + 1),
      emsNum: t[tcm['ems number'] ?? tcm['ems_number'] ?? 1] || '',
      usArrival: t[tcm['us arrival'] ?? 2] || '—',
      registered: t[tcm['registered?'] ?? tcm['registered'] ?? 3] || 'No',
      statusText,
      lastUpdate: t[tcm['last update (17track)'] ?? tcm['last update'] ?? 5] || '—',
      emailSent: t[tcm['email sent?'] ?? tcm['email sent'] ?? 6] || 'No',
    }
  })

  // Client-only rows: clients with no matching tracking row
  const clientOnlyCombined: CombinedRow[] = Object.entries(clientByEmail)
    .filter(([email]) => !matchedClientEmails.has(email))
    .map(([email, c]) => ({
      email,
      name: c[ccm['name'] ?? 3] || '',
      handle: c[ccm['handle'] ?? ccm['account'] ?? 1] || '',
      platform: c[ccm['platform'] ?? 0] || '',
      follower: c[ccm['followers'] ?? ccm['follower'] ?? 2] || '—',
      fullAddr: [c[ccm['address line 1'] ?? 6], c[ccm['address line 2'] ?? 7], c[ccm['city'] ?? 8], ((c[ccm['state'] ?? 9] || '') + ' ' + (c[ccm['zip'] ?? 10] || '')).trim(), c[ccm['country'] ?? 11]].filter(Boolean).join(', '),
      product: c[ccm['product'] ?? ccm['협찬품'] ?? 13] || '',
      rowId: '', emsNum: '', usArrival: '—', registered: '—', statusText: '', lastUpdate: '—', emailSent: '—',
    }))

  const statusColors = trackingData?.statusColors || STATUS_COLORS

  const combinedRows: CombinedRow[] = [...trackingCombined, ...clientOnlyCombined].filter(row => {
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
                      <th>상태</th><th>마지막 업데이트</th>
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
                                    <span onClick={() => openDetail(row.emsNum)} style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue-dk)', cursor: 'pointer', textDecoration: 'underline' }}>{row.emsNum}</span>
                                    <button onClick={() => { setTrackingForm({ rowId: row.rowId, emsNum: row.emsNum, arrival: row.usArrival === '—' ? '' : row.usArrival, registered: row.registered === '—' ? 'No' : row.registered, status: row.statusText || 'Preparing' }); setTrackingName(row.name); setShowTrackingModal(true) }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-dk)', fontSize: 13 }}>✎</button>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                    <a href={`https://t.17track.net/en#nums=${encodeURIComponent(row.emsNum)}`} target="_blank"
                                      style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}>↗ 17track</a>
                                    <a href={`https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${row.emsNum}`} target="_blank"
                                      style={{ fontSize: 11, color: 'var(--gray-5)' }}>↗ 우체국</a>
                                  </div>
                                </div>
                              )
                              : <button onClick={() => { setTrackingForm({ rowId: row.rowId, emsNum: '', arrival: '', registered: 'No', status: 'Preparing' }); setTrackingName(row.name); setShowTrackingModal(true) }}
                                  style={{ padding: '3px 10px', background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid var(--blue)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                  + 운송장 입력
                                </button>}
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

      {/* Tracking Detail Modal */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title={detailNum}>
        {detailLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0' }}>
            <Spinner /><span style={{ fontSize: 13, color: 'var(--gray-5)' }}>조회 중...</span>
          </div>
        )}

        {!detailLoading && detailData && !detailData.ok && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ fontSize: 13, color: 'var(--gray-5)', marginBottom: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: 200, overflowY: 'auto', background: '#f8f9fa', borderRadius: 8, padding: '10px 12px' }}>
              {detailData.error}
            </div>
            <a href={`https://t.17track.net/en#nums=${encodeURIComponent(detailNum)}`} target="_blank"
              style={{ display: 'inline-block', background: '#1e88e5', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              ↗ 17track에서 조회
            </a>
          </div>
        )}

        {!detailLoading && detailData?.ok && (() => {
          const events = (detailData.history || []).slice().reverse()
          const latest = events[0]
          return (
            <div>
              {/* Status header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: detailData.statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-8)' }}>{detailData.statusLabel}</div>
                  {detailData.carrier && <div style={{ fontSize: 12, color: 'var(--gray-5)' }}>{detailData.carrier}</div>}
                </div>
                <a href={`https://t.17track.net/en#nums=${encodeURIComponent(detailNum)}`} target="_blank"
                  style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--blue-dk)', textDecoration: 'none' }}>↗ 17track</a>
              </div>
              {detailData.lastTime && (
                <div style={{ fontSize: 12, color: 'var(--gray-5)', marginBottom: 16, paddingLeft: 46 }}>
                  Last update: {detailData.lastTime}
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--gray-2)', paddingTop: 16, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-7)', marginBottom: 14 }}>Shipping Events</div>
              </div>

              <div style={{ position: 'relative', paddingLeft: 28 }}>
                <div style={{ position: 'absolute', left: 8, top: 4, bottom: 4, width: 2, background: 'var(--gray-2)' }} />
                {events.map((evt, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: 20 }}>
                    <div style={{
                      position: 'absolute', left: -24, top: 2, width: 14, height: 14, borderRadius: '50%',
                      background: i === 0 ? detailData.statusColor! : '#fff',
                      border: `2px solid ${i === 0 ? detailData.statusColor! : 'var(--gray-3)'}`,
                    }} />
                    <div style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? detailData.statusColor! : 'var(--blue-dk)', marginBottom: 2 }}>
                      {evt.status}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>
                      {evt.date}{evt.time ? ' ' + evt.time : ''}
                    </div>
                    {evt.location && <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{evt.location}</div>}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
