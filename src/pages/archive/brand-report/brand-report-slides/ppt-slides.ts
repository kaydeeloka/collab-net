import type pptxgen from 'pptxgenjs'
import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { monitoringBrandKey } from '@/lib/influencer/monitoring-keywords'
import type { BrandReportPage, BrandPageContent, BrandPageType, ProcessStep } from '../brand-report-types'
import {
  IN, SLIDE_W, SLIDE_H, FONT, COLORS, CONTENT_BOX,
  addImageOrPlaceholder, addSectionPill, addRoundedCard, addLogoImage, addDataTable,
  addBulletList, addChevronConnector, addProgressBar,
  addContentChrome, estimateLineCount, addSanitizedSlide,
} from '../../ppt-native'

export interface BuilderCtx {
  rows: MonitoringRow[]
  brandName: string
  brandEn?: string
}

type Slide = pptxgen.Slide

function fmtK(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function platformLabel(p: string) {
  if (/tiktok/i.test(p)) return 'TikTok'
  if (/insta/i.test(p)) return 'Instagram'
  if (/magazine/i.test(p)) return 'Magazine'
  return p
}

function reviewRowsOf(rows: MonitoringRow[]) {
  return rows.filter(r => r.review_link?.startsWith('http'))
}

function brandRowsOf(ctx: BuilderCtx) {
  const lower = ctx.brandName.trim().toLowerCase()
  const variants = new Set([
    lower,
    monitoringBrandKey(ctx.brandName),
    lower.replace(/\s+/g, ''),
    ...(ctx.brandEn ? [ctx.brandEn.toLowerCase()] : []),
  ])
  return reviewRowsOf(ctx.rows).filter(r => r.brand && variants.has(r.brand.toLowerCase()))
}

// ── cover ─────────────────────────────────────────────────────────

async function buildCoverSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  slide.background = { color: COLORS.bg }

  const logoW = 3.5
  addLogoImage(slide, { x: -0.2, y: 0.6, w: logoW, h: logoW * (2900 / 6628) })

  slide.addText('© CRANECOMMUNICATIONS', {
    x: 0.22, y: SLIDE_H - 0.45, w: 4, h: 0.25,
    fontFace: FONT.SANS, fontSize: 8.25, color: 'AAAAAA',
  })

  const titlePrefix = (page.content.title ?? '').replace(/\s*_\s*.*$/, '').trimEnd()
  const brandSuffix = ctx.brandEn ? ctx.brandEn.charAt(0).toUpperCase() + ctx.brandEn.slice(1) : ctx.brandName
  const title = `${titlePrefix} _ ${brandSuffix}`
  slide.addText(title, {
    x: 0.5, y: 2.0, w: 9.0 * 0.7, h: 2.925,
    fontFace: FONT.EB, fontSize: IN.cqwPt(2.4), color: COLORS.ink,
    valign: 'top', lineSpacingMultiple: 1.3,
  })
}

// ── outro (brand report supports a list of contacts, not just one) ─

async function buildOutroSlide(prs: pptxgen, page: BrandReportPage) {
  const slide = addSanitizedSlide(prs)
  slide.background = { color: COLORS.bg }

  const title = page.content.title || 'E.O.D'
  const titleH = 1.2
  const titleY = 1.6
  slide.addText(title, {
    x: 0, y: titleY, w: SLIDE_W, h: titleH,
    align: 'center', valign: 'middle',
    fontFace: FONT.SANS, fontSize: IN.cqwPt(6), bold: true, color: COLORS.ink,
  })

  const DEFAULT_CONTACTS = '신유빈 프로|ybshin@cranecomm.com\n김도연 프로|dykim@cranecomm.com'
  const contacts = (page.content.outroContacts ?? DEFAULT_CONTACTS).split('\n').map(line => {
    const [name = '', email = ''] = line.split('|')
    return { name, email }
  })

  const rowH = 0.32
  const startY = titleY + titleH + 0.5

  slide.addText('CONTACT', {
    x: 0, y: startY, w: SLIDE_W, h: 0.28,
    align: 'center', valign: 'middle',
    fontFace: FONT.SANS, fontSize: 10.5, color: COLORS.ink,
  })

  contacts.forEach((c, i) => {
    const y = startY + 0.4 + i * rowH
    const nameW = 1.6
    const emailW = Math.max(1.8, c.email.length * 0.09)
    const totalRowW = nameW + 0.3 + emailW
    const x = (SLIDE_W - totalRowW) / 2
    slide.addText(c.name, {
      x, y, w: nameW, h: rowH,
      fontFace: FONT.SANS, fontSize: 9.5, color: COLORS.gray5, align: 'right', valign: 'middle',
    })
    slide.addText(c.email, {
      x: x + nameW + 0.3, y, w: emailW, h: rowH,
      fontFace: FONT.SANS, fontSize: 9.5, color: COLORS.teal, align: 'left', valign: 'middle',
      hyperlink: { url: `mailto:${c.email}` },
    })
  })
}

// ── project_overview (identical layout to the season report) ───────

async function buildProjectOverviewSlide(prs: pptxgen, page: BrandReportPage) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const gapAboveProc = IN.cqw(1.8)
  const pillH = 0.24
  const gapPillToSteps = IN.cqw(0.6)
  const stepsH = 1.3
  const reservedForSteps = gapAboveProc + pillH + gapPillToSteps + stepsH
  const bodyY = CONTENT_BOX.y
  const bodyH = CONTENT_BOX.h - reservedForSteps

  const imgW = CONTENT_BOX.w * 0.27
  await addImageOrPlaceholder(slide, c.imageUrl, { x: CONTENT_BOX.x, y: bodyY, w: imgW, h: bodyH })

  const tableX = CONTENT_BOX.x + imgW + IN.cqw(2)
  const tableW = CONTENT_BOX.x + CONTENT_BOX.w - tableX
  const rowValueW = tableW - IN.cqw(11)
  const rowFontPt = 14 * 0.75
  const infoFields: { label: string; value: string | undefined }[] = [
    { label: '프로젝트 명', value: c.projectName },
    { label: '프로젝트 목적', value: c.projectPurpose },
    { label: '키트 발송 대상', value: c.kitRecipients },
    { label: '총 배송 수량', value: c.totalShipping },
    { label: '참여 브랜드', value: c.participatingBrands },
  ]
  const infoRows = infoFields.map(f => ({ ...f, weight: Math.max(1, estimateLineCount(f.value ?? '', rowValueW, rowFontPt)) }))
  const rowGap = IN.cqw(0.7)
  const totalWeight = infoRows.reduce((sum, r) => sum + r.weight, 0)
  const availableForRows = bodyH - rowGap * (infoRows.length - 1)
  let rowY = bodyY
  for (const row of infoRows) {
    const rowH = availableForRows * (row.weight / totalWeight)
    addSectionPill(slide, row.label, { x: tableX, y: rowY, w: IN.cqw(10), h: 0.24 })
    slide.addText(row.value ?? '', {
      x: tableX + IN.cqw(10) + IN.cqw(1), y: rowY, w: tableW - IN.cqw(11), h: rowH,
      fontFace: FONT.REG, fontSize: 14 * 0.75, color: COLORS.ink, valign: 'top', lineSpacingMultiple: 1.5,
    })
    rowY += rowH + rowGap
  }

  const procY = bodyY + bodyH + gapAboveProc
  addSectionPill(slide, '진행 프로세스', { x: CONTENT_BOX.x, y: procY, w: 1.3, h: pillH })
  const stepsY = procY + pillH + gapPillToSteps
  const chevronW = 0.24
  const stepCount = 4
  const stepW = (CONTENT_BOX.w - chevronW * (stepCount - 1)) / stepCount
  const steps: ProcessStep[] = c.processSteps ?? [{ date: '', content: '' }, { date: '', content: '' }, { date: '', content: '' }, { date: '', content: '' }]
  let stepX = CONTENT_BOX.x
  steps.slice(0, stepCount).forEach((step, i) => {
    addRoundedCard(slide, { x: stepX, y: stepsY, w: stepW, h: stepsH })
    if (step.date) {
      addSectionPill(slide, step.date, {
        x: stepX + IN.cqw(0.7), y: stepsY - IN.cqw(0.6), w: undefined, h: 0.2, fontSize: 8,
      })
    }
    const bulletLines = step.content.split('\n').filter(Boolean)
    addBulletList(slide, bulletLines, {
      x: stepX + IN.cqw(1.4), y: stepsY + IN.cqw(2.4), w: stepW - IN.cqw(2.8), h: stepsH - IN.cqw(2.4) - IN.cqw(1.2),
      fontSize: 9, lineSpacingMultiple: 1.4,
    })
    stepX += stepW
    if (i < stepCount - 1) {
      addChevronConnector(slide, { x: stepX, y: stepsY, w: chevronW, h: stepsH })
      stepX += chevronW
    }
  })
}

// ── brand_content_performance ───────────────────────────────────────

async function buildBrandContentPerformanceSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const DEFAULT_RECOVERY = '인플루언서||80\n매거진||100\n콘텐츠 수량||98'
  const recoveryCards = (c.cpRecoveryCards ?? DEFAULT_RECOVERY).split('\n').map(line => {
    const parts = line.split('|')
    return { label: parts[0] ?? '', desc: parts[1] ?? '', pct: parseInt(parts[2] ?? '0') || 0 }
  })

  const reviewRows = reviewRowsOf(ctx.rows)
  const mimuseRows = reviewRows.filter(r => r.brand === 'mimuse')
  const brandRows = brandRowsOf(ctx)

  const infMap = new Map<string, boolean>()
  const infUploadMap = new Map<string, boolean>()
  for (const r of ctx.rows) {
    const key = r.confirmed_influencer_id || r.influencer_platform_id || r.id
    infMap.set(key, true)
    if (r.review_link?.startsWith('http')) infUploadMap.set(key, true)
  }
  const infPct = infMap.size ? Math.round(infUploadMap.size / infMap.size * 100) : 0

  addSectionPill(slide, '회수율', { x: CONTENT_BOX.x, y: CONTENT_BOX.y, w: 1.0, h: 0.24 })
  const recoveryY = CONTENT_BOX.y + 0.24 + IN.cqw(0.4)
  const recoveryH = 1.15
  const gap = IN.cqw(1.2)
  const cardW = (CONTENT_BOX.w - gap * 2) / 3
  recoveryCards.forEach((card, i) => {
    const x = CONTENT_BOX.x + i * (cardW + gap)
    const barPct = i === 0 && card.pct === 0 ? infPct : card.pct
    addRoundedCard(slide, { x, y: recoveryY, w: cardW, h: recoveryH })
    slide.addText(card.label, {
      x: x + IN.cqw(1.6), y: recoveryY + IN.cqw(1.2), w: cardW - IN.cqw(3.2), h: 0.28,
      fontFace: FONT.REG, fontSize: 11, bold: true, color: COLORS.ink,
    })
    if (i === 2) {
      slide.addText(`${reviewRows.length}건`, {
        x: x + cardW - IN.cqw(3.5), y: recoveryY + IN.cqw(1.2), w: IN.cqw(3.2), h: 0.28,
        fontFace: FONT.REG, fontSize: 8, bold: true, color: COLORS.accent, align: 'right',
      })
    }
    if (i === 0) {
      slide.addText(`${infUploadMap.size}/${infMap.size}명`, {
        x: x + cardW - IN.cqw(3.5), y: recoveryY + IN.cqw(1.2), w: IN.cqw(3.2), h: 0.28,
        fontFace: FONT.REG, fontSize: 8, bold: true, color: COLORS.accent, align: 'right',
      })
    }
    slide.addText(card.desc, {
      x: x + IN.cqw(1.6), y: recoveryY + IN.cqw(1.2) + 0.3, w: cardW - IN.cqw(3.2), h: 0.45,
      fontFace: FONT.REG, fontSize: 9, color: COLORS.ink, valign: 'top', lineSpacingMultiple: 1.4,
    })
    addProgressBar(slide, { x: x + IN.cqw(1.6), y: recoveryY + recoveryH - IN.cqw(1.0), w: cardW - IN.cqw(3.2), pct: barPct })
  })

  // Two data tables — content type breakdown, and platform performance (both auto-computed
  // from monitoring rows, matching the on-screen "자동 계산" tables).
  const countByPlat = (rws: MonitoringRow[]) => {
    const tiktok = rws.filter(r => platformLabel(r.platform ?? '') === 'TikTok').length
    const instagram = rws.filter(r => platformLabel(r.platform ?? '') === 'Instagram').length
    const magazine = rws.filter(r => platformLabel(r.platform ?? '') === 'Magazine').length
    return { tiktok, instagram, magazine, total: tiktok + instagram + magazine }
  }
  const allBrandRows = reviewRows.filter(r => r.brand !== 'mimuse')
  const brandLabel = (ctx.brandEn ?? ctx.brandName).toUpperCase()
  const ctRows = [
    { label: 'Mi Muse 리뷰', ...countByPlat(mimuseRows) },
    { label: '브랜드별 리뷰', ...countByPlat(allBrandRows) },
    { label: `${brandLabel} 리뷰`, ...countByPlat(brandRows) },
    { label: '합계', ...countByPlat(reviewRows) },
  ]

  const platforms = ['TikTok', 'Instagram', 'Magazine'] as const
  const platStats = platforms.map(label => {
    const pRows = reviewRows.filter(r => platformLabel(r.platform ?? '') === label)
    return {
      label,
      count: pRows.length,
      avgViews: pRows.length ? Math.round(pRows.reduce((s, r) => s + r.views, 0) / pRows.length) : 0,
      avgLikes: pRows.length ? Math.round(pRows.reduce((s, r) => s + r.likes, 0) / pRows.length) : 0,
      avgComments: pRows.length ? Math.round(pRows.reduce((s, r) => s + r.comments, 0) / pRows.length) : 0,
    }
  }).filter(p => p.count > 0)

  const tablesY = recoveryY + recoveryH + IN.cqw(1.6)
  const tablesH = 1.15
  const tableGap = IN.cqw(1.6)
  const tableW = (CONTENT_BOX.w - tableGap) / 2

  addSectionPill(slide, '콘텐츠 종류', { x: CONTENT_BOX.x, y: tablesY, w: 1.3, h: 0.22 })
  addDataTable(slide, {
    x: CONTENT_BOX.x, y: tablesY + 0.22 + IN.cqw(0.3), w: tableW, h: tablesH - 0.22 - IN.cqw(0.3),
    headers: ['구분', 'TikTok', 'Instagram', 'Magazine', 'Total'],
    rows: ctRows.map(r => [r.label, r.tiktok ? String(r.tiktok) : '—', r.instagram ? String(r.instagram) : '—', r.magazine ? String(r.magazine) : '—', String(r.total)]),
    colWidths: [0.34, 0.165, 0.165, 0.165, 0.165],
    fontSize: 8, totalRowIndices: [3],
  })

  const table2X = CONTENT_BOX.x + tableW + tableGap
  addSectionPill(slide, '콘텐츠 성과', { x: table2X, y: tablesY, w: 1.3, h: 0.22 })
  addDataTable(slide, {
    x: table2X, y: tablesY + 0.22 + IN.cqw(0.3), w: tableW, h: tablesH - 0.22 - IN.cqw(0.3),
    headers: ['플랫폼', '건 수', '평균 조회수', '평균 좋아요', '평균 댓글'],
    rows: platStats.map(s => [s.label, String(s.count), String(s.avgViews), s.label === 'Magazine' ? '—' : String(s.avgLikes), String(s.avgComments)]),
    fontSize: 8,
  })

  const reactionY = tablesY + tablesH + IN.cqw(1.2)
  addSectionPill(slide, `${brandLabel} 리뷰 콘텐츠 댓글 반응`, { x: CONTENT_BOX.x, y: reactionY, w: undefined, h: 0.24 })
  slide.addText(c.cpCommentReaction ?? '', {
    x: CONTENT_BOX.x, y: reactionY + 0.24 + IN.cqw(0.4), w: CONTENT_BOX.w, h: CONTENT_BOX.y + CONTENT_BOX.h - (reactionY + 0.24 + IN.cqw(0.4)),
    fontFace: FONT.REG, fontSize: 12, color: COLORS.gray3, valign: 'top', lineSpacingMultiple: 1.5,
  })
}

// ── review_list ──────────────────────────────────────────────────

async function buildReviewListSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  slide.background = { color: COLORS.bg }
  const c = page.content
  const logoW = 1.1
  addLogoImage(slide, { x: SLIDE_W - 0.5 - logoW, y: 0.32, w: logoW, h: logoW * (2900 / 6628) })
  slide.addText(c.engTitle ?? '', {
    x: 0.5, y: 0.35, w: 7.5, h: 0.3, fontFace: FONT.REG, fontSize: 13, color: COLORS.teal,
  })

  const subtitle = c.rlSubtitle ?? 'Mi Muse 리뷰'
  const isMimuse = subtitle.includes('Mi Muse') || subtitle.includes('mimuse')
  const reviewRows = reviewRowsOf(ctx.rows)
  const mimuseRows = reviewRows.filter(r => r.brand === 'mimuse')
  const allBrandReviewRows = reviewRows.filter(r => r.brand !== 'mimuse')
  const tableRows = isMimuse ? mimuseRows : allBrandReviewRows
  const offset = c.rlOffset ?? 0
  const ROWS_PER_PAGE = 15
  const pageRows = tableRows.slice(offset, offset + ROWS_PER_PAGE)
  const isBrand = !isMimuse

  slide.addText(`${c.korTitle ?? ''} — ${subtitle}`, {
    x: 0.5, y: 0.63, w: 8.5, h: 0.4, fontFace: FONT.EB, fontSize: 19, color: COLORS.ink,
  })

  const headers = isBrand
    ? ['No.', '플랫폼', '계정', '조회수', '좋아요', '댓글', 'Repost', '포스팅 URL']
    : ['No.', '플랫폼', '계정', '조회수', '좋아요', '댓글', '포스팅 URL']
  const colWidths = isBrand
    ? [0.05, 0.09, 0.13, 0.09, 0.09, 0.08, 0.09, 0.38]
    : [0.05, 0.1, 0.15, 0.1, 0.1, 0.09, 0.41]

  const rows = pageRows.length > 0
    ? pageRows.map((row, i) => {
        const base = [
          String(offset + i + 1),
          platformLabel(row.platform ?? ''),
          row.handle,
          row.views > 0 ? String(row.views) : '—',
          row.likes > 0 ? String(row.likes) : '—',
          row.comments > 0 ? String(row.comments) : '—',
        ]
        if (isBrand) base.push(row.repost ?? '—')
        base.push(row.review_link ? { text: row.review_link, hyperlink: row.review_link, align: 'left' as const } as unknown as string : '—')
        return base
      })
    : [[{ text: '데이터 없음', align: 'center' as const } as unknown as string, ...Array(headers.length - 1).fill('')]]

  addDataTable(slide, {
    x: CONTENT_BOX.x, y: CONTENT_BOX.y, w: CONTENT_BOX.w, h: CONTENT_BOX.h,
    headers, rows, colWidths, fontSize: 7.5, headerFontSize: 8,
  })
}

// ── best_review (photo wall) ────────────────────────────────────

async function buildBestReviewSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const mimuseRows = reviewRowsOf(ctx.rows)
    .filter(r => r.brand === 'mimuse')
    .sort((a, b) => {
      const aThumb = !!resolveMonitoringThumbnailUrl(a.assets)
      const bThumb = !!resolveMonitoringThumbnailUrl(b.assets)
      if (aThumb !== bThumb) return aThumb ? -1 : 1
      return (b.views || 0) - (a.views || 0)
    })
    .slice(0, 16)

  const cols = 8, rowsN = 2
  const gap = IN.cqw(0.45)
  const cellW = (CONTENT_BOX.w - gap * (cols - 1)) / cols
  const cellH = (CONTENT_BOX.h - gap * (rowsN - 1)) / rowsN

  const jobs: Promise<void>[] = []
  for (let i = 0; i < cols * rowsN; i++) {
    const row = mimuseRows[i]
    const thumbUrl = row ? resolveMonitoringThumbnailUrl(row.assets) : null
    const col = i % cols
    const rIdx = Math.floor(i / cols)
    const x = CONTENT_BOX.x + col * (cellW + gap)
    const y = CONTENT_BOX.y + rIdx * (cellH + gap)
    jobs.push(addImageOrPlaceholder(slide, thumbUrl, { x, y, w: cellW, h: cellH }))
  }
  await Promise.all(jobs)
}

// ── shared detail-card layout for best_review_detail / brand_mention_detail ─

async function buildDetailCardSlide(
  prs: pptxgen,
  page: BrandReportPage,
  data: { picked: MonitoringRow | null; overrideImgUrl: string | null; comment: string; extraStatRow?: { label: string; value: string } },
) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const gap = IN.cqw(1.6)
  const imgBlockW = CONTENT_BOX.w * 0.55
  const statsX = CONTENT_BOX.x + imgBlockW + gap
  const statsW = CONTENT_BOX.w - imgBlockW - gap

  const mediaGap = 0
  const mediaSlotW = (imgBlockW - mediaGap) / 2
  const mediaW = Math.min(mediaSlotW, CONTENT_BOX.h * (9 / 16))
  const mediaH = mediaW * (16 / 9)
  const xOff = (mediaSlotW - mediaW) / 2

  const autoThumb = data.picked ? resolveMonitoringThumbnailUrl(data.picked.assets) : null
  const jobs: Promise<void>[] = [
    addImageOrPlaceholder(slide, autoThumb, { x: CONTENT_BOX.x + xOff, y: CONTENT_BOX.y, w: mediaW, h: mediaH }),
    addImageOrPlaceholder(slide, data.overrideImgUrl, { x: CONTENT_BOX.x + mediaSlotW + mediaGap + xOff, y: CONTENT_BOX.y, w: mediaW, h: mediaH }),
  ]

  const handleUrl = data.picked?.handle ? `https://www.tiktok.com/@${data.picked.handle.replace(/^@/, '')}` : undefined
  const rows: { label: string; value: string; link?: string; weight: number }[] = [
    { label: '인플루언서', value: data.picked?.handle || '—', link: handleUrl, weight: 1 },
    { label: '팔로워', value: fmtK(data.picked?.followers), weight: 1 },
    { label: '조회수', value: fmtK(data.picked?.views), weight: 1 },
    { label: '좋아요', value: fmtK(data.picked?.likes), weight: 1 },
    { label: '댓글', value: fmtK(data.picked?.comments), weight: 1 },
    { label: '댓글 반응', value: data.comment || '—', weight: 2.2 },
  ]
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0)
  const labelW = statsW * 0.28
  let y = CONTENT_BOX.y
  rows.forEach((row, ri) => {
    const rowH = mediaH * (row.weight / totalWeight)
    slide.addShape('rect', {
      x: statsX, y, w: labelW, h: rowH, fill: { color: COLORS.accent }, line: { color: COLORS.bg, width: 0.75 },
    })
    slide.addText(row.label, {
      x: statsX, y, w: labelW, h: rowH, align: 'center', valign: 'middle',
      fontFace: FONT.REG, fontSize: 9, color: 'FFFFFF',
    })
    slide.addShape('rect', {
      x: statsX + labelW, y, w: statsW - labelW, h: rowH, fill: { color: 'FFFFFF' }, line: { color: 'D8EAEE', width: 0.75 },
    })
    slide.addText(row.value, {
      x: statsX + labelW + IN.cqw(0.6), y, w: statsW - labelW - IN.cqw(1.2), h: rowH,
      align: ri === rows.length - 1 ? 'left' : 'center', valign: 'middle',
      fontFace: FONT.REG, fontSize: 9, color: COLORS.ink,
      hyperlink: row.link ? { url: row.link } : undefined,
    })
    y += rowH
  })

  await Promise.all(jobs)
}

function parseBrdCard(raw?: string): { comment: string } {
  if (!raw) return { comment: '' }
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') return { comment: p.comment ?? '' }
  } catch { /* not json */ }
  return { comment: raw.split('\n').slice(2).join('\n') }
}

async function buildBestReviewDetailSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const c = page.content
  const pickIndex = c.brdPickIndex ?? 0
  const bestRows = reviewRowsOf(ctx.rows).filter(r => r.best_review_picks).sort((a, b) => (b.views || 0) - (a.views || 0))
  const picked = bestRows[pickIndex] ?? null
  const { comment } = parseBrdCard(c.brdCard1)
  await buildDetailCardSlide(prs, page, { picked, overrideImgUrl: c.brdCard1Img ?? null, comment })
}

// ── brand_mention (14-cell grid: auto brand thumbnails + manual captures) ─

async function buildBrandMentionSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const bmOvMap: Record<string, string> = (() => {
    try { return JSON.parse(c.bmOverrides ?? '{}') } catch { return {} }
  })()
  const autoExcluded: Set<string> = new Set((() => {
    try { return JSON.parse(c.bmAutoExclude ?? '[]') as string[] } catch { return [] }
  })())
  const brandRows = brandRowsOf(ctx)
  const autoItemsAll = brandRows
    .map(r => ({ url: resolveMonitoringThumbnailUrl(r.assets), id: r.id }))
    .filter((item): item is { url: string; id: string } => !!item.url)
  const autoItems = autoItemsAll.filter(item => !autoExcluded.has(item.id))
  const captureItems = Object.entries(bmOvMap).filter(([, url]) => url).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  const autoCount = Math.min(autoItems.length, 14)

  const cols = 7, rowsN = 2
  const gap = IN.cqw(0.4)
  const cellW = (CONTENT_BOX.w - gap * (cols - 1)) / cols
  const cellH = (CONTENT_BOX.h - gap * (rowsN - 1)) / rowsN

  const jobs: Promise<void>[] = []
  for (let i = 0; i < cols * rowsN; i++) {
    const url = i < autoCount ? autoItems[i].url : (captureItems[i - autoCount]?.[1] ?? null)
    const col = i % cols
    const rIdx = Math.floor(i / cols)
    const x = CONTENT_BOX.x + col * (cellW + gap)
    const y = CONTENT_BOX.y + rIdx * (cellH + gap)
    jobs.push(addImageOrPlaceholder(slide, url, { x, y, w: cellW, h: cellH }))
  }
  await Promise.all(jobs)
}

async function buildBrandMentionDetailSlide(prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) {
  const c = page.content
  const pickIndex = c.bmdPickIndex ?? 0
  const brandRows = brandRowsOf(ctx)
  const picked = brandRows[pickIndex] ?? null
  await buildDetailCardSlide(prs, page, { picked, overrideImgUrl: c.bmdImageUrl ?? null, comment: c.bmdCommentReaction ?? '' })
}

// ── dispatcher ──────────────────────────────────────────────────

type BuilderFn = (prs: pptxgen, page: BrandReportPage, ctx: BuilderCtx) => Promise<void>

export const SLIDE_BUILDERS: Record<BrandPageType, BuilderFn> = {
  cover: (prs, page, ctx) => buildCoverSlide(prs, page, ctx),
  outro: (prs, page) => buildOutroSlide(prs, page),
  project_overview: (prs, page) => buildProjectOverviewSlide(prs, page),
  brand_content_performance: buildBrandContentPerformanceSlide,
  review_list: buildReviewListSlide,
  best_review: buildBestReviewSlide,
  best_review_detail: buildBestReviewDetailSlide,
  brand_mention: buildBrandMentionSlide,
  brand_mention_detail: buildBrandMentionDetailSlide,
}
