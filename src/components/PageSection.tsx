import { useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  icon?: string
  title: string
  desc?: string
  children: ReactNode
  defaultOpen?: boolean
}

export default function PageSection({ icon, title, desc, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="psec">
      <div className="psec-header" onClick={() => setOpen(o => !o)}>
        <div className="psec-info">
          {icon && <span className="psec-deco">{icon}</span>}
          <div>
            <div className="psec-title">{title}</div>
            {desc && <div className="psec-desc">{desc}</div>}
          </div>
        </div>
        <span className={`psec-chevron${open ? ' open' : ''}`}>▾</span>
      </div>
      {open && <div className="psec-body">{children}</div>}
    </div>
  )
}
