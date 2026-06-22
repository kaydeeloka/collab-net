import { gasPost } from '@/lib/api'

export interface DeliveryFailure {
  email: string
  receivedAt?: string
  reason?: string
  messageId?: string
}

/** NDRs often arrive a few seconds after Graph reports send success */
const BOUNCE_RETRY_DELAYS_MS = [0, 4000, 10000, 18000]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function gasDeployHint(error: string) {
  if (!error.includes('Unknown action') && !error.includes('syncOutlookDeliveryFailures')) return error
  return 'GAS에 반송 확인(syncOutlookDeliveryFailures)이 배포되지 않았습니다. Apps Script에 api/outlook.gs 최신 코드를 반영한 뒤 Web App을 새 배포하세요.'
}

async function fetchOutlookDeliveryFailuresOnce(
  items: Array<{ email: string; since?: string }>,
): Promise<DeliveryFailure[]> {
  const res = await gasPost<{ ok?: boolean; error?: string; failures?: DeliveryFailure[] }>({
    action: 'syncOutlookDeliveryFailures',
    items,
  })

  if (res.error) throw new Error(gasDeployHint(res.error))
  if (res.ok === false) throw new Error('배송 실패 확인 실패')
  return res.failures ?? []
}

export async function fetchOutlookDeliveryFailures(
  candidates: Array<{ email: string; since?: string | null }>,
  options?: { waitForBounces?: boolean },
): Promise<DeliveryFailure[]> {
  const items = candidates
    .map(c => ({ email: c.email.trim(), since: c.since || undefined }))
    .filter(i => i.email)
  if (!items.length) return []

  const wait = options?.waitForBounces !== false
  const delays = wait ? BOUNCE_RETRY_DELAYS_MS : [0]
  const merged = new Map<string, DeliveryFailure>()

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i])
    const batch = await fetchOutlookDeliveryFailuresOnce(items)
    for (const f of batch) merged.set(f.email.toLowerCase(), f)
  }

  return Array.from(merged.values())
}
