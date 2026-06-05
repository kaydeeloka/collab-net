export default function SearchSettings() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">⚙️</span>
        <div>
          <div className="page-banner-title">서치 조건 설정</div>
          <div className="page-banner-desc">인플루언서 탐색 시 적용할 필터 조건을 설정합니다.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {[
          { label: '플랫폼', desc: 'TikTok / Instagram' },
          { label: '팔로워 범위', desc: '최소 ~ 최대' },
          { label: '인게이지먼트율', desc: '% 이상' },
          { label: '카테고리 / 키워드', desc: '뷰티, K-뷰티 등' },
          { label: '국가', desc: '한국, 일본, 글로벌 등' },
          { label: '언어', desc: '한국어, 영어 등' },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-5)' }}>{item.desc}</div>
            <div style={{ height: 36, background: 'var(--gray-2)', borderRadius: 8, marginTop: 10 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
