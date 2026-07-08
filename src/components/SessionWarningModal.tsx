import { Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function SessionWarningModal() {
  const { showSessionWarning, extendSession, lockNow } = useAuth()
  if (!showSessionWarning) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(4,0,0,.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: 400, maxWidth: '100%', textAlign: 'center',
        background: 'var(--white)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-lg)',
        padding: '40px 36px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-lt)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Lock size={20} color="#648085" strokeWidth={2} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
            대시보드 세션 연장
          </h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--gray-5)', lineHeight: 1.65 }}>
          2시간동안 서비스를 이용하지 않아<br />
          잠시 후 자동으로 잠금될 예정입니다.
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginTop: 18, marginBottom: 28 }}>
          계속 사용하시겠습니까?
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={lockNow}
            style={{
              flex: 1, padding: '11px 20px', borderRadius: 'var(--r)', cursor: 'pointer',
              border: '1px solid var(--surface-md)', background: 'var(--white)',
              color: 'var(--gray-6)', fontSize: 13.5, fontWeight: 600,
              transition: 'background .15s',
            }}
          >
            잠금
          </button>
          <button
            onClick={extendSession}
            style={{
              flex: 1, padding: '11px 20px', borderRadius: 'var(--r)', cursor: 'pointer',
              border: 'none', background: 'var(--teal-dk)',
              color: '#fff', fontSize: 13.5, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(100,128,133,.35)',
              transition: 'background .15s',
            }}
          >
            세션 연장
          </button>
        </div>
      </div>
    </div>
  )
}
