import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, FileText, GripVertical, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react'
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

  async function handleDownloadPdf() {
    if (!phase || pdfDownloading) return

    if (reportEditMode) {
      showToast('편집 모드를 종료한 후 다운로드해 주세요.', 'info')
      return
    }

    const sourceSlidesEl = document.querySelector<HTMLElement>('.report-slides')
    if (!sourceSlidesEl || sourceSlidesEl.querySelectorAll('.rslide').length === 0) {
      showToast('슬라이드가 보이지 않습니다. 리포트 탭을 먼저 열어주세요.', 'info')
      return
    }

    setPdfDownloading(true)
    try {
      const [html2canvas, { pdf, Document, Page, Image: PdfImage, Link: PdfLink, View: PdfView }] = await Promise.all([
        import('html2canvas').then(m => m.default),
        import('@react-pdf/renderer'),
      ])

      const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

      async function imgToDataUrl(src: string): Promise<string | null> {
        try {
          const sameOrigin = src.startsWith(window.location.origin) || src.startsWith('/')
          const resp = await fetch(src, sameOrigin ? {} : { mode: 'cors', credentials: 'omit' })
          if (!resp.ok) return null
          const blob = await resp.blob()
          return await new Promise<string>((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result as string)
            reader.onerror = () => rej(new Error('FileReader error'))
            reader.readAsDataURL(blob)
          })
        } catch {
          return null
        }
      }

      type PdfHotlink = { url: string; x: number; y: number; w: number; h: number }
      const slideEls = Array.from(sourceSlidesEl.querySelectorAll<HTMLElement>('.rslide'))
      const dataUrls: string[] = []
      const pageHotlinks: PdfHotlink[][] = []

      for (const el of slideEls) {
        const imgs = Array.from(el.querySelectorAll<HTMLImageElement>('img'))
        const restores: Array<() => void> = []
        await Promise.all(imgs.map(async (img) => {
          const orig = img.src
          if (!orig || orig.startsWith('data:')) return
          const converted = await imgToDataUrl(orig)
          img.src = converted ?? PLACEHOLDER
          restores.push(() => { img.src = orig })
        }))

        // Collect clickable link positions before capture
        const slideRect = el.getBoundingClientRect()
        const hotlinks: PdfHotlink[] = []
        el.querySelectorAll<HTMLElement>('[data-pdf-link]').forEach(linkEl => {
          const href = linkEl.getAttribute('data-pdf-link')
          if (!href) return
          const r = linkEl.getBoundingClientRect()
          hotlinks.push({
            url: href,
            x: ((r.left - slideRect.left) / slideRect.width) * 960,
            y: ((r.top - slideRect.top) / slideRect.height) * 540,
            w: (r.width / slideRect.width) * 960,
            h: (r.height / slideRect.height) * 540,
          })
        })
        pageHotlinks.push(hotlinks)

        const prevRadius = el.style.borderRadius
        el.style.borderRadius = '0'

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: false,
          allowTaint: false,
          backgroundColor: '#F8F6F6',
          logging: false,
          imageTimeout: 0,
        })

        el.style.borderRadius = prevRadius
        restores.forEach(fn => fn())
        dataUrls.push(canvas.toDataURL('image/jpeg', 0.95))
      }

      const W = 960, H = 540
      const blob = await pdf(
        <Document title={`Mi Muse ${phase.name} Report`}>
          {dataUrls.map((url, i) => (
            <Page key={String(i)} size={[W, H]} style={{ margin: 0, padding: 0, position: 'relative' }}>
              <PdfImage src={url} style={{ width: W, height: H, margin: 0, padding: 0 }} />
              {(pageHotlinks[i] ?? []).map((hl, j) => (
                <PdfLink key={j} src={hl.url} style={{ position: 'absolute', top: hl.y, left: hl.x, width: hl.w, height: hl.h }}>
                  <PdfView style={{ width: hl.w, height: hl.h }} />
                </PdfLink>
              ))}
            </Page>
          ))}
        </Document>
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MiMuse_${phase.name}_Report.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('PDF generation error:', msg, e)
      showToast(`PDF 오류: ${msg.slice(0, 80)}`, 'error')
    } finally {
      setPdfDownloading(false)
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

  useEffect(() => {
    if (activeTab !== 'report' || !resolvedPhaseId) return
    let cancelled = false
    setReportLoading(true)
    void Promise.all([
      supabase.from('report_pages').select('*').eq('phase_id', resolvedPhaseId).order('order_index'),
      loadMonitoringData(resolvedPhaseId),
      supabase.from('confirmed_brands').select('brand_name').eq('phase_id', resolvedPhaseId),
      supabase.from('monitoring_keywords').select('brand, keywords, phase_id').eq('phase_id', resolvedPhaseId),
    ]).then(([{ data }, { rows }, { data: cbData }, { data: kwData }]) => {
      if (!cancelled) {
        setReportPages((data as ReportPage[]) ?? [])
        setReportRows(rows)
        const kwRows: { brand: string; keywords: string[] | null }[] = (kwData ?? [])
        const isAscii = (s: string) => /^[a-z0-9][a-z0-9_\s-]*$/i.test(s.trim())
        const brands = ((cbData ?? []) as { brand_name: string }[]).map((r, i) => {
          const korLower = r.brand_name.trim().toLowerCase()
          const korKey = r.brand_name.trim().toLowerCase().replace(/\s+/g, '_')
          // Find keyword row by: Korean name in keywords, OR brand = Korean key, OR positional fallback
          const kwRow =
            kwRows.find(k => Array.isArray(k.keywords) && k.keywords.some(kw => kw.toLowerCase() === korLower)) ??
            kwRows.find(k => k.brand === korKey || k.brand === korLower) ??
            kwRows.filter(k => k.brand !== 'mimuse')[i]
          let nameEn = r.brand_name
          if (kwRow) {
            // If the brand column is already English/ASCII and differs from Korean → use it directly
            if (isAscii(kwRow.brand) && kwRow.brand.toLowerCase() !== korLower && kwRow.brand.toLowerCase() !== korKey) {
              nameEn = kwRow.brand
            } else {
              // Scan keywords for the first ASCII/English term
              const engKw = (kwRow.keywords ?? []).find(kw => isAscii(kw) && kw.toLowerCase() !== korLower && kw.toLowerCase() !== korKey)
              if (engKw) nameEn = engKw
            }
          }
          return { name: r.brand_name, nameEn }
        })
        setReportConfirmedBrands(brands)
      }
    }).finally(() => { if (!cancelled) setReportLoading(false) })
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
                  <button
                    type="button"
                    className="cfg-btn cfg-btn--ghost"
                    disabled={pdfDownloading}
                    onClick={() => { void handleDownloadPdf() }}
                  >
                    <FileText size={13} />
                    {pdfDownloading ? 'PDF 생성 중…' : 'PDF 다운로드'}
                  </button>
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
