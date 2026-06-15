import { useEffect, useRef, useState } from 'react'
import { ListFilter } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
// import { gasPost } from '../../../lib/api' // detail modal disabled
import { useToast } from '../../../contexts/ToastContext'
import Spinner from '../../../components/Spinner'
import Modal from '../../../components/Modal'
import Pagination from '../../../components/Pagination'
import { countReshipNeeded, EMS_ERROR_ROWS } from '../../../lib/ems-errors'

const INFLUENCER_TARGET = 50

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

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  ...STATUS_OPTIONS.map(status => ({ value: status, label: status })),
]

export default function Ems() {
  const { showToast } = useToast()
  const [rows,    setRows]    = useState<EmsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [searchQuery,      setSearchQuery]      = useState('')
  const [filterStatus,     setFilterStatus]     = useState('all')
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const EMS_PAGE_SIZE = 25

  // Detail Modal — disabled (17track lookup popup)
  // const [showDetailModal,  setShowDetailModal]  = useState(false)
  // const [detailData,       setDetailData]       = useState<TrackingDetail | null>(null)
  // const [detailLoading,    setDetailLoading]    = useState(false)
  // const [detailNum,        setDetailNum]        = useState('')

  // View Modal
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewRow,       setViewRow]       = useState<EmsRow | null>(null)

  // Tracking (Edit) Modal
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

  useEffect(() => { setPage(1) }, [searchQuery, filterStatus])

  useEffect(() => {
    if (!showStatusFilter) return
    const handler = (e: MouseEvent) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) {
        setShowStatusFilter(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showStatusFilter])

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
        .order('seq', { ascending: true, nullsFirst: false })

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

  function openViewModal(row: EmsRow) {
    setViewRow(row)
    setShowViewModal(true)
  }

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

  const total          = rows.length
  const targetPct      = Math.min(Math.round(total / INFLUENCER_TARGET * 100), 100)
  const delivered      = rows.filter(r => r.status === 'Delivered').length
  const inTransit      = rows.filter(r => r.status === 'In Transit' || r.status === 'Preparing').length
  const shippingErrors = rows.filter(r => r.status === 'Exception').length
  const reshipNeeded   = countReshipNeeded()
  const errorTotal     = EMS_ERROR_ROWS.length

  const thBase: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 1,
    background: '#f0f5f8',
    padding: '13px 18px',
    textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--teal-dk)', textTransform: 'uppercase', letterSpacing: '.8px',
    borderBottom: '2px solid var(--teal-lt)', whiteSpace: 'nowrap',
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / EMS_PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const startIdx   = (safePage - 1) * EMS_PAGE_SIZE
  const pagedRows  = filteredRows.slice(startIdx, startIdx + EMS_PAGE_SIZE)
  const emptyMsg   = rows.length === 0 ? '데이터가 없습니다.' : '검색 결과가 없습니다.'

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
          <div className="cards" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <div className="card highlight">
              <div className="card-label">총 관리 대상</div>
              <div style={{ textAlign: 'left', paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'flex-start' }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1px' }}>{total}</span>
                  <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                </div>
                <div className="card-sub" style={{ marginTop: 0 }}>{total} / {INFLUENCER_TARGET}명 · {targetPct}%</div>
                <div style={{ marginTop: 8, height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${targetPct}%`, background: 'var(--teal-dk)', borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>
            </div>
            <div className="card highlight">
              <div className="card-label">배송</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'start', width: '100%' }}>
                <div style={{ textAlign: 'center', paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#14532d', letterSpacing: '-1px' }}>{delivered}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>배송 완료</div>
                  <div className="card-sub" style={{ marginTop: 0 }}>{total ? Math.round(delivered / total * 100) : 0}% 완료율</div>
                </div>
                <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
                <div style={{ textAlign: 'center', paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#1e40af', letterSpacing: '-1px' }}>{inTransit}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}>배송 중</div>
                </div>
                <div style={{ width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }} />
                <div style={{ textAlign: 'center', paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#991b1b', letterSpacing: '-1px' }}>{shippingErrors}</span>
                    <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>명</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>배송 오류</div>
                </div>
              </div>
            </div>
            <div className="card highlight">
              <div className="card-label">재배송 필요</div>
              <div style={{ textAlign: 'left', paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: 'flex-start' }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#991b1b', letterSpacing: '-1px' }}>{reshipNeeded}</span>
                  <span style={{ fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }}>건</span>
                </div>
                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>재배송 필요</div>
                <div className="card-sub" style={{ marginTop: 0 }}>배송 오류 {errorTotal}건 중</div>
              </div>
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
          </div>

          <div className="table-wrap">
            <table style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 36, textAlign: 'center' }}>No</th>
                  <th style={thBase}>이름</th>
                  <th style={thBase}>이메일</th>
                  <th style={thBase}>신청일</th>
                  <th style={thBase}>접수번호</th>
                  <th style={thBase}>등기번호</th>
                  <th style={thBase}>
                    <div ref={statusFilterRef} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                      <span>배송 상태</span>
                      <button onClick={() => setShowStatusFilter(p => !p)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 4, border: 'none', background: filterStatus !== 'all' ? 'var(--teal-dk)' : 'transparent', color: filterStatus !== 'all' ? '#fff' : 'var(--teal-dk)', cursor: 'pointer', padding: 0, opacity: 0.8 }}>
                        <ListFilter size={13} />
                      </button>
                      {showStatusFilter && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#fff', border: '1px solid var(--gray-3)', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 130, marginTop: 4 }}>
                          {STATUS_FILTER_OPTIONS.map(o => (
                            <button key={o.value} onClick={() => { setFilterStatus(o.value); setShowStatusFilter(false) }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, fontWeight: filterStatus === o.value ? 700 : 500, background: filterStatus === o.value ? '#d1fae5' : 'transparent', color: filterStatus === o.value ? '#065f46' : 'var(--gray-7)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                  <th style={thBase}>배송 주소</th>
                  <th style={thBase}>마지막 업데이트</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>
                        {emptyMsg}
                      </td>
                    </tr>
                  )
                  : pagedRows.map((row, i) => {
                          const i_abs      = startIdx + i
                          const badgeColor = STATUS_COLORS[row.status || ''] || '#94a3b8'
                          const addrLines  = [
                            [row.address_line_1, row.address_line_2].filter(Boolean).join(' '),
                            [row.city, ((row.state || '') + ' ' + (row.zip || '')).trim()].filter(Boolean).join(', '),
                            row.country,
                          ].filter(Boolean)
                          return (
                            <tr key={row.confirmed_influencer_id} onClick={() => openViewModal(row)}
                              style={{ cursor: 'pointer' }}>
                              <td style={{ fontSize: 11, color: 'var(--gray-5)', textAlign: 'center' }}>{row.seq ?? i_abs + 1}</td>

                              {/* 이름 */}
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.display_name || row.handle || '—'}</div>
                                {row.handle && <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 1 }}>@{row.handle}</div>}
                              </td>

                              {/* 이메일 */}
                              <td style={{ fontSize: 12 }} onClick={e => e.stopPropagation()}>
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
                              <td onClick={e => e.stopPropagation()}>
                                {row.ems_number ? (
                                  <div>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-7)' }}>{row.ems_number}</span>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                      <a href={`https://t.17track.net/en#nums=${encodeURIComponent(row.ems_number)}`} target="_blank"
                                        style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}>↗ 17track</a>
                                      <a href={`https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${row.ems_number}`} target="_blank"
                                        style={{ fontSize: 11, color: 'var(--gray-5)' }}>↗ 우체국</a>
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>
                                )}
                              </td>

                              {/* 상태 */}
                              <td>
                                {row.status
                                  ? <span style={{ background: badgeColor, color: '#fff', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.status}</span>
                                  : <span style={{ color: '#aaa', fontSize: 11 }}>—</span>}
                              </td>

                              {/* 배송 주소 */}
                              <td style={{ fontSize: 11, color: 'var(--gray-6)', maxWidth: 200 }}>
                                {addrLines.length === 0 ? '—' : addrLines.map((line, li) => (
                                  <div key={li} style={{ lineHeight: 1.6 }}>{line}</div>
                                ))}
                              </td>

                              
                              {/* 마지막 업데이트 */}
                              <td style={{ fontSize: 11, color: 'var(--gray-5)', whiteSpace: 'nowrap' }}>{row.last_update || '—'}</td>
                            </tr>
                          )
                        })}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 0 && (
            <Pagination
              page={safePage} totalPages={totalPages} total={filteredRows.length}
              startIdx={startIdx} endIdx={Math.min(startIdx + EMS_PAGE_SIZE, filteredRows.length)}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages, p + 1))}
            />
          )}
        </>
      )}

      {/* View Modal */}
      <Modal open={showViewModal} onClose={() => setShowViewModal(false)}
        title={viewRow ? `배송 정보 · ${viewRow.display_name || viewRow.handle}` : ''}
        titleStyle={{ paddingLeft: 48 }}>
        {viewRow && (() => {
          const badgeColor = STATUS_COLORS[viewRow.status || ''] || '#94a3b8'
          const addrLines  = [
            [viewRow.address_line_1, viewRow.address_line_2].filter(Boolean).join(' '),
            [viewRow.city, ((viewRow.state || '') + ' ' + (viewRow.zip || '')).trim()].filter(Boolean).join(', '),
            viewRow.country,
          ].filter(Boolean)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 상태 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 48, marginBottom: 8 }}>
                {viewRow.status
                  ? <span style={{ background: badgeColor, color: '#fff', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{viewRow.status}</span>
                  : <span style={{ color: 'var(--gray-4)', fontSize: 12 }}>상태 미입력</span>}
                {viewRow.last_update && <span style={{ fontSize: 11, color: 'var(--gray-5)' }}>마지막 업데이트: {viewRow.last_update}</span>}
              </div>

              {/* 전체 정보 그리드 */}
              <div style={{ display: 'grid', alignItems: 'center', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', padding: '0 20px 0 48px' }}>
                {/* col 1: 신청일 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>신청일</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-8)' }}>{viewRow.registered_date || '—'}</div>
                </div>
                {/* col 2: 등기번호 — spans rows 1–2 to sit beside 신청일 + 접수번호 */}
                <div style={{ gridRow: '1 / 3', gridColumn: 2 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>등기번호</div>
                  {viewRow.ems_number ? (
                    <div>
                      <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--gray-8)', marginBottom: 6 }}>{viewRow.ems_number}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <a href={`https://t.17track.net/en#nums=${encodeURIComponent(viewRow.ems_number)}`} target="_blank"
                          style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}>↗ 17track</a>
                        <a href={`https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${viewRow.ems_number}`} target="_blank"
                          style={{ fontSize: 11, color: 'var(--gray-5)' }}>↗ 우체국</a>
                      </div>
                    </div>
                  ) : <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</div>}
                </div>
                {/* col 1: 접수번호 (below 신청일) */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>접수번호</div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--gray-8)' }}>{viewRow.application_number || '—'}</div>
                </div>

                {/* col 1: 이름 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>이름</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-8)', fontWeight: 600 }}>{viewRow.display_name || viewRow.handle || '—'}</div>
                  {viewRow.handle && <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 2 }}>@{viewRow.handle}</div>}
                </div>
                {/* col 2: 이메일 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>이메일</div>
                  {viewRow.email
                    ? <a href={`mailto:${viewRow.email}`} style={{ fontSize: 13, color: 'var(--blue-dk)' }}>{viewRow.email}</a>
                    : <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</div>}
                </div>
                {/* col 1: 연락처 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>연락처</div>
                  <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--gray-8)' }}>{viewRow.phone || '—'}</div>
                </div>
                {/* col 2: 배송 주소 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>배송 주소</div>
                  {addrLines.length === 0
                    ? <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</div>
                    : addrLines.map((line, li) => (
                      <div key={li} style={{ fontSize: 13, color: 'var(--gray-8)', lineHeight: 1.7 }}>{line}</div>
                    ))}
                </div>
              </div>

              <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={() => setShowViewModal(false)}>닫기</button>
                <button className="modal-btn-confirm" onClick={() => { setShowViewModal(false); openTrackingModal(viewRow) }}>수정</button>
              </div>
            </div>
          )
        })()}
      </Modal>

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
              onChange={e => {
                const val = e.target.value
                setTrackingForm(p => ({ ...p, applicationNumber: val, status: val.trim() ? '접수완료' : p.status }))
              }}
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
