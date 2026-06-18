import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { gasPost } from '@/lib/api'
import {
  EMS_ERROR_STATUS_STYLE,
  ERROR_STATUS_OPTIONS,
  fetchEmsErrors,
  updateEmsReship,
  type EmsErrorRow,
} from '@/lib/ems-errors'
import { formatKstDate } from '@/lib/kst-time'
import { EMS_STATUS_OPTIONS, getEmsStatusColor } from '@/lib/ems-tracking-status'
import { applyEmsPlaceholders, loadEmsTemplates, type EmsTemplate } from '@/lib/ems-templates'
import { useToast } from '@/contexts/ToastContext'
import { usePhase } from '@/contexts/PhaseContext'
import { useEmsLayout } from '../layout'
import Spinner from '@/components/Spinner'
import { TableActionBar } from '@/components/StickyBar'
import { Button } from '@/components/ui'

function displayVal(v: string) {
  return v === '—' || !v.trim() ? '—' : v
}

function toDateInputValue(v: string): string {
  if (!v || v === '—') return ''
  return formatKstDate(v) ?? ''
}

function TrackingCell({ emsNumber, carrierStatus }: { emsNumber: string; carrierStatus: string }) {
  const num = displayVal(emsNumber)
  if (num === '—') return <span style={{ color: 'var(--gray-4)', fontSize: 11 }}>—</span>

  const badgeColor = getEmsStatusColor(carrierStatus)
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
  const { showToast, showConfirm } = useToast()
  const { refreshStats, reshipVersion } = useEmsLayout()
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const { pathname } = useLocation()
  const [rows, setRows]           = useState<EmsErrorRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [tableEditMode, setTableEditMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [templates, setTemplates] = useState<EmsTemplate[]>([])
  const [bulkTplIdx, setBulkTplIdx] = useState(0)
  const [bulkSending, setBulkSending] = useState(false)

  useEffect(() => {
    loadEmsTemplates().then(setTemplates).catch(() => showToast('템플릿을 불러오지 못했습니다', 'error'))
  }, [showToast])

  useEffect(() => {
    if (pathname.startsWith('/kit/ems/errors') && !phaseLoading) loadErrors()
  }, [pathname, reshipVersion, viewPhaseId, phaseLoading])

  async function loadErrors() {
    if (!viewPhaseId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setRows(await fetchEmsErrors(viewPhaseId))
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

  const trackingTdStyle: React.CSSProperties = {
    whiteSpace: 'normal',
    overflow: 'visible',
    maxWidth: 'none',
    minWidth: 160,
    verticalAlign: 'top',
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

      {!loading && rows.length > 0 && (
        <TableActionBar
          selectedCount={checkedIds.size}
          unit="명"
          actions={
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={bulkSending || checkedIds.size === 0 || !templates[bulkTplIdx]}
                onClick={() => {
                  const tpl = templates[bulkTplIdx]
                  if (!tpl) return
                  showConfirm(`${checkedIds.size}명에게 일괄 발송하시겠습니까?`, async () => {
                    setBulkSending(true)
                    let sent = 0
                    let failed = 0
                    for (const id of checkedIds) {
                      const row = rows.find(r => r.id === id)
                      if (!row?.email) continue
                      try {
                        const res = await gasPost<{ ok?: boolean; error?: string }>({
                          action: 'sendOutreachEmail',
                          to: row.email,
                          subject: applyEmsPlaceholders(tpl.title, row),
                          body: applyEmsPlaceholders(tpl.body, row),
                        })
                        if (res.error || res.ok === false) throw new Error(res.error || '발송 실패')
                        await updateEmsReship(row.id, { email_sent: true })
                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, email_sent: true } : r))
                        sent++
                      } catch (e: unknown) {
                        failed++
                        showToast(`${row.name}: ${(e as Error).message}`, 'error')
                      }
                    }
                    setBulkSending(false)
                    setCheckedIds(new Set())
                    if (sent > 0) showToast(`${sent}명 일괄 발송 완료${failed > 0 ? ` (${failed}건 실패)` : ''}`, 'success')
                    else if (failed === 0) showToast('이메일이 있는 선택 항목이 없습니다', 'error')
                  }, { confirmLabel: '발송', confirmColor: 'var(--blue-dk)' })
                }}
              >
                {bulkSending ? '발송 중...' : '일괄 발송'}
              </Button>
              {checkedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setCheckedIds(new Set())}>
                  선택 해제
                </Button>
              )}
            </>
          }
        >
          <select className="table-action-bar__select" value={bulkTplIdx} onChange={e => setBulkTplIdx(+e.target.value)}>
            {templates.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
          </select>
        </TableActionBar>
      )}

      {loading && <div className="loader"><Spinner />데이터 불러오는 중...</div>}
      {!loading && (
      <div className="table-wrap" style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every(r => checkedIds.has(r.id))}
                  onChange={e => setCheckedIds(prev => {
                    const next = new Set(prev)
                    rows.forEach(r => e.target.checked ? next.add(r.id) : next.delete(r.id))
                    return next
                  })}
                />
              </th>
              <th>인플루언서명</th>
              <th>이메일</th>
              <th>새 접수번호</th>
              <th>새 등기번호</th>
              <th>재발송일</th>
              <th>오류 사유</th>
              <th>처리 상태</th>
              <th>발송</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>등록된 재발송 건이 없습니다. 배송 추적 탭에서 재발송을 등록하세요.</td></tr>
              : rows.map((r) => {
              const st = EMS_ERROR_STATUS_STYLE[r.status] ?? { bg: '#e9ecef', text: '#495057' }
              return (
                <tr key={r.id}>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(r.id)}
                      disabled={!r.email}
                      onChange={e => setCheckedIds(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(r.id) : next.delete(r.id)
                        return next
                      })}
                    />
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>
                    {r.email
                      ? <a href={`mailto:${r.email}`} style={{ color: 'var(--blue-dk)', fontSize: 13 }}>{r.email}</a>
                      : <span style={{ color: 'var(--gray-4)', fontSize: 12 }}>—</span>}
                  </td>
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
                  <td style={trackingTdStyle}>
                    {tableEditMode ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 150 }}>
                        <input
                          key={`ems-${r.id}-${r.tracking}`}
                          defaultValue={r.tracking === '—' ? '' : r.tracking}
                          placeholder="새 등기번호"
                          disabled={savingId === r.id}
                          onBlur={e => changeField(r, 'tracking', e.target.value)}
                          style={{ ...inputStyle, minWidth: 0, fontFamily: 'monospace' }}
                        />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-5)', marginBottom: 4 }}>배송 상태</div>
                          <select
                            value={r.carrierStatus}
                            disabled={savingId === r.id}
                            onChange={e => changeCarrierStatus(r, e.target.value)}
                            style={{
                              display: 'block', width: '100%',
                              background: getEmsStatusColor(r.carrierStatus),
                              color: '#fff',
                              padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              border: '1px solid var(--gray-3)', cursor: 'pointer',
                            }}
                          >
                            {EMS_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
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
                  <td>
                    <span style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: r.email_sent ? '#dbeafe' : '#f1f5f9',
                      color: r.email_sent ? '#1d4ed8' : '#94a3b8',
                    }}>
                      {r.email_sent ? '발송 완료' : '미발송'}
                    </span>
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
