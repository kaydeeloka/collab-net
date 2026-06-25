import fs from 'node:fs'
import path from 'node:path'

const csvPath = path.join('supabase', 'seeds', 'monitoring-import.csv')
const outPath = path.join('supabase', 'seeds', 'monitoring-import.sql')

const PHASE_ID = 'e1d8d93d-6981-4b42-889d-e4ab6e65d3cb'

function parseCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  fields.push(cur)
  return fields
}

function sqlStr(val) {
  if (val == null || val === '') return 'NULL'
  return `'${String(val).replace(/'/g, "''")}'`
}

function sqlInt(val) {
  if (val == null || val === '') return '0'
  const n = Number(val)
  return Number.isFinite(n) ? String(n) : '0'
}

function sqlDate(val) {
  if (val == null || val === '') return 'NULL'
  return `'${val}'::date`
}

function sqlTs(val) {
  if (val == null || val === '') return 'NULL'
  return `'${val}'::timestamptz`
}

function sqlUuid(val) {
  if (val == null || val === '') return 'NULL'
  return `'${val}'::uuid`
}

const raw = fs.readFileSync(csvPath, 'utf8').trim()
const lines = raw.split(/\r?\n/)
const header = parseCsvLine(lines[0])
const idx = Object.fromEntries(header.map((h, i) => [h, i]))

const rows = lines.slice(1).map(line => parseCsvLine(line))

const values = rows.map(fields => {
  let phaseId = fields[idx.phase_id] || ''
  if (!phaseId && fields[idx.keywords]) {
    phaseId = PHASE_ID
  }

  return `  (${[
    sqlUuid(fields[idx.id]),
    sqlTs(fields[idx.created_at]),
    sqlUuid(fields[idx.influencer_platform_id]),
    sqlDate(fields[idx.date]),
    sqlStr(fields[idx.media]),
    sqlStr(fields[idx.content]),
    sqlStr(fields[idx.brand]),
    sqlStr(fields[idx.review_link]),
    sqlInt(fields[idx.views]),
    sqlInt(fields[idx.likes]),
    sqlInt(fields[idx.comments]),
    sqlStr(fields[idx.keywords]),
    sqlDate(fields[idx.updated]),
    sqlUuid(phaseId),
  ].join(', ')})`
})

const sql = `-- monitoring rows imported from legacy export
-- Run in Supabase SQL Editor AFTER influencer_platform + phases exist.
-- thumbnail_url / video_file_url omitted (now live in monitoring_assets; all empty in source).

INSERT INTO monitoring (
  id, created_at, influencer_platform_id, date, media, content, brand,
  review_link, views, likes, comments, keywords, updated, phase_id
) VALUES
${values.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  created_at              = EXCLUDED.created_at,
  influencer_platform_id  = EXCLUDED.influencer_platform_id,
  date                    = EXCLUDED.date,
  media                   = EXCLUDED.media,
  content                 = EXCLUDED.content,
  brand                   = EXCLUDED.brand,
  review_link             = EXCLUDED.review_link,
  views                   = EXCLUDED.views,
  likes                   = EXCLUDED.likes,
  comments                = EXCLUDED.comments,
  keywords                = EXCLUDED.keywords,
  updated                 = EXCLUDED.updated,
  phase_id                = EXCLUDED.phase_id;
`

fs.writeFileSync(outPath, sql, 'utf8')
console.log(`Wrote ${rows.length} rows → ${outPath}`)
