export default function ReviewContent() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📹</span>
        <div>
          <div className="page-banner-title">콘텐츠 관리</div>
          <div className="page-banner-desc">리뷰 콘텐츠 수치 팔로업 및 최종 리포트 작성을 관리합니다.</div>
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
      <div style={{ fontSize: 44, lineHeight: 1 }}>🚧</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-7)', letterSpacing: '-0.5px' }}>개발중</div>
      <div style={{ fontSize: 13, color: 'var(--gray-4)', textAlign: 'center', lineHeight: 1.7 }}>
        이 페이지는 현재 개발 중입니다.<br />곧 서비스될 예정입니다.
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? '#3b82f6' : 'var(--gray-3)' }} />
        ))}
      </div>
    </div>
  )
}
