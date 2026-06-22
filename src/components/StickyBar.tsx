import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { type ReactNode } from 'react'
import { formatStickyBarClock } from '@/lib/kst-time'
import { getPhaseStatusBadge } from '@/lib/phase'
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
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const activeDbId = viewPhaseId ?? ''
  const dbOptions = phaseList
    .map(p => ({ id: p.id, label: p.name }))
    .sort((a, b) => phaseNum(a.label) - phaseNum(b.label))
  const phaseBadge = phaseList.find(p => p.id === viewPhaseId)?.name || '—'
  const selectedLabel = phaseList.find(p => p.id === activeDbId)?.name || phaseBadge
  const selectedPhase = phaseList.find(p => p.id === activeDbId)
  const selectedBadge = selectedPhase ? getPhaseStatusBadge(selectedPhase, activePhaseId) : null

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function onSwitchPhase(id: string) {
    setOpen(false)
    if (!id || id === activeDbId) return
    await switchPhase(id)
    showToast(`「${phaseList.find(p => p.id === id)?.name}」 전환 완료`, 'success')
  }

  return (
    <>
      <StickyBarClock />
      {dbOptions.length > 0 ? (
        <div className="sticky-bar__phase-wrap" ref={wrapRef}>
          <button
            type="button"
            className="sticky-bar__phase-select"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="차수 전환"
          >
            {selectedBadge?.tone === 'active' && (
              <span className="sticky-bar__phase-live-dot" aria-label="활성" title="활성" />
            )}
            {selectedLabel}
            <span className="sticky-bar__phase-chevron" aria-hidden>▾</span>
          </button>
          {open && (
            <div className="sticky-bar__phase-menu" role="listbox" aria-label="차수 목록">
              {dbOptions.map(o => {
                const phase = phaseList.find(p => p.id === o.id)
                const badge = phase ? getPhaseStatusBadge(phase, activePhaseId) : null
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={o.id === activeDbId}
                    className={`sticky-bar__phase-option${o.id === activeDbId ? ' is-active' : ''}`}
                    onClick={() => { void onSwitchPhase(o.id) }}
                  >
                    <span>{o.label}</span>
                    {badge && (
                      <span className={`sticky-bar__phase-status sticky-bar__phase-status--${badge.tone}`}>
                        {badge.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
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
  statusActions,
  actions,
  className = '',
}: {
  selectedCount: number
  maxSelection?: number
  unit?: string
  children?: ReactNode
  statusActions?: ReactNode
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
      <div className="table-action-bar__status-group">
        <span className="table-action-bar__status">
          {statusText}
        </span>
        {statusActions}
      </div>
      <div className="table-action-bar__divider" aria-hidden />
      <div className="table-action-bar__body">{children}</div>
      {actions && <div className="table-action-bar__actions">{actions}</div>}
    </div>
  )
}

export function TableTemplateSelect({
  value,
  onChange,
  options,
  disabled,
  emptyLabel,
}: {
  value: number
  onChange: (index: number) => void
  options: { id: string; name: string }[]
  disabled?: boolean
  emptyLabel?: string
}) {
  if (options.length === 0 && emptyLabel) {
    return <span className="table-action-bar__empty">{emptyLabel}</span>
  }
  return (
    <div className="table-action-bar__template">
      <span className="table-action-bar__template-label">템플릿</span>
      <div className="table-action-bar__select-wrap">
        <select
          className="table-action-bar__select"
          value={value}
          disabled={disabled}
          onChange={e => onChange(+e.target.value)}
        >
          {options.map((t, i) => (
            <option key={t.id} value={i}>{t.name}</option>
          ))}
        </select>
        <span className="table-action-bar__select-chevron" aria-hidden>▾</span>
      </div>
    </div>
  )
}
