import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ChevronRight, Palette } from 'lucide-react'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import ArchivePhaseListSidebar from '@/components/ArchivePhaseListSidebar'
import { usePhase } from '@/contexts/PhaseContext'
import { getPhaseStatusBadge } from '@/lib/phase'
import { formatKstShortDate } from '@/lib/kst-time'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'
import '../brand-report/season-collection.css'
import './design-archive.css'
import { phaseYearKey } from '../brand-report/season-archive-shared'
import { designCoverPath, loadStorageImageUrl } from './design-archive-images'
import { designArchivePath, designArchiveTitle } from './design-slug'
import type { PhaseSlugInput } from './design-slug'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

interface DesignPhase extends PhaseSlugInput {
  started_at: string | null
  ended_at: string | null
  collection_img: string | null
  design_theme_img?: string | null
}

function DesignPhaseCard({
  phase,
  phases,
  coverPath,
  startedAt,
  endedAt,
  statusLabel,
  statusDone,
}: {
  phase: DesignPhase
  phases: DesignPhase[]
  coverPath: string | null
  startedAt: string | null
  endedAt: string | null
  statusLabel: string | null
  statusDone: boolean
}) {
  const title = designArchiveTitle(phase)
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
    <Link to={designArchivePath(phase, phases)} className="brand-archive-card design-archive-card season-collection-card">
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
        <div className="brand-archive-card__tag">Kit Design · {phase.name}</div>
        <div className="brand-archive-card__title">{title}</div>
        <div className="brand-archive-card__product">{formatPhasePeriod(startedAt, endedAt)}</div>
        <div className="brand-archive-card__footer">
          <span className="brand-archive-card__cta">
            상세 보기
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ArchiveDesign() {
  const navigate = useNavigate()
  const { phases, loading, activePhaseId } = usePhase()
  const [filterYear, setFilterYear] = useState<string | null>(null)

  const filteredPhases = useMemo(() => {
    if (!filterYear) return phases
    return phases.filter(phase => {
      const key = phaseYearKey(phase) ?? 'unknown'
      return key === filterYear
    })
  }, [phases, filterYear])

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title="디자인 자료 아카이브"
          description="시즌별 키트 디자인 — 테마, 키트 박스, 컬렉션 카드, 브로슈어를 아카이브합니다."
        />
      </PageHeroBanner>

      {loading ? (
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
          <ArchivePhaseListSidebar
            title="디자인 아카이브"
            phases={phases}
            loading={loading}
            filterYear={filterYear}
            visibleCount={filteredPhases.length}
            onFilterYear={setFilterYear}
            itemIcon={<Palette size={13} strokeWidth={2.2} />}
            getItemSubtitle={phase => designArchiveTitle(phase)}
            showBrandPill={false}
            onOpenPhase={phase => {
              navigate(designArchivePath(phase, phases))
            }}
          />
          <div className="bn-archive-main">
            {!filteredPhases.length ? (
              <div className="bn-archive-empty-panel">
                {filterYear ? `${filterYear}년 시즌이 없습니다.` : '표시할 시즌이 없습니다.'}
              </div>
            ) : (
              <div className="bn-archive-cards-wrap">
                <div className="brand-archive-grid bn-archive-cards-grid design-archive-grid">
                  {filteredPhases.map(phase => {
                    const badge = getPhaseStatusBadge(phase, activePhaseId)
                    return (
                      <DesignPhaseCard
                        key={phase.id}
                        phase={phase}
                        phases={phases}
                        coverPath={designCoverPath(phase)}
                        startedAt={phase.started_at}
                        endedAt={phase.ended_at}
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
