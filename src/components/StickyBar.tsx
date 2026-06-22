import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { formatStickyBarClock } from '@/lib/kst-time'
import { phaseNum } from '@/lib/utils'
import { usePhase } from '@/contexts/PhaseContext'
import { useToast } from '@/contexts/ToastContext'

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

interface StickyBarProps {
  group: StickyBarGroup
  pathname: string
  openSub: string | null
  onSubEnter: (to: string) => void
  onSubLeave: () => void
}

function StickyBarClock() {
  const [clock, setClock] = useState(() => formatStickyBarClock())

  useEffect(() => {
    const tick = () => setClock(formatStickyBarClock())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <time className="sticky-bar__clock" dateTime={new Date().toISOString()}>
      {clock}
    </time>
  )
}

function StickyBarPhaseControls() {
  const { showToast } = useToast()
  const { activePhaseId, viewPhaseId, phases: phaseList, switchPhase } = usePhase()

  const activeDbId = viewPhaseId ?? ''
  const dbOptions = phaseList
    .map(p => ({ id: p.id, label: p.name }))
    .sort((a, b) => phaseNum(a.label) - phaseNum(b.label))
  const phaseBadge = phaseList.find(p => p.id === viewPhaseId)?.name || '—'

  async function onSwitchPhase(id: string) {
    if (!id || id === activeDbId) return
    await switchPhase(id)
    showToast(`「${phaseList.find(p => p.id === id)?.name}」 전환 완료`, 'success')
  }

  return (
    <>
      {activePhaseId && activePhaseId !== activeDbId && (
        <span className="sticky-bar__live-badge">
          활성 {phaseList.find(p => p.id === activePhaseId)?.name}
        </span>
      )}
      <StickyBarClock />
      {dbOptions.length > 0 ? (
        <select
          className="sticky-bar__phase-select"
          value={activeDbId}
          onChange={e => { void onSwitchPhase(e.target.value) }}
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
    </>
  )
}

export default function StickyBar({
  group,
  pathname,
  openSub,
  onSubEnter,
  onSubLeave,
}: StickyBarProps) {
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
        <StickyBarPhaseControls />
      </div>
    </header>
  )
}

/** Bulk / filter toolbar above data tables (contact, EMS, etc.) */
export function TableActionBar({
  selectedCount,
  maxSelection,
  unit = '명',
  children,
  actions,
  className = '',
}: {
  selectedCount: number
  maxSelection?: number
  unit?: string
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const hasSelection = selectedCount > 0
  const statusText = hasSelection
    ? maxSelection
      ? `${selectedCount}/${maxSelection}${unit} 선택됨`
      : `${selectedCount}${unit} 선택됨`
    : maxSelection
      ? `최대 ${maxSelection}${unit} 선택 가능`
      : '선택 없음'
  return (
    <div className={`table-action-bar${hasSelection ? ' is-active' : ''} ${className}`.trim()}>
      <span className="table-action-bar__status">
        {statusText}
      </span>
      <div className="table-action-bar__divider" aria-hidden />
      <div className="table-action-bar__body">{children}</div>
      {actions && <div className="table-action-bar__actions">{actions}</div>}
    </div>
  )
}
