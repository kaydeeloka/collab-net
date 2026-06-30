import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download, ExternalLink, FileText, GripVertical, Pencil, Plus, Presentation, Save, Trash2, Upload, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import { formatKstShortDate } from '@/lib/kst-time'
import { supabase } from '@/lib/supabase'
import { pdf } from '@react-pdf/renderer'
import { loadMonitoringData, type MonitoringRow } from '@/lib/influencer/monitoring-data'
import ReportPDF from './report-builder/ReportPDF'
import { PAGE_TYPE_LABELS, DEFAULT_CONTENT, type ReportPage, type PageContent, type PageType } from './report-builder/types'
import ReportSlides from './report-slides/ReportSlides'
import Spinner from '@/components/Spinner'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { PageTabs } from '@/components/ui'
import { PAGE_HERO_DEFAULT_BG } from '@/components/page-hero-banner.constants'
import '@/pages/brand/confirmed/archive/archive.css'
import './web-archive/season-collection.css'
import './report/season-report.css'
import { loadSeasonBrands, type SeasonBrandItem } from './web-archive/load-season-brands'
import { getSeasonCollectionCopy, conceptTitleFromProjectConcept, splitArchiveParagraphs } from './season-collection-content'
import { getSeasonCollectionOverview } from './report/season-collection-overview'
import { getSeasonCollectionKitComposition } from './report/season-collection-kit-composition'
import SeasonCollectionOverview from './report/SeasonCollectionOverview'
import SeasonCollectionKitComposition from './report/SeasonCollectionKitComposition'
import SeasonCollectionContentPerformance from './report/SeasonCollectionContentPerformance'
import SeasonReviewHighlights from './report/SeasonReviewHighlights'
import SeasonBrandMentions from './report/SeasonBrandMentions'
import SeasonNextStep from './report/SeasonNextStep'
import SeasonContact from './report/SeasonContact'
import SeasonReportCover from './report/SeasonReportCover'
import { getReportCoverTitle } from './report/report-cover'
import { getSeasonNextStep } from './report/season-collection-next-step'
import { REPORT_CONTACT } from './report/report-theme'
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
  const [searchParams] = useSearchParams()
  const resolvedPhaseId = phase?.id ?? null
  const { showToast, showConfirm } = useToast()

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
  const [activeTab, setActiveTab] = useState<'website' | 'report'>(
    searchParams.get('tab') === 'report' ? 'report' : 'website'
  )
  const [uploadingHero, setUploadingHero] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [reportPages, setReportPages] = useState<ReportPage[]>([])
  const [reportRows, setReportRows] = useState<MonitoringRow[]>([])
  const [reportEditMode, setReportEditMode] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const downloadRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!downloadOpen) return
    function handleClick(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [downloadOpen])

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

  async function handleDownloadPdf() {
    if (!resolvedPhaseId || !phase || pdfDownloading) return
    setDownloadOpen(false)
    setPdfDownloading(true)
    try {
      // Use in-memory state (already synced on each field blur); fall back to DB if tab hasn't loaded
      const [pages, rows] = await Promise.all([
        reportPages.length > 0
          ? Promise.resolve([...reportPages].sort((a, b) => a.order_index - b.order_index))
          : supabase.from('report_pages').select('*').eq('phase_id', resolvedPhaseId).order('order_index').then(({ data }) => (data as ReportPage[]) ?? []),
        reportRows.length > 0
          ? Promise.resolve(reportRows)
          : loadMonitoringData(resolvedPhaseId).then(r => r.rows),
      ])
      if (pages.length === 0) {
        showToast('리포트 페이지가 없습니다. 편집 버튼으로 먼저 페이지를 추가하세요.', 'info')
        return
      }
      const pdfInstance = pdf(<ReportPDF phaseName={phase.name} pages={pages} rows={rows} />)
      const blob = await Promise.race([
        pdfInstance.toBlob(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PDF 생성 시간 초과 (30초). 배경 이미지 경로를 확인해 주세요.')), 30_000)
        ),
      ])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MiMuse_${phase.name}_Report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF generation error:', e)
      showToast('PDF 생성 중 오류가 발생했습니다', 'error')
    } finally {
      setPdfDownloading(false)
    }
  }

  async function handleDownloadPpt() {
    setDownloadOpen(false)
    try {
      const { default: PptxGenJS } = await import('pptxgenjs')
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_16x9'

      const TEAL_DK = '648085'
      const TEAL_LT = 'BED6DE'
      const INK = '040000'
      const SURFACE = 'F8F6F6'

      const coverSlide = pptx.addSlide()
      coverSlide.background = { color: SURFACE }
      coverSlide.addText('MI MUSE', {
        x: 0.8, y: 0.5, w: 8.4, h: 0.3,
        fontSize: 10, color: TEAL_DK, charSpacing: 3,
      })
      coverSlide.addText(reportCoverTitle, {
        x: 0.8, y: 1.4, w: 8.4, h: 2.5,
        fontSize: 30, bold: true, color: INK, breakLine: true,
      })
      coverSlide.addText('MI MUSE — BEAUTY SEEDING PROJECT', {
        x: 0.8, y: 4.8, w: 8.4, h: 0.3,
        fontSize: 9, color: TEAL_DK, charSpacing: 2,
      })

      const overviewSlide = pptx.addSlide()
      overviewSlide.background = { color: SURFACE }
      overviewSlide.addText(overview.heading, {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: INK,
      })
      overview.fields.forEach((field, i) => {
        const y = 1.1 + i * 0.7
        overviewSlide.addText(field.label ?? '', {
          x: 0.5, y, w: 2.3, h: 0.5,
          fontSize: 10, bold: true, color: TEAL_DK,
          fill: { color: TEAL_LT }, align: 'center', valign: 'middle',
        })
        overviewSlide.addText(field.value + (field.sub ? `\n${field.sub}` : ''), {
          x: 2.9, y, w: 6.6, h: 0.5,
          fontSize: 10, color: INK, valign: 'middle', breakLine: true,
        })
      })

      const kitSlide = pptx.addSlide()
      kitSlide.background = { color: SURFACE }
      kitSlide.addText(kitComposition.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: INK,
      })
      kitSlide.addText(kitComposition.conceptHeading, {
        x: 0.5, y: 1.1, w: 9, h: 0.38,
        fontSize: 11, bold: true, color: TEAL_DK,
        fill: { color: TEAL_LT }, align: 'center', valign: 'middle',
      })
      kitComposition.conceptParagraphs.forEach((para, i) => {
        kitSlide.addText(para, {
          x: 0.5, y: 1.62 + i * 0.42, w: 9, h: 0.38,
          fontSize: 10, color: INK,
        })
      })
      const compY = 1.62 + kitComposition.conceptParagraphs.length * 0.42 + 0.3
      kitSlide.addText(kitComposition.brandComponents.heading, {
        x: 0.5, y: compY, w: 4.3, h: 0.35,
        fontSize: 10, bold: true, color: TEAL_DK,
      })
      kitComposition.brandComponents.items.forEach((item, i) => {
        kitSlide.addText(`• ${item}`, {
          x: 0.5, y: compY + 0.4 + i * 0.35, w: 4.3, h: 0.3,
          fontSize: 10, color: INK,
        })
      })
      kitSlide.addText(kitComposition.museComponents.heading, {
        x: 5.2, y: compY, w: 4.3, h: 0.35,
        fontSize: 10, bold: true, color: TEAL_DK,
      })
      kitComposition.museComponents.items.forEach((item, i) => {
        kitSlide.addText(`• ${item}`, {
          x: 5.2, y: compY + 0.4 + i * 0.35, w: 4.3, h: 0.3,
          fontSize: 10, color: INK,
        })
      })

      const nextStepData = getSeasonNextStep(phase?.name ?? '')
      const nextSlide = pptx.addSlide()
      nextSlide.background = { color: SURFACE }
      nextSlide.addText('NEXT STEP', {
        x: 0.5, y: 0.3, w: 9, h: 0.3,
        fontSize: 10, color: TEAL_DK, charSpacing: 2,
      })
      nextSlide.addText(nextStepData.title, {
        x: 0.5, y: 0.62, w: 9, h: 0.6,
        fontSize: 20, bold: true, color: INK,
      })
      nextStepData.fields.forEach((field, i) => {
        const x = 0.5 + i * 3.05
        nextSlide.addText(field.label, {
          x, y: 1.4, w: 2.9, h: 0.35,
          fontSize: 10, bold: true, color: TEAL_DK,
          fill: { color: TEAL_LT }, align: 'center', valign: 'middle',
        })
        nextSlide.addText(field.value + (field.sub ? `\n${field.sub}` : ''), {
          x, y: 1.8, w: 2.9, h: 0.6,
          fontSize: 11, color: INK, breakLine: true,
        })
      })
      nextStepData.strategies.forEach((block, i) => {
        const x = 0.5 + i * 3.05
        nextSlide.addText(block.heading, {
          x, y: 2.7, w: 2.9, h: 0.35,
          fontSize: 11, bold: true, color: INK,
        })
        block.items.forEach((item, j) => {
          nextSlide.addText(`• ${item}`, {
            x, y: 3.1 + j * 0.5, w: 2.9, h: 0.5,
            fontSize: 9, color: INK, valign: 'top',
          })
        })
      })

      const contactSlide = pptx.addSlide()
      contactSlide.background = { color: SURFACE }
      contactSlide.addText('CONTACT', {
        x: 0.5, y: 2.1, w: 9, h: 0.4,
        fontSize: 12, color: TEAL_DK, charSpacing: 3, align: 'center',
      })
      contactSlide.addText(REPORT_CONTACT.email, {
        x: 0.5, y: 2.6, w: 9, h: 0.8,
        fontSize: 24, bold: true, color: INK, align: 'center',
      })
      contactSlide.addText('E.O.D', {
        x: 0.5, y: 3.6, w: 9, h: 0.4,
        fontSize: 11, color: TEAL_DK, charSpacing: 3, align: 'center',
      })

      await pptx.writeFile({ fileName: `${phase?.name ?? '시즌'}_결과리포트.pptx` })
      showToast('PPT 다운로드가 완료되었습니다', 'success')
    } catch {
      showToast('PPT 생성 중 오류가 발생했습니다', 'error')
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
    setActiveTab(tab)
    if (tab === 'report' && resolvedPhaseId && reportPages.length === 0) {
      setReportLoading(true)
      void Promise.all([
        supabase.from('report_pages').select('*').eq('phase_id', resolvedPhaseId).order('order_index'),
        loadMonitoringData(resolvedPhaseId),
      ]).then(([{ data }, { rows }]) => {
        setReportPages((data as ReportPage[]) ?? [])
        setReportRows(rows)
      }).finally(() => setReportLoading(false))
    }
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

  async function handleMovePageBy(id: string, dir: -1 | 1) {
    const sorted = [...reportPages].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(p => p.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sorted.length) return
    await handleReorderPages(id, sorted[newIdx].id)
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
  const overview = getSeasonCollectionOverview(
    phase.name,
    brands.map(b => b.brandName),
  )
  const kitComposition = getSeasonCollectionKitComposition(phase.name)
  const reportCoverTitle = getReportCoverTitle(phase.name, phase.started_at, phase.ended_at)
  const nextStep = getSeasonNextStep(phase.name)
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
                  {reportEditMode && (
                    <div className="season-report__download-wrap" ref={addMenuRef}>
                      <button
                        type="button"
                        className="cfg-btn cfg-btn--ghost"
                        onClick={() => setAddOpen(o => !o)}
                      >
                        <Plus size={13} />
                        추가
                      </button>
                      {addOpen && (
                        <div className="season-report__download-menu">
                          {(Object.keys(PAGE_TYPE_LABELS) as PageType[]).map(t => (
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
                  )}
                  <button
                    type="button"
                    className={`cfg-btn${reportEditMode ? ' cfg-btn--blue' : ' cfg-btn--ghost'}`}
                    onClick={() => setReportEditMode(m => !m)}
                  >
                    <Pencil size={13} />
                    {reportEditMode ? '편집 완료' : '편집'}
                  </button>
                  <div className="season-report__download-wrap" ref={downloadRef}>
                    <button
                      type="button"
                      className="cfg-btn cfg-btn--ghost"
                      onClick={() => setDownloadOpen(o => !o)}
                    >
                      <Download size={13} />
                      다운로드
                    </button>
                    {downloadOpen && (
                      <div className="season-report__download-menu">
                        <button
                          type="button"
                          className="season-report__download-item"
                          disabled={pdfDownloading}
                          onClick={() => { void handleDownloadPdf() }}
                        >
                          <FileText size={13} />
                          {pdfDownloading ? 'PDF 생성 중…' : 'PDF'}
                        </button>
                        <button
                          type="button"
                          className="season-report__download-item"
                          onClick={() => { void handleDownloadPpt() }}
                        >
                          <Presentation size={13} />
                          PPT
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
                        {sorted.map((page, idx) => (
                          <div
                            key={page.id}
                            className={`season-report__page-item${dragOverId === page.id ? ' season-report__page-item--over' : ''}${dragId === page.id ? ' season-report__page-item--dragging' : ''}`}
                            draggable
                            onDragStart={() => setDragId(page.id)}
                            onDragOver={e => { e.preventDefault(); setDragOverId(page.id) }}
                            onDrop={() => {
                              if (dragId) void handleReorderPages(dragId, page.id)
                              setDragId(null); setDragOverId(null)
                            }}
                            onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                          >
                            <span className="season-report__page-drag"><GripVertical size={13} /></span>
                            <span className="season-report__page-num">{idx + 1}</span>
                            <span className="season-report__page-label">{PAGE_TYPE_LABELS[page.type as PageType]}</span>
                            <div className="season-report__page-arrows">
                              <button type="button" disabled={idx === 0} onClick={() => void handleMovePageBy(page.id, -1)}>
                                <ChevronUp size={11} />
                              </button>
                              <button type="button" disabled={idx === sorted.length - 1} onClick={() => void handleMovePageBy(page.id, 1)}>
                                <ChevronDown size={11} />
                              </button>
                            </div>
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
