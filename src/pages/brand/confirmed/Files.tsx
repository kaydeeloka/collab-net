export default function BrandConfirmedFiles() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🖼️</span>
        <div>
          <div className="page-banner-title">로고 파일 · 제품 성분 파일 등</div>
          <div className="page-banner-desc">브랜드별 로고, 성분표 등 필수 파일 수집 현황을 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">로고 수집 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">성분표 수집 완료</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">전체 완료</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>파일 종류</th><th>파일명</th><th>링크</th><th>업로드일</th><th>비고</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
