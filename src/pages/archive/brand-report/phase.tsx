import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { usePhase } from '@/contexts/PhaseContext'
import { formatKstShortDate } from '@/lib/kst-time'
import Spinner from '@/components/Spinner'
import '@/pages/brand/confirmed/archive/archive.css'

function formatPhasePeriod(startedAt: string | null, endedAt: string | null) {
  const start = formatKstShortDate(startedAt)
  const end = formatKstShortDate(endedAt)
  if (start && end) return `${start} – ${end}`
  if (start) return `${start} –`
  if (end) return `– ${end}`
  return '기간 미설정'
}

export default function ArchiveBrandReportPhase() {
  const { phaseId } = useParams<{ phaseId: string }>()
  const { phases, loading } = usePhase()
  const phase = phases.find(p => p.id === phaseId)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner />
      </div>
    )
  }

  if (!phase) {
    return (
      <div className="page page--fill">
        <div className="brand-archive-empty">
          시즌을 찾을 수 없습니다.
          <div style={{ marginTop: 16 }}>
            <Link to="/archive/brand-report" className="brand-archive-detail__back">
              <ArrowLeft size={14} />
              시즌 컬렉션으로
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco"><BarChart2 size={28} /></span>
        <div>
          <div className="page-banner-title">시즌 컬렉션 · {phase.name}</div>
          <div className="page-banner-desc">{formatPhasePeriod(phase.started_at, phase.ended_at)}</div>
        </div>
        <div className="page-banner-actions">
          <Link to="/archive/brand-report" className="brand-archive-detail__back">
            <ArrowLeft size={14} />
            전체 시즌
          </Link>
        </div>
      </div>

      <WipBlock phaseName={phase.name} />
    </div>
  )
}

function WipBlock({ phaseName }: { phaseName: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, minHeight: 320, gap: 14,
      background: 'var(--gray-0)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: 48,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-7)', letterSpacing: '-0.5px' }}>
        {phaseName} 리포트 준비 중
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-4)', textAlign: 'center', lineHeight: 1.7 }}>
        이 시즌의 브랜드별 성과 리포트는 현재 개발 중입니다.<br />
        곧 서비스될 예정입니다.
      </div>
    </div>
  )
}
