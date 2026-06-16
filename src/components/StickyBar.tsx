import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'

export interface StickyBarNavSubChild {
  label: string
  to: string
  end?: boolean
}

export interface StickyBarNavChild {
  label: string
  to: string
  end?: boolean
  sub?: StickyBarNavSubChild[]
  activeWhen?: (pathname: string) => boolean
}

export interface StickyBarGroup {
  label: string
  defaultTo: string
  prefix: string
  children: StickyBarNavChild[]
}

interface PhaseOption {
  id: string
  label: string
}

interface Props {
  group: StickyBarGroup
  pathname: string
  openSub: string | null
  onSubEnter: (to: string) => void
  onSubLeave: () => void
  activePhaseId: string | null
  viewPhaseId: string | null
  phaseList: { id: string; name: string }[]
  activeDbId: string
  dbOptions: PhaseOption[]
  phaseBadge: string
  onSwitchPhase: (id: string) => void
}

export default function StickyBar({
  group,
  pathname,
  openSub,
  onSubEnter,
  onSubLeave,
  activePhaseId,
  viewPhaseId,
  phaseList,
  activeDbId,
  dbOptions,
  phaseBadge,
  onSwitchPhase,
}: Props) {
  if (group.children.length === 0) return null

  return (
    <header className="sticky-bar">
      <nav className="sticky-bar__nav" aria-label={`${group.label} navigation`}>
        {group.children.map(child => {
          const hasSub = !!child.sub?.length
          const subOpen = openSub === child.to
          return (
            <div
              key={child.to}
              className="sticky-bar__group"
              onMouseEnter={() => hasSub && onSubEnter(child.to)}
              onMouseLeave={() => hasSub && onSubLeave()}
            >
              <NavLink
                to={child.to}
                end={child.end}
                className={({ isActive }) => {
                  const active = isActive || (child.activeWhen?.(pathname) ?? false)
                  return `sticky-bar__tab${active ? ' is-active' : ''}`
                }}
              >
                {child.label}
                {hasSub && <span className="sticky-bar__chevron">▾</span>}
              </NavLink>
              {hasSub && subOpen && (
                <div className="sticky-bar__dropdown">
                  {child.sub!.map(s => (
                    <NavLink
                      key={s.to}
                      to={s.to}
                      end={s.end}
                      className={({ isActive }) =>
                        `sticky-bar__dropdown-item${isActive ? ' is-active' : ''}`
                      }
                    >
                      {s.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sticky-bar__right">
        {activePhaseId && activePhaseId !== activeDbId && (
          <span className="sticky-bar__live-badge">
            활성 {phaseList.find(p => p.id === activePhaseId)?.name}
          </span>
        )}
        {dbOptions.length > 0 ? (
          <select
            className="sticky-bar__phase-select"
            value={activeDbId}
            onChange={e => onSwitchPhase(e.target.value)}
            title="차수 전환"
            aria-label="차수 전환"
          >
            {dbOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        ) : (
          <span className="sticky-bar__phase-badge">{phaseBadge}</span>
        )}
      </div>
    </header>
  )
}

/** Bulk / filter toolbar above data tables (contact, EMS, etc.) */
export function TableActionBar({
  selectedCount,
  unit = '명',
  children,
  actions,
  className = '',
}: {
  selectedCount: number
  unit?: string
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const hasSelection = selectedCount > 0
  return (
    <div className={`table-action-bar${hasSelection ? ' is-active' : ''} ${className}`.trim()}>
      <span className="table-action-bar__status">
        {hasSelection ? `${selectedCount}${unit} 선택됨` : '선택 없음'}
      </span>
      <div className="table-action-bar__divider" aria-hidden />
      <div className="table-action-bar__body">{children}</div>
      {actions && <div className="table-action-bar__actions">{actions}</div>}
    </div>
  )
}
