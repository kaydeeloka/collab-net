import { type CSSProperties, type ReactNode } from 'react'

type Tone = 'success' | 'muted' | 'warning'

interface Props {
  tone?: Tone
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export default function Badge({ tone = 'muted', children, className = '', style }: Props) {
  return (
    <span className={`ui-badge ui-badge--${tone} ${className}`.trim()} style={style}>
      {children}
    </span>
  )
}
