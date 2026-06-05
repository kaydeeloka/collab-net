export default function ReviewsBrandCheck() {
  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco">🏷️</span>
        <div>
          <div className="page-banner-title">Mi Muse / 브랜드 리뷰 체크란</div>
          <div className="page-banner-desc">Mi Muse 및 협력 브랜드 언급 리뷰를 체크합니다.</div>
        </div>
      </div>
      <div className="cards">
        <div className="card highlight"><div className="card-label">Mi Muse 언급</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">브랜드 언급</div><div className="card-value">—</div></div>
        <div className="card"><div className="card-label">미체크</div><div className="card-value">—</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>인플루언서명</th><th>리뷰 링크</th><th>Mi Muse 언급</th><th>브랜드 언급</th><th>체크 여부</th><th>메모</th></tr>
          </thead>
          <tbody>
            <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
