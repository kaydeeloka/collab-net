import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { gasPost } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Spinner from '@/components/Spinner'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import HeaderFilterMenu, { type HeaderFilterOption } from '@/components/HeaderFilterMenu'
import { createEmsReship, deleteEmsReship, fetchReshipmentMap } from '@/lib/ems-errors'
import { formatKstSyncLabel } from '@/lib/kst-time'
import {
  EMS_STATUS_FILTER_OPTIONS,
  EMS_STATUS_OPTIONS,
  getEmsStatusColor,
  MANUAL_RECEIVED_STATUS,
  emsStatusSelectWidth,
} from '@/lib/ems-tracking-status'
import { usePhase } from '@/contexts/PhaseContext'
import { useEmsLayout } from './layout'

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
  notes:          string | null
  handle:         string
  display_name:   string | null
  tracking_id:         string | null
  ems_number:          string | null  // 등기번호
  registered_date:     string | null  // 신청일
  application_number:  string | null  // 접수번호
  email_sent:          boolean
  status:              string | null
  registered_17track:  string | null
  reship_id:           string | null
  reship_status:       string | null
  last_update:         string | null
}

interface TrackingEvent {
  date: string; time: string; status: string; location: string; remark: string
}

interface TrackingDetail {
  ok: boolean; error?: string; pending?: boolean
  carrier?: string; statusLabel?: string; statusColor?: string
  lastTime?: string; history?: TrackingEvent[]
}

interface SyncAllResult {
  ok: boolean; error?: string
  updated?: number; skipped?: number; failed?: number; errors?: string[]
}

const RESHIP_FILTER_OPTIONS: HeaderFilterOption[] = [
  { value: 'all', label: '전체' },
  { value: 'yes', label: '재발송 등록' },
  { value: 'no',  label: '재발송 없음' },
]

export default function Ems() {
  const { showToast } = useToast()
  const { refreshStats, notifyReshipChange } = useEmsLayout()
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const [rows,    setRows]    = useState<EmsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncAllLoading, setSyncAllLoading] = useState(false)
  const [searchQuery,      setSearchQuery]      = useState('')
  const [filterStatus,     setFilterStatus]     = useState('all')
  const [filterReship,     setFilterReship]     = useState('all')
  const [openFilter,       setOpenFilter]       = useState<'status' | 'reship' | null>(null)
  const [page, setPage] = useState(1)
  const EMS_PAGE_SIZE = 25

  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailData,      setDetailData]      = useState<TrackingDetail | null>(null)
  const [detailLoading,   setDetailLoading]   = useState(false)
  const [detailNum,       setDetailNum]       = useState('')

  // View Modal
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewRow,       setViewRow]       = useState<EmsRow | null>(null)

  // Tracking (Edit) Modal
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [trackingName,      setTrackingName]      = useState('')
  const [trackingNotes,     setTrackingNotes]     = useState('')
  const [trackingSaving,    setTrackingSaving]    = useState(false)
  const [reshipSaving,      setReshipSaving]      = useState<string | null>(null)
  const [statusSaving,      setStatusSaving]      = useState<string | null>(null)
  const [trackingForm, setTrackingForm] = useState({
    confirmed_influencer_id: '',
    tracking_id:       null as string | null,
    originalEmsNum:    '',
    emsNum:            '',
    registeredDate:    '',
    applicationNumber: '',
    status:            '',
  })

  useEffect(() => {
    if (!phaseLoading && viewPhaseId) loadEms()
    if (!phaseLoading && !viewPhaseId) { setRows([]); setLoading(false) }
  }, [viewPhaseId, phaseLoading])

  useEffect(() => { setPage(1) }, [searchQuery, filterStatus, filterReship])

  async function loadEms(opts?: { silent?: boolean }) {
    if (!viewPhaseId) {
      setRows([])
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    try {
      const [{ data, error }, reshipMap] = await Promise.all([
        supabase
          .from('confirmed_influencers')
          .select(`
            id, seq, email, phone, notes,
            address_line_1, address_line_2, city, state, zip, country,
            influencers!inner(handle, display_name),
            ems_tracking(
              id, ems_number, registered_date, application_number,
              email_sent, status, last_update, registered_17track
            )
          `)
          .eq('phase_id', viewPhaseId)
          .order('seq', { ascending: true, nullsFirst: false }),
        fetchReshipmentMap(viewPhaseId),
      ])

      if (error) throw error

      const mapped: EmsRow[] = (data || []).map((ci: any) => {
        const inf = ci.influencers || {}
        const ems    = (ci.ems_tracking || [])[0] || {}
        const reship = reshipMap.get(ci.id)
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
          notes:          ci.notes,
          handle:         inf.handle       || '',
          display_name:   inf.display_name || null,
          tracking_id:        ems.id                || null,
          ems_number:         ems.ems_number        || null,
          registered_date:    ems.registered_date   || null,
          application_number: ems.application_number  || null,
          email_sent:         ems.email_sent          ?? false,
          status:             ems.status            || null,
          registered_17track: ems.registered_17track || null,
          reship_id:          reship?.id             || null,
          reship_status:      reship?.status         || null,
          last_update:        ems.last_update        || null,
        }
      })
      setRows(mapped)
      setSyncMsg(formatKstSyncLabel())
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
      setSyncMsg('동기화 실패')
    }
    setLoading(false)
  }

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

  async function syncAllFrom17Track() {
    if (!viewPhaseId) return
    setSyncAllLoading(true)
    try {
      const res = await gasPost<SyncAllResult>({
        action: 'syncAllEmsTracking',
        phaseId: viewPhaseId,
      })
      if (!res.ok) throw new Error(res.error || '동기화 실패')
      const msg = `동기화 완료 · 업데이트 ${res.updated ?? 0}, 건너뜀 ${res.skipped ?? 0}, 실패 ${res.failed ?? 0}`
      showToast(msg, (res.failed ?? 0) > 0 ? 'info' : 'success')
      if (res.errors?.length) showToast(res.errors.slice(0, 3).join('\n'), 'error')
      await Promise.all([loadEms({ silent: true }), refreshStats()])
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSyncAllLoading(false)
  }

  function openViewModal(row: EmsRow) {
    setViewRow(row)
    setShowViewModal(true)
  }

  function openTrackingModal(row: EmsRow) {
    setTrackingForm({
      confirmed_influencer_id: row.confirmed_influencer_id,
      tracking_id:       row.tracking_id,
      originalEmsNum:    row.ems_number         || '',
      emsNum:            row.ems_number         || '',
      registeredDate:    row.registered_date    || '',
      applicationNumber: row.application_number || '',
      status:            row.status             || '',
    })
    setTrackingName(row.display_name || row.handle)
    setTrackingNotes(row.notes || '')
    setShowTrackingModal(true)
  }

  async function toggleShippingError(row: EmsRow, checked: boolean, e: React.MouseEvent | React.ChangeEvent) {
    e.stopPropagation()
    if (checked && row.reship_id) return
    if (!checked && !row.reship_id) return
    setReshipSaving(row.confirmed_influencer_id)
    try {
      if (checked) {
        const { data: created, error } = await createEmsReship(row.confirmed_influencer_id, {
          id:                 row.tracking_id,
          ems_number:         row.ems_number,
          registered_date:    row.registered_date,
          application_number: row.application_number,
          last_update:        row.last_update,
          email_sent:         row.email_sent,
          status:             row.status,
        })
        if (error) throw error
        if (row.tracking_id) {
          await supabase.from('ems_tracking').update({ status: 'Exception' }).eq('id', row.tracking_id)
        }
        if (created?.id) {
          setRows(prev => prev.map(r => r.confirmed_influencer_id === row.confirmed_influencer_id
            ? { ...r, reship_id: created.id, reship_status: '처리 대기', status: row.tracking_id ? 'Exception' : r.status }
            : r))
        }
      } else {
        const { error } = await deleteEmsReship(row.confirmed_influencer_id)
        if (error) throw error
        setRows(prev => prev.map(r => r.confirmed_influencer_id === row.confirmed_influencer_id
          ? { ...r, reship_id: null, reship_status: null }
          : r))
      }
      showToast(checked ? '재발송으로 등록되었습니다' : '재발송 등록이 해제되었습니다', 'success')
      notifyReshipChange()
      await Promise.all([loadEms({ silent: true }), refreshStats()])
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    }
    setReshipSaving(null)
  }

  function statusOptionsForRow(status: string | null) {
    if (!status || (EMS_STATUS_OPTIONS as readonly string[]).includes(status)) {
      return EMS_STATUS_OPTIONS
    }
    return [status, ...EMS_STATUS_OPTIONS]
  }

  async function changeEmsStatus(row: EmsRow, newStatus: string, e: React.SyntheticEvent) {
    e.stopPropagation()
    if (!newStatus || newStatus === (row.status || '')) return
    setStatusSaving(row.confirmed_influencer_id)
    try {
      if (row.tracking_id) {
        const { error } = await supabase
          .from('ems_tracking')
          .update({ status: newStatus })
          .eq('id', row.tracking_id)
        if (error) throw error
        setRows(prev => prev.map(r => r.confirmed_influencer_id === row.confirmed_influencer_id
          ? { ...r, status: newStatus }
          : r))
        if (viewRow?.confirmed_influencer_id === row.confirmed_influencer_id) {
          setViewRow(prev => prev ? { ...prev, status: newStatus } : prev)
        }
      } else {
        const { data, error } = await supabase
          .from('ems_tracking')
          .insert({
            confirmed_influencer_id: row.confirmed_influencer_id,
            status: newStatus,
          })
          .select('id')
          .single()
        if (error) throw error
        setRows(prev => prev.map(r => r.confirmed_influencer_id === row.confirmed_influencer_id
          ? { ...r, tracking_id: data.id, status: newStatus }
          : r))
        if (viewRow?.confirmed_influencer_id === row.confirmed_influencer_id) {
          setViewRow(prev => prev ? { ...prev, tracking_id: data.id, status: newStatus } : prev)
        }
      }
      await refreshStats()
    } catch (err: unknown) {
      showToast((err as Error).message, 'error')
    }
    setStatusSaving(null)
  }

  async function submitTrackingForm() {
    setTrackingSaving(true)
    try {
      const emsChanged = trackingForm.emsNum.trim().toUpperCase() !== trackingForm.originalEmsNum.trim().toUpperCase()
      const payload: Record<string, unknown> = {
        confirmed_influencer_id: trackingForm.confirmed_influencer_id,
        ems_number:         trackingForm.emsNum            || null,
        registered_date:    trackingForm.registeredDate    || null,
        application_number: trackingForm.applicationNumber || null,
        status:             trackingForm.status,
      }
      if (emsChanged) payload.registered_17track = null

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
      await Promise.all([loadEms(), refreshStats()])
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setTrackingSaving(false)
  }

  const filteredRows = rows.filter(row => {
    if (filterStatus !== 'all' && (row.status || '') !== filterStatus) return false
    if (filterReship === 'yes' && !row.reship_id) return false
    if (filterReship === 'no' && row.reship_id) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (![row.display_name, row.handle, row.ems_number, row.application_number, row.email]
        .join(' ').toLowerCase().includes(q)) return false
    }
    return true
  })

  const thBase: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 1,
    background: 'var(--table-head-bg)',
    padding: '13px 18px',
    textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--table-head-fg)', textTransform: 'uppercase', letterSpacing: '.8px',
    borderBottom: '2px solid var(--table-head-border)', whiteSpace: 'nowrap',
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / EMS_PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const startIdx   = (safePage - 1) * EMS_PAGE_SIZE
  const pagedRows  = filteredRows.slice(startIdx, startIdx + EMS_PAGE_SIZE)
  const emptyMsg   = rows.length === 0 ? '데이터가 없습니다.' : '검색 결과가 없습니다.'

  const notesTd: React.CSSProperties = {
    padding: '8px 10px',
    whiteSpace: 'normal',
    verticalAlign: 'middle',
    maxWidth: 110,
    width: 110,
    overflow: 'hidden',
  }

  return (
    <>
      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}

      {!loading && (
        <>
          <div className="ems-toolbar">
            <div className="section-title section-title--inline">MiMuse 배송 &amp; 클라이언트 통합 대장</div>
          </div>

          <div className="filters" style={{ marginBottom: 16, marginTop: 16 }}>
            <input
              type="text"
              placeholder="이름, 이메일, 접수번호, 등기번호 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
            />
            <span className="ems-sync-msg" style={{ marginLeft: 'auto' }}>{syncMsg}</span>
            <button
              type="button"
              className="modal-btn-confirm"
              onClick={syncAllFrom17Track}
              disabled={syncAllLoading || !viewPhaseId}
              style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {syncAllLoading ? '17track 동기화 중...' : '17track 동기화'}
            </button>
          </div>

          <div className="table-wrap">
            <table style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 36, textAlign: 'center' }}>No</th>
                  <th style={thBase}>이름</th>
                  <th style={thBase}>신청일</th>
                  <th style={thBase}>접수번호</th>
                  <th style={thBase}>등기번호</th>
                  <th style={thBase}>
                    <HeaderFilterMenu
                      label="배송 상태"
                      value={filterStatus}
                      options={EMS_STATUS_FILTER_OPTIONS}
                      onChange={setFilterStatus}
                      open={openFilter === 'status'}
                      onOpenChange={open => setOpenFilter(open ? 'status' : null)}
                    />
                  </th>
                  <th style={thBase}>배송 주소</th>
                  <th style={{ ...thBase, width: 110, maxWidth: 110 }}>비고</th>
                  <th style={{ ...thBase, textAlign: 'center', width: 72 }}>
                    <HeaderFilterMenu
                      label="재발송"
                      value={filterReship}
                      options={RESHIP_FILTER_OPTIONS}
                      onChange={setFilterReship}
                      open={openFilter === 'reship'}
                      onOpenChange={open => setOpenFilter(open ? 'reship' : null)}
                      align="right"
                    />
                  </th>
                  <th style={thBase}>마지막 업데이트</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0
                  ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>
                        {emptyMsg}
                      </td>
                    </tr>
                  )
                  : pagedRows.map((row, i) => {
                          const i_abs      = startIdx + i
                          const rowStatus  = row.status ?? ''
                          const addrLines  = [
                            [row.address_line_1, row.address_line_2].filter(Boolean).join(' '),
                            [row.city, ((row.state || '') + ' ' + (row.zip || '')).trim()].filter(Boolean).join(', '),
                            row.country,
                          ].filter(Boolean)
                          return (
                            <tr key={row.confirmed_influencer_id} onClick={() => openViewModal(row)}
                              style={{ cursor: 'pointer' }}>
                              <td style={{ fontSize: 11, color: 'var(--gray-5)', textAlign: 'center' }}>{row.seq ?? i_abs + 1}</td>

                              {/* 이름 + 이메일 */}
                              <td onClick={e => row.email && e.stopPropagation()}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{row.display_name || row.handle || '—'}</div>
                                {row.handle && <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 1 }}>@{row.handle}</div>}
                                <div style={{ fontSize: 11, marginTop: 3 }}>
                                  {row.email
                                    ? <a href={`mailto:${row.email}`} style={{ color: 'var(--blue-dk)' }}>{row.email}</a>
                                    : <span style={{ color: 'var(--gray-4)' }}>—</span>}
                                </div>
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
                                    <span
                                      onClick={() => openDetail(row.ems_number!)}
                                      style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--blue-dk)', cursor: 'pointer', textDecoration: 'underline' }}
                                    >{row.ems_number}</span>
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
                              <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                                <select
                                  className="ems-status-select"
                                  value={rowStatus}
                                  disabled={statusSaving === row.confirmed_influencer_id}
                                  onChange={e => changeEmsStatus(row, e.target.value, e)}
                                  style={{
                                    width: rowStatus ? emsStatusSelectWidth(rowStatus) : '3rem',
                                    backgroundColor: rowStatus ? getEmsStatusColor(rowStatus) : 'var(--gray-1)',
                                    color: rowStatus ? '#fff' : 'var(--gray-4)',
                                    border: rowStatus ? undefined : '1px solid var(--gray-3)',
                                  }}
                                >
                                  {!rowStatus && <option value="">—</option>}
                                  {statusOptionsForRow(row.status).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </td>

                              {/* 배송 주소 */}
                              <td style={{ fontSize: 11, color: 'var(--gray-6)', maxWidth: 200 }}>
                                {addrLines.length === 0 ? '—' : addrLines.map((line, li) => (
                                  <div key={li} style={{ lineHeight: 1.6 }}>{line}</div>
                                ))}
                              </td>

                              {/* 비고 */}
                              <td style={notesTd}>
                                <span style={{
                                  fontSize: 11,
                                  color: row.notes?.trim() ? 'var(--gray-7)' : 'var(--gray-4)',
                                  lineHeight: 1.5,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  wordBreak: 'break-word',
                                }}>
                                  {row.notes?.trim() || '—'}
                                </span>
                              </td>

                              {/* 재발송 */}
                              <td style={{ textAlign: 'center', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={!!row.reship_id}
                                  disabled={reshipSaving === row.confirmed_influencer_id}
                                  onChange={e => toggleShippingError(row, e.target.checked, e)}
                                  title={row.reship_id ? '재발송 등록됨' : '재발송 등록'}
                                  style={{ width: 15, height: 15, cursor: reshipSaving === row.confirmed_influencer_id ? 'wait' : 'pointer', accentColor: '#dc2626' }}
                                />
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
          const badgeColor = getEmsStatusColor(viewRow.status)
          const addrLines  = [
            [viewRow.address_line_1, viewRow.address_line_2].filter(Boolean).join(' '),
            [viewRow.city, ((viewRow.state || '') + ' ' + (viewRow.zip || '')).trim()].filter(Boolean).join(', '),
            viewRow.country,
          ].filter(Boolean)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* 상태 배지 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 48, marginBottom: 8, flexWrap: 'wrap' }}>
                {viewRow.status
                  ? <span style={{ background: badgeColor, color: '#fff', padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{viewRow.status}</span>
                  : <span style={{ color: 'var(--gray-4)', fontSize: 12 }}>—</span>}
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
                      <span
                        onClick={() => openDetail(viewRow.ems_number!)}
                        style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--blue-dk)', cursor: 'pointer', textDecoration: 'underline', display: 'inline-block', marginBottom: 6 }}
                      >{viewRow.ems_number}</span>
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
                <div />

                {/* 배송 주소 + 비고 */}
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 120px', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>배송 주소</div>
                    {addrLines.length === 0
                      ? <div style={{ fontSize: 13, color: 'var(--gray-4)' }}>—</div>
                      : addrLines.map((line, li) => (
                        <div key={li} style={{ fontSize: 13, color: 'var(--gray-8)', lineHeight: 1.7 }}>{line}</div>
                      ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>비고</div>
                    <div style={{
                      fontSize: 13,
                      color: viewRow.notes?.trim() ? 'var(--gray-8)' : 'var(--gray-4)',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                    }}>
                      {viewRow.notes?.trim() || '—'}
                    </div>
                  </div>
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
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-8)', marginBottom: 8 }}>{trackingName}</div>
        <div style={{ fontSize: 12, color: trackingNotes.trim() ? 'var(--gray-6)' : 'var(--gray-4)', marginBottom: 16, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 700, color: 'var(--gray-5)' }}>비고 · </span>
          {trackingNotes.trim() || '—'}
        </div>
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
              {!trackingForm.status && <option value="">—</option>}
              {EMS_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>접수번호</label>
            <input placeholder="우체국 접수번호" value={trackingForm.applicationNumber}
              onChange={e => {
                const val = e.target.value
                setTrackingForm(p => ({ ...p, applicationNumber: val, status: val.trim() ? MANUAL_RECEIVED_STATUS : p.status }))
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
      </Modal>
    </>
  )
}
