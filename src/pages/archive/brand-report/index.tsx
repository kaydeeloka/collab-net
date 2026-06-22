import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart2, ChevronRight } from 'lucide-react'
import { usePhase } from '@/contexts/PhaseContext'
import { getPhaseStatusBadge } from '@/lib/phase'
import { formatKstShortDate } from '@/lib/kst-time'
import { supabase } from '@/lib/supabase'
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

function PhaseCollectionCard({
  phaseId,
  name,
  startedAt,
  endedAt,
  brandCount,
  statusLabel,
  statusDone,
}: {
  phaseId: string
  name: string
  startedAt: string | null
  endedAt: string | null
  brandCount: number
  statusLabel: string | null
  statusDone: boolean
}) {
  return (
    <Link to={`/archive/brand-report/${phaseId}`} className="brand-archive-card">
      <div className="brand-archive-card__media">
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: 36,
            fontWeight: 800,
            color: 'rgba(255,255,255,.95)',
            letterSpacing: '-0.03em',
          }}
        >
          {name}
        </div>
        <div className="brand-archive-card__media-overlay" />
        {statusLabel && (
          <span
            className={`brand-archive-card__status ${
              statusDone ? 'brand-archive-card__status--done' : 'brand-archive-card__status--pending'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      <div className="brand-archive-card__body">
        <div className="brand-archive-card__title">시즌 {name}</div>
        <div className="brand-archive-card__product">{formatPhasePeriod(startedAt, endedAt)}</div>
        <div className="brand-archive-card__product" style={{ marginTop: 2 }}>
          확정 브랜드 {brandCount}개
        </div>
        <div className="brand-archive-card__footer">
          <span className="brand-archive-card__cta">
            리포트 보기
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ArchiveBrandReport() {
  const { phases, loading, activePhaseId } = usePhase()
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({})
  const [countsLoading, setCountsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      setCountsLoading(true)
      const { data } = await supabase.from('confirmed_brands').select('phase_id')
      if (cancelled) return

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const id = row.phase_id as string
        counts[id] = (counts[id] ?? 0) + 1
      }
      setBrandCounts(counts)
      setCountsLoading(false)
    }

    void loadCounts()
    return () => { cancelled = true }
  }, [])

  const isLoading = loading || countsLoading

  return (
    <div className="page page--fill">
      <div className="page-banner">
        <span className="page-banner-deco"><BarChart2 size={28} /></span>
        <div>
          <div className="page-banner-title">시즌 컬렉션</div>
          <div className="page-banner-desc">시즌별 브랜드 캠페인 성과 리포트를 모아봅니다.</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : !phases.length ? (
        <div className="brand-archive-empty">
          등록된 시즌이 없습니다.<br />
          상단에서 시즌(차수)을 먼저 설정하세요.
        </div>
      ) : (
        <div className="brand-archive-list">
          <div className="brand-archive-toolbar">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-6)' }}>
              시즌을 선택해 브랜드 리포트를 확인하세요
            </span>
            <span className="brand-archive-count">{phases.length}개 시즌</span>
          </div>

          <div className="brand-archive-grid">
            {phases.map(phase => {
              const badge = getPhaseStatusBadge(phase, activePhaseId)
              return (
                <PhaseCollectionCard
                  key={phase.id}
                  phaseId={phase.id}
                  name={phase.name}
                  startedAt={phase.started_at}
                  endedAt={phase.ended_at}
                  brandCount={brandCounts[phase.id] ?? 0}
                  statusLabel={badge?.label ?? null}
                  statusDone={badge?.tone === 'completed'}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
