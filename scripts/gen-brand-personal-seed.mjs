/**
 * Parse personal brand TSV/CSV → SQL seed for brand_personal (TEXT[] personal_email).
 * Usage: node scripts/gen-brand-personal-seed.mjs "<path>" [output.sql]
 */
import fs from 'fs'
import path from 'path'

const inputPath = process.argv[2]
const outArg = process.argv[3]
if (!inputPath) {
  console.error('Usage: node scripts/gen-brand-personal-seed.mjs "<tsv or csv path>" [output.sql]')
  process.exit(1)
}

function parseDelimitedRecords(text, delimiter) {
  const records = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (c === '"' && next === '"') { cell += '"'; i++; continue }
      if (c === '"') { inQuotes = false; continue }
      cell += c
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === delimiter) { row.push(cell); cell = ''; continue }
    if (c === '\r' && next === '\n') { row.push(cell); records.push(row); row = []; cell = ''; i++; continue }
    if (c === '\n') { row.push(cell); records.push(row); row = []; cell = ''; continue }
    cell += c
  }
  if (cell.length || row.length) { row.push(cell); records.push(row) }
  return records.filter(r => r.some(c => c.trim()))
}

function parseEmails(raw) {
  if (!raw?.trim()) return []
  return raw.split(/[,;|\n]/).map(e => e.trim()).filter(Boolean)
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function sqlStrOrNull(s) {
  const v = String(s ?? '').trim()
  if (!v || v === '-') return 'NULL'
  return sqlStr(v)
}

function sqlEmailArray(emails) {
  if (!emails?.length) return 'NULL::TEXT[]'
  return `ARRAY[${emails.map(sqlStr).join(', ')}]::TEXT[]`
}

function normField(s) {
  const v = String(s ?? '').trim()
  if (!v || v === '-') return null
  return v
}

/** Match key for same brand (company name). */
function normBrandKey(company) {
  const v = String(company ?? '').trim().toLowerCase()
    .replace(/^\(주\)\s*/i, '')
    .replace(/\s+/g, ' ')
  return v || null
}

function normWebsiteKey(url) {
  const v = String(url ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
  return v || null
}

/** Same brand if company matches, or same site + shared email / same person. */
function rowsSameBrand(a, b) {
  const ca = normBrandKey(a.company)
  const cb = normBrandKey(b.company)
  if (ca && cb && ca === cb) return true

  const wa = normWebsiteKey(a.website)
  const wb = normWebsiteKey(b.website)
  if (!wa || wa !== wb) return false

  const ae = new Set(a.emails.map(e => e.toLowerCase()))
  if (b.emails.some(e => ae.has(e.toLowerCase()))) return true

  if (a.contact_name && b.contact_name
      && a.contact_name === b.contact_name
      && a.personal_phone && b.personal_phone
      && a.personal_phone === b.personal_phone) {
    return true
  }
  return false
}

/** Canonical brand_name per brand group; each spreadsheet row stays a separate contact row. */
function applyCanonicalBrandNames(rows) {
  const parent = rows.map((_, i) => i)
  function find(i) {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }
  function union(a, b) {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rowsSameBrand(rows[i], rows[j])) union(i, j)
    }
  }

  const groups = new Map()
  rows.forEach((row, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push({ row, i })
  })

  for (const members of groups.values()) {
    members.sort((a, b) => a.i - b.i)
    const canonical = members.find(m => m.row.company)?.row.company
      ?? members.find(m => m.row.brand_name)?.row.brand_name
      ?? '미등록'
    for (const { row } of members) row.brand_name = canonical
  }
}

const text = fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, '')
const delimiter = text.includes('\t') ? '\t' : ','
const records = parseDelimitedRecords(text, delimiter)
const header = records[0]

function colIndex(...patterns) {
  for (const p of patterns) {
    const i = header.findIndex(h => p.test(String(h).trim()))
    if (i >= 0) return i
  }
  return -1
}

const idx = {
  company:      colIndex(/^회사$/i, /^company$/i, /^brand_name$/i),
  contact:      colIndex(/^성명$/i, /^contact_name$/i),
  department:   colIndex(/^소속$/i, /^department$/i),
  position:     colIndex(/^직급$/i, /^position$/i),
  email:        colIndex(/^이메일$/i, /^personal_email$/i, /^email$/i),
  mobile:       colIndex(/^휴대폰$/i, /^personal_phone$/i, /^mobile$/i),
  telephone:    colIndex(/^내선$/i, /^telephone$/i),
  website:      colIndex(/^홈페이지$/i, /^website$/i),
}

const rows = records.slice(1).map(cols => {
  const company = normField(cols[idx.company])
  const contact_name = normField(cols[idx.contact])
  return {
    brand_name: company || contact_name || '미등록',
    company,
    contact_name,
    department: normField(cols[idx.department]),
    position:   normField(cols[idx.position]),
    emails:     parseEmails(cols[idx.email] ?? ''),
    personal_phone: normField(cols[idx.mobile]),
    telephone:    normField(cols[idx.telephone]),
    website:      normField(cols[idx.website]),
  }
})

applyCanonicalBrandNames(rows)

rows.sort((a, b) => {
  const byName = a.brand_name.localeCompare(b.brand_name, 'ko', { sensitivity: 'base' })
  if (byName !== 0) return byName
  return (a.contact_name ?? '').localeCompare(b.contact_name ?? '', 'ko', { sensitivity: 'base' })
})

const multiEmail = rows.filter(r => r.emails.length > 1).length
const dataRowCount = records.length - 1
const brandGroups = new Set(rows.map(r => normBrandKey(r.brand_name) ?? r.brand_name)).size
const outPath = outArg
  ? path.resolve(outArg)
  : path.join('supabase', 'seeds', 'brand-personal-2cha.sql')

const values = rows.map(r => `  (${[
  sqlStr(r.brand_name),
  sqlStrOrNull(r.company),
  sqlStrOrNull(r.contact_name),
  sqlStrOrNull(r.department),
  sqlStrOrNull(r.position),
  sqlEmailArray(r.emails),
  sqlStrOrNull(r.personal_phone),
  sqlStrOrNull(r.telephone),
  sqlStrOrNull(r.website),
].join(', ')})`).join(',\n')

const sql = `-- ============================================================
-- brand_personal seed — 퍼스널 DB (2차)
-- Source: ${path.basename(inputPath)} — ${dataRowCount + 1} spreadsheet rows (1 header + ${rows.length} contact rows)
-- ${brandGroups} unique brand_name values (same brand → shared brand_name; each row kept separate)
-- (${multiEmail} rows with multiple emails in personal_email TEXT[])
-- Null fields allowed · dedup only against existing DB rows (not within file)
-- Run in Supabase SQL Editor (uses get_active_phase_id() for current phase)
-- ============================================================

INSERT INTO brand_personal (
  brand_name, company, contact_name, department, position,
  personal_email, personal_phone, telephone, website, phase_id
)
SELECT
  v.brand_name, v.company, v.contact_name, v.department, v.position,
  v.personal_email, v.personal_phone, v.telephone, v.website, get_active_phase_id()
FROM (
VALUES
${values}
) AS v(brand_name, company, contact_name, department, position, personal_email, personal_phone, telephone, website)
WHERE NOT EXISTS (
  SELECT 1
  FROM brand_personal bp
  WHERE bp.phase_id = get_active_phase_id()
    AND lower(trim(bp.brand_name)) = lower(trim(v.brand_name))
    AND lower(trim(coalesce(bp.contact_name, ''))) = lower(trim(coalesce(v.contact_name, '')))
    AND (
      (v.personal_email IS NOT NULL AND bp.personal_email IS NOT NULL AND v.personal_email && bp.personal_email)
      OR (v.personal_email IS NULL AND bp.personal_email IS NULL)
    )
);
`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, sql, 'utf8')
console.log(`Wrote ${outPath}`)
console.log(`Contact rows: ${rows.length} (${rows.length + 1} with header), brand groups: ${brandGroups}, multi-email: ${multiEmail}`)
