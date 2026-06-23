import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'
import { useArchivePhase } from './use-archive-phase'
import Spinner from '@/components/Spinner'

export default function ArchiveBrandReportSection() {
  const { phase, phasesLoading } = useArchivePhase()

  if (phasesLoading || !phase) {
    return (
      <div className="page page--fill" style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div className="page page--fill">
      <PageHeroBanner>
        <PageHeroBannerContent
          title={`${phase.name} · 브랜드별 리포트`}
          description={`${phase.name} 시즌 브랜드별 성과 리포트 아카이브`}
          actions={(
            <Link to="/archive" className="design-archive-detail__back">
              <ArrowLeft size={14} />
              시즌 선택
            </Link>
          )}
        />
      </PageHeroBanner>
      <WipBlock phaseName={phase.name} />
    </div>
  )
}

function WipBlock({ phaseName }: { phaseName: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, minHeight: 320, gap: 14, margin: '0 24px 48px',
      background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: 48,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-7)', letterSpacing: '-0.5px' }}>
        {phaseName} 리포트 · 개발중
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-4)', textAlign: 'center', lineHeight: 1.7 }}>
        브랜드별 리포트 아카이브는 현재 개발 중입니다.<br />곧 서비스될 예정입니다.
      </div>
    </div>
  )
}
