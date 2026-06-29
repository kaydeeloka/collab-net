import { useMemo, type ReactNode } from 'react'
import { BarChart2 } from 'lucide-react'
import ArchiveListSidebar from '@/components/ArchiveListSidebar'
import { formatKstShortDate } from '@/lib/kst-time'
import {
  groupPhasesByYear,
  phaseYearLabel,
  type SeasonArchivePhase,
} from '@/pages/archive/season/season-archive-shared'
import { getSeasonCollectionCopy } from '@/pages/archive/season/season-collection-content'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

export interface ArchivePhaseListSidebarProps {
  phases: SeasonArchivePhase[]
  brandCountByPhase?: Record<string, number>
  loading: boolean
  filterYear: string | null
  visibleCount: number
  onFilterYear: (yearKey: string | null) => void
  onOpenPhase: (phase: SeasonArchivePhase) => void
  selectedPhaseId?: string | null
  title?: string
  emptyMessage?: string
  itemIcon?: ReactNode
  getItemSubtitle?: (phase: SeasonArchivePhase, brandCount: number) => string
  showBrandPill?: boolean
}

export default function ArchivePhaseListSidebar({
  phases,
  brandCountByPhase = {},
  loading,
  filterYear,
  visibleCount,
  onFilterYear,
  onOpenPhase,
  selectedPhaseId = null,
  title = '아카이브 목록',
  emptyMessage = '등록된 시즌이 없습니다.',
  itemIcon = <BarChart2 size={13} strokeWidth={2.2} />,
  getItemSubtitle,
  showBrandPill = true,
}: ArchivePhaseListSidebarProps) {
  const groups = useMemo(
    () => groupPhasesByYear(phases).map(group => ({
      key: group.key,
      label: group.label,
      items: group.phases,
    })),
    [phases],
  )

  const countLabel = filterYear
    ? `${phaseYearLabel(filterYear)} · ${visibleCount}시즌`
    : `${visibleCount}시즌`

  return (
    <ArchiveListSidebar
      title={title}
      loading={loading}
      emptyMessage={emptyMessage}
      visibleCount={visibleCount}
      countLabel={countLabel}
      filterKey={filterYear}
      onFilterKey={onFilterYear}
      groups={groups}
      getItemKey={phase => phase.id}
      selectedKey={selectedPhaseId}
      onSelectItem={onOpenPhase}
      renderItem={phase => {
        const brandCount = brandCountByPhase[phase.id] ?? 0
        const subtitle = getItemSubtitle
          ? getItemSubtitle(phase, brandCount)
          : getSeasonCollectionCopy(phase.name, brandCount, phase.project_concept).title

        return {
          icon: itemIcon,
          primary: phase.name,
          subs: [subtitle, formatPhasePeriod(phase.started_at, phase.ended_at)],
          pill: showBrandPill && brandCount > 0 ? `${brandCount}브랜드` : null,
        }
      }}
    />
  )
}
