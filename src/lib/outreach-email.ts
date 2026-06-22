import { gasPost } from '@/lib/api'

export const BULK_SEND_MAX = 500

export function bulkSendLimitMessage() {
  return `일괄 발송은 최대 ${BULK_SEND_MAX}명까지 선택할 수 있습니다`
}

export function bulkSendProgressLabel(current: number, total: number, failed = 0) {
  if (failed > 0) return `발송 중 ${current}/${total} (실패 ${failed})`
  return `발송 중 ${current}/${total}`
}

export type BulkSendRowStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

export interface BulkSendRow {
  key: string
  label: string
  email?: string
  status: BulkSendRowStatus
  error?: string
}

export interface BulkSendLiveState {
  running: boolean
  checkingBounces?: boolean
  rows: BulkSendRow[]
  progress: BulkSendProgress
}

export interface BulkSendEntry<T> {
  key: string
  label: string
  email?: string
  item: T
}

export async function runBulkOutreachSend<T>(
  entries: BulkSendEntry<T>[],
  sendOne: (item: T) => Promise<'sent' | 'skipped'>,
  onUpdate: (state: BulkSendLiveState) => void,
): Promise<{ sent: number; failed: number; skipped: number; failures: BulkSendFailure[] }> {
  let sent = 0
  let failed = 0
  let skipped = 0
  const failures: BulkSendFailure[] = []
  const total = entries.length
  const rows: BulkSendRow[] = entries.map(e => ({
    key: e.key,
    label: e.label,
    email: e.email,
    status: 'pending',
  }))

  const push = (running: boolean, current: number) => {
    onUpdate({ running, rows: rows.map(r => ({ ...r })), progress: { current, total, failed } })
  }

  push(true, 0)

  for (let i = 0; i < entries.length; i++) {
    rows[i].status = 'sending'
    push(true, i)

    try {
      const result = await sendOne(entries[i].item)
      if (result === 'skipped') {
        rows[i].status = 'skipped'
        skipped++
      } else {
        rows[i].status = 'sent'
        sent++
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '발송 실패'
      rows[i].status = 'failed'
      rows[i].error = message
      failed++
      failures.push({ label: entries[i].label, error: message })
    }

    push(i < entries.length - 1, i + 1)
  }

  push(false, total)
  return { sent, failed, skipped, failures }
}

export function getOutreachSendError(res: { ok?: boolean; error?: string } | null | undefined): string | null {
  if (!res) return '발송 실패 (응답 없음)'
  if (res.ok === false) return res.error?.trim() || '발송 실패'
  if (res.error?.trim()) return res.error.trim()
  if (res.ok !== true) return '발송 실패'
  return null
}

export function formatBulkSendSummary(sent: number, failed: number, unit = '건') {
  if (sent === 0 && failed === 0) return '발송할 대상이 없습니다'
  if (failed === 0) return `발송 완료 (${sent}${unit})`
  if (sent === 0) return `발송 실패 (${failed}${unit})`
  return `발송 완료 ${sent}${unit} · 실패 ${failed}${unit}`
}

export interface BulkSendFailure {
  label: string
  error: string
}

export interface BulkSendProgress {
  current: number
  total: number
  failed: number
}

export function reportBulkSendResults(
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void,
  result: { sent: number; failed: number; skipped: number },
  failures: BulkSendFailure[],
  unit = '건',
) {
  const summary = formatBulkSendSummary(result.sent, result.failed, unit)
  const type = result.failed > 0 ? 'error' : 'success'
  showToast(summary, type)
  if (failures.length > 0) {
    const lines = failures.slice(0, 4).map(f => `${f.label}: ${f.error}`)
    const more = failures.length > 4 ? `\n외 ${failures.length - 4}건` : ''
    window.setTimeout(() => showToast(lines.join('\n') + more, 'error'), 150)
  }
}

export function reportDeliveryBounces(
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void,
  bounces: Array<{ label: string; reason?: string }>,
) {
  if (!bounces.length) return
  const lines = bounces.slice(0, 4).map(b => `${b.label}: ${b.reason?.trim() || '배송 실패 (반송)'}`)
  const more = bounces.length > 4 ? `\n외 ${bounces.length - 4}건` : ''
  showToast(`배송 실패 ${bounces.length}건 감지\n${lines.join('\n')}${more}`, 'error')
}

export function markBulkSendBounces(
  state: BulkSendLiveState,
  failures: Array<{ email: string; reason?: string }>,
): BulkSendLiveState {
  const failByEmail = new Map(failures.map(f => [f.email.toLowerCase(), f.reason]))
  const rows = state.rows.map(row => {
    const key = row.email?.toLowerCase()
    if (key && failByEmail.has(key)) {
      return {
        ...row,
        status: 'failed' as const,
        error: failByEmail.get(key)?.trim() || '배송 실패 (반송)',
      }
    }
    return row
  })
  const failed = rows.filter(r => r.status === 'failed').length
  return { ...state, running: false, checkingBounces: false, rows, progress: { ...state.progress, failed } }
}

/** @deprecated Use runBulkOutreachSend for failure tracking */
export async function runBulkSendWithProgress<T>(
  items: T[],
  sendOne: (item: T) => Promise<void>,
  onProgress: (current: number, total: number) => void,
) {
  const total = items.length
  for (let i = 0; i < items.length; i++) {
    onProgress(i + 1, total)
    await sendOne(items[i])
  }
}

export function tryToggleBulkSelection<T>(
  prev: Set<T>,
  id: T,
  checked: boolean,
): { next: Set<T>; rejected: boolean } {
  if (!checked) {
    const next = new Set(prev)
    next.delete(id)
    return { next, rejected: false }
  }
  if (prev.has(id)) return { next: prev, rejected: false }
  if (prev.size >= BULK_SEND_MAX) return { next: prev, rejected: true }
  const next = new Set(prev)
  next.add(id)
  return { next, rejected: false }
}

export function tryToggleBulkPage<T>(
  prev: Set<T>,
  pageIds: T[],
  checked: boolean,
): { next: Set<T>; rejected: boolean } {
  if (!checked) {
    const next = new Set(prev)
    pageIds.forEach(id => next.delete(id))
    return { next, rejected: false }
  }
  const next = new Set(prev)
  let rejected = false
  for (const id of pageIds) {
    if (next.has(id)) continue
    if (next.size >= BULK_SEND_MAX) { rejected = true; break }
    next.add(id)
  }
  return { next, rejected }
}

/** Select all items in the current filtered list (capped at BULK_SEND_MAX). */
export function selectBulkAll<T>(allIds: T[]): { next: Set<T>; truncated: boolean } {
  const next = new Set<T>()
  let truncated = false
  for (const id of allIds) {
    if (next.size >= BULK_SEND_MAX) {
      truncated = true
      break
    }
    next.add(id)
  }
  return { next, truncated }
}

export function deselectBulkAll<T>(prev: Set<T>, allIds: T[]): Set<T> {
  const next = new Set(prev)
  allIds.forEach(id => next.delete(id))
  return next
}

export function isBulkAllSelected<T>(checked: Set<T>, allIds: T[]): boolean {
  if (allIds.length === 0) return false
  const capped = allIds.slice(0, BULK_SEND_MAX)
  return capped.every(id => checked.has(id))
}

export function toggleBulkAllFiltered<T>(
  prev: Set<T>,
  allIds: T[],
): { next: Set<T>; truncated: boolean } {
  if (isBulkAllSelected(prev, allIds)) {
    return { next: deselectBulkAll(prev, allIds), truncated: false }
  }
  const { next, truncated } = selectBulkAll(allIds)
  return { next, truncated }
}

export async function sendOutreachEmail(payload: {
  to: string
  subject: string
  body: string
}) {
  return gasPost<{ ok?: boolean; error?: string; date?: string }>({
    action: 'sendOutreachEmail',
    to: payload.to,
    subject: payload.subject,
    body: payload.body || '',
  })
}
