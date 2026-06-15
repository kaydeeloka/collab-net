import { type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  titleColor?: string
  titleStyle?: CSSProperties
  children: ReactNode
}

export default function Modal({ open, onClose, title, titleColor, titleStyle, children }: Props) {
  if (!open) return null
  return createPortal(
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="modal-title" style={{ margin: 0, ...(titleColor ? { color: titleColor } : {}), ...titleStyle }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'var(--gray-5)', padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit' }}
            aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
