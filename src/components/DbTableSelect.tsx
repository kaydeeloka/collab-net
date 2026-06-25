import { useEffect, useRef } from 'react'

export function dbTableRowClass(isSelected: boolean, isContacted?: boolean): string {
  const classes = ['db-table-row']
  if (isSelected) classes.push('db-table-row--selected')
  else if (isContacted) classes.push('db-table-row--contacted')
  return classes.join(' ')
}

export function DbSelectAllButton({
  allSelected,
  disabled,
  onClick,
}: {
  allSelected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`db-select-all-btn${allSelected ? ' db-select-all-btn--clear' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {allSelected ? '전체 해제' : '전체 선택'}
    </button>
  )
}

export function DbTableSelectAll({
  checked,
  indeterminate = false,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      className="db-table-select-all"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
    />
  )
}

export function DbTableRowSelect({
  rowNumber,
  checked,
  onChange,
}: {
  rowNumber: number
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={`db-row-select${checked ? ' db-row-select--checked' : ''}`}>
      <input
        type="checkbox"
        className="db-row-select__input"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="db-row-select__box">{rowNumber}</span>
    </label>
  )
}
