import { useMemo, useState } from 'react'
import { Calendar, ChevronDown, LayoutGrid, Newspaper } from 'lucide-react'
import Spinner from '@/components/Spinner'
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
  const groups = useMemo(() => groupArchiveByMonth(items), [items])
  const [openMonth, setOpenMonth] = useState<string | null>(null)

  function showAll() {
    setOpenMonth(null)
    onFilterMonth(null)
  }

  function selectMonth(key: string) {
    if (openMonth === key) {
      setOpenMonth(null)
      if (filterMonth === key) onFilterMonth(null)
    } else {
      setOpenMonth(key)
      onFilterMonth(key)
    }
  }

  const countLabel = filterMonth
    ? `${archiveMonthLabel(filterMonth)} · ${visibleCount}주`
    : `${visibleCount}주`

  return (
    <aside className="bn-archive-sidebar">
      <div className="bn-archive-sidebar__head">
        <Calendar size={15} strokeWidth={2.2} />
        <span>아카이브 목록</span>
        {!loading && visibleCount > 0 && (
          <span className="bn-archive-sidebar__count">{countLabel}</span>
        )}
      </div>

      <button
        type="button"
        className={`bn-archive-sidebar__all${filterMonth === null && openMonth === null ? ' selected' : ''}`}
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

        {!loading && !items.length && (
          <div className="bn-archive-sidebar__empty">저장된 아카이브가 없습니다.</div>
        )}

        {!loading && groups.map(group => {
          const isOpen = openMonth === group.key
          const isFiltered = filterMonth === group.key
          return (
            <div key={group.key} className="bn-archive-sidebar__group">
              <button
                type="button"
                className={`bn-archive-sidebar__month${isOpen ? ' open' : ''}${isFiltered ? ' filtered' : ''}`}
                onClick={() => selectMonth(group.key)}
              >
                <span className="bn-archive-sidebar__month-left">
                  <ChevronDown size={14} className={`bn-archive-sidebar__chev${isOpen ? ' open' : ''}`} />
                  <span>{group.label}</span>
                </span>
                <span className="bn-archive-sidebar__month-count">{group.items.length}</span>
              </button>

              {isOpen && (
                <div className="bn-archive-sidebar__items">
                  {group.items.map(item => {
                    const meta = archiveItemCardMeta(item)
                    const isSelected = item.windows_start === selectedKey
                    return (
                      <button
                        key={item.windows_start}
                        type="button"
                        className={`bn-archive-sidebar__item${isSelected ? ' selected' : ''}`}
                        onClick={() => onSelect(item.windows_start)}
                      >
                        <span className="bn-archive-sidebar__item-icon">
                          <Newspaper size={13} strokeWidth={2.2} />
                        </span>
                        <span className="bn-archive-sidebar__item-body">
                          <span className="bn-archive-sidebar__item-date">{archiveItemLabel(item)}</span>
                          {meta.windowBasis && (
                            <span className="bn-archive-sidebar__item-sub">{meta.windowBasis}</span>
                          )}
                        </span>
                        <span className="bn-archive-sidebar__item-pill">{meta.count}건</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
