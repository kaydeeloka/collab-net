export default function EmsPending() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">⚠️</span>
        <div>
          <div className="page-banner-title">미수취 건 · 아웃리치 진행</div>
          <div className="page-banner-desc">수령하지 못한 건을 확인하고 재발송 아웃리치를 진행합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">미수취 건</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">아웃리치 진행</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">재발송 완료</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>운송장번호</th><th>미수취 사유</th><th>아웃리치 상태</th><th>재발송 여부</th><th>처리일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
