import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import {
  computeContentReport,
  loadMonitoringData,
  type ContentReport,
  type UploadChannelSegment,
} from '@/lib/influencer/monitoring-data'
import { PLATFORM_DISPLAY, platformBadgeClass, platformBadgeStyle, type PlatformBucket } from '@/lib/influencer/content-platforms'
import Spinner from '@/components/Spinner'
import { StatCard, StatCards } from '@/components/ui'
import { PageHeroBanner, PageHeroBannerContent } from '@/components/PageHeroBanner'

const SUFFIX_STYLE = { fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 } as const
const CHANNEL_COLORS: Record<PlatformBucket, string> = {
  tiktok:    PLATFORM_DISPLAY.tiktok.statColor,
  instagram: PLATFORM_DISPLAY.instagram.statColor,
  magazine:  PLATFORM_DISPLAY.magazine.statColor,
}

const thStyle: CSSProperties = {
  padding: '12px 14px',
  background: 'var(--teal-dk)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '.6px',
  borderRight: '1px solid rgba(255,255,255,.12)',
}

const tdStyle: CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  color: 'var(--gray-8)',
  borderBottom: '1px solid var(--gray-2)',
  borderRight: '1px solid var(--gray-2)',
  background: '#fff',
}

function PlatformTh({ label, color }: { label: string; color: string }) {
  return (
    <th style={thStyle}>
      <span className="report-th-platform">
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        {label}
      </span>
    </th>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const { label, style } = platformBadgeStyle(platform)
  return <span className={platformBadgeClass(platform)} style={style}>{label}</span>
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <span className={`report-rank report-rank--${rank}`}>{rank}</span>
  }
  return <span className="report-rank">{rank}</span>
}

function ReportPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="report-panel" style={{ flex: 1, minWidth: 0 }}>
      {title ? <div className="report-panel__title">{title}</div> : null}
      <div className="report-panel__body">{children}</div>
    </div>
  )
}

function ReportTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ReportPanel title={title}>
      <table className="report-table">{children}</table>
    </ReportPanel>
  )
}

function UploadChannelChart({ channels, compact = false }: { channels: UploadChannelSegment[]; compact?: boolean }) {
  const active = channels.filter(c => c.count > 0)
  const total = active.reduce((s, c) => s + c.count, 0)
  const size = compact ? 168 : 220
  const cx = size / 2
  const cy = size / 2
  const outerR = compact ? 72 : 88
  const innerR = compact ? 44 : 54

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const polar = (deg: number, r: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  })

  const donutPath = (startDeg: number, endDeg: number) => {
    const startOuter = polar(startDeg, outerR)
    const endOuter = polar(endDeg, outerR)
    const startInner = polar(endDeg, innerR)
    const endInner = polar(startDeg, innerR)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${endInner.x} ${endInner.y}`,
      'Z',
    ].join(' ')
  }

  let angleCursor = -90
  const slices = active.map(c => {
    const sweep = (c.count / total) * 360
    const start = angleCursor
    const end = angleCursor + sweep
    angleCursor = end
    return {
      ...c,
      pct: Math.round((c.count / total) * 100),
      path: donutPath(start, end),
    }
  })

  return (
    <ReportPanel title="플랫폼별 운영 채널">
      <div className="report-chart-panel__body">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ display: 'block', overflow: 'visible' }}
          aria-label="플랫폼별 운영 채널"
        >
          {!total && (
            <circle cx={cx} cy={cy} r={outerR} fill="var(--gray-2)" />
          )}
          {slices.map(s => (
            <path
              key={s.key}
              d={s.path}
              fill={CHANNEL_COLORS[s.key]}
              stroke="#fff"
              strokeWidth={2.5}
            />
          ))}
          {total > 0 && (
            <>
              <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--gray-8)" fontSize={compact ? 20 : 24} fontWeight={800}>
                {total}
              </text>
              <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--gray-5)" fontSize={11} fontWeight={600}>
                건
              </text>
            </>
          )}
        </svg>

        {total > 0 ? (
          <div className="report-chart-legend">
            {slices.map(s => (
              <span key={s.key} className="report-chart-legend__item">
                <span className="report-chart-legend__dot" style={{ background: CHANNEL_COLORS[s.key] }} />
                {s.label}
                <span className="report-chart-legend__pct">{s.pct}%</span>
                <span style={{ color: 'var(--gray-4)', fontWeight: 500 }}>({s.count})</span>
              </span>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-5)', marginTop: 8 }}>
            업로드된 콘텐츠 없음
          </div>
        )}
      </div>
    </ReportPanel>
  )
}

function fmtAvg(n: number | null): string {
  if (n === null) return '—'
  return fmtNum(n)
}

export default function MonitoringReport() {
  const { viewPhaseId, loading: phaseLoading } = usePhase()
  const [report, setReport]   = useState<ContentReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (phaseLoading) return
    if (!viewPhaseId) {
      setReport(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loadMonitoringData(viewPhaseId)
      .then(({ rows }) => setReport(computeContentReport(rows)))
      .catch(e => console.error('monitoring report load error:', e))
      .finally(() => setLoading(false))
  }, [viewPhaseId, phaseLoading])

  const summary = report?.summary

  return (
    <div className="page page--fill">
      <PageHeroBanner style={{ marginBottom: 20 }}>
        <PageHeroBannerContent
          title="모니터링 콘텐츠 성과"
          description="리뷰 모니터링 데이터를 기반으로 업로드 현황·콘텐츠 종류·플랫폼별 참여 성과를 한눈에 확인합니다."
        />
      </PageHeroBanner>

      {loading && (
        <div className="loader"><Spinner />데이터 불러오는 중...</div>
      )}

      {!loading && !viewPhaseId && (
        <div style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 48 }}>차수를 선택해 주세요.</div>
      )}

      {!loading && viewPhaseId && report && summary && (
        <>
          <div className="section-title--dash">성과 요약</div>

          <StatCards
            className="stat-cards--tall"
            columns="repeat(3, minmax(0, 1fr))"
            style={{ marginBottom: 32 }}
          >
            <StatCard
              variant="metric"
              align="left"
              label="업로드 완료율"
              value={summary.uploadRate.current}
              valueSuffix={<span style={SUFFIX_STYLE}> / {summary.uploadRate.total} 명</span>}
              progress={summary.uploadRate.pct}
              caption={summary.uploadRate.notUploaded > 0 ? (
                <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                  미업로드 {summary.uploadRate.notUploaded}명
                </span>
              ) : (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>전원 업로드 완료</span>
              )}
              footer={`${summary.uploadRate.pct}%`}
            />
            <StatCard
              variant="metric"
              align="left"
              label="총 업로드 콘텐츠"
              value={summary.totalContent.count}
              unit="건"
              valueColor="var(--blue-dk)"
              caption={(
                <>
                  <span style={{ color: 'var(--teal-dk)', fontWeight: 700 }}>Mi Muse</span>
                  <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{summary.totalContent.mimuse}</strong>
                  <span style={{ margin: '0 6px', color: 'var(--gray-3)' }}>·</span>
                  <span style={{ color: 'var(--gray-6)', fontWeight: 700 }}>브랜드</span>
                  <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{summary.totalContent.brand}</strong>
                </>
              )}
            />
            <StatCard
              label="총 반응"
              variant="split"
              columns={[
                { value: fmtNum(summary.engagement.views),    label: '조회수', valueColor: 'var(--ink)',     labelColor: 'var(--ink)' },
                { value: fmtNum(summary.engagement.likes),    label: '좋아요', valueColor: '#dc2626',      labelColor: '#dc2626' },
                { value: fmtNum(summary.engagement.comments), label: '댓글',   valueColor: 'var(--teal-dk)', labelColor: 'var(--teal-dk)' },
              ]}
            />
          </StatCards>

          <div className="section-title" style={{ marginBottom: 16 }}>콘텐츠 분석</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, alignItems: 'stretch', marginBottom: 28 }}>
            <ReportTable title="콘텐츠 종류">
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>구분</th>
                  <PlatformTh label="TikTok" color={CHANNEL_COLORS.tiktok} />
                  <PlatformTh label="Instagram" color={CHANNEL_COLORS.instagram} />
                  <th style={{ ...thStyle, borderRight: 'none', textAlign: 'right', paddingRight: 18 }}>
                    <span className="report-th-platform" style={{ justifyContent: 'flex-end' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: CHANNEL_COLORS.magazine, flexShrink: 0 }} />
                      Magazine
                    </span>
                  </th>
                  <th style={{ ...thStyle, background: 'var(--blue-dk)', borderRight: 'none', minWidth: 56 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.contentTypeRows.map(row => (
                  <tr key={row.label} className={row.label === '합계' ? 'is-total' : undefined}>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{row.label}</td>
                    <td style={tdStyle}>{row.tiktok || '—'}</td>
                    <td style={tdStyle}>{row.instagram || '—'}</td>
                    <td style={{ ...tdStyle, borderRight: 'none', textAlign: 'right', paddingRight: 18 }}>{row.magazine || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, background: 'var(--gray-0)', borderRight: 'none', color: 'var(--blue-dk)' }}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>

            <ReportTable title="Mi Muse vs 브랜드 평균 성과">
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>구분</th>
                  <th style={thStyle}>건수</th>
                  <th style={thStyle}>평균 조회수</th>
                  <th style={thStyle}>평균 좋아요</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>평균 댓글</th>
                </tr>
              </thead>
              <tbody>
                {report.brandPerformanceRows.map(row => (
                  <tr key={row.key}>
                    <td style={{
                      ...tdStyle,
                      textAlign: 'left',
                      fontWeight: 700,
                      color: row.key === 'mimuse' ? 'var(--teal-dk)' : 'var(--gray-7)',
                    }}>
                      {row.label}
                    </td>
                    <td style={tdStyle}>{row.count || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: row.avgViews ? 700 : 600 }}>{fmtAvg(row.avgViews)}</td>
                    <td style={tdStyle}>{fmtAvg(row.avgLikes)}</td>
                    <td style={{ ...tdStyle, borderRight: 'none' }}>{fmtAvg(row.avgComments)}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          </div>

          <div className="section-title" style={{ marginBottom: 16 }}>플랫폼 분석</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr minmax(280px, 1fr)', gap: 20, alignItems: 'stretch', marginBottom: 32 }}>
            <ReportTable title="플랫폼별 성과">
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>플랫폼</th>
                  <th style={thStyle}>건수</th>
                  <th style={thStyle}>평균 조회수</th>
                  <th style={thStyle}>평균 좋아요</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>평균 댓글</th>
                </tr>
              </thead>
              <tbody>
                {report.performanceRows.map(row => (
                  <tr key={row.platform}>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      <PlatformBadge platform={row.platform} />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{row.count}</td>
                    <td style={{ ...tdStyle, fontWeight: row.avgViews ? 700 : 600 }}>{fmtAvg(row.avgViews)}</td>
                    <td style={tdStyle}>{fmtAvg(row.avgLikes)}</td>
                    <td style={{ ...tdStyle, borderRight: 'none' }}>{fmtAvg(row.avgComments)}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
            <UploadChannelChart channels={report.uploadChannels} compact />
          </div>

          <div className="section-title" style={{ marginBottom: 8 }}>Top 콘텐츠</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-6)', marginBottom: 14 }}>조회수 상위 10건</div>
          <div>
            <ReportPanel>
              <table className="report-table report-table--equal-cols">
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>인플루언서</th>
                  <th style={thStyle}>플랫폼</th>
                  <th style={thStyle}>브랜드</th>
                  <th style={thStyle}>조회수</th>
                  <th style={thStyle}>좋아요</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>댓글</th>
                  <th style={{ ...thStyle, background: 'var(--blue-dk)', borderRight: 'none' }}>링크</th>
                </tr>
              </thead>
              <tbody>
                {report.topPosts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, padding: '28px 14px', color: 'var(--gray-5)', borderRight: 'none' }}>
                      업로드된 콘텐츠가 없습니다
                    </td>
                  </tr>
                ) : report.topPosts.map(row => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      <RankBadge rank={row.rank} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, color: 'var(--gray-8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.displayName || row.handle}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{row.handle}</div>
                    </td>
                    <td style={tdStyle}>
                      <PlatformBadge platform={row.platformLabel} />
                    </td>
                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.brandLabel}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: 'var(--ink)' }}>{fmtNum(row.views)}</td>
                    <td style={{ ...tdStyle, color: '#dc2626' }}>{fmtNum(row.likes)}</td>
                    <td style={{ ...tdStyle, color: 'var(--teal-dk)' }}>{fmtNum(row.comments)}</td>
                    <td style={{ ...tdStyle, borderRight: 'none' }}>
                      <a href={row.reviewLink} target="_blank" rel="noopener noreferrer" className="video-link" style={{ fontSize: 12 }}>
                        ↗ 보기
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </ReportPanel>
          </div>
        </>
      )}
    </div>
  )
}
