import { useState } from 'react'
import type { ReactNode } from 'react'

interface StatBadge {
  label: string
  value: string
  highlight?: boolean
}

interface Props {
  icon?: ReactNode
  title: string
  desc?: string
  stats?: StatBadge[]
  children: ReactNode
  defaultOpen?: boolean
}

export default function PageSection({ icon, title, desc, stats, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="psec">
      <div className="psec-header" onClick={() => setOpen(o => !o)}>
        <div className="psec-info">
          {icon && <span className="psec-deco">{icon}</span>}
          <div>
            <div className="psec-title">{title}</div>
            {desc && !stats && <div className="psec-desc">{desc}</div>}
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div className="psec-stats">
            {stats.map(s => (
              <div key={s.label} className={`psec-stat${s.highlight ? ' psec-stat--hi' : ''}`}>
                <span className="psec-stat-val">{s.value}</span>
                <span className="psec-stat-lbl">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        <span className={`psec-chevron${open ? ' open' : ''}`}>▾</span>
      </div>
      {open && <div className="psec-body">{children}</div>}
    </div>
  )
}
