export default function ReviewContent() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📈</span>
        <div>
          <div className="page-banner-title">리뷰 콘텐츠 수치 확인</div>
          <div className="page-banner-desc">리뷰 콘텐츠 조회수·좋아요·댓글 수치를 팔로업하고 최종 리포트를 작성합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">총 조회수</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">총 좋아요</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">총 댓글</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">평균 인게이지먼트율</div><div className="card-value">—%</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>플랫폼</th><th>리뷰 링크</th><th>조회수</th><th>좋아요</th><th>댓글</th><th>수치 확인일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
