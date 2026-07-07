import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, FileText, GripVertical, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import { formatKstShortDate } from '@/lib/kst-time'
import { supabase } from '@/lib/supabase'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import { PAGE_TYPE_LABELS, DEFAULT_CONTENT, type ReportPage, type PageContent, type PageType } from './report-slides/types'
import ReportSlides from './report-slides/ReportSlides'
import Spinner from '@/components/Spinner'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { PageTabs } from '@/components/ui'
import { PAGE_HERO_DEFAULT_BG } from '@/components/page-hero-banner.constants'
import '@/pages/brand/confirmed/archive/archive.css'
import './web-archive/season-collection.css'
import { loadSeasonBrands, type SeasonBrandItem } from './web-archive/load-season-brands'
import { getSeasonCollectionCopy, conceptTitleFromProjectConcept, splitArchiveParagraphs } from './season-collection-content'
import {
  loadStorageImageUrl,
  removeCollectionImg,
  uploadCollectionImg,
} from './season-collection-images'
import { brandNameToSlug } from '@/pages/brand/confirmed/archive/slug'
import { useArchivePhase } from '../use-archive-phase'
import { designCoverPath } from '../design/design-archive-images'

async function resolveSeasonHeroUrl(phase: {
  design_theme_img?: string | null
  collection_img?: string | null
}) {
  const coverPath = designCoverPath(phase)
  if (coverPath) {
    const url = await loadStorageImageUrl(coverPath)
    if (url) return url
  }
  return PAGE_HERO_DEFAULT_BG
}

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

function defaultBrandDesc(brand: SeasonBrandItem) {
  return `${brand.brandName} — a Mi Muse kit partner brand selected for this season's creator collection.`
}

function ProductCard({
  brand,
  editMode,
}: {
  brand: SeasonBrandItem
  editMode: boolean
}) {
  const productKo = brand.product?.trim()
  const productEn = brand.productEn?.trim()
  const primaryTitle = productEn || productKo || brand.brandName
  const secondaryTitle = productEn && productKo ? productKo : null
  const desc = (brand.description?.trim() || defaultBrandDesc(brand))
  const archiveSlug = encodeURIComponent(brandNameToSlug(brand.brandName))
  const archivePath = `/brand/confirmed/archive/${archiveSlug}`

  return (
    <article className="season-collection__product">
      <div className="season-collection__product-media">
        {brand.imageUrl ? (
          <img src={brand.imageUrl} alt={primaryTitle} />
        ) : (
          <span className="season-collection__product-placeholder">
            대표 이미지 없음
          </span>
        )}
      </div>
      <div className="season-collection__product-copy">
        <div className="season-collection__product-brand-block">
          <span className="season-collection__product-brand">{brand.brandName}</span>
          {secondaryTitle && (
            <p className="season-collection__product-title-sub">{secondaryTitle}</p>
          )}
        </div>
        <h3 className="season-collection__product-title">{primaryTitle}</h3>
        <p className="season-collection__product-desc">{desc}</p>
        {editMode && (
          <Link to={archivePath} className="season-collection__archive-link">
            <ExternalLink size={12} />
            브랜드 자료 아카이브에서 편집
          </Link>
        )}
      </div>
    </article>
  )
}

export default function ArchiveBrandReportPhase() {
  const { phase, phasesLoading } = useArchivePhase()
  const { phases, refreshPhases } = usePhase()
  const { phaseName } = useParams<{ phaseName: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const resolvedPhaseId = phase?.id ?? null
  const { showToast, showConfirm } = useToast()

  const activeTab: 'website' | 'report' = location.pathname.endsWith('/season-report') ? 'report' : 'website'

  const [brands, setBrands] = useState<SeasonBrandItem[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [phaseArchiveDesc, setPhaseArchiveDesc] = useState('')
  const [phaseProjectConcept, setPhaseProjectConcept] = useState('')
  const [editSnapshot, setEditSnapshot] = useState<{
    title: string
    archiveDesc: string
  } | null>(null)
  const [heroPath, setHeroPath] = useState<string | null>(null)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [heroLoading, setHeroLoading] = useState(true)
  const [overviewKitUrl, setOverviewKitUrl] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [pptDownloading, setPptDownloading] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const downloadMenuRef = useRef<HTMLDivElement>(null)
  const [reportPages, setReportPages] = useState<ReportPage[]>([])
  const [reportRows, setReportRows] = useState<MonitoringRow[]>([])
  const [reportConfirmedBrands, setReportConfirmedBrands] = useState<{ name: string; nameEn: string }[]>([])
  const [reportEditMode, setReportEditMode] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

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

  async function handleDownloadPdf() {
    if (!phase || pdfDownloading) return

    if (reportEditMode) {
      showToast('편집 모드를 종료한 후 다운로드해 주세요.', 'info')
      return
    }

    const sourceSlidesEl = document.querySelector<HTMLElement>('.season-report .report-slides')
    if (!sourceSlidesEl || sourceSlidesEl.querySelectorAll('.rslide').length === 0) {
      showToast('슬라이드가 보이지 않습니다. 리포트 탭을 먼저 열어주세요.', 'info')
      return
    }

    setPdfDownloading(true)
    try {
      // Collect all CSS rules from the current page so slides render identically
      const cssTexts: string[] = []
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            cssTexts.push(rule.cssText)
          }
        } catch {
          if (sheet.href) cssTexts.push(`@import url('${sheet.href}');`)
        }
      }

      const slidesHtml = sourceSlidesEl.innerHTML
      const pdfTitle = `[Mi Muse] 미국 뷰티 인플루언서 대상 ${phase.name} 시딩 프로젝트 결과 리포트`
      const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${pdfTitle}</title>
<base href="${window.location.origin}/">
<style>${cssTexts.join('\n')}</style>
<style>
@page { size: 960px 540px; margin: 0; }
*, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body { margin: 0; padding: 0; width: 960px; background: #F8F6F6; }
.report-slides { display: flex !important; flex-direction: column !important; width: 960px !important; gap: 0 !important; padding: 0 !important; overflow: visible !important; }
.rslide { width: 960px !important; height: 540px !important; flex-shrink: 0 !important; page-break-after: always; break-after: page; border-radius: 0 !important; overflow: hidden !important; transform: none !important; }
.rslide__content-layer { height: 100% !important; box-sizing: border-box !important; overflow: hidden !important; }
.rslide__np { flex: 1 !important; min-height: 0 !important; overflow: hidden !important; }
.rslide__np-bottom { margin-top: 0 !important; gap: 0.8cqw !important; }
.rslide__np-cards { min-height: 0 !important; }
.rslide__np-card { padding: 0.6cqw 1cqw !important; gap: 0.4cqw !important; }
.rslide__np-card-bullet { font-size: 11px !important; line-height: 1.5 !important; }
.rslide__kit-cell--concept { overflow: visible !important; }
.rslide__kit-concept-text { font-size: 12px !important; line-height: 1.72 !important; overflow: visible !important; }
</style>
</head>
<body><div class="report-slides">${slidesHtml}</div></body>
</html>`

      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:960px;height:540px;border:none;visibility:hidden;'
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document
      if (!iframeDoc) {
        document.body.removeChild(iframe)
        showToast('PDF 출력 준비 중 오류가 발생했습니다.', 'error')
        return
      }

      iframeDoc.open()
      iframeDoc.write(printHtml)
      iframeDoc.close()

      iframe.addEventListener('load', () => {
        const imgs = Array.from(iframeDoc.querySelectorAll<HTMLImageElement>('img'))
        const waitAll = imgs.map(img =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res() })
        )
        Promise.all(waitAll).then(() => {
          setTimeout(() => {
            const prevTitle = document.title
            document.title = pdfTitle
            iframe.contentWindow?.print()
            document.title = prevTitle
            setTimeout(() => document.body.removeChild(iframe), 1000)
          }, 200)
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('PDF generation error:', msg, e)
      showToast(`PDF 오류: ${msg.slice(0, 80)}`, 'error')
    } finally {
      setPdfDownloading(false)
    }
  }

  async function handleDownloadPpt() {
    if (!phase || pptDownloading) return
    if (reportEditMode) { showToast('편집 모드를 종료한 후 다운로드해 주세요.', 'info'); return }
    const sourceSlidesEl = document.querySelector<HTMLElement>('.season-report .report-slides')
    if (!sourceSlidesEl || sourceSlidesEl.querySelectorAll('.rslide').length === 0) {
      showToast('슬라이드가 보이지 않습니다. 리포트 탭을 먼저 열어주세요.', 'info'); return
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
      inner.className = 'report-slides'
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

        // ── Hide text + product img block, capture background ─────────────
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

        const pptSlide = prs.addSlide()
        pptSlide.addImage({ data: bgUrl, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H })

        for (const ovImg of ovImgItems) {
          pptSlide.addImage({ data: ovImg.data, x: ovImg.x, y: ovImg.y, w: ovImg.w, h: ovImg.h })
        }

        for (const item of textItems) {
          const safeText = item.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          if (!safeText) continue
          pptSlide.addText(safeText, {
            x: item.x, y: item.y, w: item.w, h: item.h,
            fontSize: item.fontSize, color: item.colorHex,
            bold: item.bold, italic: item.italic, align: item.align,
            valign: 'middle', margin: 0, wrap: true,
          })
        }
      }

      const pptTitle = `[Mi Muse] 미국 뷰티 인플루언서 대상 ${phase.name} 시딩 프로젝트 결과 리포트`
      await prs.writeFile({ fileName: `${pptTitle}.pptx` })
      document.body.removeChild(wrapper)
    } catch (e) {
      showToast(`PPT 오류: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`, 'error')
    } finally {
      setPptDownloading(false)
    }
  }

  const reloadBrands = useCallback(async () => {
    if (!resolvedPhaseId) {
      setBrands([])
      setBrandsLoading(false)
      return
    }
    setBrandsLoading(true)
    const rows = await loadSeasonBrands(resolvedPhaseId)
    setBrands(rows)
    setBrandsLoading(false)
  }, [resolvedPhaseId])

  useEffect(() => {
    void reloadBrands()
  }, [reloadBrands])

  useEffect(() => {
    if (!resolvedPhaseId) {
      setPhaseArchiveDesc('')
      setPhaseProjectConcept('')
      setHeroPath(null)
      setHeroUrl(null)
      setOverviewKitUrl(null)
      setHeroLoading(false)
      return
    }

    let cancelled = false
    setHeroLoading(true)

    void (async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('collection_img, archive_desc, project_concept, design_kit_box_img, design_theme_img')
        .eq('id', resolvedPhaseId)
        .maybeSingle()
      if (cancelled) return

      if (error) {
        if (!cancelled && phase) {
          const url = await resolveSeasonHeroUrl({
            design_theme_img: phase.design_theme_img,
            collection_img: phase.collection_img,
          })
          setHeroPath(phase.collection_img)
          setHeroUrl(url)
          setOverviewKitUrl(await loadStorageImageUrl(phase.design_kit_box_img))
        }
        setHeroLoading(false)
        return
      }

      const projectConcept = (data?.project_concept as string | null) ?? phase?.project_concept ?? null
      setPhaseArchiveDesc((data?.archive_desc as string | null) ?? '')
      setPhaseProjectConcept(conceptTitleFromProjectConcept(projectConcept))
      const collectionPath = (data?.collection_img as string | null) ?? phase?.collection_img ?? null
      const designThemePath = (data?.design_theme_img as string | null) ?? phase?.design_theme_img ?? null
      setHeroPath(collectionPath)
      const [url, kitUrl] = await Promise.all([
        resolveSeasonHeroUrl({
          design_theme_img: designThemePath,
          collection_img: collectionPath,
        }),
        loadStorageImageUrl(
          (data?.design_kit_box_img as string | null) ?? phase?.design_kit_box_img ?? null,
        ),
      ])
      if (!cancelled) {
        setHeroUrl(url)
        setOverviewKitUrl(kitUrl)
        setHeroLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [resolvedPhaseId, phase?.project_concept, phase?.collection_img, phase?.design_theme_img, phase?.design_kit_box_img])

  const DEFAULT_PAGE_ORDER: PageType[] = [
    'cover', 'project_overview', 'kit_composition', 'content_performance',
    'best_review', 'best_review_detail', 'brand_mention', 'next_project', 'outro',
  ]

  useEffect(() => {
    if (activeTab !== 'report' || !resolvedPhaseId) return
    let cancelled = false
    setReportLoading(true)
    void (async () => {
      try {
        const [{ data }, { rows }, { data: cbData }, { data: kwData }] = await Promise.all([
          supabase.from('report_pages').select('*').eq('phase_id', resolvedPhaseId).order('order_index'),
          loadMonitoringData(resolvedPhaseId),
          supabase.from('confirmed_brands').select('brand_name').eq('phase_id', resolvedPhaseId),
          supabase.from('monitoring_keywords').select('brand, keywords, phase_id').eq('phase_id', resolvedPhaseId),
        ])
        if (cancelled) return

        let pages = (data as ReportPage[]) ?? []

        // Auto-create all default pages when none exist yet
        if (pages.length === 0) {
          const inserts = DEFAULT_PAGE_ORDER.map((type, i) => ({
            phase_id: resolvedPhaseId,
            order_index: i,
            type,
            content: DEFAULT_CONTENT[type],
          }))
          const { data: newPages } = await supabase.from('report_pages').insert(inserts).select()
          if (!cancelled) pages = (newPages as ReportPage[]) ?? []
        }

        if (!cancelled) {
          setReportPages(pages)
          setReportRows(rows)
          const kwRows: { brand: string; keywords: string[] | null }[] = (kwData ?? [])
          const isAscii = (s: string) => /^[a-z0-9][a-z0-9_\s-]*$/i.test(s.trim())
          const brands = ((cbData ?? []) as { brand_name: string }[]).map((r, i) => {
            const korLower = r.brand_name.trim().toLowerCase()
            const korKey = r.brand_name.trim().toLowerCase().replace(/\s+/g, '_')
            const kwRow =
              kwRows.find(k => Array.isArray(k.keywords) && k.keywords.some(kw => kw.toLowerCase() === korLower)) ??
              kwRows.find(k => k.brand === korKey || k.brand === korLower) ??
              kwRows.filter(k => k.brand !== 'mimuse')[i]
            let nameEn = r.brand_name
            if (kwRow) {
              if (isAscii(kwRow.brand) && kwRow.brand.toLowerCase() !== korLower && kwRow.brand.toLowerCase() !== korKey) {
                nameEn = kwRow.brand
              } else {
                const engKw = (kwRow.keywords ?? []).find(kw => isAscii(kw) && kw.toLowerCase() !== korLower && kw.toLowerCase() !== korKey)
                if (engKw) nameEn = engKw
              }
            }
            return { name: r.brand_name, nameEn }
          })
          setReportConfirmedBrands(brands)
        }
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeTab, resolvedPhaseId])

  function buildProjectConceptForSave(title: string, existingConcept?: string | null, archiveDesc?: string) {
    const trimmedTitle = title.trim()
    const restParagraphs = splitArchiveParagraphs(existingConcept).slice(1)
    const hasArchiveDesc = Boolean(archiveDesc?.trim())

    if (hasArchiveDesc) return trimmedTitle || null
    if (restParagraphs.length) {
      return trimmedTitle
        ? [trimmedTitle, ...restParagraphs].join('\n\n')
        : restParagraphs.join('\n\n')
    }
    return trimmedTitle || null
  }

  function cancelEditMode() {
    if (editSnapshot) {
      setPhaseProjectConcept(editSnapshot.title)
      setPhaseArchiveDesc(editSnapshot.archiveDesc)
    }
    setEditSnapshot(null)
    setEditMode(false)
  }

  function handleTabChange(tab: 'website' | 'report') {
    if (tab !== 'website' && editMode) cancelEditMode()
    navigate(`/archive/${phaseName}/${tab === 'report' ? 'season-report' : 'season-web'}`)
  }

  async function handleUpdateReportPage(page: ReportPage) {
    await supabase.from('report_pages').update({ content: page.content }).eq('id', page.id)
    setReportPages(prev => prev.map(p => p.id === page.id ? page : p))
  }

  async function addReportPage(type: PageType) {
    if (!resolvedPhaseId) return
    setAddOpen(false)
    const maxOrder = reportPages.reduce((m, p) => Math.max(m, p.order_index), -1)
    const { data, error } = await supabase
      .from('report_pages')
      .insert({ phase_id: resolvedPhaseId, order_index: maxOrder + 1, type, content: DEFAULT_CONTENT[type] })
      .select()
      .single()
    if (error) {
      showToast(error.code === '42P01' ? 'report_pages 테이블이 없습니다.' : `저장 오류: ${error.message}`, 'error')
      return
    }
    if (data) setReportPages(prev => [...prev, data as ReportPage])
  }

  async function handleReorderPages(fromId: string, toId: string) {
    if (fromId === toId) return
    const sorted = [...reportPages].sort((a, b) => a.order_index - b.order_index)
    const fromIdx = sorted.findIndex(p => p.id === fromId)
    const toIdx = sorted.findIndex(p => p.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const updated = reordered.map((p, i) => ({ ...p, order_index: i }))
    setReportPages(updated)
    await Promise.all(updated.map(p =>
      supabase.from('report_pages').update({ order_index: p.order_index }).eq('id', p.id)
    ))
  }

  function scrollToSlide(idx: number) {
    const slides = document.querySelectorAll('.report-slides .rslide')
    slides[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function deleteReportPage(id: string, label: string) {
    showConfirm(`「${label}」 페이지를 삭제하시겠습니까?`, () => {
      void (async () => {
        const { error } = await supabase.from('report_pages').delete().eq('id', id)
        if (error) { showToast(error.message, 'error'); return }
        setReportPages(prev => prev.filter(p => p.id !== id))
      })()
    })
  }

  const isUploading = uploadingHero
  const isBusy = isUploading || saving

  function startEditMode() {
    const title = phaseProjectConcept || conceptTitleFromProjectConcept(phase?.project_concept)
    setPhaseProjectConcept(title)
    setEditSnapshot({ title, archiveDesc: phaseArchiveDesc })
    setEditMode(true)
  }

  async function handleSaveEdit() {
    if (!resolvedPhaseId || !phase || saving) return
    setSaving(true)
    try {
      const archiveDescValue = phaseArchiveDesc.trim() || null
      const projectConceptValue = buildProjectConceptForSave(
        phaseProjectConcept,
        phase.project_concept,
        phaseArchiveDesc,
      )

      const { error: phaseErr } = await supabase
        .from('phases')
        .update({
          archive_desc: archiveDescValue,
          project_concept: projectConceptValue,
        })
        .eq('id', resolvedPhaseId)
      if (phaseErr) {
        showToast(phaseErr.message, 'error')
        return
      }

      await refreshPhases()
      setEditSnapshot(null)
      await reloadBrands()
      setEditMode(false)
      showToast('저장되었습니다', 'success')
    } finally {
      setSaving(false)
    }
  }

  async function handleHeroUpload(file: File | undefined) {
    if (!resolvedPhaseId || !file || uploadingHero) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다', 'error')
      return
    }

    setUploadingHero(true)
    try {
      const { path, error } = await uploadCollectionImg(resolvedPhaseId, file, heroPath)
      if (error || !path) {
        showToast(error ?? '업로드 실패', 'error')
        return
      }

      const url = await resolveSeasonHeroUrl({
        design_theme_img: phase?.design_theme_img,
        collection_img: path,
      })
      setHeroPath(path)
      setHeroUrl(url)
      showToast('히어로 이미지가 업로드되었습니다', 'success')
    } finally {
      setUploadingHero(false)
    }
  }

  function handleHeroRemove() {
    if (!resolvedPhaseId || !heroPath || isBusy) return
    showConfirm('히어로 이미지를 삭제하시겠습니까?', () => {
      void (async () => {
        setUploadingHero(true)
        try {
          const { error } = await removeCollectionImg(resolvedPhaseId, heroPath)
          if (error) {
            showToast(error, 'error')
            return
          }
          setHeroPath(null)
          setHeroUrl(await resolveSeasonHeroUrl({
            design_theme_img: phase?.design_theme_img,
            collection_img: null,
          }))
          showToast('히어로 이미지가 삭제되었습니다', 'success')
        } finally {
          setUploadingHero(false)
        }
      })()
    })
  }

  if (phasesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  if (!phase) {
    return (
      <div className="page page--fill">
        <div className="brand-archive-empty">
          시즌을 찾을 수 없습니다.
          <div style={{ marginTop: 16 }}>
            <Link to="/archive">아카이브로 돌아가기</Link>
          </div>
        </div>
      </div>
    )
  }

  const displayConcept = phaseProjectConcept.trim() || phase.project_concept
  const copy = getSeasonCollectionCopy(
    phase.name,
    brands.length,
    displayConcept,
    phaseArchiveDesc,
  )
  const contentLoading = brandsLoading || heroLoading

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title={`${phase.name} 시즌 컬렉션`}
          description="차수별 시즌 개요·키트 구성·콘텐츠 성과를 작성하고 웹사이트 아카이브 정보를 관리합니다."
        />
      </PageHeroBanner>

      {contentLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : (
        <>
          <PageTabs
            tabs={[
              { id: 'website', label: '웹사이트 아카이브' },
              { id: 'report', label: '결과 리포트' },
            ]}
            active={activeTab}
            onChange={handleTabChange}
          />
          <div className="ftab-content">
            {activeTab === 'website' ? (
              <div className={`season-collection${editMode ? ' season-collection--edit' : ''}`}>
                <div className="season-collection__edit-controls">
                  {editMode ? (
                    <>
                      <button
                        type="button"
                        className="cfg-btn cfg-btn--ghost"
                        disabled={isBusy}
                        onClick={cancelEditMode}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="cfg-btn"
                        disabled={isBusy}
                        onClick={() => { void handleSaveEdit() }}
                      >
                        <Save size={13} />
                        {saving ? '저장 중…' : '저장'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="cfg-btn cfg-btn--ghost"
                      onClick={startEditMode}
                    >
                      <Pencil size={13} />
                      편집
                    </button>
                  )}
                </div>
                <section className="season-collection__hero">
            <div className={`season-collection__hero-media${editMode ? ' season-collection__media-edit' : ''}`}>
              {heroUrl ? (
                <img src={heroUrl} alt={copy.title} />
              ) : (
                <span className="season-collection__hero-placeholder">
                  {editMode ? '히어로 이미지 업로드' : '커버 이미지 없음'}
                </span>
              )}
              {editMode && (
                <div className="season-collection__media-edit-actions">
                  <label className="cfg-btn cfg-btn--ghost season-collection__media-btn">
                    <Upload size={13} />
                    {uploadingHero ? '처리 중…' : '업로드'}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={isBusy}
                      onChange={e => {
                        void handleHeroUpload(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {heroPath && (
                    <button
                      type="button"
                      className="cfg-btn cfg-btn--ghost season-collection__media-btn"
                      disabled={isBusy}
                      onClick={handleHeroRemove}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="season-collection__hero-copy">
              <span className="season-collection__volume">{copy.volume}</span>
              {editMode ? (
                <input
                  type="text"
                  className="season-collection__edit-title"
                  value={phaseProjectConcept}
                  onChange={e => setPhaseProjectConcept(e.target.value)}
                  placeholder={getSeasonCollectionCopy(phase.name, brands.length).title}
                />
              ) : (
                <h1 className="season-collection__title">{copy.title}</h1>
              )}
              {editMode ? (
                <textarea
                  className="season-collection__edit-textarea season-collection__edit-textarea--intro"
                  value={phaseArchiveDesc}
                  onChange={e => setPhaseArchiveDesc(e.target.value)}
                  placeholder={'시즌 소개 문단을 입력하세요.\n\n문단 사이는 빈 줄로 구분합니다.'}
                  rows={8}
                />
              ) : (
                <div className="season-collection__intro">
                  {copy.intro.map(paragraph => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          </section>

          {brands.length > 0 ? (
            <section>
              <div className="season-collection__kit-head">
                <h2 className="season-collection__kit-heading">{copy.kitHeading}</h2>
                {editMode && (
                  <span className="season-collection__kit-edit-hint">
                    브랜드별 제품 정보는{' '}
                    <Link to="/brand/confirmed/archive">자료 아카이브</Link>
                    에서 수정할 수 있습니다.
                  </span>
                )}
              </div>
              <div className="season-collection__products">
                {brands.map(brand => (
                  <ProductCard
                    key={brand.id}
                    brand={brand}
                    editMode={editMode}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="brand-archive-empty">
              이 시즌에 등록된 확정 브랜드가 없습니다.<br />
              <strong>확정 브랜드 → 브랜드 관리</strong>에서 브랜드를 추가하세요.
            </div>
          )}

              </div>
            ) : (
              <>
                <div className="season-report__controls">
                  <button
                    type="button"
                    className={`cfg-btn${reportEditMode ? ' cfg-btn--blue' : ' cfg-btn--ghost'}`}
                    onClick={() => setReportEditMode(m => !m)}
                  >
                    <Pencil size={13} />
                    {reportEditMode ? '편집 완료' : '편집'}
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
                <div className={reportEditMode ? 'season-report__edit-layout' : ''}>
                  {reportEditMode && (() => {
                    const sorted = [...reportPages].sort((a, b) => a.order_index - b.order_index)
                    return (
                      <div className="season-report__page-list">
                        <div className="season-report__page-add-wrap" ref={addMenuRef}>
                          <button type="button" className="season-report__page-add-btn" onClick={() => setAddOpen(o => !o)}>
                            <Plus size={12} />
                            슬라이드 추가
                          </button>
                          {addOpen && (
                            <div className="season-report__download-menu">
                              {(['best_review', 'best_review_detail'] as PageType[]).map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  className="season-report__download-item"
                                  onClick={() => { void addReportPage(t) }}
                                >
                                  {PAGE_TYPE_LABELS[t]}
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
                            onDrop={() => {
                              if (dragId) void handleReorderPages(dragId, page.id)
                              setDragId(null); setDragOverId(null)
                            }}
                            onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                          >
                            <span className="season-report__page-drag"><GripVertical size={13} /></span>
                            <span className="season-report__page-label">{PAGE_TYPE_LABELS[page.type as PageType]}</span>
                            <button
                              type="button"
                              className="season-report__page-delete"
                              onClick={e => { e.stopPropagation(); deleteReportPage(page.id, PAGE_TYPE_LABELS[page.type as PageType]) }}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  <div className="season-report">
                    {reportLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
                    ) : (
                      <ReportSlides
                        pages={reportPages}
                        rows={reportRows}
                        confirmedBrands={reportConfirmedBrands}
                        editMode={reportEditMode}
                        onUpdate={handleUpdateReportPage}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
