import { useMemo } from 'react'
import { Music2 } from 'lucide-react'
import ArchiveListSidebar from '@/components/ArchiveListSidebar'

export interface TrendDraft {
  subject: string
  body: string
  date: string
  ts: number
}

interface ArchiveGroup {
  label: string
  items: TrendDraft[]
}

export function draftMonthKey(draft: TrendDraft) {
  const dt = new Date(draft.ts)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export function groupDrafts(drafts: TrendDraft[]) {
  const groups: Record<string, ArchiveGroup> = {}
  const order: string[] = []

  for (const draft of drafts) {
    const key = draftMonthKey(draft)
    const label = `${new Date(draft.ts).getFullYear()}년 ${new Date(draft.ts).getMonth() + 1}월`
    if (!groups[key]) {
      groups[key] = { label, items: [] }
      order.push(key)
    }
    groups[key].items.push(draft)
  }

  return { order, groups }
}

export default function TiktokArchiveSidebar({
  drafts,
  loading,
  selectedTs,
  filterMonth,
  visibleCount,
  onFilterMonth,
  onSelect,
}: {
  drafts: TrendDraft[]
  loading: boolean
  selectedTs: number | null
  filterMonth: string | null
  visibleCount: number
  onFilterMonth: (monthKey: string | null) => void
  onSelect: (ts: number) => void
}) {
  const groups = useMemo(() => {
    const { order, groups: grouped } = groupDrafts(drafts)
    return order.map(key => ({
      key,
      label: grouped[key].label,
      items: grouped[key].items,
    }))
  }, [drafts])

  const countLabel = filterMonth
    ? `${groups.find(group => group.key === filterMonth)?.label ?? filterMonth} · ${visibleCount}주`
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
      getItemKey={draft => String(draft.ts)}
      selectedKey={selectedTs != null ? String(selectedTs) : null}
      onSelectItem={draft => onSelect(draft.ts)}
      renderItem={draft => ({
        icon: <Music2 size={13} strokeWidth={2.2} />,
        primary: draft.date,
        subs: draft.subject ? [draft.subject] : undefined,
      })}
    />
  )
}
