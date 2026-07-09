import type pptxgen from 'pptxgenjs'

type Slide = pptxgen.Slide

/** 960x540px on-screen slide == 10in x 5.625in PPTX slide -> 96px = 1in. */
export const IN = {
  /** cqw (1cqw = 9.6px on the 960px-wide container) -> inches */
  cqw: (n: number) => n * 0.1,
  /** px -> inches */
  px: (n: number) => n / 96,
  /** cqw -> points (pptxgenjs fontSize unit) */
  cqwPt: (n: number) => n * 7.2,
  /** px -> points */
  pxPt: (n: number) => n * 0.75,
}

export const SLIDE_W = 10
export const SLIDE_H = 5.625

/** 나눔휴먼OTF weights are installed as distinct font families (Regular/Bold/ExtraBold), not
 *  one family toggled via the `bold` flag — the old 'NanumHumanEB' string didn't match any
 *  installed font at all. */
export const FONT = {
  EB: '나눔휴먼OTF ExtraBold',
  BOLD: '나눔휴먼OTF Bold',
  REG: '나눔휴먼OTF Regular',
  SANS: 'Arial',
}

export const COLORS = {
  bg: 'F8F6F6',
  accent: '8BAAB8',
  teal: '648085',
  ink: '1A1A1A',
  gray3: '333333',
  gray5: '555555',
  gray8: '888888',
  badgeBg: 'C8DCE4',
  badgeTx: '3A6475',
  compBg: 'EAF3F6',
  hairline: '000000',
  placeholder: 'D5E4EA',
  placeholderText: '648085',
  chevron: 'B0C4CE',
}

export const CARD_SHADOW = { type: 'outer' as const, color: '000000', opacity: 0.05, blur: 8, offset: 2, angle: 90 }

/** PNG, not the original SVG — pptxgenjs's native SVG `addImage()` embedding (blip +
 *  asvg:svgBlip extLst) has repeated, longstanding PowerPoint "needs repair" bugs (see
 *  gitbrent/PptxGenJS #522, #1150, #1449); a plain raster embed uses the same reliable
 *  codepath every other image in this report already goes through. */
export const LOGO_PATH = '/img/logo-report.png'
/** Logo is 6628x2900 -> h/w aspect ratio, used since pptxgenjs needs explicit w/h. */
export const LOGO_ASPECT = 2900 / 6628

/** Control characters illegal in XML 1.0 text content (everything except tab/LF/CR).
 *  A single one of these — e.g. a stray vertical-tab (0x0B) left over from a Windows
 *  soft line-break pasted into a textarea — produces genuinely malformed slide XML that
 *  PowerPoint's "needs repair" flow recovers from by wiping that slide's entire content. */
const XML_ILLEGAL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

function sanitizeXmlText(text: string): string {
  return text.replace(XML_ILLEGAL_CHARS, '')
}

/** `prs.addSlide()` wrapped so every `addText()` call on the returned Slide is automatically
 *  stripped of XML-illegal control characters before reaching pptxgenjs. Centralized here
 *  instead of sanitizing at each call site, since content flows in from many places (DB free
 *  text, monitoring row handles/comments) and missing even one call site reproduces the bug. */
export function addSanitizedSlide(prs: pptxgen): Slide {
  const slide = prs.addSlide()
  const originalAddText = slide.addText.bind(slide)
  ;(slide as unknown as { addText: typeof slide.addText }).addText = ((text: unknown, options?: unknown) => {
    if (typeof text === 'string') {
      return originalAddText(sanitizeXmlText(text), options as never)
    }
    if (Array.isArray(text)) {
      const cleaned = text.map(item =>
        item && typeof item === 'object' && typeof item.text === 'string'
          ? { ...item, text: sanitizeXmlText(item.text) }
          : item,
      )
      return originalAddText(cleaned, options as never)
    }
    return originalAddText(text as never, options as never)
  }) as typeof slide.addText
  return slide
}

/** Fetch an image URL and convert to a downscaled JPEG base64 data URI for pptxgenjs
 *  `data:` embedding. Always re-encodes via canvas rather than passing the raw fetched bytes
 *  through, for two reasons: (1) the source may be webp/avif/heic/etc, which PowerPoint's OOXML
 *  image embedding does not reliably support, and (2) full-resolution phone/camera photos
 *  passed straight through as PNG can balloon to tens of MB per slide, which has been observed
 *  to produce a file PowerPoint reports as needing repair (and then blanks the affected slide).
 *  Downscaling to a sane max dimension and using JPEG keeps embedded images small and universally
 *  readable. Returns null on any failure (network/CORS/404/decode) so callers fall back to a
 *  placeholder instead of crashing the whole export. */
export async function fetchImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const MAX_DIM = 1200
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Flatten onto white first — JPEG has no alpha channel, so any transparent source
    // (e.g. a PNG product cutout) would otherwise encode as black.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.75)
  } catch {
    return null
  }
}

/** Places the MiMuse logo (a plain PNG — see LOGO_PATH) at the given box. */
export function addLogoImage(slide: Slide, opts: { x: number; y: number; w: number; h: number }) {
  slide.addImage({ path: LOGO_PATH, x: opts.x, y: opts.y, w: opts.w, h: opts.h })
}

export function addPlaceholderRect(slide: Slide, x: number, y: number, w: number, h: number, label = '이미지') {
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.04,
    fill: { color: COLORS.placeholder },
    line: { type: 'none' },
  })
  slide.addText(label, {
    x, y, w, h,
    align: 'center', valign: 'middle',
    fontFace: FONT.REG, fontSize: 10, color: COLORS.placeholderText, bold: true,
  })
}

/** Fetches `url` and places it as a native cropped-to-fill image; falls back to a placeholder card. */
export async function addImageOrPlaceholder(
  slide: Slide,
  url: string | null | undefined,
  opts: { x: number; y: number; w: number; h: number },
) {
  const data = await fetchImageAsBase64(url)
  if (data) {
    try {
      slide.addImage({
        data, x: opts.x, y: opts.y, w: opts.w, h: opts.h,
        sizing: { type: 'cover', w: opts.w, h: opts.h },
      })
      return
    } catch {
      // fall through to placeholder — one bad image should never blank/corrupt the whole slide
    }
  }
  addPlaceholderRect(slide, opts.x, opts.y, opts.w, opts.h)
}

/** Small rounded-pill label (SectionPill equivalent). */
export function addSectionPill(
  slide: Slide,
  text: string,
  opts: { x: number; y: number; w?: number; h?: number; fontSize?: number },
) {
  const h = opts.h ?? 0.22
  const w = opts.w ?? Math.max(0.75, text.length * 0.11 + 0.28)
  slide.addShape('roundRect', {
    x: opts.x, y: opts.y, w, h,
    rectRadius: 0.5,
    fill: { color: COLORS.accent },
    line: { type: 'none' },
  })
  slide.addText(text, {
    x: opts.x, y: opts.y, w, h,
    align: 'center', valign: 'middle',
    fontFace: FONT.REG, fontSize: opts.fontSize ?? 9, color: 'FFFFFF',
  })
  return { w, h }
}

/** Reusable white/tinted rounded card with hairline border.
 *  No drop shadow — confirmed by isolated single-shape bisection (2026-07-09) that
 *  pptxgenjs's `shadow: CARD_SHADOW` (an `outerShdw` effect) on a roundRect, and *only*
 *  that, is what makes PowerPoint flag the file as needing repair. A single card with the
 *  shadow reproduced it every time; the identical card with `shadow: false` never did,
 *  across many isolated shape-count/content variations. See CARD_SHADOW for the effect
 *  definition kept around in case a future pptxgenjs version fixes this. */
export function addRoundedCard(
  slide: Slide,
  opts: {
    x: number; y: number; w: number; h: number
    fill?: string; fillTransparency?: number
    line?: string; lineTransparency?: number
    radius?: number; shadow?: boolean
  },
) {
  slide.addShape('roundRect', {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    rectRadius: opts.radius ?? 0.06,
    fill: { color: opts.fill ?? 'FFFFFF', transparency: opts.fillTransparency ?? 12 },
    line: { color: opts.line ?? COLORS.hairline, transparency: opts.lineTransparency ?? 93, width: 0.75 },
  })
}

/** Estimate of how many wrapped lines `text` occupies at `fontSizePt` within `widthIn`.
 *  Uses real canvas font-metrics measurement (accurate for the mixed Korean/English report
 *  copy this sizes) when a DOM is available; falls back to a conservative character-count
 *  heuristic otherwise (e.g. Node-based testing). A safety margin is applied since PowerPoint's
 *  own text layout won't match the browser canvas's metrics exactly, and multi-line results get
 *  one extra buffer line — used to size free-text boxes (info values, concept descriptions) so
 *  long content doesn't overflow into the next element. Erring toward extra whitespace is far
 *  preferable to overlapping text. */
export function estimateLineCount(text: string, widthIn: number, fontSizePt: number, fontFace: string = FONT.REG): number {
  if (!text) return 1
  const widthPx = widthIn * 96
  const SAFETY_MARGIN = 1.12
  let totalLines = 0
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  for (const rawLine of text.split('\n')) {
    if (!rawLine) { totalLines += 1; continue }
    if (ctx) {
      ctx.font = `${fontSizePt}pt ${fontFace}`
      const textWidthPx = ctx.measureText(rawLine).width * SAFETY_MARGIN
      totalLines += Math.max(1, Math.ceil(textWidthPx / widthPx))
    } else {
      const avgCharWidthIn = (fontSizePt / 72) * 1.4
      const charsPerLine = Math.max(1, Math.floor(widthIn / avgCharWidthIn))
      totalLines += Math.max(1, Math.ceil(rawLine.length / charsPerLine))
    }
  }
  return totalLines > 1 ? totalLines + 1 : totalLines
}

/** Bullet list using literal "■ " prefixes (matches the source content strings exactly). */
export function addBulletList(
  slide: Slide,
  lines: string[],
  opts: { x: number; y: number; w: number; h: number; fontSize?: number; color?: string; lineSpacingMultiple?: number },
) {
  const clean = lines.filter(Boolean)
  if (clean.length === 0) return
  slide.addText(
    clean.map(line => ({ text: `■ ${line.replace(/^■\s?/, '')}`, options: { breakLine: true } })),
    {
      x: opts.x, y: opts.y, w: opts.w, h: opts.h,
      fontFace: FONT.REG, fontSize: opts.fontSize ?? 12, color: opts.color ?? COLORS.gray3,
      align: 'left', valign: 'top',
      lineSpacingMultiple: opts.lineSpacingMultiple ?? 1.5,
    },
  )
}

/** Simple data table (header row + body rows), drawn as manual rect+text cells rather than
 *  pptxgenjs's native `addTable()` — every other grid/card in this report is built the same
 *  hand-drawn way, and it keeps table rendering on the one OOXML codepath (shapes + text) that's
 *  actually been verified not to trigger PowerPoint's repair dialog (see addRoundedCard). */
export function addDataTable(
  slide: Slide,
  opts: {
    x: number; y: number; w: number; h: number
    headers: string[]
    rows: (string | { text: string; hyperlink?: string; align?: 'left' | 'center' | 'right' })[][]
    colWidths?: number[]
    fontSize?: number
    headerFontSize?: number
    totalRowIndices?: number[]
    align?: 'left' | 'center' | 'right'
  },
) {
  const headerH = Math.min(0.28, opts.h * 0.25)
  const rowCount = opts.rows.length
  const bodyH = opts.h - headerH
  const rowH = rowCount > 0 ? bodyH / rowCount : 0
  const cols = opts.headers.length
  const widths = opts.colWidths ?? Array(cols).fill(1 / cols)
  const colX: number[] = []
  let acc = opts.x
  for (const wFrac of widths) { colX.push(acc); acc += wFrac * opts.w }

  slide.addShape('rect', {
    x: opts.x, y: opts.y, w: opts.w, h: headerH,
    fill: { color: COLORS.badgeBg }, line: { color: 'B8CFD8', width: 0.5 },
  })
  opts.headers.forEach((h, ci) => {
    slide.addText(h, {
      x: colX[ci], y: opts.y, w: widths[ci] * opts.w, h: headerH,
      align: 'center', valign: 'middle', fontFace: FONT.REG, fontSize: opts.headerFontSize ?? opts.fontSize ?? 9,
      bold: true, color: COLORS.badgeTx,
    })
  })

  opts.rows.forEach((row, ri) => {
    const y = opts.y + headerH + ri * rowH
    const isTotal = opts.totalRowIndices?.includes(ri) ?? false
    const zebra = ri % 2 === 1
    slide.addShape('rect', {
      x: opts.x, y, w: opts.w, h: rowH,
      fill: { color: isTotal ? 'E8F2F5' : zebra ? 'F5F9FA' : 'FFFFFF' },
      line: { color: 'E5EDF0', width: 0.5 },
    })
    row.forEach((cell, ci) => {
      const cellObj = typeof cell === 'string' ? { text: cell } : cell
      slide.addText(cellObj.text, {
        x: colX[ci], y, w: widths[ci] * opts.w, h: rowH,
        align: cellObj.align ?? opts.align ?? 'center', valign: 'middle',
        fontFace: FONT.REG, fontSize: opts.fontSize ?? 9, bold: isTotal, color: COLORS.ink,
        hyperlink: cellObj.hyperlink ? { url: cellObj.hyperlink } : undefined,
      })
    })
  })
}

/** "›" chevron glyph used between connected process-step cards. */
export function addChevronConnector(slide: Slide, opts: { x: number; y: number; w: number; h: number }) {
  slide.addText('›', {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h,
    align: 'center', valign: 'middle',
    fontFace: FONT.SANS, fontSize: 20, color: COLORS.chevron,
  })
}

/** Rounded progress-bar track + fill, matching `.rslide__cp-progress`. */
export function addProgressBar(
  slide: Slide,
  opts: { x: number; y: number; w: number; h?: number; pct: number; barColor?: string; trackColor?: string },
) {
  const h = opts.h ?? 0.06
  const pct = Math.max(0, Math.min(100, opts.pct))
  slide.addShape('roundRect', {
    x: opts.x, y: opts.y, w: opts.w, h, rectRadius: 0.5,
    fill: { color: opts.trackColor ?? 'E8EEF1' }, line: { type: 'none' },
  })
  if (pct > 0) {
    slide.addShape('roundRect', {
      x: opts.x, y: opts.y, w: opts.w * (pct / 100), h, rectRadius: 0.5,
      fill: { color: opts.barColor ?? COLORS.accent }, line: { type: 'none' },
    })
  }
}

/** Doughnut chart (channel split), rendered to a canvas and embedded as a PNG rather than a
 *  native pptxgenjs chart (`addChart` embeds a whole separate chart XML part + an Excel
 *  workbook part) — one more complex OOXML subsystem this report doesn't need, and one more
 *  surface for a PowerPoint "needs repair" prompt. Legend is drawn separately to match layout. */
export function addDoughnutChart(
  slide: Slide,
  segments: { label: string; pct: number; color: string }[],
  opts: { x: number; y: number; w: number; h: number },
) {
  const DPR = 2
  const pxW = Math.round(opts.w * 96 * DPR)
  const pxH = Math.round(opts.h * 96 * DPR)
  const canvas = document.createElement('canvas')
  canvas.width = pxW
  canvas.height = pxH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const cx = pxW / 2
  const cy = pxH / 2
  const outerR = Math.min(pxW, pxH) / 2
  const holeR = outerR * 0.62
  const total = segments.reduce((sum, seg) => sum + seg.pct, 0) || 1
  let angle = -Math.PI / 2
  for (const seg of segments) {
    const sweep = (seg.pct / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, outerR, angle, angle + sweep)
    ctx.closePath()
    ctx.fillStyle = `#${seg.color}`
    ctx.fill()
    angle += sweep
  }
  // Punch a transparent hole to turn the pie into a doughnut.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(cx, cy, holeR, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'

  slide.addImage({ data: canvas.toDataURL('image/png'), x: opts.x, y: opts.y, w: opts.w, h: opts.h })
}

/** Manual legend to sit beside the doughnut (colored dot + label + pct), matching `.rslide__cp-legend`. */
export function addLegend(
  slide: Slide,
  segments: { label: string; pct: number; color: string }[],
  opts: { x: number; y: number; w: number; rowH?: number },
) {
  const rowH = opts.rowH ?? 0.24
  segments.forEach((seg, i) => {
    const y = opts.y + i * rowH
    slide.addShape('ellipse', {
      x: opts.x, y: y + rowH / 2 - 0.05, w: 0.1, h: 0.1,
      fill: { color: seg.color }, line: { type: 'none' },
    })
    slide.addText(seg.label, {
      x: opts.x + 0.2, y, w: opts.w - 0.7, h: rowH,
      fontFace: FONT.REG, fontSize: 9, color: COLORS.gray3, valign: 'middle',
    })
    slide.addText(`${seg.pct}%`, {
      x: opts.x + opts.w - 0.5, y, w: 0.5, h: rowH,
      fontFace: FONT.REG, fontSize: 9, bold: true, color: COLORS.ink, valign: 'middle', align: 'right',
    })
  })
}

/** Shared logo + eng/kor header block used on every non-cover, non-outro slide. */
export function addContentChrome(slide: Slide, engTitle: string | undefined, korTitle: string | undefined) {
  slide.background = { color: COLORS.bg }
  const logoW = 1.1
  addLogoImage(slide, { x: SLIDE_W - 0.5 - logoW, y: 0.32, w: logoW, h: logoW * LOGO_ASPECT })
  slide.addText(engTitle ?? '', {
    x: 0.5, y: 0.35, w: 7.5, h: 0.3,
    fontFace: FONT.BOLD, fontSize: 13, color: COLORS.teal,
  })
  slide.addText(korTitle ?? '', {
    x: 0.5, y: 0.63, w: 8.5, h: 0.4,
    fontFace: FONT.EB, fontSize: 19, color: COLORS.ink,
  })
}

/** Content-layer inset used by all non-cover/outro slides (x, y, w, h in inches). */
export const CONTENT_BOX = { x: 0.5, y: 1.1, w: 9.0, h: 3.9 }
