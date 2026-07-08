import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import './Lock.css'

const CORRECT_PIN = '2626'
const HINT_LINE_1 = '힌트: MiMuse 시작 연도의 마지막'
const HINT_LINE_2 = '두 자리를 입력하세요'

export default function Lock() {
  const { isUnlocked, unlock } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [showHint, setShowHint] = useState(false)

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
    const digits = v.replace(/\D/g, '').slice(0, 4)
    setValue(digits)
    setError('')
    if (digits.length === 4) {
      setTimeout(() => checkPin(digits), 80)
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
      setError('비밀번호가 올바르지 않습니다. 다시 시도해주세요.')
      setTimeout(() => { setValue(''); setShake(false); inputRef.current?.focus() }, 500)
    }
  }

  return (
    <div className="lock-page">
      <div className="lock-card" onClick={() => inputRef.current?.focus()}>
        <img src="/img/logo-black.svg" alt="MiMuse" className="lock-logo" />
        <p className="lock-email">beautyproject@cranecomm.com</p>
        <h2 className="lock-title">MiMuse 대시보드 잠금 모드</h2>

        <div className={`lock-pins${shake ? ' lock-pins--shake' : ''}`}>
          {[0, 1, 2, 3].map(i => {
            const filled = i < value.length
            const active = i === value.length
            const cls = [
              'lock-pin',
              filled && 'lock-pin--filled',
              active && !shake && 'lock-pin--active',
              shake && 'lock-pin--error',
            ].filter(Boolean).join(' ')
            return <div key={i} className={cls}>{filled ? '●' : ''}</div>
          })}
        </div>

        {error && <p className="lock-error">{error}</p>}

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          value={value}
          maxLength={4}
          autoComplete="off"
          onChange={e => handleInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.length === 4) checkPin(value) }}
          className="lock-hidden-input"
        />

        <button className="lock-forgot" onClick={() => setShowHint(v => !v)}>
          비밀번호를 잊으셨나요?
        </button>
        {showHint && <p className="lock-hint">{HINT_LINE_1}<br />{HINT_LINE_2}</p>}
      </div>
    </div>
  )
}
