import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const CORRECT_PIN = 'US26'

export default function Lock() {
  const { isUnlocked, unlock } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (isUnlocked) {
      const dest = sessionStorage.getItem('mimuse_redirect') || '/'
      sessionStorage.removeItem('mimuse_redirect')
      navigate(dest, { replace: true })
    }
  }, [isUnlocked])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleInput(v: string) {
    const upper = v.toUpperCase().slice(0, 4)
    setValue(upper)
    setError('')
    if (upper.length === 4) {
      setTimeout(() => checkPin(upper), 80)
    }
  }

  function checkPin(pin: string) {
    if (pin === CORRECT_PIN) {
      unlock()
      const dest = sessionStorage.getItem('mimuse_redirect') || '/'
      sessionStorage.removeItem('mimuse_redirect')
      navigate(dest, { replace: true })
    } else {
      setShake(true)
      setError('Incorrect PIN. Please try again.')
      setTimeout(() => { setValue(''); setShake(false); inputRef.current?.focus() }, 500)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #fffde7 0%, #f8f9fb 50%, #edf3f6 100%)',
    }}>
      <div style={{ textAlign: 'center', width: 320 }} onClick={() => inputRef.current?.focus()}>
        <img src="/img/logo-03.png" alt="MiMuse" style={{ height: 72, borderRadius: 20, marginBottom: 16 }} />
        <p style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>beautyproject@cranecomm.com</p>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 28 }}>
          Your MiMuse Dashboard is locked
        </h2>

        <div
          style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 12 }}
          className={shake ? 'pin-shake' : ''}
        >
          {[0, 1, 2, 3].map(i => {
            const filled = i < value.length
            const active = i === value.length
            return (
              <div key={i} style={{
                width: 52, height: 60, borderRadius: 12,
                border: shake ? '2px solid #ef4444' : active ? '2px solid #6a95a5' : '2px solid #e0e0e0',
                background: filled ? '#6a95a5' : shake ? '#fee2e2' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, color: '#fff', fontWeight: 700,
                transition: 'border-color .15s, background .15s',
              }}>
                {filled ? '●' : ''}
              </div>
            )
          })}
        </div>

        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <input
          ref={inputRef}
          type="password"
          value={value}
          maxLength={4}
          autoComplete="off"
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.length === 4) checkPin(value) }}
          style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}
        />

        <button
          onClick={() => setError('Contact the dashboard administrator.')}
          style={{
            background: 'none', border: 'none', color: '#888', fontSize: 13,
            cursor: 'pointer', marginTop: 12, textDecoration: 'underline',
          }}
        >
          I forgot my Lock Mode password
        </button>
      </div>
    </div>
  )
}
