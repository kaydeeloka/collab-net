/** Brand report (시딩 키트 결과 리포트) design tokens — matches PDF template */

export const REPORT_COLORS = {
  ink: '#040000',
  tealDk: '#648085',
  teal: '#9FBAC5',
  tealLt: '#BED6DE',
  surfaceMd: '#E0DFDC',
  surface: '#F8F6F6',
} as const

export const REPORT_ASSETS = {
  logo: '/report/logo-04.png',
} as const

export const REPORT_CONTACT = {
  email: 'beautyproject@cranecomm.com',
} as const

export const REPORT_FONTS = {
  /** Hangul — 나눔휴먼 */
  ko: "'Report KO', 'NanumHuman', sans-serif",
  /** Latin / numbers — 모노플렉스 KR */
  en: "'Report EN', 'Monoplex KR', monospace",
  /** Mixed body text (unicode-range stack) */
  body: "'Report KO', 'Report EN', 'NanumHuman', 'Monoplex KR', sans-serif",
} as const
