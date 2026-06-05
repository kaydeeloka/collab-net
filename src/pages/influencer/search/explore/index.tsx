export default function SearchExplore() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🔍</span>
        <div>
          <div className="page-banner-title">조건별 탐색 · 리스트업 연동</div>
          <div className="page-banner-desc">설정된 조건으로 인플루언서를 탐색하고 리스트업 DB에 연동합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">탐색 결과</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">리스트업 추가</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">중복 제외</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>핸들</th><th>인플루언서명</th><th>플랫폼</th><th>팔로워</th><th>인게이지먼트율</th><th>리스트업</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>탐색 결과 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
