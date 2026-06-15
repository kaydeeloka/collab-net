import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  EMS_ERROR_STATUS_STYLE,
  ERROR_STATUS_OPTIONS,
  fetchEmsErrors,
  updateEmsReship,
  type EmsErrorRow,
} from '../../../../lib/ems-errors'
import { useToast } from '../../../../contexts/ToastContext'
import { useEmsLayout } from '../layout'
import Spinner from '../../../../components/Spinner'

function displayVal(v: string) {
  return v === '—' || !v.trim() ? '—' : v
}

function toDateInputValue(v: string): string {
  if (!v || v === '—') return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return ''
}

const CARRIER_STATUS_COLORS: Record<string, string> = {
  '접수완료'   : '#6366f1',
  'Preparing'  : '#94a3b8',
  'In Transit' : '#6a95a5',
  'Delivered'  : '#27ae60',
  'Exception'  : '#e74c3c',
}

const CARRIER_STATUS_OPTIONS = ['접수완료', 'Preparing', 'In Transit', 'Delivered', 'Exception']

function TrackingCell({ emsNumber, carrierStatus }: { emsNumber: string; carrierStatus: string }) {
  const num = displayVal(emsNumber)
  if (num === '—') return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>

  const badgeColor = CARRIER_STATUS_COLORS[carrierStatus] || '#94a3b8'
  return (
    <div>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--gray-7)' }}>{num}</span>
      <div style={{ marginTop: 4 }}>
        <span style={{
          background: badgeColor, color: '#fff',
          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {carrierStatus}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <a
          href={`https://t.17track.net/en#nums=${encodeURIComponent(num)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: 'var(--blue-dk)', fontWeight: 600 }}
        >
          ↗ 17track
        </a>
        <a
          href={`https://service.epost.go.kr/trace.RetrieveEmsRigiTraceList.comm?POST_CODE=${num}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: 'var(--gray-5)' }}
        >
          ↗ 우체국
        </a>
      </div>
    </div>
  )
}

export default function EmsErrors() {
  const { showToast } = useToast()
  const { refreshStats, reshipVersion } = useEmsLayout()
  const { pathname } = useLocation()
  const [rows, setRows]           = useState<EmsErrorRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [tableEditMode, setTableEditMode] = useState(false)

  useEffect(() => {
    if (pathname.startsWith('/kit/ems/errors')) loadErrors()
  }, [pathname, reshipVersion])

  async function loadErrors() {
    setLoading(true)
    try {
      setRows(await fetchEmsErrors())
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setLoading(false)
  }

  async function changeStatus(row: EmsErrorRow, status: string) {
    setSavingId(row.id)
    try {
      const { error } = await updateEmsReship(row.id, { status })
      if (error) throw error
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status } : r))
      showToast('처리 상태가 업데이트되었습니다', 'success')
      await refreshStats()
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSavingId(null)
  }

  async function changeReason(row: EmsErrorRow, reason: string) {
    if (reason === row.reason || (reason === '' && row.reason === '—')) return
    setSavingId(row.id)
    try {
      const { error } = await updateEmsReship(row.id, { error_reason: reason.trim() || null })
      if (error) throw error
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, reason: reason.trim() || '—' } : r))
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSavingId(null)
  }

  async function changeCarrierStatus(row: EmsErrorRow, carrierStatus: string) {
    if (carrierStatus === row.carrierStatus) return
    setSavingId(row.id)
    try {
      const { error } = await updateEmsReship(row.id, { carrier_status: carrierStatus })
      if (error) throw error
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, carrierStatus } : r))
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSavingId(null)
  }

  async function changeField(row: EmsErrorRow, field: 'tracking' | 'applicationNumber' | 'sentDate', value: string) {
    const trimmed = value.trim()
    const current = field === 'tracking'
      ? row.tracking
      : field === 'applicationNumber'
        ? row.applicationNumber
        : row.sentDate
    if (trimmed === current || (trimmed === '' && current === '—')) return
    setSavingId(row.id)
    try {
      const payload = field === 'tracking'
        ? { ems_number: trimmed || null }
        : field === 'applicationNumber'
          ? { application_number: trimmed || null }
          : { registered_date: trimmed || null }
      const { error } = await updateEmsReship(row.id, payload)
      if (error) throw error
      const key = field === 'tracking' ? 'tracking' : field === 'applicationNumber' ? 'applicationNumber' : 'sentDate'
      setRows(prev => prev.map(r => r.id === row.id
        ? { ...r, [key]: trimmed || '—' }
        : r))
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    }
    setSavingId(null)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', minWidth: 110, padding: '4px 8px',
    border: '1px solid var(--gray-3)', borderRadius: 6, fontSize: 12, outline: 'none',
  }

  return (
    <div className="bn-report-card">
      <div className="bn-report-header">
        <span className="bn-report-title">배송 오류 인플루언서 목록</span>
        <button
          type="button"
          className="cfg-btn"
          style={tableEditMode ? { background: 'var(--green)', color: '#fff', borderColor: 'var(--green)', marginLeft: 'auto' } : { marginLeft: 'auto' }}
          onClick={() => setTableEditMode(v => !v)}
        >
          {tableEditMode ? '완료' : '편집'}
        </button>
      </div>
      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
      {!loading && (
      <div className="table-wrap" style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th>인플루언서명</th>
              <th>새 접수번호</th>
              <th>새 등기번호</th>
              <th>재발송일</th>
              <th>오류 사유</th>
              <th>처리 상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>등록된 재발송 건이 없습니다. 배송 추적 탭에서 재발송을 등록하세요.</td></tr>
              : rows.map((r) => {
              const st = EMS_ERROR_STATUS_STYLE[r.status] ?? { bg: '#e9ecef', text: '#495057' }
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>
                    {tableEditMode ? (
                      <input
                        key={`app-${r.id}-${r.applicationNumber}`}
                        defaultValue={r.applicationNumber === '—' ? '' : r.applicationNumber}
                        placeholder="새 접수번호"
                        disabled={savingId === r.id}
                        onBlur={e => changeField(r, 'applicationNumber', e.target.value)}
                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: displayVal(r.applicationNumber) === '—' ? 'var(--gray-4)' : 'var(--gray-8)' }}>
                        {displayVal(r.applicationNumber)}
                      </span>
                    )}
                  </td>
                  <td>
                    {tableEditMode ? (
                      <div>
                        <input
                          key={`ems-${r.id}-${r.tracking}`}
                          defaultValue={r.tracking === '—' ? '' : r.tracking}
                          placeholder="새 등기번호"
                          disabled={savingId === r.id}
                          onBlur={e => changeField(r, 'tracking', e.target.value)}
                          style={{ ...inputStyle, minWidth: 130, fontFamily: 'monospace' }}
                        />
                        <select
                          value={r.carrierStatus}
                          disabled={savingId === r.id}
                          onChange={e => changeCarrierStatus(r, e.target.value)}
                          style={{
                            width: '100%', marginTop: 6, minWidth: 130,
                            background: CARRIER_STATUS_COLORS[r.carrierStatus] || '#94a3b8',
                            color: '#fff',
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: 'pointer',
                          }}
                        >
                          {CARRIER_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ) : (
                      <TrackingCell emsNumber={r.tracking} carrierStatus={r.carrierStatus} />
                    )}
                  </td>
                  <td>
                    {tableEditMode ? (
                      <input
                        type="date"
                        key={`date-${r.id}-${r.sentDate}`}
                        defaultValue={toDateInputValue(r.sentDate)}
                        disabled={savingId === r.id}
                        onBlur={e => changeField(r, 'sentDate', e.target.value)}
                        style={{ ...inputStyle, minWidth: 130 }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: displayVal(r.sentDate) === '—' ? 'var(--gray-4)' : 'var(--gray-8)' }}>
                        {displayVal(r.sentDate)}
                      </span>
                    )}
                  </td>
                  <td>
                    {tableEditMode ? (
                      <input
                        key={`reason-${r.id}-${r.reason}`}
                        defaultValue={r.reason === '—' ? '' : r.reason}
                        placeholder="오류 사유 입력"
                        disabled={savingId === r.id}
                        onBlur={e => changeReason(r, e.target.value)}
                        style={{ ...inputStyle, minWidth: 120 }}
                      />
                    ) : (
                      <span style={{ fontSize: 13, color: displayVal(r.reason) === '—' ? 'var(--gray-4)' : 'var(--gray-8)' }}>
                        {displayVal(r.reason)}
                      </span>
                    )}
                  </td>
                  <td>
                    {tableEditMode ? (
                      <select
                        value={r.status}
                        disabled={savingId === r.id}
                        onChange={e => changeStatus(r, e.target.value)}
                        style={{
                          background: st.bg, color: st.text,
                          padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                          border: `1px solid ${st.text}33`, cursor: 'pointer',
                        }}
                      >
                        {ERROR_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span style={{
                        background: st.bg, color: st.text,
                        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        border: `1px solid ${st.text}33`, display: 'inline-block',
                      }}>
                        {r.status}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
