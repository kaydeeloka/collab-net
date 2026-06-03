export default function ContactList() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📋</span>
        <div>
          <div className="page-banner-title">컨택 대상 명단</div>
          <div className="page-banner-desc">이번 차수 컨택 대상 인플루언서 명단을 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">컨택 대상</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">발송 완료</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">답장 수신</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미응답</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>이메일</th><th>플랫폼</th><th>팔로워</th><th>컨택 상태</th><th>발송일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
