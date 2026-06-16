import { type CSSProperties } from 'react'

export interface PageTabItem<T extends string = string> {
  id: T
  label: string
}

interface Props<T extends string = string> {
  tabs: PageTabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  style?: CSSProperties
}

/** Unified in-page tabs — influencer underline style (blue-dk active, gray-5 inactive). */
export default function PageTabs<T extends string = string>({
  tabs,
  active,
  onChange,
  className = '',
  style,
}: Props<T>) {
  return (
    <div className={`page-tab-bar ${className}`.trim()} style={style} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`page-tab${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
