import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
// import { gasPost } from '../../../lib/api' // detail modal disabled
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Modal from '../../../components/Modal'
import Pagination from '../../../components/Pagination'

interface EmsRow {
  confirmed_influencer_id: string
  seq:            number | null
  email:          string | null
  phone:          string | null
  address_line_1: string | null
  address_line_2: string | null
  city:           string | null
  state:          string | null
  zip:            string | null
  country:        string | null
  handle:         string
  display_name:   string | null
  tracking_id:         string | null
  ems_number:          string | null  // 등기번호
  registered_date:     string | null  // 신청일
  application_number:  string | null  // 접수번호
  status:              string | null
  last_update:         string | null
}

// interface TrackingEvent {
//   date: string; time: string; status: string; location: string; remark: string
// }

// interface TrackingDetail {
//   ok: boolean; error?: string; pending?: boolean
//   carrier?: string; statusLabel?: string; statusColor?: string
//   lastTime?: string; history?: TrackingEvent[]
// }

const STATUS_OPTIONS = ['접수완료', 'Preparing', 'In Transit', 'Delivered', 'Exception']

const STATUS_COLORS: Record<string, string> = {
  '접수완료'   : '#6366f1',
  'Preparing'  : '#94a3b8',
  'In Transit' : '#6a95a5',
  'Delivered'  : '#27ae60',
  'Exception'  : '#e74c3c',
}

export default function Ems() {
  const { showToast } = useToast()
  const [rows,    setRows]    = useState<EmsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const EMS_PAGE_SIZE = 25

  // Detail Modal — disabled (17track lookup popup)
  // const [showDetailModal,  setShowDetailModal]  = useState(false)
  // const [detailData,       setDetailData]       = useState<TrackingDetail | null>(null)
  // const [detailLoading,    setDetailLoading]    = useState(false)
  // const [detailNum,        setDetailNum]        = useState('')

  // Tracking Modal
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [trackingName,      setTrackingName]      = useState('')
  const [trackingSaving,    setTrackingSaving]    = useState(false)
  const [trackingForm, setTrackingForm] = useState({
    confirmed_influencer_id: '',
    tracking_id:       null as string | null,
    emsNum:            '',   // 등기번호
    registeredDate:    '',   // 신청일
    applicationNumber: '',   // 접수번호
    status:            '접수완료',
  })

  useEffect(() => { loadEms() }, [])

  async function loadEms() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('confirmed_influencers')
        .select(`
          id, seq, email, phone,
          address_line_1, address_line_2, city, state, zip, country,
          influencers!inner(handle, display_name),
          ems_tracking(
            id, ems_number, registered_date, application_number,
            status, last_update
          )
        `)
        .order('id')

      if (error) throw error

      const mapped: EmsRow[] = (data || []).map((ci: any) => {
        const inf = ci.influencers || {}
        const ems = (ci.ems_tracking || [])[0] || {}
        return {
          confirmed_influencer_id: ci.id,
          seq:            ci.seq    ?? null,
          email:          ci.email,
          phone:          ci.phone,
          address_line_1: ci.address_line_1,
          address_line_2: ci.address_line_2,
          city:           ci.city,
          state:          ci.state,
          zip:            ci.zip,
          country:        ci.country,
          handle:         inf.handle       || '',
          display_name:   inf.display_name || null,
          tracking_id:        ems.id                || null,
          ems_number:         ems.ems_number        || null,
          registered_date:    ems.registered_date   || null,
          application_number: ems.application_number  || null,
          status:             ems.status            || null,
          last_update:        ems.last_update        || null,
        }
      })
      setRows(mapped)
      setSyncMsg(`마지막 동기화: ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`)
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
      setSyncMsg('동기화 실패')
    }
    setLoading(false)
  }

  // async function openDetail(emsNum: string) {
  //   setDetailNum(emsNum)
  //   setDetailData(null)
  //   setShowDetailModal(true)
  //   setDetailLoading(true)
  //   try {
  //     const res = await gasPost<TrackingDetail>({ action: 'get17TrackInfo', number: emsNum })
  //     setDetailData(res)
  //   } catch (e: unknown) {
  //     setDetailData({ ok: false, error: (e as Error).message })
  //   }
  //   setDetailLoading(false)
  // }

  function openTrackingModal(row: EmsRow) {
    setTrackingForm({
      confirmed_influencer_id: row.confirmed_influencer_id,
      tracking_id:      row.tracking_id,
      emsNum:           row.ems_number         || '',
      registeredDate:   row.registered_date    || '',
      applicationNumber: row.application_number   || '',
      status:           row.status             || '접수완료',
    })
    setTrackingName(row.display_name || row.handle)
    setShowTrackingModal(true)
  }

  async function submitTrackingForm() {
    setTrackingSaving(true)
    try {
      const payload = {
        confirmed_influencer_id: trackingForm.confirmed_influencer_id,
        ems_number:         trackingForm.emsNum            || null,
        registered_date:    trackingForm.registeredDate    || null,
        application_number: trackingForm.applicationNumber  || null,
        status:             trackingForm.status,
      }

      let err: unknown
      if (trackingForm.tracking_id) {
        const res = await supabase.from('ems_tracking').update(payload).eq('id', trackingForm.tracking_id)
        err = res.error
      } else {
        const res = await supabase.from('ems_tracking').insert(payload)
        err = res.error
      }
      if (err) throw err

      showToast('배송 정보 업데이트 완료', 'success')
      setShowTrackingModal(false)
      loadEms()
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setTrackingSaving(false)
  }

  const filteredRows = rows.filter(row => {
    if (filterStatus !== 'all' && (row.status || '') !== filterStatus) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (![row.display_name, row.handle, row.ems_number, row.application_number, row.email]
        .join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = {
    total:     rows.length,
    received:  rows.filter(r => r.status === '접수완료').length,
    inTransit: rows.filter(r => r.status === 'In Transit').length,
    delivered: rows.filter(r => r.status === 'Delivered').length,
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <div>
          <div className="page-banner-title">EMS 글로벌 배송 &amp; 통합 관리 시스템</div>
          <div className="page-banner-desc">확정 인플루언서의 배송 정보를 통합 관리합니다.</div>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn page-banner-btn--secondary" onClick={loadEms}>
            <span style={{ color: 'var(--blue-dk)' }}>↻</span> 새로고침
          </button>
        </div>
      </div>

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && (
        <>
          <div className="cards">
            <div className="card"><div className="card-label">총 관리 대상</div><div className="card-value">{stats.total}</div></div>
            <div className="card"><div className="card-label">접수완료</div><div className="card-value" style={{ color: '#6366f1' }}>{stats.received}</div></div>
            <div className="card"><div className="card-label">배송 중</div><div className="card-value" style={{ color: 'var(--blue-dk)' }}>{stats.inTransit}</div></div>
            <div className="card highlight">
              <div className="card-label">배송 완료</div>
              <div className="card-value" style={{ color: 'var(--green)' }}>{stats.delivered}</div>
              <div className="card-sub">{stats.total ? Math.round(stats.delivered / stats.total * 100) : 0}% 완료율</div>
            </div>
          </div>

          <div className="ems-toolbar">
            <div className="section-title section-title--inline">MiMuse 배송 &amp; 클라이언트 통합 대장</div>
            <span className="ems-sync-msg">{syncMsg}</span>
          </div>

          <div className="filters" style={{ marginBottom: 16, marginTop: 16 }}>
            <input
              type="text"
              placeholder="이름, 이메일, 접수번호, 등기번호 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            />
            <div className="filter-group">
              <label>배송 상태:</label>
              {([['all', '전체'], ['접수완료', '접수완료'], ['In Transit', '배송중'], ['Delivered', '완료']] as const).map(([v, l]) => (
                <button key={v} className={'ems-filter-btn' + (filterStatus === v ? ' active' : '')} onClick={() => setFilterStatus(v)}>{l}</button>
              ))}
            </div>
          </div>

          {filteredRows.length === 0
            ? <div className="empty">데이터가 없습니다.</div>
            : (() => {
                const totalPages = Math.max(1, Math.ceil(filteredRows.length / EMS_PAGE_SIZE))
                const safePage   = Math.min(page, totalPages)
                const startIdx   = (safePage - 1) * EMS_PAGE_SIZE
                const pagedRows  = filteredRows.slice(startIdx, startIdx + EMS_PAGE_SIZE)
                return (
                  <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>No</th>
                          <th>이름</th>
                          <th>이메일</th>
                          <th>신청일</th>
                          <th>접수번호</th>
                          <th>등기번호</th>
                          <th>상태</th>
                          <th>배송 주소</th>
                          <th>마지막 업데이트</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedRows.map((row, i) => {
                          const i_abs      = startIdx + i
                          const badgeColor = STATUS_COLORS[row.status || ''] || '#94a3b8'
                          const fullAddr   = [row.address_line_1, row.address_line_2, row.city,
                            ((row.state || '') + ' ' + (row.zip || '')).trim(), row.country]
                            .filter(Boolean).join(', ')
                          return (
                            <tr key={row.confirmed_influencer_id}>
                              <td style={{ fontSize: 11, color: 'var(--gray-5)', textAlign: 'center' }}>{row.seq ?? i_abs + 1}</td>

                              {/* 이름 */}
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.display_name || row.handle || '—'}</div>
                                {row.handle && <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 1 }}>@{row.handle}</div>}
                              </td>

                              {/* 이메일 */}
                              <td style={{ fontSize: 12 }}>
                                {row.email
                                  ? <a href={`mailto:${row.email}`} style={{ color: 'var(--blue-dk)' }}>{row.email}</a>
                                  : <span style={{ color: 'var(--gray-5)' }}>—</span>}
                              </td>

                              {/* 신청일 */}
                              <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--gray-6)' }}>
                                {row.registered_date || '—'}
                              </td>

                              {/* 접수번호 */}
                              <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-7)' }}>
                                {row.application_number || '—'}
                              </td>

                              {/* 등기번호 + tracking links */}
                              <td>
                                {row.ems_number ? (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span
                                        // onClick={() => openDetail(row.ems_number!)}
                                        style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-7)' }}
                                      >{row.ems_number}</span>
                                      <button onClick={() => openTrackingModal(row)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue-dk)', fontSize: 13 }}>✎</button>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                      <a href={`https://t.17track.net/en#nums=${encodeURIComponent(row.ems_number)}`} target="_blank"
                                        style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}>↗ 17track</a>
                                      <a href={`https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${row.ems_number}`} target="_blank"
                                        style={{ fontSize: 11, color: 'var(--gray-5)' }}>↗ 우체국</a>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => openTrackingModal(row)}
                                    style={{ padding: '3px 10px', background: 'var(--blue-lt)', color: 'var(--blue-dk)', border: '1px solid var(--blue)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                                    + 입력
                                  </button>
                                )}
                              </td>

                              {/* 상태 */}
                              <td>
                                {row.status
                                  ? <span style={{ background: badgeColor, color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.status}</span>
                                  : <span style={{ color: '#aaa', fontSize: 11 }}>—</span>}
                              </td>

                              {/* 배송 주소 */}
                              <td style={{ fontSize: 11, color: 'var(--gray-6)', maxWidth: 200 }}>{fullAddr || '—'}</td>

                              
                              {/* 마지막 업데이트 */}
                              <td style={{ fontSize: 11, color: 'var(--gray-5)', whiteSpace: 'nowrap' }}>{row.last_update || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={safePage} totalPages={totalPages} total={filteredRows.length}
                    startIdx={startIdx} endIdx={Math.min(startIdx + EMS_PAGE_SIZE, filteredRows.length)}
                    onPrev={() => setPage(p => Math.max(1, p - 1))}
                    onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                  />
                  </>
                )
              })()}
        </>
      )}

      {/* Tracking Modal */}
      <Modal open={showTrackingModal} onClose={() => setShowTrackingModal(false)} title="배송 정보 등록 및 수정">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 16 }}>{trackingName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>신청일</label>
            <input type="date" value={trackingForm.registeredDate}
              onChange={e => setTrackingForm(p => ({ ...p, registeredDate: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>상태</label>
            <select value={trackingForm.status}
              onChange={e => setTrackingForm(p => ({ ...p, status: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>접수번호</label>
            <input placeholder="우체국 접수번호" value={trackingForm.applicationNumber}
              onChange={e => setTrackingForm(p => ({ ...p, applicationNumber: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>등기번호</label>
            <input placeholder="EG123456789KR" value={trackingForm.emsNum}
              onChange={e => setTrackingForm(p => ({ ...p, emsNum: e.target.value.toUpperCase() }))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-3)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
          </div>

        </div>
        <div className="modal-actions">
          <button className="modal-btn-cancel" onClick={() => setShowTrackingModal(false)}>취소</button>
          <button className="modal-btn-confirm" onClick={submitTrackingForm} disabled={trackingSaving}>
            {trackingSaving ? '저장 중...' : '정보 업데이트'}
          </button>
        </div>
      </Modal>

      {/* Tracking Detail Modal — disabled (use ↗ 17track / ↗ 우체국 links instead) */}
      {/* <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title={detailNum}>
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
          return (
            <div>
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
                <div style={{ position: 'absolute', left: 8, top: 4, bottom: 4, width: 2, background: detailData.statusColor! + '44' }} />
                {events.map((evt, i) => {
                  const isLatest = i === events.length - 1
                  return (
                    <div key={i} style={{ position: 'relative', marginBottom: 20 }}>
                      <div style={{
                        position: 'absolute', left: -24, top: 2, width: 14, height: 14, borderRadius: '50%',
                        background: isLatest ? detailData.statusColor! : '#fff',
                        border: `2px solid ${detailData.statusColor!}`,
                      }} />
                      <div style={{ fontSize: 13, fontWeight: isLatest ? 700 : 400, color: isLatest ? detailData.statusColor! : 'var(--gray-6)', marginBottom: 2 }}>{evt.status}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{evt.date}{evt.time ? ' ' + evt.time : ''}</div>
                      {evt.location && <div style={{ fontSize: 11, color: 'var(--gray-5)' }}>{evt.location}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </Modal> */}
    </div>
  )
}
