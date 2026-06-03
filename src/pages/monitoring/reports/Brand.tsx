export default function ReportsBrand() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🏢</span>
        <div>
          <div className="page-banner-title">브랜드 별 리포트 아카이브</div>
          <div className="page-banner-desc">브랜드별로 정리된 캠페인 성과 리포트를 관리합니다.</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>캠페인명</th><th>차수</th><th>인플루언서 수</th><th>총 조회수</th><th>리포트 링크</th><th>작성일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
