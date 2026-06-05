export default function EmsCheck() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🔎</span>
        <div>
          <div className="page-banner-title">도착 건 / 오류 건 수량 체크</div>
          <div className="page-banner-desc">도착 확인 및 오류·반송 건 수량을 체크합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card highlight"><div className="card-label">도착 확인</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">오류 건</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">반송 건</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미확인</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>운송장번호</th><th>발송일</th><th>상태</th><th>오류 사유</th><th>처리 결과</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
