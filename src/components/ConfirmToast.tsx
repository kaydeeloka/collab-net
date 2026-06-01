import { useState, useCallback } from 'react'

interface ConfirmState {
  message: string
  onConfirm: () => void
}

export function useConfirmToast() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const show = useCallback((message: string, onConfirm: () => void) => {
    setState({ message, onConfirm })
    setTimeout(() => setState(null), 6000)
  }, [])

  const hide = useCallback(() => setState(null), [])

  return { state, show, hide }
}

interface Props {
  state: ConfirmState | null
  onHide: () => void
}

export default function ConfirmToast({ state, onHide }: Props) {
  if (!state) return null
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, pointerEvents: 'auto',
      background: '#1e293b', color: '#fff', borderRadius: 12, padding: '12px 18px',
      fontSize: 13, fontWeight: 500, boxShadow: '0 6px 24px rgba(0,0,0,.25)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span>{state.message}</span>
      <button
        onClick={() => { onHide(); state.onConfirm() }}
        style={{ padding: '5px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >삭제</button>
      <button
        onClick={onHide}
        style={{ padding: '5px 14px', background: '#475569', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >취소</button>
    </div>
  )
}
