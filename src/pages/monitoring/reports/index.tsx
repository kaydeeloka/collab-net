export default function ReportArchive() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🗄️</span>
        <div>
          <div className="page-banner-title">리포트 아카이브</div>
          <div className="page-banner-desc">브랜드별 · 전체 캠페인 리포트를 아카이브합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">전체 리포트</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">브랜드별 리포트</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">최근 업로드</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>리포트명</th><th>브랜드</th><th>차수</th><th>기간</th><th>파일 링크</th><th>작성일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
