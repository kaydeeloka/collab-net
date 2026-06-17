import type { CSSProperties, ReactNode } from 'react'

const UNIT_STYLE: CSSProperties = { fontSize: 14, fontWeight: 500, color: 'var(--gray-5)' }
const METRIC_NUM: CSSProperties = { fontSize: 36, fontWeight: 800, letterSpacing: '-1px' }
const METRIC_UNIT: CSSProperties = { fontSize: 13, color: 'var(--gray-5)', fontWeight: 500 }
const DIVIDER: CSSProperties = { width: 1, height: 48, background: 'var(--gray-2)', marginTop: 4 }
const CARD_SHELL: CSSProperties = { display: 'flex', flexDirection: 'column', boxSizing: 'border-box', alignSelf: 'stretch', minHeight: 0 }
const CARD_BODY: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }
const CARD_FOOTER: CSSProperties = { marginTop: 'auto', minHeight: 40, flexShrink: 0 }

export interface StatCardTag {
  label: string
  count: number | string
  color: string
}

export interface StatCardSplitColumn {
  value: number | string
  unit?: string
  valueColor?: string
  label: string
  labelColor?: string
  sub?: string
  hideSub?: boolean
}

export interface StatCardGridColumn {
  value: number | string
  unit?: string
  label: string
  color: string
}

interface StatCardBase {
  label: string
  highlight?: boolean
  className?: string
  style?: CSSProperties
}

export interface StatCardSimpleProps extends StatCardBase {
  variant?: 'simple'
  value: ReactNode
  unit?: string
  valueColor?: string
  sub?: ReactNode
  tags?: StatCardTag[]
  progress?: number
  progressColor?: string
}

export interface StatCardMetricProps extends StatCardBase {
  variant: 'metric'
  value: number | string
  unit?: string
  valueColor?: string
  valueSuffix?: ReactNode
  align?: 'left' | 'center'
  sub?: ReactNode
  progress?: number
  progressColor?: string
  footer?: ReactNode
}

export interface StatCardProgressProps extends StatCardBase {
  variant: 'progress'
  value: ReactNode
  unit?: string
  sub?: ReactNode
  progress: number
  tags?: StatCardTag[]
  progressColor?: string
}

export interface StatCardSplitProps extends StatCardBase {
  variant: 'split'
  columns: StatCardSplitColumn[]
}

export interface StatCardGridProps extends StatCardBase {
  variant: 'grid'
  columns: StatCardGridColumn[]
}

export type StatCardProps =
  | StatCardSimpleProps
  | StatCardMetricProps
  | StatCardProgressProps
  | StatCardSplitProps
  | StatCardGridProps

function cardClass(highlight?: boolean, className?: string) {
  return ['card', highlight && 'highlight', className].filter(Boolean).join(' ')
}

function shellStyle(style?: CSSProperties): CSSProperties {
  return { ...CARD_SHELL, ...style }
}

function MetricNumber({ value, unit, color, align = 'center', suffix }: {
  value: number | string
  unit?: string
  color?: string
  align?: 'left' | 'center'
  suffix?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6, justifyContent: align === 'left' ? 'flex-start' : 'center' }}>
      <span style={{ ...METRIC_NUM, color: color ?? 'var(--ink)' }}>{value}</span>
      {unit && <span style={METRIC_UNIT}>{unit}</span>}
      {suffix}
    </div>
  )
}

function StatCardProgressBar({ pct, color = 'var(--teal-dk)' }: { pct: number; color?: string }) {
  const width = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ marginTop: 6, height: 4, background: 'var(--gray-2)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
    </div>
  )
}

function SplitColumnCell({ col }: { col: StatCardSplitColumn }) {
  const labelColor = col.labelColor ?? col.valueColor ?? 'var(--gray-5)'
  const showSub = col.sub !== undefined || col.hideSub
  return (
    <div style={{ textAlign: 'center' }}>
      <MetricNumber value={col.value} unit={col.unit} color={col.valueColor} />
      <div style={{ fontSize: 11, color: labelColor, fontWeight: 600, marginBottom: showSub ? 4 : 0 }}>{col.label}</div>
      {showSub && (
        <div className="card-sub" style={{ marginTop: 0, visibility: col.hideSub ? 'hidden' : undefined }}>
          {col.sub ?? '0% 완료율'}
        </div>
      )}
    </div>
  )
}

export function StatCardTags({ tags, style }: { tags: StatCardTag[]; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: 11, marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 0', lineHeight: 1.8, ...style }}>
      {tags.map((p, i) => (
        <span key={p.label}>
          {i > 0 && <span style={{ margin: '0 6px', color: 'var(--gray-3)' }}>·</span>}
          <span style={{ color: p.color, fontWeight: 700 }}>{p.label}</span>
          <strong style={{ color: 'var(--gray-7)', marginLeft: 4 }}>{p.count}</strong>
        </span>
      ))}
    </div>
  )
}

export default function StatCard(props: StatCardProps) {
  const { label, highlight, className, style } = props

  if (props.variant === 'split') {
    const gridCols = props.columns.length > 1
      ? props.columns.flatMap((_, i) => (i === 0 ? ['1fr'] : ['auto', '1fr'])).join(' ')
      : '1fr'
    return (
      <div className={cardClass(highlight, className)} style={shellStyle(style)}>
        <div className="card-label">{label}</div>
        <div style={{ ...CARD_BODY, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'start', width: '100%' }}>
          {props.columns.flatMap((col, i) => [
            ...(i > 0 ? [<div key={`div-${i}`} style={DIVIDER} />] : []),
            <SplitColumnCell key={`col-${i}`} col={col} />,
          ])}
          </div>
        </div>
      </div>
    )
  }

  if (props.variant === 'grid') {
    return (
      <div className={cardClass(highlight, className)} style={shellStyle(style)}>
        <div className="card-label">{label}</div>
        <div style={{ ...CARD_BODY, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${props.columns.length}, 1fr)`, alignItems: 'start', width: '100%' }}>
          {props.columns.map((col, i) => (
            <div
              key={col.label}
              style={{ textAlign: 'center', minWidth: 0, borderLeft: i > 0 ? '1px solid var(--gray-2)' : undefined }}
            >
              <MetricNumber value={col.value} unit={col.unit ?? '회'} color={col.color} />
              <div style={{ fontSize: 11, color: col.color, fontWeight: 600 }}>{col.label}</div>
            </div>
          ))}
          </div>
        </div>
      </div>
    )
  }

  if (props.variant === 'metric') {
    const align = props.align ?? 'center'
    const { progress, progressColor, footer, valueSuffix, sub } = props
    return (
      <div className={cardClass(highlight, className)} style={shellStyle(style)}>
        <div className="card-label">{label}</div>
        <div style={{ ...CARD_BODY, width: '100%', textAlign: align }}>
          <MetricNumber value={props.value} unit={props.unit} color={props.valueColor} align={align} suffix={valueSuffix} />
          <div style={CARD_FOOTER}>
            {sub && <div className="card-sub" style={{ marginTop: 0 }}>{sub}</div>}
            {progress != null && <StatCardProgressBar pct={progress} color={progressColor} />}
            {footer && <div style={{ fontSize: 11, color: 'var(--gray-5)', marginTop: progress != null ? 6 : sub ? 0 : 0 }}>{footer}</div>}
          </div>
        </div>
      </div>
    )
  }

  if (props.variant === 'progress') {
    const pct = Math.max(0, Math.min(100, props.progress))
    return (
      <div className={cardClass(highlight, className)} style={shellStyle(style)}>
        <div className="card-label">{label}</div>
        <div style={CARD_BODY}>
          <div className="card-value">
            {props.value}
            {props.unit && <span style={UNIT_STYLE}>{props.unit}</span>}
          </div>
          {props.sub && <div className="card-sub">{props.sub}</div>}
          <div style={CARD_FOOTER}>
            <StatCardProgressBar pct={pct} color={props.progressColor} />
            {props.tags && props.tags.length > 0 && <StatCardTags tags={props.tags} />}
          </div>
        </div>
      </div>
    )
  }

  // simple (default)
  const { value, unit, valueColor, sub, tags, progress, progressColor } = props
  return (
    <div className={cardClass(highlight, className)} style={shellStyle(style)}>
      <div className="card-label">{label}</div>
      <div style={CARD_BODY}>
        <div className="card-value" style={valueColor ? { color: valueColor } : undefined}>
          {value}
          {unit && <span style={UNIT_STYLE}> {unit}</span>}
        </div>
        <div style={CARD_FOOTER}>
          {sub != null && <div className="card-sub" style={{ marginTop: 0 }}>{sub}</div>}
          {tags && tags.length > 0 && <StatCardTags tags={tags} style={{ marginTop: sub != null ? 6 : 0 }} />}
          {progress != null && <StatCardProgressBar pct={progress} color={progressColor} />}
        </div>
      </div>
    </div>
  )
}

export function StatCards({
  children,
  className,
  style,
  columns,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  columns?: string
}) {
  return (
    <div
      className={['cards', 'stat-cards', className].filter(Boolean).join(' ')}
      style={{ alignItems: 'stretch', ...(columns ? { gridTemplateColumns: columns } : {}), ...style }}
    >
      {children}
    </div>
  )
}
