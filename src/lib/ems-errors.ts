export interface EmsErrorRow {
  name:     string
  tracking: string
  sentDate: string
  country:  string
  reason:   string
  status:   string
}

export const EMS_ERROR_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '처리 중':     { bg: '#fff3cd', text: '#856404' },
  '재발송 예정': { bg: '#cff4fc', text: '#055160' },
  '확인 중':     { bg: '#e2d9f3', text: '#4a2c8a' },
  '재발송 완료': { bg: '#d1e7dd', text: '#0f5132' },
  '처리 대기':   { bg: '#f8d7da', text: '#842029' },
}

/** Shared source for 배송 오류 관리 — update here when data moves to Supabase. */
export const EMS_ERROR_ROWS: EmsErrorRow[] = [
  { name: 'Sarah Kim',   tracking: 'EMS123456789KR', sentDate: '2026-05-12', country: '미국',   reason: '주소 불명',   status: '처리 중' },
  { name: 'Emily Chen',  tracking: 'EMS234567890KR', sentDate: '2026-05-14', country: '미국',   reason: '수취인 부재', status: '재발송 예정' },
  { name: 'Mia Johnson', tracking: 'EMS345678901KR', sentDate: '2026-05-15', country: '캐나다', reason: '세관 보류',   status: '확인 중' },
  { name: 'Jessica Lee', tracking: 'EMS456789012KR', sentDate: '2026-05-18', country: '미국',   reason: '주소 오류',   status: '재발송 완료' },
  { name: 'Ashley Park', tracking: 'EMS567890123KR', sentDate: '2026-05-20', country: '미국',   reason: '반송 처리',   status: '처리 대기' },
]

export const RESHIP_NEEDED_STATUSES = ['처리 중', '재발송 예정', '확인 중', '처리 대기'] as const

export function countReshipNeeded(rows: EmsErrorRow[] = EMS_ERROR_ROWS): number {
  return rows.filter(r => RESHIP_NEEDED_STATUSES.includes(r.status as typeof RESHIP_NEEDED_STATUSES[number])).length
}
