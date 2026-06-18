import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ListFilter } from 'lucide-react'

export interface HeaderFilterOption {
  value: string
  label: string
}

interface HeaderFilterMenuProps {
  label: string
  value: string
  options: ReadonlyArray<HeaderFilterOption>
  onChange: (value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  inactiveValue?: string
  tone?: 'dark' | 'light'
  align?: 'left' | 'right'
}

export default function HeaderFilterMenu({
  label,
  value,
  options,
  onChange,
  open,
  onOpenChange,
  inactiveValue = 'all',
  tone = 'dark',
  align = 'left',
}: HeaderFilterMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const active = value !== inactiveValue && value !== ''

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onOpenChange])

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: align === 'right' ? rect.right : rect.left,
      })
    }
    onOpenChange(!open)
  }

  const btnStyle = tone === 'dark'
    ? {
        background: active ? '#fff' : 'rgba(255,255,255,.12)',
        color: active ? 'var(--table-head-bg)' : '#fff',
      }
    : {
        background: active ? 'var(--teal-dk)' : 'transparent',
        color: active ? '#fff' : 'var(--teal-dk)',
      }

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span>{label}</span>
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            ...btnStyle,
          }}
        >
          <ListFilter size={13} />
        </button>
      </div>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="table-filter-menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: align === 'left' ? pos.left : undefined,
            right: align === 'right' ? window.innerWidth - pos.left : undefined,
            zIndex: 9999,
          }}
        >
          {options.map(option => (
            <button
              key={option.value || '__all__'}
              type="button"
              className={value === option.value ? 'is-active' : undefined}
              onClick={() => {
                onChange(option.value)
                onOpenChange(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
