import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface AuthCtx {
  isUnlocked: boolean
  unlock: () => void
}

const AuthContext = createContext<AuthCtx>({ isUnlocked: false, unlock: () => {} })

const EXPIRY_KEY = 'mimuse_unlock_expiry'
const SESSION_MS = 2 * 60 * 60 * 1000 // 2 hours

function readIsUnlocked(): boolean {
  const expiry = Number(localStorage.getItem(EXPIRY_KEY) ?? 0)
  return Date.now() < expiry
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setUnlocked] = useState(readIsUnlocked)

  useEffect(() => {
    const id = setInterval(() => {
      setUnlocked(readIsUnlocked())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  function unlock() {
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_MS))
    setUnlocked(true)
  }

  return <AuthContext.Provider value={{ isUnlocked, unlock }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
