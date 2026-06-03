export default function DeliveryStatus() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📦</span>
        <div>
          <div className="page-banner-title">배송 현황</div>
          <div className="page-banner-desc">전체 배송 현황 요약 — 단계별 건수 및 미수취 알림을 확인합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">총 발송</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">배송 중</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">도착 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미수취 / 오류</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>운송장번호</th><th>발송일</th><th>배송 상태</th><th>도착일</th><th>비고</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
