export default function BrandConfirmedFolders() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📁</span>
        <div>
          <div className="page-banner-title">브랜드 별 필요 자료 폴더 생성</div>
          <div className="page-banner-desc">확정 브랜드별 구글 드라이브 폴더 생성 현황을 관리합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card"><div className="card-label">폴더 생성 완료</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미생성</div><div className="card-value">—</div></div>
        <div className="card highlight"><div className="card-label">자료 업로드 완료</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>폴더 링크</th><th>로고</th><th>성분표</th><th>기타</th><th>생성일</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
