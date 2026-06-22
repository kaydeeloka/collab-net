export const TCM_KEYWORD_MAX = 5
export const TCM_PER_KEYWORD_TARGET_WARN = 10
export const TCM_TARGET_MIN = 10
export const TCM_TARGET_MAX = 120

export function tcmTargetLimitMessage() {
  return `목표 인플루언서 수는 ${TCM_TARGET_MIN}~${TCM_TARGET_MAX}명까지 설정할 수 있습니다`
}

export function clampTargetCreators(value: number): number {
  const n = Number.isFinite(value) ? Math.round(value) : TCM_TARGET_MIN
  return Math.min(TCM_TARGET_MAX, Math.max(TCM_TARGET_MIN, n))
}

export function tcmKeywordLimitMessage() {
  return `TCM 키워드는 최대 ${TCM_KEYWORD_MAX}개까지 선택할 수 있습니다`
}

export function perKeywordTarget(total: number, keywordCount: number): number {
  if (!keywordCount) return total
  return Math.ceil(total / keywordCount)
}

export function isLowPerKeywordTarget(total: number, keywordCount: number): boolean {
  if (!keywordCount) return false
  return perKeywordTarget(total, keywordCount) < TCM_PER_KEYWORD_TARGET_WARN
}

export function tryToggleTcmKeyword(
  prev: string[],
  kw: string,
): { next: string[]; rejected: boolean } {
  if (prev.includes(kw)) {
    return { next: prev.filter(k => k !== kw), rejected: false }
  }
  if (prev.length >= TCM_KEYWORD_MAX) {
    return { next: prev, rejected: true }
  }
  return { next: [...prev, kw], rejected: false }
}
