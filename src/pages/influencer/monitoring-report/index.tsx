import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { usePhase } from '@/contexts/PhaseContext'
import { fmtNum } from '@/lib/utils'
import {
  computeContentReport,
  loadMonitoringData,
  type ContentReport,
  type UploadChannelSegment,
} from '@/lib/monitoring-data'
import { PLATFORM_DISPLAY, type PlatformBucket } from '@/lib/content-platforms'
import Spinner from '@/components/Spinner'
import { StatCard, StatCards } from '@/components/ui'

const SUFFIX_STYLE = { fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 } as const
const CHANNEL_COLORS: Record<PlatformBucket, string> = {
  tiktok:    PLATFORM_DISPLAY.tiktok.statColor,
  instagram: PLATFORM_DISPLAY.instagram.statColor,
  magazine:  PLATFORM_DISPLAY.magazine.statColor,
}

const sectionBadge: CSSProperties = {
  display: 'inline-block',
  background: 'var(--teal-dk)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  padding: '8px 18px',
  borderRadius: 999,
}

const thStyle: CSSProperties = {
  padding: '12px 14px',
  background: 'var(--teal-dk)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,.15)',
}

const tdStyle: CSSProperties = {
  padding: '11px 14px',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  color: 'var(--gray-8)',
  borderBottom: '1px solid var(--gray-2)',
  borderRight: '1px solid var(--gray-2)',
  background: '#fff',
}

function SectionBadge({ children }: { children: ReactNode }) {
  return <div style={{ ...sectionBadge, marginBottom: 12 }}>{children}</div>
}

function ReportTable({ title, children }: { title: string; children: ReactNode }) {  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <SectionBadge>{title}</SectionBadge>
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--gray-2)', boxShadow: 'var(--sh-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          {children}
        </table>
      </div>
    </div>
  )
}

function UploadChannelChart({ channels }: { channels: UploadChannelSegment[] }) {
  const active = channels.filter(c => c.count > 0)
  const total = active.reduce((s, c) => s + c.count, 0)
  const size = 260
  const cx = size / 2
  const cy = size / 2
  const outerR = 92

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const polar = (deg: number, r: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  })

  const piePath = (startDeg: number, endDeg: number) => {
    const start = polar(startDeg, outerR)
    const end = polar(endDeg, outerR)
    const large = endDeg - startDeg > 180 ? 1 : 0
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${end.x} ${end.y}`,
      'Z',
    ].join(' ')
  }

  let angleCursor = -90
  const slices = active.map(c => {
    const sweep = (c.count / total) * 360
    const start = angleCursor
    const end = angleCursor + sweep
    const mid = start + sweep / 2
    angleCursor = end

    const isSmall = sweep < 28
    const labelR = outerR + (isSmall ? 18 : 32)
    const edge = polar(mid, outerR + 2)
    const labelPt = polar(mid, labelR)
    const textR = isSmall ? labelR + 8 : labelR + (Math.cos(toRad(mid)) >= 0 ? 10 : -10)
    const textPt = polar(mid, textR)

    return {
      ...c,
      pct: Math.round((c.count / total) * 100),
      start,
      end,
      mid,
      path: piePath(start, end),
      edge,
      labelPt,
      textPt,
      anchorAlign: (Math.cos(toRad(mid)) >= 0 ? 'start' : 'end') as 'start' | 'end',
      showLine: isSmall,
    }
  })

  return (
    <div style={{
      background: 'var(--gray-1)',
      borderRadius: 22,
      padding: '22px 24px 18px',
      border: '1px solid var(--gray-2)',
      boxShadow: 'var(--sh-sm)',
      minWidth: 300,
    }}>
      <SectionBadge>콘텐츠 업로드 채널</SectionBadge>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block', margin: '8px auto 0', overflow: 'visible' }}
        aria-label="콘텐츠 업로드 채널"
      >
        {!total && (
          <circle cx={cx} cy={cy} r={outerR} fill="var(--gray-2)" />
        )}
        {slices.map(s => (
          <path key={s.key} d={s.path} fill={CHANNEL_COLORS[s.key]} />
        ))}
        {slices.filter(s => s.showLine).map(s => (
          <line
            key={`line-${s.key}`}
            x1={s.edge.x}
            y1={s.edge.y}
            x2={s.labelPt.x}
            y2={s.labelPt.y}
            stroke="var(--gray-3)"
            strokeWidth={1}
          />
        ))}
        {slices.map(s => (
          <g key={`label-${s.key}`}>
            <text
              x={s.textPt.x}
              y={s.textPt.y - 6}
              textAnchor={s.anchorAlign}
              fill="var(--gray-6)"
              fontSize={12}
              fontWeight={600}
            >
              {s.label}
            </text>
            <text
              x={s.textPt.x}
              y={s.textPt.y + 10}
              textAnchor={s.anchorAlign}
              fill="var(--gray-8)"
              fontSize={13}
              fontWeight={800}
            >
              {s.pct}%
            </text>
          </g>
        ))}
      </svg>
      {!total && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-5)', marginTop: 8 }}>업로드된 콘텐츠 없음</div>
      )}
    </div>
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
      <div className="page-banner" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-dk)', marginBottom: 4 }}>Content Performance</div>
          <div className="page-banner-title">콘텐츠 성과 OVERVIEW</div>
          <div className="page-banner-desc">리뷰 모니터링 데이터를 기반으로 업로드 현황·콘텐츠 종류·플랫폼별 성과를 집계합니다.</div>
        </div>
      </div>

      {loading && (
        <div className="loader"><Spinner />데이터 불러오는 중...</div>
      )}

      {!loading && !viewPhaseId && (
        <div style={{ textAlign: 'center', color: 'var(--gray-5)', padding: 48 }}>차수를 선택해 주세요.</div>
      )}

      {!loading && viewPhaseId && report && summary && (
        <>
          <div className="section-title--dash">성과 요약</div>

          <StatCards className="stat-cards--tall" columns="repeat(3, minmax(0, 1fr))" style={{ marginBottom: 28 }}>
            <StatCard
              variant="metric"
              align="left"
              label="업로드 완료율"
              value={summary.uploadRate.current}
              valueSuffix={<span style={SUFFIX_STYLE}> / {summary.uploadRate.total} 명</span>}
              progress={summary.uploadRate.pct}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr minmax(280px, 340px)', gap: 20, alignItems: 'start' }}>
            <ReportTable title="콘텐츠 종류">
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>구분</th>
                  <th style={thStyle}>TikTok</th>
                  <th style={thStyle}>Instagram</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>Magazine</th>
                  <th style={{ ...thStyle, background: 'var(--blue-dk)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.contentTypeRows.map(row => (
                  <tr key={row.label}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: row.label === '합계' ? 800 : 600 }}>{row.label}</td>
                    <td style={tdStyle}>{row.tiktok || '—'}</td>
                    <td style={tdStyle}>{row.instagram || '—'}</td>
                    <td style={tdStyle}>{row.magazine || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, background: 'var(--gray-0)' }}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>

            <ReportTable title="콘텐츠 성과">
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>플랫폼</th>
                  <th style={thStyle}>건수</th>
                  <th style={thStyle}>평균 조회수</th>
                  <th style={thStyle}>평균 좋아요</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>평균 댓글</th>
                </tr>
              </thead>
              <tbody>
                {report.performanceRows.map(row => (
                  <tr key={row.platform}>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{row.label}</td>
                    <td style={tdStyle}>{row.count}</td>
                    <td style={tdStyle}>{fmtAvg(row.avgViews)}</td>
                    <td style={tdStyle}>{fmtAvg(row.avgLikes)}</td>
                    <td style={tdStyle}>{fmtAvg(row.avgComments)}</td>
                  </tr>
                ))}
              </tbody>
            </ReportTable>

            <UploadChannelChart channels={report.uploadChannels} />
          </div>
        </>
      )}
    </div>
  )
}
