import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { PageTabs } from '@/components/ui'
import Spinner from '@/components/Spinner'
import { archiveBrandReportPath, archiveBrandSlugFromPath, archiveBrandSlugKey, brandFromArchiveBrandSlug } from '../archive-slug'
import { useArchivePhase } from '../use-archive-phase'
import { loadSeasonBrands, type SeasonBrandItem } from './load-season-brands'
import './brand-report.css'

export interface ArchiveBrandReportOutletContext {
  phaseName: string
  brands: SeasonBrandItem[]
}

export default function ArchiveBrandReportLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { phase, phasesLoading } = useArchivePhase()
  const [brands, setBrands] = useState<SeasonBrandItem[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)

  useEffect(() => {
    if (!phase) return

    let cancelled = false
    void (async () => {
      setBrandsLoading(true)
      const loaded = await loadSeasonBrands(phase.id)
      if (!cancelled) {
        setBrands(loaded)
        setBrandsLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [phase?.id])

  if (phasesLoading || !phase) {
    return (
      <div className="page page--fill" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  const activeBrandSlug = archiveBrandSlugFromPath(pathname)
  const activeBrand = brandFromArchiveBrandSlug(brands, activeBrandSlug)
  const activeTab = activeBrand
    ? archiveBrandSlugKey(activeBrand, brands)
    : brands[0] ? archiveBrandSlugKey(brands[0], brands) : ''

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="브랜드별 리포트"
          description="확정 브랜드별 리뷰 모니터링과 콘텐츠 성과 결과 데이터를 브랜드별로 확인합니다."
        />
      </PageHeroBanner>

      {brandsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : !brands.length ? (
        <BrandReportEmpty phaseName={phase.name} />
      ) : (
        <>
          <PageTabs
            tabs={brands.map(b => ({ id: archiveBrandSlugKey(b, brands), label: b.brandName }))}
            active={activeTab}
            onChange={slug => {
              const brand = brands.find(b => archiveBrandSlugKey(b, brands) === slug)
              if (brand) navigate(archiveBrandReportPath(phase, brand, brands))
            }}
          />
          <div className="ftab-content">
            <Outlet context={{ phaseName: phase.name, brands } satisfies ArchiveBrandReportOutletContext} />
          </div>
        </>
      )}
    </div>
  )
}

function BrandReportEmpty({ phaseName }: { phaseName: string }) {
  return (
    <div className="bn-archive-empty-panel">
      <span>{phaseName} 시즌에 등록된 확정 브랜드가 없습니다.</span>
      <span className="bn-archive-empty-sub">브랜드별 리포트는 확정 브랜드 등록 후 확인할 수 있습니다.</span>
    </div>
  )
}
