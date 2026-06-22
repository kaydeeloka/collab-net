import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import ConfirmToast from '@/components/ConfirmToast'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  msg: string
  type: ToastType
}

interface ConfirmState {
  message: string
  onConfirm: () => void
  confirmLabel?: string
  confirmColor?: string
}

export interface ShowConfirmOptions {
  confirmLabel?: string
  confirmColor?: string
}

interface ToastCtx {
  showToast: (msg: string, type?: ToastType) => void
  showConfirm: (message: string, onConfirm: () => void, options?: ShowConfirmOptions) => void
  hideConfirm: () => void
}

const ToastContext = createContext<ToastCtx>({
  showToast: () => {},
  showConfirm: () => {},
  hideConfirm: () => {},
})

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === 'error' ? 8000 : 3500)
  }, [])

  const hideConfirm = useCallback(() => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = null
    }
    setConfirm(null)
  }, [])

  const showConfirm = useCallback((message: string, onConfirm: () => void, options?: ShowConfirmOptions) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirm({
      message,
      onConfirm,
      confirmLabel: options?.confirmLabel,
      confirmColor: options?.confirmColor,
    })
    confirmTimerRef.current = setTimeout(() => {
      setConfirm(null)
      confirmTimerRef.current = null
    }, 10000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, showConfirm, hideConfirm }}>
      {children}
      {createPortal(
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 15000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          {toasts.map(t => {
            const bg = t.type === 'success' ? '#d1fae5' : t.type === 'error' ? '#fee2e2' : '#e0e7ff'
            const col = t.type === 'success' ? '#065f46' : t.type === 'error' ? '#991b1b' : '#1e40af'
            const icon = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'
            return (
              <div key={t.id} style={{
                background: bg, color: col, borderRadius: 10, padding: '12px 18px',
                fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto',
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ whiteSpace: 'pre-line' }}>{t.msg}</span>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
      <ConfirmToast
        state={confirm}
        onHide={hideConfirm}
        confirmLabel={confirm?.confirmLabel}
        confirmColor={confirm?.confirmColor}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
