import { type ReactNode } from 'react'

interface Props {
  label: string
  value?: ReactNode
  empty?: boolean
}

export default function DetailRow({ label, value, empty }: Props) {
  const isEmpty = empty ?? (value === null || value === undefined || value === '' || value === '—')
  return (
    <div className="ui-detail-row">
      <span className="ui-detail-row__label">{label}</span>
      <span className={`ui-detail-row__value${isEmpty ? ' is-empty' : ''}`}>
        {isEmpty ? '—' : value}
      </span>
    </div>
  )
}

export function DetailList({ children }: { children: ReactNode }) {
  return <div className="ui-detail-list">{children}</div>
}
