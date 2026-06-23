import { Navigate, useOutletContext } from 'react-router-dom'
import { archiveBrandReportPath } from '../archive-slug'
import { useArchivePhase } from '../use-archive-phase'
import type { ArchiveBrandReportOutletContext } from './layout'

export default function ArchiveBrandReportIndex() {
  const { phase } = useArchivePhase()
  const { brands } = useOutletContext<ArchiveBrandReportOutletContext>()

  if (!phase || !brands.length) return null
  return <Navigate to={archiveBrandReportPath(phase, brands[0], brands)} replace />
}
