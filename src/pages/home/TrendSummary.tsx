import PageSection from '../../components/PageSection'

export default function TrendSummary() {
  return (
    <div className="page page--fill">
      <PageSection icon="📊" title="오늘의 트렌드 요약" desc="뉴스·틱톡 트렌드 분석 결과를 한눈에 요약합니다.">
        <div className="cards">
          <div className="card"><div className="card-label">뉴스 키워드</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">틱톡 인기 해시태그</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">급상승 트렌드</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>구분</th><th>키워드</th><th>트렌드 지수</th><th>전일 대비</th><th>수집 시각</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 40 }}>데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </PageSection>
    </div>
  )
}
