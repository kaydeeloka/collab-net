import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  msg: string
  type: ToastType
}

interface ToastCtx {
  showToast: (msg: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
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
              <span>{t.msg}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
