import { gasPost } from '@/lib/api'
import { dateOnlyToIso, supabaseNow, toIsoTimestamp } from '@/lib/kst-time'

export interface DetectedReply {
  email: string
  body: string
  date: string
  receivedAt?: string
  isRead?: boolean
  messageId?: string
}

export interface ReplySyncCandidate {
  email: string
  since?: string | null
  lastReplyAt?: string | null
}

const AWAITING_REPLY = new Set(['yes', 'noreply', ''])

export async function checkOutlookConnected() {
  return gasPost<{ ok?: boolean; configured?: boolean; authorized?: boolean; error?: string }>({
    action: 'checkOutlookAuth',
  })
}

export async function fetchOutlookReplies(candidates: Array<ReplySyncCandidate | string>) {
  const items = candidates
    .map(c => (typeof c === 'string' ? { email: c } : c))
    .map(c => ({
      email: c.email.trim(),
      since: c.since || undefined,
      lastReplyAt: c.lastReplyAt || undefined,
    }))
    .filter(i => i.email)
  if (!items.length) return [] as DetectedReply[]

  const res = await gasPost<{ ok?: boolean; error?: string; replies?: DetectedReply[] }>({
    action: 'syncOutlookReplies',
    items,
  })

  if (res.error) throw new Error(res.error)
  if (res.ok === false) throw new Error('회신 확인 실패')
  return res.replies ?? []
}

export async function markRepliesReadInOutlook(messageIds: string[]) {
  const ids = messageIds.filter(Boolean)
  if (!ids.length) return
  await gasPost({ action: 'markOutlookMessagesRead', messageIds: ids })
}

export function shouldAutoMarkReply(currentStatus: string) {
  return AWAITING_REPLY.has(currentStatus || '')
}

export function replyTimestamp(reply: DetectedReply) {
  if (reply.receivedAt) {
    const ms = new Date(reply.receivedAt).getTime()
    if (!Number.isNaN(ms)) return new Date(ms).toISOString()
  }
  if (reply.date) return dateOnlyToIso(reply.date)
  return supabaseNow()
}

export { toIsoTimestamp }

function ts(iso: string | null | undefined) {
  if (!iso) return NaN
  return new Date(iso).getTime()
}

/** True when reply is newer than last send and not already recorded on the influencer row. */
export function isNewReply(
  candidate: { last_contact_at?: string | null; last_reply_at?: string | null },
  reply: DetectedReply,
) {
  const replyMs = ts(replyTimestamp(reply))
  if (Number.isNaN(replyMs)) return false

  const sendMs = ts(candidate.last_contact_at)
  if (!Number.isNaN(sendMs) && replyMs <= sendMs) return false

  const lastReplyMs = ts(candidate.last_reply_at)
  if (!Number.isNaN(lastReplyMs) && replyMs <= lastReplyMs) return false

  return true
}

export function compareByRecentReply<T extends { status?: string; last_reply_at?: string | null }>(a: T, b: T) {
  const aAccepted = a.status === 'accept' ? 1 : 0
  const bAccepted = b.status === 'accept' ? 1 : 0
  if (aAccepted !== bAccepted) return aAccepted - bAccepted

  const aReply = a.last_reply_at ? new Date(a.last_reply_at).getTime() : 0
  const bReply = b.last_reply_at ? new Date(b.last_reply_at).getTime() : 0
  if (aReply !== bReply) return bReply - aReply

  return 0
}
