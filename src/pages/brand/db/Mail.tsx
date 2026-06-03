export default function BrandDbMail() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📧</span>
        <div>
          <div className="page-banner-title">대표메일 DB</div>
          <div className="page-banner-desc">브랜드 대표 이메일 주소 데이터베이스를 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">등록 브랜드</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">이메일 유효</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">컨택 이력 있음</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>대표메일</th><th>카테고리</th><th>마지막 컨택</th><th>컨택 횟수</th><th>메모</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
