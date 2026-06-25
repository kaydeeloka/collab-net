import { useEffect, useState } from 'react'
import Spinner from '@/components/Spinner'
import { fmtNum } from '@/lib/utils'
import { loadMonitoringData } from '@/lib/influencer/monitoring-data'
import { platformBadgeClass, platformBadgeStyle } from '@/lib/influencer/content-platforms'
import { computeReviewHighlights, type ReviewHighlight } from './season-report-highlights'
import SeasonReportSlide from './SeasonReportSlide'

interface Props {
  phaseId: string
}

function PlatformBadge({ platform }: { platform: string }) {
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
}

export default function SeasonReviewHighlights({ phaseId }: Props) {
  const [items, setItems] = useState<ReviewHighlight[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void loadMonitoringData(phaseId)
      .then(({ rows }) => {
        if (!cancelled) setItems(computeReviewHighlights(rows))
      })
      .catch(e => {
        console.error('season review highlights load error:', e)
        if (!cancelled) setItems(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [phaseId])

  return (
    <SeasonReportSlide eyebrow="Best Review Highlights" title="베스트 리뷰 하이라이트">
      <section className="season-review-hl">
        {loading ? (
          <div className="season-review-hl__loading">
            <Spinner />
          </div>
        ) : !items || items.length === 0 ? (
          <p className="season-review-hl__empty">업로드된 리뷰가 없습니다.</p>
        ) : (
          <div className="season-review-hl__grid">
            {items.map(item => (
              <article key={item.id} className="season-review-hl__card">
                <div className="season-review-hl__card-head">
                  <div className="season-review-hl__identity">
                    <span className="season-review-hl__handle">@{item.handle}</span>
                    {item.displayName && (
                      <span className="season-review-hl__name">{item.displayName}</span>
                    )}
                  </div>
                  <PlatformBadge platform={item.platform} />
                </div>

                <div className="season-review-hl__brand">{item.brandLabel}</div>

                <dl className="season-review-hl__metrics">
                  <div>
                    <dt>조회</dt>
                    <dd>{fmtNum(item.views)}</dd>
                  </div>
                  <div>
                    <dt>좋아요</dt>
                    <dd>{fmtNum(item.likes)}</dd>
                  </div>
                  <div>
                    <dt>댓글</dt>
                    <dd>{fmtNum(item.comments)}</dd>
                  </div>
                </dl>

                {item.reviewLink && (
                  <a
                    className="season-review-hl__link"
                    href={item.reviewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    리뷰 보기 ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </SeasonReportSlide>
  )
}
