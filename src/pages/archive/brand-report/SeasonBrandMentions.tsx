import { useEffect, useState } from 'react'
import Spinner from '@/components/Spinner'
import { fmtNum } from '@/lib/utils'
import { loadMonitoringData } from '@/lib/influencer/monitoring-data'
import { computeBrandMentions, type BrandMention } from './season-report-highlights'
import SeasonReportSlide from './SeasonReportSlide'

interface Props {
  phaseId: string
}

export default function SeasonBrandMentions({ phaseId }: Props) {
  const [items, setItems] = useState<BrandMention[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void loadMonitoringData(phaseId)
      .then(({ rows }) => {
        if (!cancelled) setItems(computeBrandMentions(rows))
      })
      .catch(e => {
        console.error('season brand mentions load error:', e)
        if (!cancelled) setItems(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [phaseId])

  return (
    <SeasonReportSlide eyebrow="Brand Mention Highlights" title="브랜드 멘션 하이라이트">
      <section className="season-brand-mentions">
        {loading ? (
          <div className="season-brand-mentions__loading">
            <Spinner />
          </div>
        ) : !items || items.length === 0 ? (
          <p className="season-brand-mentions__empty">브랜드 멘션 데이터가 없습니다.</p>
        ) : (
          <div className="season-brand-mentions__grid">
            {items.map(item => (
              <article key={item.brand} className="season-brand-mentions__card">
                <h3 className="season-brand-mentions__name">{item.label}</h3>
                <dl className="season-brand-mentions__metrics">
                  <div>
                    <dt>멘션</dt>
                    <dd>{item.mentions}<span>건</span></dd>
                  </div>
                  <div>
                    <dt>조회</dt>
                    <dd>{fmtNum(item.views)}</dd>
                  </div>
                  <div>
                    <dt>좋아요</dt>
                    <dd>{fmtNum(item.likes)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </SeasonReportSlide>
  )
}
