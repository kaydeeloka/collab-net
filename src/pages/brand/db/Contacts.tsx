export default function BrandDbContacts() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">👤</span>
        <div>
          <div className="page-banner-title">개인 연락처 DB</div>
          <div className="page-banner-desc">브랜드 담당자 개인 연락처 데이터베이스를 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">등록 담당자</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">이메일 보유</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">SNS 연락처 보유</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>담당자명</th><th>직책</th><th>이메일</th><th>연락처</th><th>등록일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
