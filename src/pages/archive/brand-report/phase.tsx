import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { usePhase } from '@/contexts/PhaseContext'
import { formatKstShortDate } from '@/lib/kst-time'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import './season-collection.css'
import { loadSeasonBrands, type SeasonBrandItem } from './load-season-brands'
import { getSeasonCollectionCopy } from './season-collection-content'

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
  const phase = phases.find(p => p.id === phaseId)

  const [brands, setBrands] = useState<SeasonBrandItem[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)

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

  const copy = getSeasonCollectionCopy(phase.name, brands.length)
  const heroImage = brands.find(b => b.imageUrl)?.imageUrl ?? null

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
        </div>
      </div>

      {brandsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : (
        <div className="season-collection">
          <section className="season-collection__hero">
            <div className="season-collection__hero-media">
              {heroImage ? (
                <img src={heroImage} alt={copy.title} />
              ) : (
                <span className="season-collection__hero-placeholder">
                  확정 브랜드 자료 아카이브에<br />제품 대표 이미지를 업로드하면 표시됩니다
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
                <p className="season-collection__kit-intro">{copy.kitIntro(brands.length)}</p>
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
    </div>
  )
}
