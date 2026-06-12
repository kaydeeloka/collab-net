import { Palette } from 'lucide-react'

export default function ArchiveDesign() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco"><Palette size={28} /></span>
        <div>
          <div className="page-banner-title">디자인 자료 아카이브</div>
          <div className="page-banner-desc">키트 디자인 파일 및 발주 아카이브를 관리합니다.</div>
        </div>
      </div>
      <WipBlock />
    </div>
  )
}

function WipBlock() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, minHeight: 320, gap: 14,
      background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: 48,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-7)', letterSpacing: '-0.5px' }}>개발중</div>
      <div style={{ fontSize: 13, color: 'var(--gray-4)', textAlign: 'center', lineHeight: 1.7 }}>
        이 페이지는 현재 개발 중입니다.<br />곧 서비스될 예정입니다.
      </div>
    </div>
  )
}
