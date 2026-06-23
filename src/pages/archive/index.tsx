import { useEffect, useMemo, useState } from 'react'
import { Archive, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { usePhase } from '@/contexts/PhaseContext'
import { getPhaseStatusBadge } from '@/lib/phase'
import { formatKstShortDate } from '@/lib/kst-time'
import { phaseNum } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import { getSeasonCollectionCopy } from './brand-report/season-collection-content'
import { loadStorageImageUrl } from './brand-report/season-collection-images'
import './brand-report/season-collection.css'
import ArchivePhaseListSidebar from '@/components/ArchivePhaseListSidebar'
import { phaseYearKey } from './brand-report/season-archive-shared'
import { designCoverPath } from './design/design-archive-images'
import { archiveSectionPath } from './archive-slug'
import { setGlobalArchivePhase } from './archive-phase-sync'
import './archive.css'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

interface ArchivePhaseCardProps {
  phase: {
    id: string
    name: string
    project_concept: string | null
    started_at: string | null
    ended_at: string | null
    collection_img: string | null
    design_theme_img?: string | null
  }
  brandNames: string[]
  statusLabel: string | null
  statusDone: boolean
  onOpen: () => void
}

function ArchivePhaseCard({
  phase,
  brandNames,
  statusLabel,
  statusDone,
  onOpen,
}: ArchivePhaseCardProps) {
  const title = getSeasonCollectionCopy(phase.name, brandNames.length, phase.project_concept).title
  const brandLine = brandNames.length ? brandNames.join(' · ') : '—'
  const coverPath = designCoverPath(phase)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const url = await loadStorageImageUrl(coverPath)
      if (!cancelled) setImageUrl(url)
    })()
    return () => { cancelled = true }
  }, [coverPath])

  return (
    <button
      type="button"
      className="brand-archive-card season-collection-card archive-picker-card"
      onClick={onOpen}
    >
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
        <div className="archive-picker-card__head">
          <div className="brand-archive-card__title">{title}</div>
          <span className="archive-picker-card__phase">{phase.name}</span>
        </div>
        <div className="brand-archive-card__product">{formatPhasePeriod(phase.started_at, phase.ended_at)}</div>
        <div className="brand-archive-card__product" style={{ marginTop: 2 }}>
          {brandLine}
        </div>
        <div className="brand-archive-card__footer">
          <span className="brand-archive-card__cta">
            아카이브 보기
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </button>
  )
}

export default function ArchivePicker() {
  const navigate = useNavigate()
  const { phases, loading, activePhaseId, switchPhase } = usePhase()
  const [brandNamesByPhase, setBrandNamesByPhase] = useState<Record<string, string[]>>({})
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [filterYear, setFilterYear] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
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
    })()

    return () => { cancelled = true }
  }, [])

  const sortedPhases = [...phases].sort((a, b) => phaseNum(a.name) - phaseNum(b.name))
  const isLoading = loading || brandsLoading

  const brandCountByPhase = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const [id, names] of Object.entries(brandNamesByPhase)) {
      counts[id] = names.length
    }
    return counts
  }, [brandNamesByPhase])

  const filteredPhases = useMemo(() => {
    if (!filterYear) return sortedPhases
    return sortedPhases.filter(phase => {
      const key = phaseYearKey(phase) ?? 'unknown'
      return key === filterYear
    })
  }, [sortedPhases, filterYear])

  function openPhase(phaseId: string) {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase) return
    void setGlobalArchivePhase(phase, 'season', switchPhase, navigate)
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="아카이브"
          description="시즌(차수)을 선택하면 시즌 컬렉션, 디자인 자료, 브랜드별 리포트를 확인할 수 있습니다."
        />
      </PageHeroBanner>

      {isLoading ? (
        <div className="bn-archive-cards-wrap archive-picker">
          <div className="bn-archive-brand-loading"><Spinner sm /> 불러오는 중...</div>
        </div>
      ) : !sortedPhases.length ? (
        <div className="bn-archive-empty-panel">
          <Archive size={28} strokeWidth={1.5} className="bn-archive-empty-icon" />
          <span>등록된 시즌이 없습니다.</span>
          <span className="bn-archive-empty-sub">상단에서 시즌(차수)을 먼저 설정하세요.</span>
        </div>
      ) : (
        <div className="bn-archive-layout archive-picker">
          <ArchivePhaseListSidebar
            phases={phases}
            brandCountByPhase={brandCountByPhase}
            loading={isLoading}
            filterYear={filterYear}
            visibleCount={filteredPhases.length}
            onFilterYear={setFilterYear}
            onOpenPhase={phase => openPhase(phase.id)}
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
                      <ArchivePhaseCard
                        key={phase.id}
                        phase={phase}
                        brandNames={brandNamesByPhase[phase.id] ?? []}
                        statusLabel={badge?.label ?? null}
                        statusDone={badge?.tone === 'completed'}
                        onOpen={() => openPhase(phase.id)}
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
