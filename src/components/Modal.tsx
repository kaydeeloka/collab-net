import { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  titleColor?: string
  children: ReactNode
}

export default function Modal({ open, onClose, title, titleColor, children }: Props) {
  if (!open) return null
  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box">
        <div className="modal-title" style={titleColor ? { color: titleColor } : undefined}>
          {title}
        </div>
        {children}
      </div>
    </div>
  )
}
