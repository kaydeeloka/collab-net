export default function TiktokTrend() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🎵</span>
        <div>
          <div className="page-banner-title">틱톡 트렌드 분석</div>
          <div className="page-banner-desc">틱톡 인기 해시태그 · 음원 · 영상 트렌드를 분석합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">인기 해시태그</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">급상승 음원</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">뷰티 카테고리 순위</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>순위</th><th>해시태그 / 키워드</th><th>영상 수</th><th>총 조회수</th><th>전일 대비</th><th>수집일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
