import * as XLSX from 'xlsx'

export interface BrandGeneralImportRow {
  brand_name:       string
  company:          string | null
  email:            string[] | null
  telephone:        string | null
  website:          string | null
  product_category: string | null
  overseas:         boolean
}

export interface BrandGeneralImportPreview {
  toInsert:    BrandGeneralImportRow[]
  skipInDb:    number
  skipInvalid: number
  totalParsed: number
  rawRows:     number
}

type ExistingRow = {
  brand_name: string
  email:      string[] | string | null
  website:    string | null
}

export type RawBrandRow = {
  brand_name: string
  email:      string
  website:    string
  company?:   string
  telephone?: string
  product_category?: string
  overseas?:  boolean
}

const HEADER_MAP: Record<string, keyof RawBrandRow | 'email_raw' | 'skip'> = {
  no:               'skip',
  'no.':            'skip',
  brand_name:       'brand_name',
  brand:            'brand_name',
  name:             'brand_name',
  '브랜드명':         'brand_name',
  '브랜드 명':        'brand_name',
  company:          'company',
  '회사명':           'company',
  '회사 명':          'company',
  email:            'email_raw',
  emails:           'email_raw',
  '이메일':           'email_raw',
  telephone:        'telephone',
  phone:            'telephone',
  '내선번호':         'telephone',
  '전화':            'telephone',
  website:          'website',
  url:              'website',
  homepage:         'website',
  '홈페이지':         'website',
  product_category: 'product_category',
  category:         'product_category',
  '판매 제품':        'product_category',
  '제품 카테고리':     'product_category',
  overseas:         'overseas',
  '해외':            'overseas',
  '해외 진출':        'overseas',
}

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normBrandName(s: string) {
  return s.trim().toLowerCase()
}

function normEmail(s: string) {
  return s.trim().toLowerCase()
}

export function normWebsite(s: string) {
  return s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
}

export function rowMatchKeys(brand_name: string, emails: string[], website: string) {
  const keys: string[] = []
  if (brand_name.trim()) keys.push(`n:${normBrandName(brand_name)}`)
  if (website.trim()) keys.push(`w:${normWebsite(website)}`)
  for (const e of emails) {
    const clean = e.trim()
    if (clean) keys.push(`e:${normEmail(clean)}`)
  }
  return keys
}

export function buildExistingKeySet(rows: ExistingRow[]) {
  const set = new Set<string>()
  for (const r of rows) {
    const emails = Array.isArray(r.email)
      ? r.email
      : typeof r.email === 'string' && r.email
        ? [r.email]
        : []
    for (const k of rowMatchKeys(r.brand_name ?? '', emails, r.website ?? '')) {
      set.add(k)
    }
  }
  return set
}

export function parseEmailList(raw: unknown): string[] {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) return raw.flatMap(v => parseEmailList(v))
  const s = String(raw).trim()
  if (!s) return []
  return s.split(/[,;|\n]/).map(e => e.trim()).filter(Boolean)
}

function parseOverseas(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw !== 0
  const s = String(raw ?? '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'y', 'o', '있음'].includes(s) || s === '✓'
}

function cellStr(v: unknown) {
  if (v == null) return ''
  return String(v).trim()
}

function pushUniqueEmail(list: string[], email: string) {
  const clean = email.trim()
  if (!clean) return
  const lower = clean.toLowerCase()
  if (!list.some(e => e.toLowerCase() === lower)) list.push(clean)
}

/**
 * Rows with empty brand_name but an email belong to the previous brand (extra addresses).
 */
export function mergeContinuationRows(rawRows: RawBrandRow[]): { merged: BrandGeneralImportRow[]; skipInvalid: number } {
  const merged: BrandGeneralImportRow[] = []
  let skipInvalid = 0

  for (const row of rawRows) {
    const brand = row.brand_name.trim()
    const emails = parseEmailList(row.email)
    const website = row.website.trim().replace(/\s+/g, ' ')

    if (!brand) {
      if (emails.length && merged.length) {
        const prev = merged[merged.length - 1]
        for (const e of emails) pushUniqueEmail(prev.email ?? (prev.email = []), e)
        if (website && !prev.website) prev.website = website
      } else {
        skipInvalid++
      }
      continue
    }

    const rowEmails = [...emails]
    merged.push({
      brand_name:       brand,
      company:          row.company?.trim()          || null,
      email:            rowEmails.length ? rowEmails : null,
      telephone:        row.telephone?.trim()        || null,
      website:          website || null,
      product_category: row.product_category?.trim() || null,
      overseas:         row.overseas ?? false,
    })
  }

  return { merged, skipInvalid }
}

function mapHeaderRow(raw: Record<string, unknown>): RawBrandRow {
  const out: RawBrandRow = { brand_name: '', email: '', website: '' }
  for (const [header, value] of Object.entries(raw)) {
    const key = HEADER_MAP[normHeader(header)]
    if (!key || key === 'skip' || key === 'email_raw') {
      if (key === 'email_raw') out.email = [out.email, cellStr(value)].filter(Boolean).join(', ')
      continue
    }
    if (key === 'overseas') out.overseas = parseOverseas(value)
    else out[key] = cellStr(value) as never
  }
  return out
}

/** Parse CSV text with quoted fields (supports multiline website cells). */
export function parseBrandGeneralCsvText(text: string): RawBrandRow[] {
  const clean = text.replace(/^\uFEFF/, '')
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    const next = clean[i + 1]

    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; continue }
      if (c === '"') { inQuotes = false; continue }
      cell += c
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === ',') { row.push(cell); cell = ''; continue }
    if (c === '\r' && next === '\n') {
      row.push(cell); records.push(row); row = []; cell = ''; i++; continue
    }
    if (c === '\n') {
      row.push(cell); records.push(row); row = []; cell = ''; continue
    }
    cell += c
  }
  if (cell.length || row.length) { row.push(cell); records.push(row) }

  const nonEmpty = records.filter(r => r.some(c => c.trim()))
  if (!nonEmpty.length) return []

  const header = nonEmpty[0]
  const idx = {
    brand:   header.findIndex(h => /브랜드|brand/i.test(h)),
    email:   header.findIndex(h => /이메일|email/i.test(h)),
    website: header.findIndex(h => /홈페이지|website|url/i.test(h)),
  }

  return nonEmpty.slice(1).map(cols => ({
    brand_name: (cols[idx.brand] ?? '').trim(),
    email:      (cols[idx.email] ?? '').trim(),
    website:    (cols[idx.website] ?? '').trim().replace(/\s+/g, ' '),
  }))
}

export function parseBrandGeneralWorkbook(buf: ArrayBuffer): RawBrandRow[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return json.map(mapHeaderRow)
}

export async function parseBrandGeneralFile(file: File): Promise<BrandGeneralImportRow[]> {
  const result = await parseBrandGeneralFileDetailed(file)
  return result.rows
}

export async function parseBrandGeneralFileDetailed(file: File): Promise<{
  rows: BrandGeneralImportRow[]
  rawRows: number
  mergeInvalid: number
}> {
  const isCsv = /\.csv$/i.test(file.name)
  const rawRows = isCsv
    ? parseBrandGeneralCsvText(await file.text())
    : parseBrandGeneralWorkbook(await file.arrayBuffer())
  const { merged, skipInvalid } = mergeContinuationRows(rawRows)
  return { rows: merged, rawRows: rawRows.length, mergeInvalid: skipInvalid }
}

export function previewBrandGeneralImport(
  parsed: BrandGeneralImportRow[],
  existingKeys: Set<string>,
  rawRows = parsed.length,
): BrandGeneralImportPreview {
  const toInsert: BrandGeneralImportRow[] = []
  let skipInDb = 0
  let skipInvalid = 0

  for (const row of parsed) {
    if (!row.brand_name.trim()) {
      skipInvalid++
      continue
    }
    const matchKeys = rowMatchKeys(row.brand_name, row.email ?? [], row.website ?? '')
    // Only skip when already registered in DB — not duplicates within the CSV
    if (matchKeys.some(k => existingKeys.has(k))) {
      skipInDb++
      continue
    }
    toInsert.push(row)
  }

  return { toInsert, skipInDb, skipInvalid, totalParsed: parsed.length, rawRows }
}
