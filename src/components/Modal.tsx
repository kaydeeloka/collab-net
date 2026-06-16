import { type CSSProperties, type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

type ModalSize = 'md' | 'lg' | 'xl'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  titleColor?: string
  titleStyle?: CSSProperties
  size?: ModalSize
  footer?: ReactNode
  children: ReactNode
}

const sizeClass: Record<ModalSize, string> = {
  md: '',
  lg: 'modal-box--lg',
  xl: 'modal-box--xl',
}

export default function Modal({
  open,
  onClose,
  title,
  titleColor,
  titleStyle,
  size = 'md',
  footer,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const boxClass = `modal-box ${sizeClass[size]}`.trim()

  return createPortal(
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={boxClass} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div
            id="modal-title"
            className="modal-title"
            style={{ ...(titleColor ? { color: titleColor } : {}), ...titleStyle }}
          >
            {title}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  )
}
