export default function DDay() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📅</span>
        <div>
          <div className="page-banner-title">D-DAY (발송/마감)</div>
          <div className="page-banner-desc">캠페인 발송일 및 마감일 D-DAY 현황을 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card highlight"><div className="card-label">발송 D-DAY</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">마감 D-DAY</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">진행 중 캠페인</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>캠페인명</th><th>발송일</th><th>마감일</th><th>D-DAY</th><th>상태</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
