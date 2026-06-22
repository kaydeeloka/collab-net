export const TCM_KEYWORD_MAX = 5
export const TCM_PER_KEYWORD_TARGET_WARN = 10

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
