import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthCtx {
  isUnlocked: boolean
  unlock: () => void
}

const AuthContext = createContext<AuthCtx>({ isUnlocked: false, unlock: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isUnlocked, setUnlocked] = useState(true) // DEV: skip lock

  function unlock() {
    sessionStorage.setItem('mimuse_unlocked', 'true')
    setUnlocked(true)
  }

  return <AuthContext.Provider value={{ isUnlocked, unlock }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
