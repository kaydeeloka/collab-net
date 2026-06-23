import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatKstShortDate } from '@/lib/kst-time'
import Spinner from '@/components/Spinner'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import '@/pages/brand/confirmed/archive/archive.css'
import './design-archive.css'
import { loadDesignAssetUrls } from './design-archive-images'
import { designArchiveTitle } from './design-slug'
import { splitArchiveParagraphs } from '../brand-report/season-collection-content'
import { useArchivePhase } from '../use-archive-phase'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

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
  const period = formatPhasePeriod(phase.started_at, phase.ended_at)
  const descParagraphs = (() => {
    const fromArchive = splitArchiveParagraphs(phase.design_archive_desc)
    if (fromArchive.length) return fromArchive

    const fromConcept = splitArchiveParagraphs(phase.project_concept)
    if (fromConcept.length <= 1) return []
    return fromConcept.slice(1)
  })()
  const assetMap = {
    kitBox: assets.kitBox,
    collectionCard: assets.collectionCard,
    brochure: assets.brochure,
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner className="design-archive-hero">
        <PageHeroBannerContent
          eyebrow={(
            <Link to="/archive" className="page-hero-back">
              <ArrowLeft size={14} />
              시즌 선택
            </Link>
          )}
          title={title}
          actions={(
            <span className="design-archive-hero__section">{phase.name} · 디자인 자료</span>
          )}
          description={(
            <div className="design-archive-hero__copy">
              <p className="design-archive-hero__period">{period}</p>
              {descParagraphs.length ? (
                descParagraphs.map((p, i) => (
                  <p key={i} className="design-archive-hero__desc">{p}</p>
                ))
              ) : (
                <p className="design-archive-hero__desc">
                  {phase.name} 시즌 키트 디자인 테마 및 시각 아이덴티티 아카이브입니다.
                </p>
              )}
            </div>
          )}
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
      </div>
    </div>
  )
}
