import { type ReactNode } from 'react'
import { Search } from 'lucide-react'

interface Props {
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  count?: string | number
  actions?: ReactNode
  children?: ReactNode
}

export default function PageToolbar({ search, count, actions, children }: Props) {
  return (
    <div className="ui-toolbar">
      <div className="ui-toolbar__start">
        {search && (
          <div className="ui-search">
            <Search size={16} className="ui-search__icon" />
            <input
              value={search.value}
              onChange={e => search.onChange(e.target.value)}
              placeholder={search.placeholder ?? '검색...'}
            />
          </div>
        )}
        {count !== undefined && (
          <span className="ui-count">{typeof count === 'number' ? `${count} 건` : count}</span>
        )}
        {children}
      </div>
      {actions && <div className="ui-toolbar__end">{actions}</div>}
    </div>
  )
}
