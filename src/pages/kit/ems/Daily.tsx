export default function EmsDaily() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📬</span>
        <div>
          <div className="page-banner-title">각 배송 단계 데일리 추적</div>
          <div className="page-banner-desc">EMS 배송 단계별 일일 현황을 추적합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">발송 전</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">발송 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">세관 통과</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">배달 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">오류 / 반송</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>운송장번호</th><th>현재 단계</th><th>위치</th><th>업데이트 시각</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
