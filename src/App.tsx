import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import Lock from './pages/Lock'
import Dashboard from './pages/Dashboard'
import Trends from './pages/Trends'
import Listup from './pages/Listup'
import Outreach from './pages/Outreach'
import Confirmed from './pages/Confirmed'
import Ems from './pages/Ems'
import Monitoring from './pages/Monitoring'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/lock" element={<Lock />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/trends" element={<Trends />} />
                <Route path="/listup" element={<Listup />} />
                <Route path="/outreach" element={<Outreach />} />
                <Route path="/confirmed" element={<Confirmed />} />
                <Route path="/ems" element={<Ems />} />
                <Route path="/monitoring" element={<Monitoring />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
