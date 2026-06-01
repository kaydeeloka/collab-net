import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RequireAuth() {
  const { isUnlocked } = useAuth()
  const location = useLocation()

  if (!isUnlocked) {
    sessionStorage.setItem('mimuse_redirect', location.pathname)
    return <Navigate to="/lock" replace />
  }

  return <Outlet />
}
