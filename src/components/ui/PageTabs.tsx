import { type CSSProperties, type ReactNode } from 'react'

export interface PageTabItem<T extends string = string> {
  id: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

interface Props<T extends string = string> {
  tabs: PageTabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  style?: CSSProperties
}

/** In-page tabs — underline style (blue-dk active, gray-5 inactive). */
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
          aria-disabled={tab.disabled || undefined}
          disabled={tab.disabled}
          className={`page-tab${active === tab.id ? ' is-active' : ''}${tab.disabled ? ' is-disabled' : ''}`}
          onClick={() => { if (!tab.disabled) onChange(tab.id) }}
        >
          {tab.icon && <span className="page-tab-icon">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
