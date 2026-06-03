import PageSection from '../../components/PageSection'

export default function BrandStatus() {
  return (
    <div className="page page--fill">
      <PageSection icon="🏢" title="브랜드 현황" desc="컨택·확정·자료 수집 단계별 브랜드 현황을 관리합니다.">
        <div className="cards">
          <div className="card"><div className="card-label">총 브랜드</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">컨택 진행</div><div className="card-value">—</div></div>
          <div className="card highlight"><div className="card-label">확정</div><div className="card-value">—</div></div>
          <div className="card"><div className="card-label">자료 수집 완료</div><div className="card-value">—</div></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>브랜드명</th><th>담당자</th><th>컨택 상태</th><th>확정 여부</th><th>로고 파일</th><th>성분 파일</th></tr>
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
