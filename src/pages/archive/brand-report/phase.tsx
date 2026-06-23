import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Pencil, Trash2, Upload } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'
import { formatKstShortDate } from '@/lib/kst-time'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/Modal'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import './season-collection.css'
import { loadSeasonBrands, type SeasonBrandItem } from './load-season-brands'
import { getSeasonCollectionCopy } from './season-collection-content'
import {
  loadCollectionHeroUrl,
  removeCollectionHero,
  uploadCollectionHero,
} from './season-collection-hero'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

function ProductCard({ brand }: { brand: SeasonBrandItem }) {
  const title = brand.product?.trim() || brand.brandName
  const desc = brand.description
    || `${brand.brandName} — a Mi Muse kit partner brand selected for this season's creator collection.`

  return (
    <article className="season-collection__product">
      <div className="season-collection__product-media">
        {brand.imageUrl ? (
          <img src={brand.imageUrl} alt={title} />
        ) : (
          <span className="season-collection__product-placeholder">
            자료 아카이브에<br />대표 이미지 없음
          </span>
        )}
      </div>
      <div className="season-collection__product-copy">
        <span className="season-collection__product-brand">{brand.brandName}</span>
        <h3 className="season-collection__product-title">{title}</h3>
        <p className="season-collection__product-desc">{desc}</p>
      </div>
    </article>
  )
}

export default function ArchiveBrandReportPhase() {
  const { phaseId } = useParams<{ phaseId: string }>()
  const { phases, loading: phasesLoading } = usePhase()
  const { showToast, showConfirm } = useToast()
  const phase = phases.find(p => p.id === phaseId)

  const [brands, setBrands] = useState<SeasonBrandItem[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [heroPath, setHeroPath] = useState<string | null>(null)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [heroLoading, setHeroLoading] = useState(true)
  const [showEditHero, setShowEditHero] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!phaseId) {
      setBrands([])
      setBrandsLoading(false)
      return
    }

    let cancelled = false
    setBrandsLoading(true)

    void loadSeasonBrands(phaseId).then(rows => {
      if (!cancelled) {
        setBrands(rows)
        setBrandsLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [phaseId])

  useEffect(() => {
    if (!phaseId) {
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
        .select('collection_hero_path')
        .eq('id', phaseId)
        .maybeSingle()
      if (cancelled) return

      if (error) {
        setHeroLoading(false)
        return
      }

      const path = (data?.collection_hero_path as string | null) ?? null
      setHeroPath(path)
      const url = await loadCollectionHeroUrl(path)
      if (!cancelled) {
        setHeroUrl(url)
        setHeroLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [phaseId])

  async function handleHeroUpload(file: File | undefined) {
    if (!phaseId || !file || uploadingHero) return
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다', 'error')
      return
    }

    setUploadingHero(true)
    try {
      const { path, error } = await uploadCollectionHero(phaseId, file, heroPath)
      if (error || !path) {
        showToast(error ?? '업로드 실패', 'error')
        return
      }

      const url = await loadCollectionHeroUrl(path)
      setHeroPath(path)
      setHeroUrl(url)
      showToast('대표 이미지가 업로드되었습니다', 'success')
    } finally {
      setUploadingHero(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleHeroRemove() {
    if (!phaseId || !heroPath || uploadingHero) return
    showConfirm('대표 이미지를 삭제하시겠습니까?', () => {
      void (async () => {
        setUploadingHero(true)
        try {
          const { error } = await removeCollectionHero(phaseId, heroPath)
          if (error) {
            showToast(error, 'error')
            return
          }
          setHeroPath(null)
          setHeroUrl(null)
          showToast('대표 이미지가 삭제되었습니다', 'success')
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
            <Link to="/archive/brand-report" className="brand-archive-detail__back">
              <ArrowLeft size={14} />
              시즌 컬렉션으로
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const copy = getSeasonCollectionCopy(phase.name, brands.length, phase.project_concept)

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✦</span>
        <div>
          <div className="page-banner-title">시즌 컬렉션 · {phase.name}</div>
          <div className="page-banner-desc">{formatPhasePeriod(phase.started_at, phase.ended_at)}</div>
        </div>
        <div className="page-banner-actions">
          <Link to="/archive/brand-report" className="brand-archive-detail__back">
            <ArrowLeft size={14} />
            전체 시즌
          </Link>
          <button
            type="button"
            className="brand-archive-detail__back"
            onClick={() => setShowEditHero(true)}
          >
            <Pencil size={14} />
            수정
          </button>
        </div>
      </div>

      {brandsLoading || heroLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : (
        <div className="season-collection">
          <section className="season-collection__hero">
            <div className="season-collection__hero-media">
              {heroUrl ? (
                <img src={heroUrl} alt={copy.title} />
              ) : (
                <span className="season-collection__hero-placeholder">
                  상단 <strong>수정</strong> 버튼에서<br />시즌 대표 이미지를 업로드하세요
                </span>
              )}
            </div>
            <div className="season-collection__hero-copy">
              <span className="season-collection__volume">{copy.volume}</span>
              <h1 className="season-collection__title">{copy.title}</h1>
              <div className="season-collection__intro">
                {copy.intro.map(paragraph => (
                  <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                ))}
              </div>
              <button type="button" className="season-collection__download" disabled title="곧 제공 예정">
                Download Report
                <ArrowRight size={14} />
              </button>
            </div>
          </section>

          {brands.length > 0 ? (
            <section>
              <div className="season-collection__kit-head">
                <h2 className="season-collection__kit-heading">{copy.kitHeading}</h2>
              </div>
              <div className="season-collection__products" style={{ marginTop: 32 }}>
                {brands.map(brand => (
                  <ProductCard key={brand.id} brand={brand} />
                ))}
              </div>
            </section>
          ) : (
            <div className="brand-archive-empty">
              이 시즌에 등록된 확정 브랜드가 없습니다.<br />
              <strong>확정 브랜드 → 브랜드 관리</strong>에서 브랜드를 추가하고 자료 아카이브에 이미지를 업로드하세요.
            </div>
          )}
        </div>
      )}

      <Modal
        open={showEditHero}
        onClose={() => !uploadingHero && setShowEditHero(false)}
        title="시즌 대표 이미지"
        size="md"
        footer={(
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="modal-btn-cancel"
              onClick={() => setShowEditHero(false)}
              disabled={uploadingHero}
            >
              닫기
            </button>
          </div>
        )}
      >
        <div className="season-collection__hero-edit">
          <div className="season-collection__hero-edit-preview">
            {heroUrl ? (
              <img src={heroUrl} alt="" />
            ) : (
              <span className="season-collection__hero-placeholder">등록된 이미지 없음</span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={e => { void handleHeroUpload(e.target.files?.[0]) }}
          />

          <div className="season-collection__hero-edit-actions">
            <button
              type="button"
              className="modal-btn-confirm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingHero}
            >
              <Upload size={14} />
              {uploadingHero ? '처리 중...' : heroUrl ? '이미지 변경' : '이미지 업로드'}
            </button>
            {heroUrl && (
              <button
                type="button"
                className="modal-btn-cancel"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                onClick={handleHeroRemove}
                disabled={uploadingHero}
              >
                <Trash2 size={14} />
                삭제
              </button>
            )}
          </div>

          <p className="season-collection__hero-edit-hint">
            시즌 컬렉션 상단에 표시할 대표 이미지입니다. JPG, PNG, WebP 등 이미지 파일을 업로드하세요.
          </p>
        </div>
      </Modal>
    </div>
  )
}
