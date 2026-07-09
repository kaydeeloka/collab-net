import type pptxgen from 'pptxgenjs'
import type { MonitoringRow } from '@/lib/influencer/monitoring-data'
import { resolveMonitoringThumbnailUrl } from '@/lib/influencer/monitoring-storage'
import { monitoringBrandKey } from '@/lib/influencer/monitoring-keywords'
import type { ReportPage, PageType } from './types'
import {
  IN, SLIDE_W, SLIDE_H, FONT, COLORS, CONTENT_BOX, LOGO_ASPECT,
  addImageOrPlaceholder, addSectionPill, addRoundedCard, addLogoImage,
  addBulletList, addChevronConnector, addProgressBar, addDoughnutChart, addLegend,
  addContentChrome, estimateLineCount, addSanitizedSlide,
} from '../../ppt-native'

export interface BuilderCtx {
  rows: MonitoringRow[]
  confirmedBrands: { name: string; nameEn: string }[]
  phaseName: string
}

function fmtK(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function reviewRowsOf(rows: MonitoringRow[]) {
  return rows.filter(r => r.review_link?.startsWith('http'))
}

// ── cover ─────────────────────────────────────────────────────────

async function buildCoverSlide(prs: pptxgen, page: ReportPage) {
  const slide = addSanitizedSlide(prs)
  slide.background = { color: COLORS.bg }

  const logoW = 3.5
  addLogoImage(slide, { x: -0.2, y: 0.6, w: logoW, h: logoW * LOGO_ASPECT })

  slide.addText('© CRANECOMMUNICATIONS', {
    x: 0.22, y: SLIDE_H - 0.45, w: 4, h: 0.25,
    fontFace: FONT.SANS, fontSize: 8.25, color: 'AAAAAA',
  })

  const title = page.content.title ?? ''
  if (title) {
    slide.addText(title, {
      x: 0.5, y: 2.0, w: 9.0 * 0.55, h: 2.925,
      fontFace: FONT.EB, bold: true, fontSize: IN.cqwPt(2.8), color: COLORS.ink,
      valign: 'top', lineSpacingMultiple: 1.3,
    })
  }
}

// ── outro ─────────────────────────────────────────────────────────

async function buildOutroSlide(prs: pptxgen, page: ReportPage) {
  const slide = addSanitizedSlide(prs)
  slide.background = { color: COLORS.bg }

  const title = page.content.title || 'E.O.D'
  const titleH = 1.2
  const titleY = (SLIDE_H - titleH) / 2 - IN.cqw(4) / 2
  slide.addText(title, {
    x: 0, y: titleY, w: SLIDE_W, h: titleH,
    align: 'center', valign: 'middle',
    fontFace: FONT.SANS, fontSize: IN.cqwPt(6), bold: true, color: COLORS.ink,
  })

  const DEFAULT_CONTACT = 'CONTACT | beautyproject@cranecomm.com'
  const caption = page.content.caption || DEFAULT_CONTACT
  const parts = caption.split('|').map(p => p.trim())
  const barY = SLIDE_H - IN.cqw(3.8) - 0.14

  if (parts.length >= 2) {
    const label = parts[0]
    const email = parts.slice(1).join('|').trim()
    const labelW = 1.3
    const gap = IN.cqw(1.4)
    const emailW = Math.max(1.5, email.length * 0.075)
    const totalW = labelW + gap + gap + emailW
    let x = (SLIDE_W - totalW) / 2

    slide.addText(label, {
      x, y: barY, w: labelW, h: 0.28,
      fontFace: FONT.SANS, fontSize: 10.5, color: COLORS.ink, align: 'right', valign: 'middle',
    })
    x += labelW + gap
    slide.addShape('rect', {
      x, y: barY + 0.04, w: 0.012, h: 0.2,
      fill: { color: 'AAAAAA' }, line: { type: 'none' },
    })
    x += gap
    slide.addText(email, {
      x, y: barY, w: emailW, h: 0.28,
      fontFace: FONT.SANS, fontSize: 8.25, color: '2563EB', underline: { style: 'sng' },
      align: 'left', valign: 'middle',
      hyperlink: { url: `mailto:${email}` },
    })
  } else {
    slide.addText(caption, {
      x: 0, y: barY, w: SLIDE_W, h: 0.28,
      align: 'center', valign: 'middle',
      fontFace: FONT.SANS, fontSize: 8, color: COLORS.gray3,
    })
  }
}

// ── project_overview ────────────────────────────────────────────────

async function buildProjectOverviewSlide(prs: pptxgen, page: ReportPage) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  // Vertical budget: reserve a fixed height for the process-steps section first,
  // then give the remainder to the image/info-table body — this guarantees both
  // sections fit inside CONTENT_BOX without either one getting squeezed to ~0.
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
  // Weight rows by estimated wrapped line count so long free-text (e.g. 프로젝트 목적)
  // gets proportionally more height instead of overflowing into the next row.
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
      fontFace: FONT.REG, fontSize: rowFontPt, color: COLORS.ink, valign: 'top', lineSpacingMultiple: 1.5,
    })
    rowY += rowH + rowGap
  }

  // process steps
  const procY = bodyY + bodyH + gapAboveProc
  addSectionPill(slide, '진행 프로세스', { x: CONTENT_BOX.x, y: procY, w: 1.3, h: pillH })
  const stepsY = procY + pillH + gapPillToSteps
  const chevronW = 0.24
  const stepCount = 4
  const stepW = (CONTENT_BOX.w - chevronW * (stepCount - 1)) / stepCount
  const steps = c.processSteps ?? [{ date: '', content: '' }, { date: '', content: '' }, { date: '', content: '' }, { date: '', content: '' }]
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

// ── kit_composition ──────────────────────────────────────────────

async function buildKitCompositionSlide(prs: pptxgen, page: ReportPage) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const gapX = IN.cqw(1.2)
  const gapY = IN.cqw(2.2)
  const topH = (CONTENT_BOX.h - gapY) * (2 / 3)
  const bottomH = (CONTENT_BOX.h - gapY) * (1 / 3)
  const leftW = CONTENT_BOX.w * 0.375 // 0.75fr of 0.75+1.25
  const rightW = CONTENT_BOX.w - leftW - gapX

  // top-left: kit image
  await addImageOrPlaceholder(slide, c.kitImageUrl, { x: CONTENT_BOX.x, y: CONTENT_BOX.y, w: leftW, h: topH })

  // top-right: concept
  const conceptX = CONTENT_BOX.x + leftW + gapX
  addSectionPill(slide, c.kitConceptTitle || '2026 VOL.1 콘셉트', { x: conceptX, y: CONTENT_BOX.y + IN.cqw(1.2), w: undefined, h: 0.24 })
  const conceptTextY = CONTENT_BOX.y + IN.cqw(1.2) + 0.24 + IN.cqw(0.9)
  const conceptTextH = topH - IN.cqw(1.2) * 2 - 0.24 - IN.cqw(0.9)
  const conceptText = c.kitConceptText ?? ''
  // The concept text box shares its row height with the image cell (fixed 2:1 grid), so it
  // can't grow like the other slides' rows — shrink the font instead of letting long copy
  // overflow into the composition cards below.
  let conceptFontPt = 10.5
  while (
    conceptFontPt > 7 &&
    estimateLineCount(conceptText, rightW, conceptFontPt) * (conceptFontPt / 72) * 1.85 > conceptTextH
  ) {
    conceptFontPt -= 0.5
  }
  slide.addText(conceptText, {
    x: conceptX, y: conceptTextY, w: rightW, h: conceptTextH,
    fontFace: FONT.REG, fontSize: conceptFontPt, color: COLORS.gray3, valign: 'top', lineSpacingMultiple: 1.85,
  })

  // bottom row: two composition cells
  const bottomY = CONTENT_BOX.y + topH + gapY
  const cellW = (CONTENT_BOX.w - gapX) / 2
  const compData: { title: string; items: string }[] = [
    { title: '브랜드 구성품', items: c.kitBrandItems ?? '' },
    { title: 'Mi Muse 구성품', items: c.kitMimuseItems ?? '' },
  ]
  compData.forEach((comp, i) => {
    const x = CONTENT_BOX.x + i * (cellW + gapX)
    addRoundedCard(slide, { x, y: bottomY, w: cellW, h: bottomH, fill: COLORS.compBg, fillTransparency: 0, line: COLORS.compBg, lineTransparency: 100, shadow: false })
    addSectionPill(slide, comp.title, { x: x + cellW / 2 - 0.6, y: bottomY - IN.cqw(0.65), w: 1.2, h: 0.24 })
    addBulletList(slide, comp.items.split('\n').filter(Boolean), {
      x: x + IN.cqw(3), y: bottomY + IN.cqw(1.2), w: cellW - IN.cqw(6), h: bottomH - IN.cqw(2.4),
      fontSize: 9, lineSpacingMultiple: 1.6,
    })
  })
}

// ── content_performance ──────────────────────────────────────────

async function buildContentPerformanceSlide(prs: pptxgen, page: ReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const DEFAULT_RECOVERY = '인플루언서||80\n매거진||100\n콘텐츠 수량||98'
  const DEFAULT_CTYPES = '숏폼 중심\n전체 콘텐츠의 대다수가 TikTok 숏폼으로 생성\n\n댓글 반응 활발\n키트 패키징·구성에 대한 자발적 질문 및 공유 다수\n\n키트 언박싱 포맷\n개봉 과정을 담은 리뷰가 주요 콘텐츠 유형으로 확인'

  const recoveryCards = (c.cpRecoveryCards ?? DEFAULT_RECOVERY).split('\n').map(line => {
    const parts = line.split('|')
    return { label: parts[0] ?? '', desc: parts[1] ?? '', pct: parseInt(parts[2] ?? '0') || 0 }
  })
  const reviewRows = reviewRowsOf(ctx.rows)
  const contentTypeItems = (c.cpContentTypes ?? DEFAULT_CTYPES).split('\n\n').map(block => {
    const lines = block.trim().split('\n')
    return { title: lines[0] ?? '', desc: lines.slice(1).join('\n') }
  })

  addSectionPill(slide, '회수율', { x: CONTENT_BOX.x, y: CONTENT_BOX.y, w: 1.0, h: 0.24 })

  const recoveryY = CONTENT_BOX.y + 0.24 + IN.cqw(0.4)
  const recoveryH = 1.35
  const gap = IN.cqw(1.2)
  const cardW = (CONTENT_BOX.w - gap * 2) / 3
  recoveryCards.forEach((card, i) => {
    const x = CONTENT_BOX.x + i * (cardW + gap)
    addRoundedCard(slide, { x, y: recoveryY, w: cardW, h: recoveryH })
    slide.addText(card.label, {
      x: x + IN.cqw(1.6), y: recoveryY + IN.cqw(1.4), w: cardW - IN.cqw(3.2), h: 0.3,
      fontFace: FONT.REG, fontSize: 11, bold: true, color: COLORS.ink,
    })
    if (i === 2 && reviewRows.length > 0) {
      slide.addText(`총 ${reviewRows.length}건`, {
        x: x + cardW - IN.cqw(3.5), y: recoveryY + IN.cqw(1.4), w: IN.cqw(3.2), h: 0.3,
        fontFace: FONT.REG, fontSize: 8, bold: true, color: COLORS.accent, align: 'right',
      })
    }
    slide.addText(card.desc, {
      x: x + IN.cqw(1.6), y: recoveryY + IN.cqw(1.4) + 0.32, w: cardW - IN.cqw(3.2), h: 0.55,
      fontFace: FONT.REG, fontSize: 9.5, color: COLORS.ink, valign: 'top', lineSpacingMultiple: 1.45,
    })
    addProgressBar(slide, { x: x + IN.cqw(1.6), y: recoveryY + recoveryH - IN.cqw(1.0), w: cardW - IN.cqw(3.2), pct: card.pct })
  })

  const bottomY = recoveryY + recoveryH + IN.cqw(1.6)
  const bottomH = CONTENT_BOX.y + CONTENT_BOX.h - bottomY
  const panelGap = IN.cqw(1.6)
  const panelW = (CONTENT_BOX.w - panelGap) / 2

  // left panel — donut + legend
  const leftX = CONTENT_BOX.x
  addSectionPill(slide, '콘텐츠 업로드 채널', { x: leftX, y: bottomY, w: 1.7, h: 0.24 })
  const total = reviewRows.length
  const channelSegs = [
    { label: 'TikTok', count: reviewRows.filter(r => /tiktok/i.test(r.platform ?? '')).length, color: '648085' },
    { label: 'Instagram', count: reviewRows.filter(r => /insta/i.test(r.platform ?? '')).length, color: '8BAAB8' },
    { label: 'magazine', count: reviewRows.filter(r => /magazine/i.test(r.platform ?? '')).length, color: 'BED6DE' },
  ].map(s => ({ ...s, pct: total ? Math.round(s.count / total * 100) : 0 })).filter(s => s.count > 0)

  const donutSize = 1.6
  const donutY = bottomY + 0.24 + IN.cqw(0.4)
  if (channelSegs.length > 0) {
    addDoughnutChart(slide, channelSegs, { x: leftX, y: donutY, w: donutSize, h: donutSize })
    addLegend(slide, channelSegs, { x: leftX + donutSize + IN.cqw(1.4), y: donutY + 0.3, w: panelW - donutSize - IN.cqw(1.4) })
  }

  // right panel — content type blocks
  const rightX = leftX + panelW + panelGap
  addSectionPill(slide, '콘텐츠 유형', { x: rightX, y: bottomY, w: 1.3, h: 0.24 })
  let ctY = bottomY + 0.24 + IN.cqw(0.4)
  const ctRowH = (bottomH - 0.24 - IN.cqw(0.4)) / Math.max(1, contentTypeItems.length)
  contentTypeItems.forEach(item => {
    slide.addText(`■ ${item.title}`, {
      x: rightX, y: ctY, w: panelW, h: 0.24,
      fontFace: FONT.REG, fontSize: 11, bold: true, color: COLORS.ink,
    })
    slide.addText(item.desc, {
      x: rightX, y: ctY + 0.24, w: panelW, h: ctRowH - 0.24,
      fontFace: FONT.REG, fontSize: 10.5, color: COLORS.gray5, valign: 'top', lineSpacingMultiple: 1.5,
    })
    ctY += ctRowH
  })
}

// ── best_review (photo wall) ──────────────────────────────────────

async function buildBestReviewSlide(prs: pptxgen, page: ReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const reviewRows = reviewRowsOf(ctx.rows)
  const mimuseRows = reviewRows
    .filter(r => (r.brand || '').toLowerCase() === 'mimuse')
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

// ── best_review_detail ──────────────────────────────────────────

function parseBrdCard(raw?: string): { comment: string } {
  if (!raw) return { comment: '' }
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object') return { comment: p.comment ?? '' }
  } catch { /* not json */ }
  return { comment: '' }
}

async function buildBestReviewDetailSlide(prs: pptxgen, page: ReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const cardKeys = ['brdCard1', 'brdCard2', 'brdCard3'] as const
  const imgKeys = ['brdCard1Img', 'brdCard2Img', 'brdCard3Img'] as const
  const bestRows = ctx.rows.filter(r => r.best_review_picks && r.review_link?.startsWith('http')).sort((a, b) => b.views - a.views)

  const gap = IN.cqw(1.2)
  const cardW = (CONTENT_BOX.w - gap * 2) / 3
  const infoH = 1.2
  const cardX0 = CONTENT_BOX.x
  const mediaGap = 0
  const mediaSlotW = (cardW - mediaGap) / 2
  const mediaAreaH = CONTENT_BOX.h - infoH
  // Dual media grid sized to a 9:16 frame per cell (matches native TikTok video shape); fit
  // within whichever of slot-width/area-height is the binding constraint, then center within
  // the slot the old full-bleed thumbnail used to fill.
  const mediaW = Math.min(mediaSlotW, mediaAreaH * (9 / 16))
  const mediaH = mediaW * (16 / 9)
  const cardH = mediaH + infoH

  const jobs: Promise<void>[] = []
  cardKeys.forEach((key, i) => {
    const x = cardX0 + i * (cardW + gap)
    const picked = bestRows[i] ?? null
    const { comment } = parseBrdCard(c[key])

    addRoundedCard(slide, { x, y: CONTENT_BOX.y, w: cardW, h: cardH, radius: 0.05 })

    const mediaXOffset = (mediaSlotW - mediaW) / 2
    const autoThumb = picked ? resolveMonitoringThumbnailUrl(picked.assets) : null
    jobs.push(addImageOrPlaceholder(slide, autoThumb, { x: x + mediaXOffset, y: CONTENT_BOX.y, w: mediaW, h: mediaH }))
    jobs.push(addImageOrPlaceholder(slide, c[imgKeys[i]], { x: x + mediaSlotW + mediaGap + mediaXOffset, y: CONTENT_BOX.y, w: mediaW, h: mediaH }))

    const infoY = CONTENT_BOX.y + mediaH
    const labelW = cardW * 0.32
    // 댓글 반응 is free-text and wraps to multiple lines, while 인플루언서/팔로워 are always
    // a single short line — give it most of the row budget instead of splitting evenly.
    const infoRows: { label: string; value: string; link?: string; weight: number }[] = [
      { label: '인플루언서', value: picked?.handle || '—', link: picked?.handle ? `https://www.tiktok.com/@${picked.handle.replace(/^@/, '')}` : undefined, weight: 0.65 },
      { label: '팔로워', value: fmtK(picked?.followers), weight: 0.65 },
      { label: '댓글 반응', value: comment || '—', weight: 1.7 },
    ]
    const totalWeight = infoRows.reduce((sum, r) => sum + r.weight, 0)
    let y = infoY
    infoRows.forEach((row, ri) => {
      const rowH = infoH * (row.weight / totalWeight)
      slide.addShape('rect', { x, y, w: labelW, h: rowH, fill: { color: COLORS.accent }, line: { type: 'none' } })
      slide.addText(row.label, {
        x, y, w: labelW, h: rowH, align: 'center', valign: 'middle',
        fontFace: FONT.REG, fontSize: 8.25, color: 'FFFFFF',
      })
      slide.addText(row.value, {
        x: x + labelW, y, w: cardW - labelW, h: rowH,
        align: ri === 2 ? 'left' : 'center', valign: 'middle',
        fontFace: FONT.REG, fontSize: 8.25, color: COLORS.ink,
        hyperlink: row.link ? { url: row.link } : undefined,
      })
      y += rowH
    })
  })
  await Promise.all(jobs)
}

// ── brand_mention (gallery) ──────────────────────────────────────

async function buildBrandMentionSlide(prs: pptxgen, page: ReportPage, ctx: BuilderCtx) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  function brandVariants(name: string): string[] {
    const lower = name.trim().toLowerCase()
    return [lower, monitoringBrandKey(name), lower.replace(/\s+/g, ''), lower.replace(/\s+/g, '-')]
  }
  const bmOvMap: Record<string, string> = (() => {
    try { return JSON.parse(c.bmOverrides ?? '{}') } catch { return {} }
  })()
  const reviewRows = reviewRowsOf(ctx.rows)
  const groups = ctx.confirmedBrands.length > 0
    ? ctx.confirmedBrands.slice(0, 4).map(({ name, nameEn }) => {
        const variants = new Set([...brandVariants(name), ...brandVariants(nameEn)])
        const matched = reviewRows
          .filter(r => r.brand && variants.has(r.brand.toLowerCase()))
          .sort((a, b) => {
            const aThumb = !!resolveMonitoringThumbnailUrl(a.assets)
            const bThumb = !!resolveMonitoringThumbnailUrl(b.assets)
            if (aThumb !== bThumb) return aThumb ? -1 : 1
            return (b.views || 0) - (a.views || 0)
          })
        return { name, nameEn, brandRows: matched }
      })
    : [
        { name: 'brand1', nameEn: 'BRAND 1', brandRows: [] as MonitoringRow[] },
        { name: 'brand2', nameEn: 'BRAND 2', brandRows: [] as MonitoringRow[] },
        { name: 'brand3', nameEn: 'BRAND 3', brandRows: [] as MonitoringRow[] },
        { name: 'brand4', nameEn: 'BRAND 4', brandRows: [] as MonitoringRow[] },
      ]

  const gap = IN.cqw(1.4)
  const cellW = (CONTENT_BOX.w - gap) / 2
  const cellH = (CONTENT_BOX.h - gap) / 2
  const jobs: Promise<void>[] = []

  groups.forEach((group, gi) => {
    const col = gi % 2, rowI = Math.floor(gi / 2)
    const x = CONTENT_BOX.x + col * (cellW + gap)
    const y = CONTENT_BOX.y + rowI * (cellH + gap)

    slide.addShape('roundRect', {
      x, y, w: Math.max(0.9, group.nameEn.length * 0.09 + 0.3), h: 0.22, rectRadius: 0.15,
      fill: { color: COLORS.accent }, line: { type: 'none' },
    })
    slide.addText(group.nameEn.toUpperCase(), {
      x, y, w: Math.max(0.9, group.nameEn.length * 0.09 + 0.3), h: 0.22,
      align: 'center', valign: 'middle', fontFace: FONT.REG, fontSize: 9, color: 'FFFFFF',
    })

    const thumbsY = y + 0.22 + IN.cqw(0.55)
    const thumbsH = cellH - 0.22 - IN.cqw(0.55)
    const thumbGap = IN.cqw(0.4)
    const thumbW = (cellW - thumbGap * 3) / 4
    for (let ti = 0; ti < 4; ti++) {
      const ovKey = `${monitoringBrandKey(group.name)}_${ti}`
      const overrideUrl = bmOvMap[ovKey] ?? null
      const row = group.brandRows[ti]
      const autoThumb = row ? resolveMonitoringThumbnailUrl(row.assets) : null
      const displayUrl = overrideUrl ?? autoThumb
      const tx = x + ti * (thumbW + thumbGap)
      jobs.push(addImageOrPlaceholder(slide, displayUrl, { x: tx, y: thumbsY, w: thumbW, h: thumbsH }))
    }
  })
  await Promise.all(jobs)
}

// ── next_project ──────────────────────────────────────────────────

async function buildNextProjectSlide(prs: pptxgen, page: ReportPage) {
  const slide = addSanitizedSlide(prs)
  const c = page.content
  addContentChrome(slide, c.engTitle, c.korTitle)

  const gapRows = IN.cqw(1.8)
  const topH = (CONTENT_BOX.h - gapRows) * 0.55
  const bottomH = CONTENT_BOX.h - gapRows - topH

  // top: 4-image strip + info
  const imageUrls = (c.npImageUrls ?? '').split('\n').map(u => u.trim()).slice(0, 4)
  const stripW = CONTENT_BOX.w * 0.54
  const cellW = stripW / 4
  const jobs: Promise<void>[] = []
  for (let i = 0; i < 4; i++) {
    jobs.push(addImageOrPlaceholder(slide, imageUrls[i], { x: CONTENT_BOX.x + i * cellW, y: CONTENT_BOX.y, w: cellW, h: topH }))
  }

  const infoX = CONTENT_BOX.x + stripW + IN.cqw(1.6)
  const infoW = CONTENT_BOX.x + CONTENT_BOX.w - infoX
  const valueX = infoX + 1.05
  const valueW = infoW - 1.05
  const conceptLines = (c.npConcept ?? '').split('\n')
  const conceptTitle = conceptLines[0] ?? ''
  const conceptDetail = conceptLines.slice(1)
  const conceptTitleH = 0.26
  // Weight rows by estimated wrapped line count so long free-text (concept detail, or an
  // unusually long period/brand list) gets proportionally more height instead of overflowing
  // into the row below.
  const infoRows: { label: string; value: string; isConcept?: boolean; weight: number }[] = [
    { label: '프로젝트 컨셉', value: '', isConcept: true, weight: 1 + Math.max(1, estimateLineCount(conceptDetail.join('\n'), valueW, 9)) },
    { label: '프로젝트 기간', value: c.npPeriod ?? '', weight: Math.max(1, estimateLineCount(c.npPeriod ?? '', valueW, 10.5)) },
    { label: '키트 발송 대상', value: c.npKitRecipients ?? '', weight: Math.max(1, estimateLineCount(c.npKitRecipients ?? '', valueW, 10.5)) },
    { label: '참여 브랜드', value: c.npBrands ?? '', weight: Math.max(1, estimateLineCount(c.npBrands ?? '', valueW, 10.5)) },
  ]
  const totalWeight = infoRows.reduce((sum, r) => sum + r.weight, 0)
  let rowY = CONTENT_BOX.y
  infoRows.forEach(row => {
    const rowH = topH * (row.weight / totalWeight)
    const y = rowY
    addSectionPill(slide, row.label, { x: infoX, y: y + IN.cqw(0.15), w: 0.95, h: 0.22, fontSize: 8 })
    if (row.isConcept) {
      slide.addText(conceptTitle, {
        x: valueX, y, w: valueW, h: conceptTitleH,
        fontFace: FONT.REG, fontSize: 10.5, bold: true, color: COLORS.ink,
      })
      slide.addText(conceptDetail.join('\n'), {
        x: valueX, y: y + conceptTitleH, w: valueW, h: rowH - conceptTitleH,
        fontFace: FONT.REG, fontSize: 9, color: COLORS.gray5, valign: 'top', lineSpacingMultiple: 1.5,
      })
    } else {
      slide.addText(row.value, {
        x: valueX, y, w: valueW, h: rowH,
        fontFace: FONT.REG, fontSize: 10.5, color: COLORS.ink, valign: 'top', lineSpacingMultiple: 1.4,
      })
    }
    rowY += rowH
  })

  // bottom: improvement cards
  const bottomY = CONTENT_BOX.y + topH + gapRows
  addSectionPill(slide, c.npImprovementTitle || '1차 대비 보완 운영 예정', { x: CONTENT_BOX.x, y: bottomY, w: undefined, h: 0.24 })
  const cardsY = bottomY + 0.24 + IN.cqw(0.5)
  const cardsH = CONTENT_BOX.y + CONTENT_BOX.h - cardsY
  const cardGap = IN.cqw(0.8)
  const cardKeys = ['npCard1', 'npCard2', 'npCard3'] as const
  const cardW = (CONTENT_BOX.w - cardGap * 2) / 3
  cardKeys.forEach((key, i) => {
    const x = CONTENT_BOX.x + i * (cardW + cardGap)
    addRoundedCard(slide, { x, y: cardsY, w: cardW, h: cardsH })
    const lines = (c[key] ?? '').split('\n')
    const title = lines[0] ?? ''
    const bullets = lines.slice(1).filter(Boolean)
    if (title) {
      slide.addShape('roundRect', {
        x: x + IN.cqw(1.2), y: cardsY + IN.cqw(0.9), w: Math.max(0.9, title.length * 0.075 + 0.3), h: 0.2,
        rectRadius: 0.2, fill: { color: COLORS.badgeBg }, line: { type: 'none' },
      })
      slide.addText(title, {
        x: x + IN.cqw(1.2), y: cardsY + IN.cqw(0.9), w: Math.max(0.9, title.length * 0.075 + 0.3), h: 0.2,
        align: 'center', valign: 'middle', fontFace: FONT.REG, fontSize: 8.5, color: COLORS.badgeTx,
      })
    }
    addBulletList(slide, bullets, {
      x: x + IN.cqw(1.2), y: cardsY + IN.cqw(0.9) + 0.3, w: cardW - IN.cqw(2.4), h: cardsH - IN.cqw(0.9) - 0.3 - IN.cqw(1),
      fontSize: 9, lineSpacingMultiple: 1.5,
    })
  })
}

// ── dispatcher ──────────────────────────────────────────────────

type BuilderFn = (prs: pptxgen, page: ReportPage, ctx: BuilderCtx) => Promise<void>

export const SLIDE_BUILDERS: Record<PageType, BuilderFn> = {
  cover: (prs, page) => buildCoverSlide(prs, page),
  outro: (prs, page) => buildOutroSlide(prs, page),
  project_overview: (prs, page) => buildProjectOverviewSlide(prs, page),
  kit_composition: (prs, page) => buildKitCompositionSlide(prs, page),
  content_performance: buildContentPerformanceSlide,
  best_review: buildBestReviewSlide,
  best_review_detail: buildBestReviewDetailSlide,
  brand_mention: buildBrandMentionSlide,
  next_project: (prs, page) => buildNextProjectSlide(prs, page),
}
