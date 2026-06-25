import React from 'react'

export interface FilterSegmentOption {
  value: string
  label: string
}

export interface FilterSegmentBarProps {
  label: string
  ariaLabel?: string
  value: string
  options: FilterSegmentOption[]
  onChange: (value: string) => void
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function FilterSegmentBar({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  children,
  className = '',
  style,
}: FilterSegmentBarProps) {
  return (
    <div className={`filters${className ? ` ${className}` : ''}`} style={style}>
      <div className="filter-segment" role="group" aria-label={ariaLabel ?? label}>
        <span className="filter-segment-label">{label}</span>
        {options.map(opt => (
          <button
            key={opt.value || '__all__'}
            type="button"
            data-value={opt.value}
            className={`filter-segment-btn${value === opt.value ? ' active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
