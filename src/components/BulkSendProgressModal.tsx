import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import { formatBulkSendSummary, type BulkSendLiveState } from '@/lib/outreach-email'

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  sending: '발송 중…',
  sent: '발송 완료',
  failed: '발송 실패',
  skipped: '건너뜀',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'var(--gray-4)',
  sending: 'var(--blue-dk)',
  sent: '#15803d',
  failed: '#b91c1c',
  skipped: 'var(--gray-5)',
}

const LIST_SCROLL_AT = 10
const ROW_HEIGHT_PX = 52

export default function BulkSendProgressModal({
  open,
  state,
  unit = '건',
  onClose,
}: {
  open: boolean
  state: BulkSendLiveState | null
  unit?: string
  onClose: () => void
}) {
  if (!state) return null

  const { running, checkingBounces, rows, progress } = state
  const busy = running || !!checkingBounces
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const sent = rows.filter(r => r.status === 'sent').length
  const failed = rows.filter(r => r.status === 'failed').length
  const skipped = rows.filter(r => r.status === 'skipped').length
  const title = checkingBounces
    ? '반송 메일 확인 중…'
    : running
      ? `일괄 발송 중 (${progress.current}/${progress.total})`
      : '일괄 발송 완료'
  const statusLine = checkingBounces
    ? '받은편지함에서 배달 실패(NDR) 확인 중…'
    : '이메일 발송 중…'
  const summaryText = formatBulkSendSummary(sent, failed, unit)
  const listScrollable = rows.length > LIST_SCROLL_AT

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="lg"
      footer={!busy ? (
        <div className="modal-actions" style={{ marginTop: 0 }}>
          <button type="button" className="modal-btn-confirm" onClick={onClose}>닫기</button>
        </div>
      ) : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {busy && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--gray-6)' }}>
              <span>{statusLine}</span>
              <span>{checkingBounces ? <Spinner sm /> : `${pct}%`}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--gray-1)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: checkingBounces ? '100%' : `${pct}%`,
                borderRadius: 999,
                background: failed > 0 ? 'linear-gradient(90deg, var(--teal-dk), #f87171)' : 'var(--teal-dk)',
                transition: 'width .25s ease',
                opacity: checkingBounces ? 0.45 : 1,
              }} />
            </div>
          </div>
        )}

        <div style={{
          maxHeight: listScrollable ? ROW_HEIGHT_PX * LIST_SCROLL_AT : undefined,
          overflowY: listScrollable ? 'auto' : undefined,
          border: '1px solid var(--gray-2)',
          borderRadius: 12,
          background: 'var(--gray-0)',
        }}>
          {rows.map(row => (
            <div
              key={row.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '11px 14px',
                borderBottom: '1px solid var(--gray-1)',
              }}
            >
              <div style={{ width: 20, paddingTop: 1, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                {row.status === 'sending' || (checkingBounces && row.status === 'sent')
                  ? <Spinner sm />
                  : (
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: STATUS_COLOR[row.status] || 'var(--gray-4)',
                      display: 'inline-block',
                      marginTop: 5,
                    }} />
                  )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-8)', wordBreak: 'break-word' }}>
                  {row.label}
                </div>
                {row.email && (
                  <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 2, wordBreak: 'break-all' }}>
                    {row.email}
                  </div>
                )}
                {row.status === 'failed' && row.error && (
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4, wordBreak: 'break-word' }}>
                    {row.error}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: STATUS_COLOR[row.status] || 'var(--gray-5)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {STATUS_LABEL[row.status] || row.status}
              </div>
            </div>
          ))}
        </div>

        {!busy && (
          <div style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: failed > 0 ? '#fef2f2' : 'var(--gray-1)',
            border: `1px solid ${failed > 0 ? '#fecaca' : 'var(--gray-2)'}`,
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: failed > 0 ? '#991b1b' : '#14532d',
            }}>
              {summaryText}
            </div>
            {skipped > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gray-5)' }}>건너뜀 {skipped}{unit}</div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
