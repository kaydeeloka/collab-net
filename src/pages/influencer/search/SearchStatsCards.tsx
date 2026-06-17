import StatCard, { StatCards, StatCardTags } from '@/components/ui/StatCard'

const TIER_COLOR: Record<string, string> = {
  '1순위': '#6366f1',
  '2순위': '#10b981',
  '3순위': '#3b82f6',
  '4순위': '#f59e0b',
  '5순위': '#ec4899',
}

const CONFIRMED_TARGET = 50
const SUFFIX_STYLE = { fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 } as const

export interface SearchDashStats {
  total: number
  sent: number
  confirmed: number
  tiers: { rank: string; total: number }[]
}

export function SearchStatsCards({ dashStats, phaseLabel }: { dashStats: SearchDashStats; phaseLabel: string }) {
  const confirmedPct = Math.min(dashStats.confirmed / CONFIRMED_TARGET * 100, 100)

  return (
    <StatCards className="stat-cards--tall" columns="1fr 1fr 1fr" style={{ marginBottom: 16 }}>
      <StatCard
        variant="metric"
        align="left"
        label="총 인플루언서"
        value={dashStats.total}
        unit="명"
        footer={(
          <StatCardTags
            tags={dashStats.tiers.map(t => ({
              label: t.rank,
              count: t.total,
              color: TIER_COLOR[t.rank] ?? 'var(--gray-5)',
            }))}
            style={{ marginTop: 0 }}
          />
        )}
      />
      <StatCard
        highlight
        variant="metric"
        align="left"
        label="컨택 예정"
        value={dashStats.sent}
        valueColor="var(--yellow-text)"
        valueSuffix={<span style={SUFFIX_STYLE}> / {dashStats.total}</span>}
      />
      <StatCard
        variant="metric"
        align="left"
        label={`${phaseLabel} 확정 인원`}
        value={dashStats.confirmed}
        valueColor="var(--teal-dk)"
        valueSuffix={<span style={SUFFIX_STYLE}> / {CONFIRMED_TARGET}</span>}
        progress={confirmedPct}
      />
    </StatCards>
  )
}

export { TIER_COLOR }
