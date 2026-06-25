import { useEffect, useState } from 'react'
import Spinner from '@/components/Spinner'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import '@/pages/brand/confirmed/archive/archive.css'
import './design-archive.css'
import { loadDesignAssetUrls } from './design-archive-images'
import { getDesignArchiveHeroDescription } from './design-archive-copy'
import { designArchiveTitle } from './design-slug'
import DesignArchiveFolders from './DesignArchiveFolders'
import { useArchivePhase } from '../use-archive-phase'

const ASSET_SECTIONS = [
  { key: 'kitBox' as const, label: '키트 박스', sub: 'Kit box exterior & unboxing design' },
  { key: 'collectionCard' as const, label: '컬렉션 카드', sub: 'Season collection card artwork' },
  { key: 'brochure' as const, label: '브로슈어', sub: 'Printed brochure & insert materials' },
]

export default function ArchiveDesignPhase() {
  const { phase, phasesLoading } = useArchivePhase()

  const [assets, setAssets] = useState<Awaited<ReturnType<typeof loadDesignAssetUrls>> | null>(null)
  const [assetsLoading, setAssetsLoading] = useState(true)

  useEffect(() => {
    if (!phase) return

    let cancelled = false
    void (async () => {
      setAssetsLoading(true)
      const loaded = await loadDesignAssetUrls(phase)
      if (!cancelled) {
        setAssets(loaded)
        setAssetsLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [phase])

  if (phasesLoading || !phase || assetsLoading || !assets) {
    return (
      <div className="page page--fill" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  const title = designArchiveTitle(phase)
  const heroDescription = getDesignArchiveHeroDescription(phase.design_archive_desc)
  const assetMap = {
    kitBox: assets.kitBox,
    collectionCard: assets.collectionCard,
    brochure: assets.brochure,
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title={title}
          description={heroDescription}
        />
      </PageHeroBanner>

      <div className="design-archive-detail">
        <section className="design-archive-assets">
          <h2 className="design-archive-assets__heading">디자인 산출물</h2>
          <div className="design-archive-assets__grid">
            {ASSET_SECTIONS.map(section => (
              <article key={section.key} className="design-archive-asset">
                <div className="design-archive-asset__head">
                  <h3 className="design-archive-asset__label">{section.label}</h3>
                  <p className="design-archive-asset__sub">{section.sub}</p>
                </div>
                <div className="design-archive-asset__media">
                  {assetMap[section.key] ? (
                    <img src={assetMap[section.key]!} alt={section.label} />
                  ) : (
                    <span className="design-archive-asset__placeholder">이미지 없음</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <DesignArchiveFolders phaseId={phase.id} />
      </div>
    </div>
  )
}
