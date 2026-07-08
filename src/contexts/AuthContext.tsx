import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'

interface AuthCtx {
  isUnlocked: boolean
  unlock: () => void
  showSessionWarning: boolean
  extendSession: () => void
  lockNow: () => void
}

const AuthContext = createContext<AuthCtx>({
  isUnlocked: false, unlock: () => {}, showSessionWarning: false, extendSession: () => {}, lockNow: () => {},
})

const UNLOCKED_KEY = 'mimuse_unlocked'
const ACTIVITY_KEY = 'mimuse_last_activity'
const SESSION_MS = 2 * 60 * 60 * 1000 // lock after 2 hours of inactivity
const WARNING_WINDOW_MS = 60 * 1000 // ask to extend 60s before that
const CHECK_INTERVAL_MS = 5_000

function readIsUnlocked(): boolean {
  if (localStorage.getItem(UNLOCKED_KEY) !== 'true') return false
  const last = Number(localStorage.getItem(ACTIVITY_KEY) ?? 0)
  return Date.now() - last < SESSION_MS
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setUnlocked] = useState(readIsUnlocked)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const lastWriteRef = useRef(0)
  const warningShownRef = useRef(false)

  // Track user activity — but only while no warning is showing. Once the "continue?"
  // prompt appears, only its own buttons should count as a response; passive mouse/key
  // activity elsewhere must not silently extend the session behind the user's back.
  useEffect(() => {
    function markActive() {
      if (warningShownRef.current) return
      if (localStorage.getItem(UNLOCKED_KEY) !== 'true') return
      const now = Date.now()
      if (now - lastWriteRef.current > 5_000) {
        lastWriteRef.current = now
        localStorage.setItem(ACTIVITY_KEY, String(now))
      }
    }
    const events: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel']
    events.forEach(evt => window.addEventListener(evt, markActive, { passive: true }))
    return () => events.forEach(evt => window.removeEventListener(evt, markActive))
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (localStorage.getItem(UNLOCKED_KEY) !== 'true') {
        setUnlocked(false)
        setShowSessionWarning(false)
        warningShownRef.current = false
        return
      }
      const last = Number(localStorage.getItem(ACTIVITY_KEY) ?? 0)
      const idleMs = Date.now() - last
      if (idleMs >= SESSION_MS) {
        localStorage.setItem(UNLOCKED_KEY, 'false')
        setUnlocked(false)
        setShowSessionWarning(false)
        warningShownRef.current = false
      } else if (idleMs >= SESSION_MS - WARNING_WINDOW_MS) {
        setUnlocked(true)
        setShowSessionWarning(true)
        warningShownRef.current = true
      } else {
        setUnlocked(true)
      }
    }, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  function unlock() {
    const now = Date.now()
    localStorage.setItem(UNLOCKED_KEY, 'true')
    localStorage.setItem(ACTIVITY_KEY, String(now))
    lastWriteRef.current = now
    warningShownRef.current = false
    setUnlocked(true)
    setShowSessionWarning(false)
  }

  function extendSession() {
    const now = Date.now()
    localStorage.setItem(ACTIVITY_KEY, String(now))
    lastWriteRef.current = now
    warningShownRef.current = false
    setShowSessionWarning(false)
  }

  function lockNow() {
    localStorage.setItem(UNLOCKED_KEY, 'false')
    warningShownRef.current = false
    setUnlocked(false)
    setShowSessionWarning(false)
  }

  return (
    <AuthContext.Provider value={{ isUnlocked, unlock, showSessionWarning, extendSession, lockNow }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
