export default function ReviewsUploadStatus() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📡</span>
        <div>
          <div className="page-banner-title">인플루언서 별 리뷰 업로드 여부</div>
          <div className="page-banner-desc">각 인플루언서가 리뷰를 업로드했는지 여부를 추적합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">전체 인플루언서</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">업로드 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미업로드</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">업로드율</div><div className="card-value">—%</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>플랫폼</th><th>핸들</th><th>업로드 여부</th><th>리뷰 링크</th><th>업로드일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
