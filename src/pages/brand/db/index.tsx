import { useState } from 'react'

type DbTab = 'mail' | 'contacts'

export default function BrandDb() {
  const [tab, setTab] = useState<DbTab>('mail')

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🗃️</span>
        <div>
          <div className="page-banner-title">브랜드 DB</div>
          <div className="page-banner-desc">대표메일 DB와 개인 연락처 DB를 통합 관리합니다.</div>
        </div>
      </div>

      <div className="ftab-bar">
        <button className={'ftab' + (tab === 'mail' ? ' active' : '')} onClick={() => setTab('mail')}>대표메일 DB</button>
        <button className={'ftab' + (tab === 'contacts' ? ' active' : '')} onClick={() => setTab('contacts')}>개인 연락처 DB</button>
      </div>

      <div className="ftab-content">
        {tab === 'mail' && <WipBlock title="대표메일 DB" desc="브랜드 대표 이메일 주소 데이터베이스를 관리합니다." />}
        {tab === 'contacts' && <WipBlock title="개인 연락처 DB" desc="브랜드 담당자 개인 연락처 데이터베이스를 관리합니다." />}
      </div>
    </div>
  )
}

function WipBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, minHeight: 320, gap: 14,
      background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: 48,
    }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>🚧</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-7)', letterSpacing: '-0.5px' }}>개발중</div>
      <div style={{ fontSize: 13, color: 'var(--gray-6)', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--gray-4)', textAlign: 'center', lineHeight: 1.7 }}>
        {desc}<br />곧 서비스될 예정입니다.
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#3b82f6' : 'var(--gray-3)' }} />
        ))}
      </div>
    </div>
  )
}
