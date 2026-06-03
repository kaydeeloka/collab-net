export default function BrandContact() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🤝</span>
        <div>
          <div className="page-banner-title">브랜드 컨택</div>
          <div className="page-banner-desc">브랜드 컨택 대상 선정부터 완료까지 전체 진행 현황을 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">컨택 대상</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">발송 완료</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">답장 수신</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">확정</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>컨택 방법</th><th>컨택 상태</th><th>발송일</th><th>답장 여부</th><th>확정 여부</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
