import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Spinner from '@/components/Spinner'
import { fmtNum } from '@/lib/utils'
import {
  computeContentReport,
  loadMonitoringData,
  type ContentReport,
} from '@/lib/influencer/monitoring-data'
import { platformBadgeClass, platformBadgeStyle } from '@/lib/influencer/content-platforms'
import SeasonReportSlide from './SeasonReportSlide'

interface Props {
  phaseId: string
}

function PlatformBadge({ platform }: { platform: string }) {
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
}

export default function SeasonCollectionContentPerformance({ phaseId }: Props) {
  const [report, setReport] = useState<ContentReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void loadMonitoringData(phaseId)
      .then(({ rows }) => {
        if (!cancelled) setReport(computeContentReport(rows))
      })
      .catch(e => {
        console.error('season content performance load error:', e)
        if (!cancelled) setReport(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [phaseId])

  const summary = report?.summary

  return (
    <SeasonReportSlide eyebrow="Content Performance" title="콘텐츠 성과">
      <section className="season-content-performance">

      {loading ? (
        <div className="season-content-performance__loading">
          <Spinner />
        </div>
      ) : !summary ? (
        <p className="season-content-performance__empty">모니터링 데이터를 불러올 수 없습니다.</p>
      ) : (
        <>
          <div className="season-content-performance__summary">
            <div className="season-content-performance__card">
              <span className="season-content-performance__card-label">업로드 완료율</span>
              <div className="season-content-performance__card-value">
                {summary.uploadRate.current}
                <span> / {summary.uploadRate.total}명</span>
              </div>
              <div className="season-content-performance__progress">
                <div
                  className="season-content-performance__progress-bar"
                  style={{ width: `${summary.uploadRate.pct}%` }}
                />
              </div>
              <p className="season-content-performance__card-caption">
                {summary.uploadRate.notUploaded > 0
                  ? `미업로드 ${summary.uploadRate.notUploaded}명`
                  : '전원 업로드 완료'}
              </p>
            </div>

            <div className="season-content-performance__card">
              <span className="season-content-performance__card-label">총 업로드 콘텐츠</span>
              <div className="season-content-performance__card-value">
                {summary.totalContent.count}
                <span>건</span>
              </div>
              <p className="season-content-performance__card-caption">
                Mi Muse {summary.totalContent.mimuse} · 브랜드 {summary.totalContent.brand}
              </p>
            </div>

            <div className="season-content-performance__card">
              <span className="season-content-performance__card-label">총 반응</span>
              <dl className="season-content-performance__engagement">
                <div>
                  <dt>조회</dt>
                  <dd>{fmtNum(summary.engagement.views)}</dd>
                </div>
                <div>
                  <dt>좋아요</dt>
                  <dd>{fmtNum(summary.engagement.likes)}</dd>
                </div>
                <div>
                  <dt>댓글</dt>
                  <dd>{fmtNum(summary.engagement.comments)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="season-content-performance__detail">
            <div className="season-content-performance__panel">
              <h3 className="season-content-performance__panel-title">플랫폼별 성과</h3>
              <div className="season-content-performance__rows">
                <div className="season-content-performance__row season-content-performance__row--head">
                  <span>플랫폼</span>
                  <span>건수</span>
                  <span>평균 조회</span>
                  <span>평균 좋아요</span>
                  <span>평균 댓글</span>
                </div>
                {report.performanceRows.map(row => (
                  <div key={row.platform} className="season-content-performance__row">
                    <PlatformBadge platform={row.platform} />
                    <span>{row.count}건</span>
                    <span>{row.avgViews != null ? fmtNum(row.avgViews) : '—'}</span>
                    <span>{row.avgLikes != null ? fmtNum(row.avgLikes) : '—'}</span>
                    <span>{row.avgComments != null ? fmtNum(row.avgComments) : '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="season-content-performance__panel">
              <h3 className="season-content-performance__panel-title">조회수 Top 5</h3>
              {report.topPosts.length === 0 ? (
                <p className="season-content-performance__empty season-content-performance__empty--inline">
                  업로드된 콘텐츠가 없습니다.
                </p>
              ) : (
                <ol className="season-content-performance__top-list">
                  {report.topPosts.slice(0, 5).map(post => (
                    <li key={post.id} className="season-content-performance__top-item">
                      <span className="season-content-performance__top-rank">{post.rank}</span>
                      <div className="season-content-performance__top-copy">
                        <div className="season-content-performance__top-name">
                          {post.displayName || post.handle}
                        </div>
                        <div className="season-content-performance__top-meta">
                          <PlatformBadge platform={post.platformLabel} />
                          <span>{post.brandLabel}</span>
                        </div>
                      </div>
                      <div className="season-content-performance__top-metrics">
                        <strong>{fmtNum(post.views)}</strong>
                        {post.reviewLink && (
                          <a href={post.reviewLink} target="_blank" rel="noopener noreferrer">
                            보기 ↗
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="season-content-performance__footer">
            <Link to="/influencer/monitoring/report" className="season-content-performance__link">
              상세 리포트 보기
              <ArrowRight size={14} />
            </Link>
          </div>
        </>
      )}
      </section>
    </SeasonReportSlide>
  )
}
