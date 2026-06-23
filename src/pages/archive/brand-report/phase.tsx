import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Pencil, Save, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import { formatKstShortDate } from '@/lib/kst-time'
import { supabase } from '@/lib/supabase'
import Spinner from '@/components/Spinner'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import '@/pages/brand/confirmed/archive/archive.css'
import './season-collection.css'
import { loadSeasonBrands, type SeasonBrandItem } from './load-season-brands'
import { getSeasonCollectionCopy, conceptTitleFromProjectConcept, splitArchiveParagraphs } from './season-collection-content'
import {
  loadStorageImageUrl,
  removeBrandCover,
  removeCollectionImg,
  uploadBrandCover,
  uploadCollectionImg,
} from './season-collection-images'
import { useArchivePhase } from '../use-archive-phase'

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
  description,
  onDescriptionChange,
  onUpload,
  onRemoveCover,
  uploading,
  disabled,
}: {
  brand: SeasonBrandItem
  editMode: boolean
  description: string
  onDescriptionChange: (value: string) => void
  onUpload: (file: File) => void
  onRemoveCover: () => void
  uploading: boolean
  disabled: boolean
}) {
  const productKo = brand.product?.trim()
  const productEn = brand.productEn?.trim()
  const primaryTitle = productEn || productKo || brand.brandName
  const secondaryTitle = productEn && productKo ? productKo : null
  const desc = description.trim() || defaultBrandDesc(brand)

  return (
    <article className={`season-collection__product${editMode ? ' season-collection__product--edit' : ''}`}>
      <div className={`season-collection__product-media${editMode ? ' season-collection__media-edit' : ''}`}>
        {brand.imageUrl ? (
          <img src={brand.imageUrl} alt={primaryTitle} />
        ) : (
          <span className="season-collection__product-placeholder">
            {editMode ? '커버 이미지 업로드' : '커버 이미지 없음'}
          </span>
        )}
        {editMode && (
          <div className="season-collection__media-edit-actions">
            <label className="cfg-btn cfg-btn--ghost season-collection__media-btn">
              <Upload size={13} />
              {uploading ? '처리 중…' : '업로드'}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={disabled || uploading}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) onUpload(file)
                  e.target.value = ''
                }}
              />
            </label>
            {brand.coverAsset && (
              <button
                type="button"
                className="cfg-btn cfg-btn--ghost season-collection__media-btn"
                disabled={disabled || uploading}
                onClick={onRemoveCover}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
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
        {editMode ? (
          <textarea
            className="season-collection__edit-textarea season-collection__edit-textarea--product"
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder={defaultBrandDesc(brand)}
            rows={5}
          />
        ) : (
          <p className="season-collection__product-desc">{desc}</p>
        )}
      </div>
    </article>
  )
}

export default function ArchiveBrandReportPhase() {
  const { phase, phasesLoading } = useArchivePhase()
  const { phases, refreshPhases } = usePhase()
  const resolvedPhaseId = phase?.id ?? null
  const { showToast, showConfirm } = useToast()

  const [brands, setBrands] = useState<SeasonBrandItem[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [phaseArchiveDesc, setPhaseArchiveDesc] = useState('')
  const [phaseProjectConcept, setPhaseProjectConcept] = useState('')
  const [editSnapshot, setEditSnapshot] = useState<{
    title: string
    archiveDesc: string
    brandDescs: Record<string, string>
  } | null>(null)
  const [heroPath, setHeroPath] = useState<string | null>(null)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [heroLoading, setHeroLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [brandArchiveDescs, setBrandArchiveDescs] = useState<Record<string, string>>({})
  const [uploadingHero, setUploadingHero] = useState(false)
  const [uploadingBrandId, setUploadingBrandId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
      setHeroLoading(false)
      return
    }

    let cancelled = false
    setHeroLoading(true)

    void (async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('collection_img, archive_desc, project_concept')
        .eq('id', resolvedPhaseId)
        .maybeSingle()
      if (cancelled) return

      if (error) {
        setHeroLoading(false)
        return
      }

      const projectConcept = (data?.project_concept as string | null) ?? phase?.project_concept ?? null
      setPhaseArchiveDesc((data?.archive_desc as string | null) ?? '')
      setPhaseProjectConcept(conceptTitleFromProjectConcept(projectConcept))
      const path = (data?.collection_img as string | null) ?? null
      setHeroPath(path)
      const url = await loadStorageImageUrl(path)
      if (!cancelled) {
        setHeroUrl(url)
        setHeroLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [resolvedPhaseId, phase?.project_concept])

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
      setBrandArchiveDescs(editSnapshot.brandDescs)
    }
    setEditSnapshot(null)
    setEditMode(false)
  }

  const isUploading = uploadingHero || uploadingBrandId !== null
  const isBusy = isUploading || saving

  function startEditMode() {
    const descs: Record<string, string> = {}
    for (const brand of brands) descs[brand.id] = brand.description ?? ''
    const title = phaseProjectConcept || conceptTitleFromProjectConcept(phase?.project_concept)
    setPhaseProjectConcept(title)
    setEditSnapshot({ title, archiveDesc: phaseArchiveDesc, brandDescs: descs })
    setBrandArchiveDescs(descs)
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

      const updates = brands.map(brand =>
        supabase
          .from('confirmed_brands')
          .update({ archive_desc: brandArchiveDescs[brand.id]?.trim() || null })
          .eq('id', brand.id),
      )
      const results = await Promise.all(updates)
      const failed = results.find(r => r.error)
      if (failed?.error) {
        showToast(failed.error.message, 'error')
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

      const url = await loadStorageImageUrl(path)
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
          setHeroUrl(null)
          showToast('히어로 이미지가 삭제되었습니다', 'success')
        } finally {
          setUploadingHero(false)
        }
      })()
    })
  }

  async function handleBrandUpload(brandId: string, file: File) {
    if (!resolvedPhaseId || isBusy) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다', 'error')
      return
    }

    setUploadingBrandId(brandId)
    try {
      const { imageUrl, coverAsset, error } = await uploadBrandCover(resolvedPhaseId, brandId, file)
      if (error) {
        showToast(error, 'error')
        return
      }

      setBrands(prev => prev.map(b => (
        b.id === brandId ? { ...b, imageUrl, coverAsset } : b
      )))
      showToast('커버 이미지가 업로드되었습니다', 'success')
    } finally {
      setUploadingBrandId(null)
    }
  }

  function handleBrandCoverRemove(brand: SeasonBrandItem) {
    const asset = brand.coverAsset
    if (!asset || isBusy) return
    showConfirm(`"${asset.file_name}" 삭제할까요?`, () => {
      void (async () => {
        setUploadingBrandId(brand.id)
        try {
          const { error } = await removeBrandCover(asset.id, asset.storage_path)
          if (error) {
            showToast(error, 'error')
            return
          }
          await reloadBrands()
          showToast('커버 이미지가 삭제되었습니다', 'success')
        } finally {
          setUploadingBrandId(null)
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
            <Link to="/archive" className="page-hero-back">
              <ArrowLeft size={14} />
              시즌 선택
            </Link>
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
          eyebrow={(
            <Link to="/archive" className="page-hero-back">
              <ArrowLeft size={14} />
              시즌 선택
            </Link>
          )}
          title={`시즌 컬렉션 · ${phase.name}`}
          description={formatPhasePeriod(phase.started_at, phase.ended_at)}
          actions={(
            <>
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
            </>
          )}
        />
      </PageHeroBanner>

      {contentLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : (
        <div className={`season-collection${editMode ? ' season-collection--edit' : ''}`}>
          <section className="season-collection__hero">
            <div className={`season-collection__hero-media${editMode ? ' season-collection__media-edit' : ''}`}>
              {heroUrl ? (
                <img src={heroUrl} alt={copy.title} />
              ) : (
                <span className="season-collection__hero-placeholder">
                  {editMode ? '히어로 이미지 업로드' : '히어로 이미지 없음'}
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
              {!editMode && (
                <button type="button" className="season-collection__download" disabled title="곧 제공 예정">
                  Download Report
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </section>

          {brands.length > 0 ? (
            <section>
              <div className="season-collection__kit-head">
                <h2 className="season-collection__kit-heading">{copy.kitHeading}</h2>
              </div>
              <div className="season-collection__products">
                {brands.map(brand => (
                  <ProductCard
                    key={brand.id}
                    brand={brand}
                    editMode={editMode}
                    description={editMode ? (brandArchiveDescs[brand.id] ?? '') : (brand.description ?? '')}
                    onDescriptionChange={value => setBrandArchiveDescs(prev => ({ ...prev, [brand.id]: value }))}
                    onUpload={file => { void handleBrandUpload(brand.id, file) }}
                    onRemoveCover={() => handleBrandCoverRemove(brand)}
                    uploading={uploadingBrandId === brand.id}
                    disabled={isBusy}
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
      )}
    </div>
  )
}
