export default function BrandContactList() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">📋</span>
        <div>
          <div className="page-banner-title">컨택 대상 명단</div>
          <div className="page-banner-desc">이번 차수 브랜드 컨택 대상 목록을 관리합니다.</div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>브랜드명</th><th>카테고리</th><th>컨택 방법</th><th>우선순위</th><th>담당자</th><th>비고</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
