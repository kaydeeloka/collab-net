import { useMemo } from 'react'
import { Newspaper } from 'lucide-react'
import ArchiveListSidebar from '@/components/ArchiveListSidebar'
import {
  type ArchiveItem,
  archiveItemCardMeta,
  archiveItemLabel,
  archiveMonthLabel,
  groupArchiveByMonth,
} from './shared'

export default function ArchiveSidebar({
  items,
  loading,
  selectedKey,
  filterMonth,
  visibleCount,
  onFilterMonth,
  onSelect,
}: {
  items: ArchiveItem[]
  loading: boolean
  selectedKey: string
  filterMonth: string | null
  visibleCount: number
  onFilterMonth: (monthKey: string | null) => void
  onSelect: (windowsStart: string) => void
}) {
  const groups = useMemo(
    () => groupArchiveByMonth(items).map(group => ({
      key: group.key,
      label: group.label,
      items: group.items,
    })),
    [items],
  )

  const countLabel = filterMonth
    ? `${archiveMonthLabel(filterMonth)} · ${visibleCount}주`
    : `${visibleCount}주`

  return (
    <ArchiveListSidebar
      loading={loading}
      emptyMessage="저장된 아카이브가 없습니다."
      visibleCount={visibleCount}
      countLabel={countLabel}
      filterKey={filterMonth}
      onFilterKey={onFilterMonth}
      groups={groups}
      getItemKey={item => item.windows_start}
      selectedKey={selectedKey}
      onSelectItem={item => onSelect(item.windows_start)}
      renderItem={item => {
        const meta = archiveItemCardMeta(item)
        return {
          icon: <Newspaper size={13} strokeWidth={2.2} />,
          primary: archiveItemLabel(item),
          subs: meta.windowBasis ? [meta.windowBasis] : undefined,
          pill: `${meta.count}건`,
        }
      }}
    />
  )
}
