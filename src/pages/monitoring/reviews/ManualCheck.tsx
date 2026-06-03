export default function ReviewsManualCheck() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">✏️</span>
        <div>
          <div className="page-banner-title">수기 리뷰 체크 기능</div>
          <div className="page-banner-desc">자동 감지 외 수동으로 리뷰를 확인하고 체크합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">수기 체크 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미체크</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">확인된 리뷰</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>플랫폼</th><th>리뷰 링크</th><th>체크 여부</th><th>체크 담당자</th><th>체크일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
