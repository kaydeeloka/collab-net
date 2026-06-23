import { useEffect, useState } from 'react'
import { gasPost } from '@/lib/api'
import {
  fetchEmailRecipients,
  selectedRecipientEmails,
  setAllEmailRecipientsSelected,
  setEmailRecipientSelected,
  type EmailRecipient,
} from '@/lib/template/email-recipients'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import type { ReportData } from './archive/shared'

export default function ShareEmailModal({
  open,
  onClose,
  report,
}: {
  open: boolean
  onClose: () => void
  report: ReportData | null
}) {
  const [recipients, setRecipients] = useState<EmailRecipient[]>([])
  const [selectedRcpt, setSelectedRcpt] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!open) return
    setStatus('')
    void loadRecipients()
  }, [open])

  async function loadRecipients() {
    setLoading(true)
    try {
      const list = await fetchEmailRecipients()
      setRecipients(list)
      setSelectedRcpt(selectedRecipientEmails(list))
    } catch {}
    finally { setLoading(false) }
  }

  async function toggleRecipient(email: string, checked: boolean) {
    setSelectedRcpt(prev => {
      const next = new Set(prev)
      checked ? next.add(email) : next.delete(email)
      return next
    })
    await setEmailRecipientSelected(email, checked)
  }

  async function toggleAllRecipients(checked: boolean) {
    setSelectedRcpt(checked ? new Set(recipients.map(r => r.email)) : new Set())
    await setAllEmailRecipientsSelected(checked)
    setRecipients(prev => prev.map(r => ({ ...r, selected: checked })))
  }

  async function send() {
    if (!report?.windowsStart) {
      setStatus('오류: 발송할 브리핑이 없습니다')
      return
    }
    if (selectedRcpt.size === 0) {
      setStatus('오류: 수신자를 선택하세요')
      return
    }
    setSending(true)
    setStatus('')
    try {
      const rcptList = recipients
        .filter(r => selectedRcpt.has(r.email))
        .map(r => r.email)
      const result = await gasPost<{
        ok?: boolean
        skipped?: boolean
        sent?: number
        recipientCount?: number
        error?: string
      }>({
        action: 'sendWeeklyBeautyNewsEmail',
        force: true,
        windowsStart: report.windowsStart,
        recipients: rcptList,
      })
      if (result.skipped) {
        setStatus('이미 발송된 주차입니다')
        return
      }
      if (!result.ok) throw new Error(result.error || '발송 실패')
      setStatus('완료 — ' + (result.sent ?? result.recipientCount ?? rcptList.length) + '명에게 발송')
    } catch (e: unknown) {
      setStatus('오류: ' + ((e as Error).message || '알 수 없음'))
    } finally {
      setSending(false)
    }
  }

  const statusColor = status.startsWith('완료')
    ? '#4caf50'
    : status.startsWith('오류')
      ? '#f44336'
      : undefined

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="브리핑 이메일 발송"
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="cfg-btn cfg-btn--ghost" onClick={onClose}>취소</button>
          <button
            type="button"
            className="cfg-btn cfg-btn--primary"
            disabled={sending || loading || selectedRcpt.size === 0 || !report?.windowsStart}
            onClick={() => { void send() }}
          >
            {sending ? '발송 중...' : `발송 (${selectedRcpt.size}명)`}
          </button>
        </div>
      }
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spinner sm />
        </div>
      )}

      {!loading && recipients.length === 0 && (
        <div className="bn-email-none">등록된 수신자가 없습니다. 뷰티 뉴스 탭에서 수신자를 추가하세요.</div>
      )}

      {!loading && recipients.length > 0 && (
        <>
          <label className="bn-rcpt-select-all" style={{ marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={selectedRcpt.size === recipients.length}
              onChange={e => { void toggleAllRecipients(e.target.checked) }}
            />
            전체 선택 ({selectedRcpt.size}/{recipients.length}명)
          </label>
          <div className="bn-recipients" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {recipients.map(r => (
              <div key={r.email} className="bn-rcpt-row">
                <label className="bn-rcpt-label">
                  <input
                    type="checkbox"
                    checked={selectedRcpt.has(r.email)}
                    onChange={e => { void toggleRecipient(r.email, e.target.checked) }}
                  />
                  <div className="bn-rcpt-info">
                    {r.name && <div className="bn-rcpt-name">{r.name}</div>}
                    <div className="bn-rcpt-email">{r.email}</div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </>
      )}

      {status && (
        <div className="bn-email-status" style={{ color: statusColor, marginTop: 12 }}>
          {status}
        </div>
      )}
    </Modal>
  )
}
