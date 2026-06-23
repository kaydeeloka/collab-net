import { useMemo, useState } from 'react'
import { Calendar, ChevronDown, LayoutGrid, Palette } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatKstShortDate } from '@/lib/kst-time'
import Spinner from '@/components/Spinner'
import { groupPhasesByYear, phaseYearLabel, type SeasonArchivePhase } from '../brand-report/season-archive-shared'
import { designArchivePath, designArchiveTitle } from './design-slug'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

export default function DesignArchiveSidebar({
  allPhases,
  loading,
  filterYear,
  visibleCount,
  onFilterYear,
}: {
  allPhases: SeasonArchivePhase[]
  loading: boolean
  filterYear: string | null
  visibleCount: number
  onFilterYear: (yearKey: string | null) => void
}) {
  const navigate = useNavigate()
  const groups = useMemo(() => groupPhasesByYear(allPhases), [allPhases])
  const [openYear, setOpenYear] = useState<string | null>(null)

  function showAll() {
    setOpenYear(null)
    onFilterYear(null)
  }

  function selectYear(key: string) {
    if (openYear === key) {
      setOpenYear(null)
      if (filterYear === key) onFilterYear(null)
    } else {
      setOpenYear(key)
      onFilterYear(key)
    }
  }

  const countLabel = filterYear
    ? `${phaseYearLabel(filterYear)} · ${visibleCount}시즌`
    : `${visibleCount}시즌`

  return (
    <aside className="bn-archive-sidebar">
      <div className="bn-archive-sidebar__head">
        <Calendar size={15} strokeWidth={2.2} />
        <span>디자인 아카이브</span>
        {!loading && visibleCount > 0 && (
          <span className="bn-archive-sidebar__count">{countLabel}</span>
        )}
      </div>

      <button
        type="button"
        className={`bn-archive-sidebar__all${filterYear === null && openYear === null ? ' selected' : ''}`}
        onClick={showAll}
      >
        <LayoutGrid size={14} />
        전체 보기
      </button>

      <div className="bn-archive-sidebar__list">
        {loading && (
          <div className="bn-archive-sidebar__loading">
            <Spinner sm /> 불러오는 중...
          </div>
        )}

        {!loading && !allPhases.length && (
          <div className="bn-archive-sidebar__empty">등록된 시즌이 없습니다.</div>
        )}

        {!loading && groups.map(group => {
          const isOpen = openYear === group.key
          const isFiltered = filterYear === group.key
          return (
            <div key={group.key} className="bn-archive-sidebar__group">
              <button
                type="button"
                className={`bn-archive-sidebar__month${isOpen ? ' open' : ''}${isFiltered ? ' filtered' : ''}`}
                onClick={() => selectYear(group.key)}
              >
                <span className="bn-archive-sidebar__month-left">
                  <ChevronDown size={14} className={`bn-archive-sidebar__chev${isOpen ? ' open' : ''}`} />
                  <span>{group.label}</span>
                </span>
                <span className="bn-archive-sidebar__month-count">{group.phases.length}</span>
              </button>

              {isOpen && (
                <div className="bn-archive-sidebar__items">
                  {group.phases.map(phase => (
                    <button
                      key={phase.id}
                      type="button"
                      className="bn-archive-sidebar__item"
                      onClick={() => navigate(designArchivePath(phase, allPhases))}
                    >
                      <span className="bn-archive-sidebar__item-icon">
                        <Palette size={13} strokeWidth={2.2} />
                      </span>
                      <span className="bn-archive-sidebar__item-body">
                        <span className="bn-archive-sidebar__item-date">{phase.name}</span>
                        <span className="bn-archive-sidebar__item-sub">{designArchiveTitle(phase)}</span>
                        <span className="bn-archive-sidebar__item-sub">
                          {formatPhasePeriod(phase.started_at, phase.ended_at)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
