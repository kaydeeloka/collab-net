export default function ConfirmedShipping() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📮</span>
        <div>
          <div className="page-banner-title">배송 주소 구글폼 연동</div>
          <div className="page-banner-desc">확정 인플루언서 배송 주소 수집 현황 및 구글폼 응답을 확인합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">주소 수집 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미제출</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">수집률</div><div className="card-value">—%</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>제출 여부</th><th>수령인</th><th>연락처</th><th>주소</th><th>제출일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
