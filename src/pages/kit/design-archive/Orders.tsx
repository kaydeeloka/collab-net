export default function DesignArchiveOrders() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📄</span>
        <div>
          <div className="page-banner-title">발주 파일 아카이브</div>
          <div className="page-banner-desc">제품 발주 관련 파일을 아카이브하고 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">발주 건수</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">파일 등록 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미등록</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>발주번호</th><th>브랜드명</th><th>제품명</th><th>파일 링크</th><th>발주일</th><th>비고</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
