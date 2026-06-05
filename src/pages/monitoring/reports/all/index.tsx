export default function ReportsAll() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📚</span>
        <div>
          <div className="page-banner-title">전체 리포트 아카이브</div>
          <div className="page-banner-desc">모든 캠페인의 전체 성과 리포트를 아카이브합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">전체 캠페인</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">총 리뷰</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">누적 조회수</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>캠페인명</th><th>기간</th><th>브랜드 수</th><th>인플루언서 수</th><th>총 조회수</th><th>리포트 링크</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
