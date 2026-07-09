import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText, GripVertical, Pencil, Plus, X } from 'lucide-react'
import { Navigate, useOutletContext, useParams } from 'react-router-dom'
import { archiveBrandReportPath, archiveSectionPath, brandFromArchiveBrandSlug, isLegacyArchiveBrandIdSlug } from '../archive-slug'
import { useArchivePhase } from '../use-archive-phase'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import Spinner from '@/components/Spinner'
import type { ArchiveBrandReportOutletContext } from './layout'
import {
  BRAND_ADDABLE_TYPES,
  BRAND_DEFAULT_CONTENT,
  BRAND_DEFAULT_PAGE_ORDER,
  BRAND_PAGE_TYPE_LABELS,
  type BrandPageContent,
  type BrandPageType,
  type BrandReportPage,
} from './brand-report-types'
import BrandReportSlides from './brand-report-slides/BrandReportSlides'
import { addSanitizedSlide } from '../ppt-native'

export default function ArchiveBrandReportBrand() {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  const { phase } = useArchivePhase()
  const { phaseName, brands } = useOutletContext<ArchiveBrandReportOutletContext>()
  const { showToast, showConfirm } = useToast()

  const brand = brandFromArchiveBrandSlug(brands, brandSlug)

  const [pages, setPages] = useState<BrandReportPage[]>([])
  const [rows, setRows] = useState<MonitoringRow[]>([])
  const [sharedPages, setSharedPages] = useState<BrandReportPage[]>([])
  const [loading, setLoading] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [pptDownloading, setPptDownloading] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const downloadMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!addOpen) return
    function handleClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [addOpen])

  useEffect(() => {
    if (!downloadOpen) return
    function handleClick(e: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setDownloadOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [downloadOpen])

  const loadPages = useCallback(async () => {
    if (!phase?.id || !brand) return
    setLoading(true)
    try {
      const [{ data }, { rows: monRows }, { data: sharedData }] = await Promise.all([
        supabase
          .from('brand_report_pages')
          .select('*')
          .eq('phase_id', phase.id)
          .eq('brand_name', brand.brandName)
          .order('order_index'),
        loadMonitoringData(phase.id),
        supabase
          .from('brand_report_pages')
          .select('*')
          .eq('phase_id', phase.id)
          .eq('brand_name', '__shared__')
          .order('order_index'),
      ])

      let loaded = (data as BrandReportPage[]) ?? []
      let shared = (sharedData as BrandReportPage[]) ?? []

      // Auto-create default pages when none exist
      if (loaded.length === 0) {
        const inserts = BRAND_DEFAULT_PAGE_ORDER.map(({ type, extra }, i) => ({
          phase_id: phase.id,
          brand_name: brand.brandName,
          order_index: i,
          type,
          content: { ...BRAND_DEFAULT_CONTENT[type], ...extra },
        }))
        const { data: newPages } = await supabase
          .from('brand_report_pages')
          .insert(inserts)
          .select()
        loaded = (newPages as BrandReportPage[]) ?? []
      }

      // Ensure shared pages exist for cover + project_overview
      const sharedTypes: BrandPageType[] = ['cover', 'project_overview']
      for (const t of sharedTypes) {
        if (!shared.find(p => p.type === t)) {
          const source = loaded.find(p => p.type === t)
          const { data: newShared } = await supabase
            .from('brand_report_pages')
            .insert({
              phase_id: phase.id,
              brand_name: '__shared__',
              order_index: sharedTypes.indexOf(t),
              type: t,
              content: source?.content ?? BRAND_DEFAULT_CONTENT[t],
            })
            .select()
            .single()
          if (newShared) shared = [...shared, newShared as BrandReportPage]
        }
      }

      // Ensure shared pages exist for all review lists (matched by subtitle+offset)
      const reviewSources = loaded
        .filter(p => p.type === 'review_list')
        .sort((a, b) => a.order_index - b.order_index)
      for (const [i, source] of reviewSources.entries()) {
        const srcSubtitle = (source.content as BrandPageContent).rlSubtitle ?? 'Mi Muse 리뷰'
        const srcOffset = (source.content as BrandPageContent).rlOffset ?? 0
        if (!shared.find(s =>
          s.type === 'review_list' &&
          ((s.content as BrandPageContent).rlSubtitle ?? 'Mi Muse 리뷰') === srcSubtitle &&
          ((s.content as BrandPageContent).rlOffset ?? 0) === srcOffset
        )) {
          const { data: newShared } = await supabase
            .from('brand_report_pages')
            .insert({
              phase_id: phase.id,
              brand_name: '__shared__',
              order_index: sharedTypes.length + i,
              type: 'review_list',
              content: source.content,
            })
            .select()
            .single()
          if (newShared) shared = [...shared, newShared as BrandReportPage]
        }
      }

      setPages(loaded)
      setRows(monRows)
      setSharedPages(shared)
    } finally {
      setLoading(false)
    }
  }, [phase?.id, brand?.brandName])

  useEffect(() => { void loadPages() }, [loadPages])

  async function handleUpdatePage(page: BrandReportPage) {
    await supabase.from('brand_report_pages').update({ content: page.content }).eq('id', page.id)
    setPages(prev => prev.map(p => p.id === page.id ? page : p))
  }

  async function handleUpdateSharedPage(page: BrandReportPage) {
    await supabase.from('brand_report_pages').update({ content: page.content }).eq('id', page.id)
    setSharedPages(prev => prev.map(p => p.id === page.id ? page : p))
  }

  async function addPage(type: BrandPageType) {
    if (!phase?.id || !brand) return
    setAddOpen(false)
    const maxOrder = pages.reduce((m, p) => Math.max(m, p.order_index), -1)
    const { data, error } = await supabase
      .from('brand_report_pages')
      .insert({
        phase_id: phase.id,
        brand_name: brand.brandName,
        order_index: maxOrder + 1,
        type,
        content: BRAND_DEFAULT_CONTENT[type],
      })
      .select()
      .single()
    if (error) { showToast(error.message, 'error'); return }
    if (data) setPages(prev => [...prev, data as BrandReportPage])
  }

  async function handleReorder(fromId: string, toId: string) {
    if (fromId === toId) return
    const sorted = [...pages].sort((a, b) => a.order_index - b.order_index)
    const fromIdx = sorted.findIndex(p => p.id === fromId)
    const toIdx = sorted.findIndex(p => p.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const updated = reordered.map((p, i) => ({ ...p, order_index: i }))
    setPages(updated)
    await Promise.all(updated.map(p =>
      supabase.from('brand_report_pages').update({ order_index: p.order_index }).eq('id', p.id)
    ))
  }

  function scrollToSlide(idx: number) {
    const slides = document.querySelectorAll('.brand-report-slides .rslide')
    slides[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function deletePage(id: string, label: string) {
    showConfirm(`「${label}」 페이지를 삭제하시겠습니까?`, () => {
      void (async () => {
        const { error } = await supabase.from('brand_report_pages').delete().eq('id', id)
        if (error) { showToast(error.message, 'error'); return }
        setPages(prev => prev.filter(p => p.id !== id))
      })()
    })
  }

  async function handleDownloadPdf() {
    if (!brand || pdfDownloading) return
    if (editMode) { showToast('편집 모드를 종료한 후 다운로드해 주세요.', 'info'); return }

    const sourceSlidesEl = document.querySelector<HTMLElement>('.brand-report-slides')
    if (!sourceSlidesEl || sourceSlidesEl.querySelectorAll('.rslide').length === 0) {
      showToast('슬라이드가 보이지 않습니다.', 'info')
      return
    }

    setPdfDownloading(true)
    try {
      const cssTexts: string[] = []
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) cssTexts.push(rule.cssText)
        } catch {
          if (sheet.href) cssTexts.push(`@import url('${sheet.href}');`)
        }
      }

      const pdfTitle = `[Mi Muse] 미국 뷰티 인플루언서 대상 ${phaseName} 시딩 프로젝트 결과 리포트_${brand.brandName}`
      const printHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${pdfTitle}</title>
<base href="${window.location.origin}/">
<style>${cssTexts.join('\n')}</style>
<style>
@page { size: 960px 540px; margin: 0; }
*, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body { margin: 0; padding: 0; width: 960px; background: #EEF6FC; }
.report-slides { display: flex !important; flex-direction: column !important; width: 960px !important; gap: 0 !important; padding: 0 !important; overflow: visible !important; }
.rslide { width: 960px !important; height: 540px !important; flex-shrink: 0 !important; page-break-after: always; break-after: page; border-radius: 0 !important; overflow: hidden !important; transform: none !important; }
.rslide__content-layer { height: 100% !important; box-sizing: border-box !important; overflow: hidden !important; }
.rslide__np { flex: 1 !important; min-height: 0 !important; overflow: hidden !important; }
.rslide__np-bottom { margin-top: 0 !important; gap: 0.8cqw !important; }
.rslide__np-cards { min-height: 0 !important; }
.rslide__np-card { padding: 0.6cqw 1cqw !important; gap: 0.4cqw !important; }
.rslide__np-card-bullet { font-size: 11px !important; line-height: 1.5 !important; }
.rslide:has(.brslide__rl) .rslide__content-layer { padding-bottom: 2cqw !important; }
.brslide__rl-table td { padding-top: 0.18cqw !important; padding-bottom: 0.18cqw !important; }
.brslide__rl-table th { padding-top: 0.25cqw !important; padding-bottom: 0.25cqw !important; }
</style>
</head><body><div class="report-slides brand-report-slides">${sourceSlidesEl.innerHTML}</div></body></html>`

      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:960px;height:540px;border:none;visibility:hidden;'
      document.body.appendChild(iframe)
      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document
      if (!iframeDoc) { document.body.removeChild(iframe); showToast('PDF 출력 준비 중 오류가 발생했습니다.', 'error'); return }
      iframeDoc.open(); iframeDoc.write(printHtml); iframeDoc.close()
      iframe.addEventListener('load', () => {
        const imgs = Array.from(iframeDoc.querySelectorAll<HTMLImageElement>('img'))
        Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res() }))).then(() => {
          // Strip all id attributes so PDF viewer has no named destination to jump to
          iframeDoc.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
          setTimeout(() => {
            iframe.contentWindow?.scrollTo(0, 0)
            iframeDoc.documentElement.scrollTop = 0
            iframeDoc.body.scrollTop = 0
            const prevTitle = document.title
            document.title = pdfTitle
            iframe.contentWindow?.print()
            document.title = prevTitle
            setTimeout(() => document.body.removeChild(iframe), 1000)
          }, 300)
        })
      })
    } catch (e) {
      showToast(`PDF 오류: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`, 'error')
    } finally {
      setPdfDownloading(false)
    }
  }

  async function handleDownloadPpt() {
    if (!brand || pptDownloading) return
    if (editMode) { showToast('편집 모드를 종료한 후 다운로드해 주세요.', 'info'); return }
    const sourceSlidesEl = document.querySelector<HTMLElement>('.brand-report-slides')
    if (!sourceSlidesEl || sourceSlidesEl.querySelectorAll('.rslide').length === 0) {
      showToast('슬라이드가 보이지 않습니다.', 'info'); return
    }
    setDownloadOpen(false)
    setPptDownloading(true)
    try {
      const SKIP_TAGS = new Set(['button','select','option','input','textarea','script','style'])
      const SLIDE_W = 10
      const SLIDE_H = 5.625

      const wrapper = document.createElement('div')
      wrapper.style.cssText = 'position:fixed;top:-20000px;left:0;width:960px;'
      const inner = document.createElement('div')
      inner.className = 'report-slides brand-report-slides'
      inner.style.cssText = 'padding:0!important;gap:0!important;'
      inner.innerHTML = sourceSlidesEl.innerHTML
      wrapper.appendChild(inner)
      document.body.appendChild(wrapper)

      const imgs = Array.from(wrapper.querySelectorAll<HTMLImageElement>('img'))
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res() })))

      const slideEls = Array.from(wrapper.querySelectorAll<HTMLElement>('.rslide'))
      const [{ default: html2canvasFn }, { default: PptxGenJS }] = await Promise.all([
        import('html2canvas'),
        import('pptxgenjs'),
      ])

      const prs = new PptxGenJS()
      prs.defineLayout({ name: 'WIDE169', width: SLIDE_W, height: SLIDE_H })
      prs.layout = 'WIDE169'

      type TItem = { text: string; x: number; y: number; w: number; h: number; fontSize: number; colorHex: string; bold: boolean; italic: boolean; align: 'left' | 'center' | 'right' }
      type OvImgItem = { el: HTMLElement; data: string; x: number; y: number; w: number; h: number }

      function cssColorToHex(color: string, fallback: string) {
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        return m ? [+m[1],+m[2],+m[3]].map(n=>n.toString(16).padStart(2,'0')).join('') : fallback
      }

      for (const slideEl of slideEls) {
        const slideRect = slideEl.getBoundingClientRect()
        // ── 0. Capture product/kit image blocks as separate PPT layers ──────
        const ovImgItems: OvImgItem[] = []

        for (const sel of ['.rslide__ov-img-block', '.rslide__kit-img-cell']) {
          const imgBlock = slideEl.querySelector<HTMLElement>(sel)
          if (!imgBlock) continue
          const imgInBlock = imgBlock.querySelector<HTMLImageElement>('img')
          // Skip if no img loaded — a missing/broken image would give a white blob (the block has white bg)
          if (!imgInBlock || !imgInBlock.complete || imgInBlock.naturalWidth === 0) continue
          const r = imgBlock.getBoundingClientRect()
          if (r.width <= 1) continue
          const x = Math.max(0, (r.left - slideRect.left) / slideRect.width * SLIDE_W)
          const y = Math.max(0, (r.top - slideRect.top) / slideRect.height * SLIDE_H)
          try {
            const imgCanvas = await html2canvasFn(imgBlock, {
              scale: 2, useCORS: true, allowTaint: true, backgroundColor: null,
            })
            ovImgItems.push({
              el: imgBlock,
              data: imgCanvas.toDataURL('image/png'),
              x, y,
              w: Math.min(r.width / slideRect.width * SLIDE_W, SLIDE_W - x),
              h: Math.min(r.height / slideRect.height * SLIDE_H, SLIDE_H - y),
            })
          } catch { /* skip if canvas tainted */ }
        }

        // ── 1. Collect all leaf text nodes and their styles ──────────────
        const textItems: TItem[] = []
        const textEls: HTMLElement[] = []

        function collectTexts(node: Element) {
          for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
              const txt = child.textContent?.trim()
              if (!txt) continue
              const par = child.parentElement
              if (!par || SKIP_TAGS.has(par.tagName.toLowerCase())) continue
              const cs = window.getComputedStyle(par)
              if (cs.display === 'none' || cs.visibility === 'hidden') continue
              const r = par.getBoundingClientRect()
              if (r.width < 1 || r.height < 1) continue
              const x = (r.left - slideRect.left) / slideRect.width * SLIDE_W
              const y = (r.top - slideRect.top) / slideRect.height * SLIDE_H
              const w = Math.max(0.05, r.width / slideRect.width * SLIDE_W)
              const h = Math.max(0.05, r.height / slideRect.height * SLIDE_H)
              if (x < -0.1 || y < -0.1 || x > SLIDE_W || y > SLIDE_H) continue
              textItems.push({
                text: txt,
                x: Math.max(0, x), y: Math.max(0, y),
                w: Math.min(w, SLIDE_W - Math.max(0, x)),
                h: Math.min(h, SLIDE_H - Math.max(0, y)),
                fontSize: Math.max(6, Math.round(parseFloat(cs.fontSize) * 0.75)),
                colorHex: cssColorToHex(cs.color, '000000'),
                bold: parseInt(cs.fontWeight) >= 700,
                italic: cs.fontStyle === 'italic',
                align: cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : 'left',
              })
              if (!textEls.includes(par)) textEls.push(par)
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              collectTexts(child as Element)
            }
          }
        }
        collectTexts(slideEl)

        // ── 2. Hide text + product img block, capture background ──────────
        const savedColors = textEls.map(el => el.style.color)
        textEls.forEach(el => { el.style.color = 'transparent' })

        const savedImgVis = ovImgItems.map(i => ({ vis: i.el.style.visibility }))
        ovImgItems.forEach(i => { i.el.style.visibility = 'hidden' })

        const canvas = await html2canvasFn(slideEl, {
          scale: 2, useCORS: true, allowTaint: true,
          width: 960, height: 540, backgroundColor: '#F8F6F6',
        })
        const bgUrl = canvas.toDataURL('image/png')

        textEls.forEach((el, i) => { el.style.color = savedColors[i] })
        ovImgItems.forEach((img, i) => { img.el.style.visibility = savedImgVis[i].vis })

        // ── 3. Build PPT slide ────────────────────────────────────────────
        // addSanitizedSlide (not prs.addSlide()) so any control character that slips into
        // DB free text still gets stripped before it reaches the slide XML — see ppt-native.ts.
        const pptSlide = addSanitizedSlide(prs)
        pptSlide.addImage({ data: bgUrl, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H })

        // Product image block as a separate PPT layer
        for (const ovImg of ovImgItems) {
          if (![ovImg.x, ovImg.y, ovImg.w, ovImg.h].every(Number.isFinite)) continue
          pptSlide.addImage({ data: ovImg.data, x: ovImg.x, y: ovImg.y, w: ovImg.w, h: ovImg.h })
        }

        for (const item of textItems) {
          if (![item.x, item.y, item.w, item.h, item.fontSize].every(Number.isFinite)) continue
          pptSlide.addText(item.text, {
            x: item.x, y: item.y, w: item.w, h: item.h,
            fontSize: item.fontSize,
            color: item.colorHex,
            bold: item.bold,
            italic: item.italic,
            align: item.align,
            valign: 'middle',
            margin: 0,
            wrap: true,
          })
        }
      }

      const pptTitle = `[Mi Muse] 미국 뷰티 인플루언서 대상 ${phaseName} 시딩 프로젝트 결과 리포트_${brand.brandName}`
      await prs.writeFile({ fileName: `${pptTitle}.pptx` })
      document.body.removeChild(wrapper)
    } catch (e) {
      showToast(`PPT 오류: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`, 'error')
    } finally {
      setPptDownloading(false)
    }
  }

  if (!brand) {
    if (!phase) return null
    return <Navigate to={archiveSectionPath(phase, 'brand-report')} replace />
  }

  if (phase && isLegacyArchiveBrandIdSlug(brandSlug)) {
    return <Navigate to={archiveBrandReportPath(phase, brand, brands)} replace />
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spinner />
      </div>
    )
  }

  const sorted = [...pages].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="archive-brand-report-panel">
      {/* Controls */}
      <div className="season-report__controls">
        <button
          type="button"
          className={`cfg-btn${editMode ? ' cfg-btn--blue' : ' cfg-btn--ghost'}`}
          onClick={() => setEditMode(m => !m)}
        >
          <Pencil size={13} />
          {editMode ? '편집 완료' : '편집'}
        </button>
        <div className="season-report__download-wrap" ref={downloadMenuRef}>
          <button
            type="button"
            className="cfg-btn cfg-btn--ghost"
            disabled={pdfDownloading || pptDownloading}
            onClick={() => setDownloadOpen(o => !o)}
          >
            <FileText size={13} />
            {pdfDownloading ? 'PDF 생성 중…' : pptDownloading ? 'PPT 생성 중…' : '다운로드'}
            <ChevronDown size={11} />
          </button>
          {downloadOpen && (
            <div className="season-report__download-menu">
              <button type="button" className="season-report__download-item"
                onClick={() => { setDownloadOpen(false); void handleDownloadPdf() }}>
                PDF 다운로드
              </button>
              <button type="button" className="season-report__download-item"
                onClick={() => { void handleDownloadPpt() }}>
                PPT 다운로드
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={editMode ? 'season-report__edit-layout' : ''}>
        {/* Page list sidebar */}
        {editMode && (
          <div className="season-report__page-list">
            <div className="season-report__page-add-wrap" ref={addMenuRef}>
              <button type="button" className="season-report__page-add-btn" onClick={() => setAddOpen(o => !o)}>
                <Plus size={12} />
                슬라이드 추가
              </button>
              {addOpen && (
                <div className="season-report__download-menu">
                  {BRAND_ADDABLE_TYPES.map(t => (
                    <button key={t} type="button" className="season-report__download-item"
                      onClick={() => { void addPage(t) }}>
                      {BRAND_PAGE_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {sorted.map((page, idx) => (
              <div
                key={page.id}
                data-type={page.type}
                className={`season-report__page-item${dragOverId === page.id ? ' season-report__page-item--over' : ''}${dragId === page.id ? ' season-report__page-item--dragging' : ''}`}
                draggable
                onClick={() => scrollToSlide(idx)}
                onDragStart={() => setDragId(page.id)}
                onDragOver={e => { e.preventDefault(); setDragOverId(page.id) }}
                onDrop={() => { if (dragId) void handleReorder(dragId, page.id); setDragId(null); setDragOverId(null) }}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
              >
                <span className="season-report__page-drag"><GripVertical size={13} /></span>
                <span className="season-report__page-label">{BRAND_PAGE_TYPE_LABELS[page.type as BrandPageType]}</span>
                <button type="button" className="season-report__page-delete"
                  onClick={e => { e.stopPropagation(); deletePage(page.id, BRAND_PAGE_TYPE_LABELS[page.type as BrandPageType]) }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Slides */}

        <div className="season-report">
          <BrandReportSlides
            pages={pages}
            rows={rows}
            brandName={brand.brandName}
            brandEn={brand.brandEn ?? undefined}
            editMode={editMode}
            onUpdate={handleUpdatePage}
            sharedPages={sharedPages}
            onUpdateShared={handleUpdateSharedPage}
            onDelete={(id) => {
              const p = pages.find(x => x.id === id)
              if (p) deletePage(id, BRAND_PAGE_TYPE_LABELS[p.type as BrandPageType])
            }}
          />
        </div>
      </div>
    </div>
  )
}
