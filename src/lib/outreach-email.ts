import { gasPost } from '@/lib/api'
import { plainBodyToHtmlForSend } from '@/lib/email-body-format'

export const BULK_SEND_MAX = 500

export function bulkSendLimitMessage() {
  return `일괄 발송은 최대 ${BULK_SEND_MAX}명까지 선택할 수 있습니다`
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

export async function sendOutreachEmail(payload: {
  to: string
  subject: string
  body: string
}) {
  const body = payload.body || ''
  return gasPost<{ ok?: boolean; error?: string; date?: string }>({
    action: 'sendOutreachEmail',
    to: payload.to,
    subject: payload.subject,
    body,
    htmlBody: plainBodyToHtmlForSend(body),
  })
}
