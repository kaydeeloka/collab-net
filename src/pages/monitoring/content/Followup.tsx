export default function ContentFollowup() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🔄</span>
        <div>
          <div className="page-banner-title">리뷰 콘텐츠 수치 팔로업</div>
          <div className="page-banner-desc">업로드 후 시간대별 수치 변화를 추적합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">팔로업 대상</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">수치 업데이트</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">마지막 수집</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>D+1 조회수</th><th>D+7 조회수</th><th>D+30 조회수</th><th>최종 조회수</th><th>업데이트일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
