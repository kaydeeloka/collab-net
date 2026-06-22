import type { ReactNode } from 'react'

export function ReportCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--gray-2)', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ color: 'var(--gray-6)', display: 'flex' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-8)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

export function ReportStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-8)' }}>{value}</div>
    </div>
  )
}
