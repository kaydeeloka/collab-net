import PageSection from '../../components/PageSection'

export default function InfluencerStatus() {
  return (
    <div className="page page--fill">
      <PageSection icon="👥" title="인플루언서 현황" desc="서치 · 컨택 · 확정 단계별 인플루언서 현황을 한눈에 확인합니다.">
        <div className="cards">
          <div className="card"><div className="card-label">서치 완료</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">컨택 진행</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">확정</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">리뷰 업로드</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>인플루언서명</th><th>플랫폼</th><th>팔로워</th><th>컨택 상태</th><th>확정 여부</th><th>리뷰 업로드</th></tr>
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
