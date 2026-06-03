export default function BrandContactTemplate() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✉️</span>
        <div>
          <div className="page-banner-title">아웃리치 템플릿 작성 / 선택</div>
          <div className="page-banner-desc">브랜드 컨택에 사용할 이메일 · DM 템플릿을 작성하거나 선택합니다.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-5)', marginBottom: 12 }}>템플릿 목록</div>
          <div style={{ color: 'var(--gray-4)', fontSize: 13 }}>저장된 템플릿 없음</div>
        </div>
        <div style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-5)', marginBottom: 12 }}>템플릿 편집</div>
          <div style={{ height: 320, background: 'var(--gray-1)', borderRadius: 8, border: '1px solid var(--gray-3)' }} />
        </div>
      </div>
    </div>
  )
}
