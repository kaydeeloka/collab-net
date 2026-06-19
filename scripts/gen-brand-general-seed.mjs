/**
 * Parse brand general CSV → SQL seed with TEXT[] email arrays + dedup.
 * Continuation rows (empty brand_name, email only) merge into previous brand.
 * Usage: node scripts/gen-brand-general-seed.mjs "<csv path>"
 */
import fs from 'fs'
import path from 'path'

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('Usage: node scripts/gen-brand-general-seed.mjs "<csv path>"')
  process.exit(1)
}

function parseCsvRecords(text) {
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
    if (c === ',') { row.push(cell); cell = ''; continue }
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

function pushUnique(list, email) {
  const clean = email.trim()
  if (!clean) return
  if (!list.some(e => e.toLowerCase() === clean.toLowerCase())) list.push(clean)
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function sqlStrOrNull(s) {
  const v = String(s ?? '').trim()
  return v ? sqlStr(v) : 'NULL'
}

function sqlEmailArray(emails) {
  if (!emails?.length) return 'NULL::TEXT[]'
  return `ARRAY[${emails.map(sqlStr).join(', ')}]::TEXT[]`
}

const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
const records = parseCsvRecords(text)
const header = records[0]
const idx = {
  brand:   header.findIndex(h => /브랜드|brand/i.test(h)),
  email:   header.findIndex(h => /이메일|email/i.test(h)),
  website: header.findIndex(h => /홈페이지|website|url/i.test(h)),
}

const rawRows = records.slice(1).map(cols => ({
  brand_name: (cols[idx.brand] ?? '').trim(),
  email:      (cols[idx.email] ?? '').trim(),
  website:    (cols[idx.website] ?? '').trim().replace(/\s+/g, ' '),
}))

// Merge continuation rows into email arrays
const brands = []
let skipInvalid = 0
for (const row of rawRows) {
  const brand = row.brand_name
  const emails = parseEmails(row.email)
  const website = row.website

  if (!brand) {
    if (emails.length && brands.length) {
      for (const e of emails) pushUnique(brands[brands.length - 1].emails, e)
      if (website && !brands[brands.length - 1].website) brands[brands.length - 1].website = website
    } else {
      skipInvalid++
    }
    continue
  }

  brands.push({ brand_name: brand, emails: [...emails], website: website || null })
}

const rows = brands.filter(b => b.brand_name)
  .sort((a, b) => a.brand_name.localeCompare(b.brand_name, 'ko', { sensitivity: 'base' }))

const multiEmail = rows.filter(r => r.emails.length > 1).length
const outPath = path.join('supabase', 'seeds', 'brand-general-rep-email-2cha.sql')
const values = rows.map(r =>
  `  (${sqlStr(r.brand_name)}, ${sqlEmailArray(r.emails)}, ${sqlStrOrNull(r.website)})`,
).join(',\n')

const sql = `-- ============================================================
-- brand_general seed — 대표메일 DB (2차)
-- Source: ${path.basename(csvPath)}
-- Raw CSV rows: ${rawRows.length} → ${rows.length} brands (continuation emails merged)
-- (${multiEmail} brands with multiple emails, ${skipInvalid} orphan continuation rows skipped)
-- Null email/website allowed — only brand_name required
-- email column is TEXT[] — continuation rows (no brand name) merge into previous row
-- Run in Supabase SQL Editor (uses get_active_phase_id() for current phase)
-- ============================================================

INSERT INTO brand_general (brand_name, email, website, phase_id)
SELECT v.brand_name, v.email, v.website, get_active_phase_id()
FROM (
VALUES
${values}
) AS v(brand_name, email, website)
WHERE NOT EXISTS (
  SELECT 1
  FROM brand_general bg
  WHERE bg.phase_id = get_active_phase_id()
    AND (
      lower(trim(bg.brand_name)) = lower(trim(v.brand_name))
      OR (v.email IS NOT NULL AND bg.email IS NOT NULL AND v.email && bg.email)
      OR (
        v.website IS NOT NULL AND trim(v.website) <> ''
        AND lower(trim(bg.website)) = lower(trim(v.website))
      )
    )
);
`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, sql, 'utf8')
console.log(`Wrote ${outPath}`)
console.log(`Merged brands: ${rows.length}, multi-email: ${multiEmail}, invalid: ${skipInvalid}`)
