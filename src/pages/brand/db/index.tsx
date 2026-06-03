export default function BrandDb() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🗃️</span>
        <div>
          <div className="page-banner-title">브랜드 DB</div>
          <div className="page-banner-desc">대표메일 DB와 개인 연락처 DB를 통합 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">전체 브랜드</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">대표메일 DB</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">개인 연락처 DB</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>대표메일</th><th>담당자명</th><th>담당자 연락처</th><th>등록일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
