import { Navigate, useOutletContext, useParams } from 'react-router-dom'
import { archiveBrandReportPath, archiveSectionPath, brandFromArchiveBrandSlug, isLegacyArchiveBrandIdSlug } from '../archive-slug'
import { useArchivePhase } from '../use-archive-phase'
import type { ArchiveBrandReportOutletContext } from './layout'

export default function ArchiveBrandReportBrand() {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  const { phase } = useArchivePhase()
  const { phaseName, brands } = useOutletContext<ArchiveBrandReportOutletContext>()

  const brand = brandFromArchiveBrandSlug(brands, brandSlug)
  if (!brand) {
    if (!phase) return null
    return <Navigate to={archiveSectionPath(phase, 'brand-report')} replace />
  }

  if (phase && isLegacyArchiveBrandIdSlug(brandSlug)) {
    return <Navigate to={archiveBrandReportPath(phase, brand, brands)} replace />
  }

  return (
    <div className="archive-brand-report-panel">
      <div className="archive-brand-report-panel__title">{brand.brandName}</div>
      {brand.product && (
        <div className="archive-brand-report-panel__sub">{brand.product}</div>
      )}
      <div className="archive-brand-report-panel__wip">
        <div className="archive-brand-report-panel__wip-heading">
          {phaseName} · {brand.brandName} 리포트 · 개발중
        </div>
        <p className="archive-brand-report-panel__wip-desc">
          브랜드별 성과 리포트 아카이브는 현재 개발 중입니다.<br />
          곧 서비스될 예정입니다.
        </p>
      </div>
    </div>
  )
}
