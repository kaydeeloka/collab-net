import Spinner from '@/components/Spinner'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import './design-archive.css'
import { getDesignArchiveHeroDescription } from './design-archive-copy'
import { designArchiveTitle } from './design-slug'
import DesignArchiveFolders from './DesignArchiveFolders'
import { useArchivePhase } from '../use-archive-phase'

export default function ArchiveDesignPhase() {
  const { phase, phasesLoading } = useArchivePhase()

  if (phasesLoading || !phase) {
    return (
      <div className="page page--fill" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  const title = designArchiveTitle(phase)
  const heroDescription = getDesignArchiveHeroDescription(phase.design_archive_desc)

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title={title}
          description={heroDescription}
        />
      </PageHeroBanner>

      <DesignArchiveFolders phaseId={phase.id} />
    </div>
  )
}
