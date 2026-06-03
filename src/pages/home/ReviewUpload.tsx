import PageSection from '../../components/PageSection'

export default function ReviewUpload() {
  return (
    <div className="page page--fill">
      <PageSection icon="📝" title="리뷰 업로드 현황" desc="각 인플루언서의 리뷰 업로드 여부 및 링크를 한눈에 파악합니다.">
        <div className="cards">
          <div className="card"><div className="card-label">업로드 완료</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">미업로드</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">업로드율</div><div className="card-value">—%</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>인플루언서명</th><th>플랫폼</th><th>업로드 여부</th><th>리뷰 링크</th><th>업로드 일자</th><th>조회수</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>
    </div>
  )
}
