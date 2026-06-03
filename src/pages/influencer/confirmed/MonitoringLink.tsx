export default function ConfirmedMonitoringLink() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🔗</span>
        <div>
          <div className="page-banner-title">리뷰 모니터링 연동</div>
          <div className="page-banner-desc">확정 인플루언서의 계정을 리뷰 모니터링 시스템과 연동합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">모니터링 연동</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미연동</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">리뷰 감지됨</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>핸들</th><th>플랫폼</th><th>모니터링 연동</th><th>마지막 리뷰</th><th>감지 키워드</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
