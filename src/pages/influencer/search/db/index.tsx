export default function SearchDbList() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🗂️</span>
        <div>
          <div className="page-banner-title">DB 리스트</div>
          <div className="page-banner-desc">리스트업된 전체 인플루언서 DB를 조회합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">전체 DB</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">K-뷰티</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">일반뷰티</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>순위</th><th>핸들</th><th>인플루언서명</th><th>이메일</th><th>팔로워</th><th>인게이지먼트율</th><th>카테고리</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
