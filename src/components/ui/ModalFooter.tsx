import { type ReactNode } from 'react'
import Button from './Button'

interface Action {
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

interface Props {
  cancel?: Action
  confirm?: Action
  danger?: Action
  split?: boolean
  children?: ReactNode
  className?: string
}

export default function ModalFooter({ cancel, confirm, danger, split, children, className = '' }: Props) {
  const footerClass = `modal-footer${split ? ' modal-footer--split' : ''} ${className}`.trim()

  if (split && (danger || cancel || confirm)) {
    return (
      <div className={footerClass}>
        <div className="modal-footer__start">
          {danger && (
            <Button variant="danger" size="sm" onClick={danger.onClick} disabled={danger.disabled}>
              {danger.loading && danger.disabled ? danger.loading : danger.label}
            </Button>
          )}
        </div>
        <div className="modal-footer__end">
          {cancel && (
            <Button variant="secondary" onClick={cancel.onClick} disabled={cancel.disabled}>
              {cancel.label}
            </Button>
          )}
          {confirm && (
            <Button variant="primary" onClick={confirm.onClick} disabled={confirm.disabled}>
              {confirm.loading && confirm.disabled ? confirm.loading : confirm.label}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={footerClass}>
      {children}
      {cancel && (
        <Button variant="secondary" onClick={cancel.onClick} disabled={cancel.disabled}>
          {cancel.label}
        </Button>
      )}
      {confirm && (
        <Button variant="primary" onClick={confirm.onClick} disabled={confirm.disabled}>
          {confirm.loading && confirm.disabled ? confirm.loading : confirm.label}
        </Button>
      )}
    </div>
  )
}
