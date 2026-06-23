import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { PageTabs } from '@/components/ui'
import Spinner from '@/components/Spinner'
import { archiveBrandIdFromPath, archiveBrandReportPath } from '../archive-slug'
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

  const activeBrandId = archiveBrandIdFromPath(pathname)
  const activeTab = brands.some(b => b.id === activeBrandId)
    ? activeBrandId!
    : brands[0]?.id ?? ''

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
          title={`${phase.name} · 브랜드별 리포트`}
          description={`${phase.name} 시즌 브랜드별 성과 리포트 아카이브`}
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
            tabs={brands.map(b => ({ id: b.id, label: b.brandName }))}
            active={activeTab}
            onChange={id => navigate(archiveBrandReportPath(phase, id))}
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
