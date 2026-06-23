import { useState, type ReactNode } from 'react'
import { Calendar, ChevronDown, LayoutGrid } from 'lucide-react'
import Spinner from '@/components/Spinner'

export interface ArchiveListGroup<T> {
  key: string
  label: string
  items: T[]
}

export interface ArchiveListSidebarItemContent {
  icon: ReactNode
  primary: string
  subs?: string[]
  pill?: string | null
}

export interface ArchiveListSidebarProps<T> {
  title?: string
  loading: boolean
  emptyMessage?: string
  visibleCount: number
  countLabel: string
  filterKey: string | null
  onFilterKey: (key: string | null) => void
  groups: ArchiveListGroup<T>[]
  getItemKey: (item: T) => string
  selectedKey?: string | null
  onSelectItem: (item: T) => void
  renderItem: (item: T) => ArchiveListSidebarItemContent
}

export default function ArchiveListSidebar<T>({
  title = '아카이브 목록',
  loading,
  emptyMessage = '등록된 항목이 없습니다.',
  visibleCount,
  countLabel,
  filterKey,
  onFilterKey,
  groups,
  getItemKey,
  selectedKey = null,
  onSelectItem,
  renderItem,
}: ArchiveListSidebarProps<T>) {
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null)

  function showAll() {
    setOpenGroupKey(null)
    onFilterKey(null)
  }

  function selectGroup(key: string) {
    if (openGroupKey === key) {
      setOpenGroupKey(null)
      if (filterKey === key) onFilterKey(null)
    } else {
      setOpenGroupKey(key)
      onFilterKey(key)
    }
  }

  const hasItems = groups.some(group => group.items.length > 0)

  return (
    <aside className="bn-archive-sidebar">
      <div className="bn-archive-sidebar__head">
        <Calendar size={15} strokeWidth={2.2} />
        <span>{title}</span>
        {!loading && visibleCount > 0 && (
          <span className="bn-archive-sidebar__count">{countLabel}</span>
        )}
      </div>

      <button
        type="button"
        className={`bn-archive-sidebar__all${filterKey === null && openGroupKey === null ? ' selected' : ''}`}
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

        {!loading && !hasItems && (
          <div className="bn-archive-sidebar__empty">{emptyMessage}</div>
        )}

        {!loading && groups.map(group => {
          const isOpen = openGroupKey === group.key
          const isFiltered = filterKey === group.key
          return (
            <div key={group.key} className="bn-archive-sidebar__group">
              <button
                type="button"
                className={`bn-archive-sidebar__month${isOpen ? ' open' : ''}${isFiltered ? ' filtered' : ''}`}
                onClick={() => selectGroup(group.key)}
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
                    const key = getItemKey(item)
                    const isSelected = selectedKey != null && key === selectedKey
                    const content = renderItem(item)
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`bn-archive-sidebar__item${isSelected ? ' selected' : ''}`}
                        onClick={() => onSelectItem(item)}
                      >
                        <span className="bn-archive-sidebar__item-icon">
                          {content.icon}
                        </span>
                        <span className="bn-archive-sidebar__item-body">
                          <span className="bn-archive-sidebar__item-date">{content.primary}</span>
                          {content.subs?.map((sub, index) => (
                            <span key={index} className="bn-archive-sidebar__item-sub">{sub}</span>
                          ))}
                        </span>
                        {content.pill && (
                          <span className="bn-archive-sidebar__item-pill">{content.pill}</span>
                        )}
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
