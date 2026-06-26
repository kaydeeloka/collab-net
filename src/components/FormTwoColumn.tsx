import type { ReactNode } from 'react'

interface Column {
  title: string
  children: ReactNode
}

/** Two-column form layout — each side gets an uppercase section label above its fields. */
export function FormTwoColumn({ left, right }: { left: Column; right: Column }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
          {left.title}
        </div>
        {left.children}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-5)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 2 }}>
          {right.title}
        </div>
        {right.children}
      </div>
    </div>
  )
}
