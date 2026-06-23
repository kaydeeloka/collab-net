import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ChevronRight } from 'lucide-react'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { usePhase } from '@/contexts/PhaseContext'
import { getPhaseStatusBadge } from '@/lib/phase'
import { formatKstShortDate } from '@/lib/kst-time'
import { supabase } from '@/lib/supabase'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import './season-collection.css'
import { getSeasonCollectionCopy } from './season-collection-content'
import { loadStorageImageUrl } from './season-collection-images'
import SeasonArchiveSidebar from './season-archive-sidebar'
import { phaseYearKey } from './season-archive-shared'
import { phaseCollectionPath, type PhaseSlugInput } from './slug'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

function PhaseCollectionCard({
  phase,
  phases,
  projectConcept,
  collectionImg,
  startedAt,
  endedAt,
  brandNames,
  statusLabel,
  statusDone,
}: {
  phase: PhaseSlugInput
  phases: PhaseSlugInput[]
  projectConcept: string | null
  collectionImg: string | null
  startedAt: string | null
  endedAt: string | null
  brandNames: string[]
  statusLabel: string | null
  statusDone: boolean
}) {
  const title = getSeasonCollectionCopy(phase.name, brandNames.length, projectConcept).title
  const brandLine = brandNames.length ? brandNames.join(' · ') : '—'
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const url = await loadStorageImageUrl(collectionImg)
      if (!cancelled) setImageUrl(url)
    })()
    return () => { cancelled = true }
  }, [collectionImg])

  return (
    <Link to={phaseCollectionPath(phase, phases, brandNames.length)} className="brand-archive-card season-collection-card">
      <div className="brand-archive-card__media">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={title} />
            <div className="brand-archive-card__media-overlay" />
          </>
        ) : (
          <span className="season-collection-card__placeholder">{phase.name}</span>
        )}
        {statusLabel && (
          <span
            className={`brand-archive-card__status ${
              statusDone ? 'brand-archive-card__status--done' : 'brand-archive-card__status--pending'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <div className="brand-archive-card__body">
        <div className="brand-archive-card__title">{title}</div>
        <div className="brand-archive-card__product">{formatPhasePeriod(startedAt, endedAt)}</div>
        <div className="brand-archive-card__product" style={{ marginTop: 2 }}>
          {brandLine}
        </div>
        <div className="brand-archive-card__footer">
          <span className="brand-archive-card__cta">
            리포트 보기
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ArchiveBrandReport() {
  const { phases, loading, activePhaseId } = usePhase()
  const [brandNamesByPhase, setBrandNamesByPhase] = useState<Record<string, string[]>>({})
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [filterYear, setFilterYear] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadBrandNames() {
      setBrandsLoading(true)
      const { data } = await supabase
        .from('confirmed_brands')
        .select('phase_id, brand_name')
        .order('brand_name')
      if (cancelled) return

      const names: Record<string, string[]> = {}
      for (const row of data ?? []) {
        const id = row.phase_id as string
        const brandName = (row.brand_name as string)?.trim()
        if (!id || !brandName) continue
        if (!names[id]) names[id] = []
        names[id].push(brandName)
      }
      setBrandNamesByPhase(names)
      setBrandsLoading(false)
    }

    void loadBrandNames()
    return () => { cancelled = true }
  }, [])

  const brandCountByPhase = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [id, names] of Object.entries(brandNamesByPhase)) {
      counts[id] = names.length
    }
    return counts
  }, [brandNamesByPhase])

  const filteredPhases = useMemo(() => {
    if (!filterYear) return phases
    return phases.filter(phase => {
      const key = phaseYearKey(phase) ?? 'unknown'
      return key === filterYear
    })
  }, [phases, filterYear])

  const isLoading = loading || brandsLoading

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="전체 리포트 아카이브"
          description="모든 캠페인의 전체 성과 리포트를 아카이브합니다."
        />
      </PageHeroBanner>

      {isLoading ? (
        <div className="bn-archive-cards-wrap">
          <div className="bn-archive-brand-loading"><Spinner sm /> 불러오는 중...</div>
        </div>
      ) : !phases.length ? (
        <div className="bn-archive-empty-panel">
          <Archive size={28} strokeWidth={1.5} className="bn-archive-empty-icon" />
          <span>등록된 시즌이 없습니다.</span>
          <span className="bn-archive-empty-sub">상단에서 시즌(차수)을 먼저 설정하세요.</span>
        </div>
      ) : (
        <div className="bn-archive-layout">
          <SeasonArchiveSidebar
            allPhases={phases}
            brandCountByPhase={brandCountByPhase}
            loading={isLoading}
            filterYear={filterYear}
            visibleCount={filteredPhases.length}
            onFilterYear={setFilterYear}
          />
          <div className="bn-archive-main">
            {!filteredPhases.length ? (
              <div className="bn-archive-empty-panel">
                {filterYear ? `${filterYear}년 시즌이 없습니다.` : '표시할 시즌이 없습니다.'}
              </div>
            ) : (
              <div className="bn-archive-cards-wrap">
                <div className="brand-archive-grid bn-archive-cards-grid season-collection-grid">
                  {filteredPhases.map(phase => {
                    const badge = getPhaseStatusBadge(phase, activePhaseId)
                    return (
                      <PhaseCollectionCard
                        key={phase.id}
                        phase={phase}
                        phases={phases}
                        projectConcept={phase.project_concept}
                        collectionImg={phase.collection_img}
                        startedAt={phase.started_at}
                        endedAt={phase.ended_at}
                        brandNames={brandNamesByPhase[phase.id] ?? []}
                        statusLabel={badge?.label ?? null}
                        statusDone={badge?.tone === 'completed'}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
