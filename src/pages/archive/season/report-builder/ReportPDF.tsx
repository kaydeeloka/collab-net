import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import type { ReportPage } from './types'
import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'

// NanumGothic ExtraBold — closest CDN-available match for 나눔휴먼 OTF ExtraBold
// Replace src with your own font file URL if you have 나눔휴먼 OTF ExtraBold
Font.register({
  family: 'NanumGothic',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/nanum-gothic@5.0.14/files/nanum-gothic-korean-400-normal.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/nanum-gothic@5.0.14/files/nanum-gothic-korean-700-normal.woff2',
      fontWeight: 700,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/nanum-gothic@5.0.14/files/nanum-gothic-korean-800-normal.woff2',
      fontWeight: 800,
    },
  ],
})

// ── 16:9 (PowerPoint widescreen) ──────────────────────────────────
const W = 960
const H = 540

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''
// ⬇ Change this to match your file extension (.png / .jpg / .jpeg)
const BG_EXT = '.jpg'
const BG = {
  title:   `${ORIGIN}/report/title-bg${BG_EXT}`,
  content: `${ORIGIN}/report/content-bg${BG_EXT}`,
  outro:   `${ORIGIN}/report/conclusion-bg${BG_EXT}`,
}

const C = {
  ink:    '#1a1a1a',
  teal:   '#8BAAB8',
  gray:   '#888888',
  grayLt: '#f0f0f0',
  white:  '#ffffff',
  border: '#e0e0e0',
}

const PH = 64  // horizontal padding
const PV = 40  // vertical padding

const s = StyleSheet.create({
  page: { fontFamily: 'NanumGothic', width: W, height: H },

  bg: { position: 'absolute', top: 0, left: 0, width: W, height: H },

  // ── Cover ─────────────────────────────────────────────────────
  // Background already contains the Mi Muse logo — we only place text
  coverLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    paddingHorizontal: 72,
    paddingBottom: 52,
    justifyContent: 'flex-end',   // push title to lower half (below background logo)
  },
  coverCaption: {               // © attribution — appears above title block
    fontSize: 8,
    color: C.gray,
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: 800,            // ExtraBold — matches 나눔휴먼 OTF ExtraBold intent
    color: C.ink,
    lineHeight: 1.35,
    marginBottom: 8,
    maxWidth: '55%',
  },
  coverSub: {
    fontSize: 12,
    fontWeight: 400,
    color: C.gray,
    marginBottom: 4,
  },
  coverTagline: {
    fontSize: 10,
    fontWeight: 400,
    color: C.gray,
  },

  // ── Content page header ────────────────────────────────────────
  // English title (18pt) top-left, aligns vertically with background logo (top-right)
  // Korean title (24pt ExtraBold) immediately below
  contentLayer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    paddingHorizontal: PH,
    paddingTop: PV,
    paddingBottom: PV,
  },
  engTitle: {
    fontSize: 18,
    fontWeight: 400,
    color: C.gray,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  korTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: C.ink,
    marginBottom: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
    marginBottom: 18,
  },

  // ── Stats ─────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 14 },
  statBox: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.teal,
    borderLeftStyle: 'solid',
  },
  statValue: { fontSize: 28, fontWeight: 800, color: C.ink, marginBottom: 4 },
  statLabel: { fontSize: 9, fontWeight: 400, color: C.gray },
  caption: { fontSize: 10, fontWeight: 400, color: C.gray, lineHeight: 1.7, marginTop: 14 },

  // ── Text body ─────────────────────────────────────────────────
  body: { fontSize: 11, fontWeight: 400, color: C.ink, lineHeight: 1.85 },

  // ── Influencer grid ───────────────────────────────────────────
  gridRow: { flexDirection: 'row', marginBottom: 8 },
  gridCell: { backgroundColor: C.white, borderRadius: 6, overflow: 'hidden' },
  gridThumb: { width: '100%', height: 72, objectFit: 'cover' },
  gridThumbEmpty: { width: '100%', height: 72, backgroundColor: C.grayLt },
  gridBody: { paddingHorizontal: 6, paddingVertical: 4 },
  gridHandle: { fontSize: 7, fontWeight: 700, color: C.ink, marginBottom: 2 },
  gridStat: { fontSize: 7, fontWeight: 400, color: C.gray },

  // ── Brand table ───────────────────────────────────────────────
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.teal,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  th: { fontSize: 9, fontWeight: 700, color: C.white },
  td: { fontSize: 10, fontWeight: 400, color: C.ink },
  col1: { width: '36%' },
  col2: { width: '16%', textAlign: 'right' },
  col3: { width: '18%', textAlign: 'right' },
  col4: { width: '16%', textAlign: 'right' },
  col5: { width: '14%', textAlign: 'right' },

  // ── Image page ────────────────────────────────────────────────
  pageImage: { width: '100%', maxHeight: 330, objectFit: 'contain', marginBottom: 10 },

  // ── Outro ─────────────────────────────────────────────────────
  outroCenter: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outroMain: { fontSize: 80, fontWeight: 800, color: C.ink, letterSpacing: -2 },
  outroFooter: {
    position: 'absolute',
    bottom: 44,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  outroLabel: { fontSize: 10, fontWeight: 700, color: C.ink, letterSpacing: 2 },
  outroDivider: { width: 1, height: 12, backgroundColor: C.gray },
  outroContact: { fontSize: 10, fontWeight: 400, color: C.gray },
})

// ── Helpers ───────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

interface BrandStat { brand: string; count: number; views: number; likes: number; comments: number }
function brandStats(rows: MonitoringRow[]): BrandStat[] {
  const m: Record<string, BrandStat> = {}
  rows.filter(r => r.review_link?.startsWith('http')).forEach(r => {
    const b = r.brand || '기타'
    if (!m[b]) m[b] = { brand: b, count: 0, views: 0, likes: 0, comments: 0 }
    m[b].count++; m[b].views += r.views; m[b].likes += r.likes; m[b].comments += r.comments
  })
  return Object.values(m).sort((a, b) => b.views - a.views)
}

// ── Page header (English + Korean title) ─────────────────────────
function PageHeader({ eng, kor }: { eng?: string; kor?: string }) {
  return (
    <>
      {eng ? <Text style={s.engTitle}>{eng}</Text> : null}
      {kor ? <Text style={s.korTitle}>{kor}</Text> : null}
      <View style={s.divider} />
    </>
  )
}

// ── Page renderers ────────────────────────────────────────────────

function CoverPDF({ page }: { page: ReportPage }) {
  return (
    <Page size={[W, H]} style={s.page}>
      <Image src={BG.title} style={s.bg} />
      <View style={s.coverLayer}>
        {page.content.caption
          ? <Text style={s.coverCaption}>{page.content.caption}</Text>
          : null}
        {page.content.title
          ? <Text style={s.coverTitle}>{page.content.title}</Text>
          : null}
        {page.content.subtitle
          ? <Text style={s.coverSub}>{page.content.subtitle}</Text>
          : null}
        {page.content.tagline
          ? <Text style={s.coverTagline}>{page.content.tagline}</Text>
          : null}
      </View>
    </Page>
  )
}

function StatsPDF({ page, rows }: { page: ReportPage; rows: MonitoringRow[] }) {
  const review = rows.filter(r => r.review_link?.startsWith('http'))
  const tot = review.reduce((a, r) => ({ v: a.v + r.views, l: a.l + r.likes, c: a.c + r.comments }), { v: 0, l: 0, c: 0 })
  const boxes = [
    { label: '총 리뷰', value: fmt(review.length) },
    { label: '총 조회수', value: fmt(tot.v) },
    { label: '총 좋아요', value: fmt(tot.l) },
    { label: '총 댓글', value: fmt(tot.c) },
  ]
  return (
    <Page size={[W, H]} style={s.page}>
      <Image src={BG.content} style={s.bg} />
      <View style={s.contentLayer}>
        <PageHeader eng={page.content.engTitle} kor={page.content.korTitle} />
        <View style={s.statsRow}>
          {boxes.map((b, i) => (
            <View key={i} style={s.statBox}>
              <Text style={s.statValue}>{b.value}</Text>
              <Text style={s.statLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
        {page.content.caption ? <Text style={s.caption}>{page.content.caption}</Text> : null}
      </View>
    </Page>
  )
}

function GridPDF({ page, rows }: { page: ReportPage; rows: MonitoringRow[] }) {
  const cols = page.content.columns ?? 5
  const GAP = 8
  const cellW = (W - PH * 2 - GAP * (cols - 1)) / cols
  const review = rows.filter(r => r.review_link?.startsWith('http')).slice(0, cols * 3)
  const rows2d = chunk(review, cols)
  return (
    <Page size={[W, H]} style={s.page}>
      <Image src={BG.content} style={s.bg} />
      <View style={s.contentLayer}>
        <PageHeader eng={page.content.engTitle} kor={page.content.korTitle} />
        {rows2d.map((rowItems, ri) => (
          <View key={ri} style={s.gridRow}>
            {rowItems.map((row, ci) => {
              const thumb = resolveMonitoringThumbnailUrl(row.assets)
              const handle = (row.handle || '').replace(/^@/, '')
              return (
                <View key={ci} style={[s.gridCell, { width: cellW, marginRight: ci < cols - 1 ? GAP : 0 }]}>
                  {thumb ? <Image src={thumb} style={s.gridThumb} /> : <View style={s.gridThumbEmpty} />}
                  <View style={s.gridBody}>
                    <Text style={s.gridHandle}>@{handle}</Text>
                    <Text style={s.gridStat}>{fmt(row.views)} 조회</Text>
                  </View>
                </View>
              )
            })}
            {rowItems.length < cols && Array.from({ length: cols - rowItems.length }).map((_, i) => (
              <View key={`e${i}`} style={{ width: cellW, marginRight: i < cols - rowItems.length - 1 ? GAP : 0 }} />
            ))}
          </View>
        ))}
      </View>
    </Page>
  )
}

function BrandPDF({ page, rows }: { page: ReportPage; rows: MonitoringRow[] }) {
  const brands = brandStats(rows)
  return (
    <Page size={[W, H]} style={s.page}>
      <Image src={BG.content} style={s.bg} />
      <View style={s.contentLayer}>
        <PageHeader eng={page.content.engTitle} kor={page.content.korTitle} />
        <View style={s.tableHead}>
          <Text style={[s.th, s.col1]}>브랜드</Text>
          <Text style={[s.th, s.col2]}>리뷰</Text>
          <Text style={[s.th, s.col3]}>조회수</Text>
          <Text style={[s.th, s.col4]}>좋아요</Text>
          <Text style={[s.th, s.col5]}>댓글</Text>
        </View>
        {brands.map((b, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
            <Text style={[s.td, s.col1]}>{b.brand}</Text>
            <Text style={[s.td, s.col2]}>{b.count}</Text>
            <Text style={[s.td, s.col3]}>{fmt(b.views)}</Text>
            <Text style={[s.td, s.col4]}>{fmt(b.likes)}</Text>
            <Text style={[s.td, s.col5]}>{fmt(b.comments)}</Text>
          </View>
        ))}
        {page.content.caption ? <Text style={s.caption}>{page.content.caption}</Text> : null}
      </View>
    </Page>
  )
}

function TextPDF({ page }: { page: ReportPage }) {
  return (
    <Page size={[W, H]} style={s.page}>
      <Image src={BG.content} style={s.bg} />
      <View style={s.contentLayer}>
        <PageHeader eng={page.content.engTitle} kor={page.content.korTitle} />
        <Text style={s.body}>{page.content.body || ''}</Text>
      </View>
    </Page>
  )
}


function OutroPDF({ page }: { page: ReportPage }) {
  const parts = (page.content.caption || '').split('|').map(p => p.trim()).filter(Boolean)
  return (
    <Page size={[W, H]} style={s.page}>
      <Image src={BG.outro} style={s.bg} />
      <View style={s.outroCenter}>
        <Text style={s.outroMain}>{page.content.title || 'E.O.D'}</Text>
      </View>
      {parts.length > 0 && (
        <View style={s.outroFooter}>
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={s.outroDivider} />}
              <Text style={i === 0 ? s.outroLabel : s.outroContact}>{part}</Text>
            </React.Fragment>
          ))}
        </View>
      )}
    </Page>
  )
}

// ── Document ──────────────────────────────────────────────────────

export interface ReportPDFProps {
  phaseName: string
  pages: ReportPage[]
  rows: MonitoringRow[]
}

export default function ReportPDF({ phaseName, pages, rows }: ReportPDFProps) {
  const sorted = [...pages].sort((a, b) => a.order_index - b.order_index)
  return (
    <Document title={`Mi Muse ${phaseName} Report`} author="Mi Muse">
      {sorted.map(page => {
        switch (page.type) {
          case 'cover':               return <CoverPDF key={page.id} page={page} />
          case 'project_overview':    return <TextPDF  key={page.id} page={page} />
          case 'kit_composition':     return <TextPDF  key={page.id} page={page} />
          case 'content_performance': return <StatsPDF key={page.id} page={page} rows={rows} />
          case 'best_review':         return <GridPDF  key={page.id} page={page} rows={rows} />
          case 'brand_mention':       return <BrandPDF key={page.id} page={page} rows={rows} />
          case 'next_project':        return <TextPDF  key={page.id} page={page} />
          case 'outro':               return <OutroPDF key={page.id} page={page} />
          default:                    return null
        }
      })}
    </Document>
  )
}
