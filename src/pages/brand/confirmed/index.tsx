export default function BrandConfirmed() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🎯</span>
        <div>
          <div className="page-banner-title">확정 브랜드 명단</div>
          <div className="page-banner-desc">협업 확정 브랜드의 자료 수집 및 폴더 관리 현황을 확인합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">확정 브랜드</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">폴더 생성 완료</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">자료 수집 완료</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>폴더 생성</th><th>로고 파일</th><th>성분 파일</th><th>기타 자료</th><th>확정일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
