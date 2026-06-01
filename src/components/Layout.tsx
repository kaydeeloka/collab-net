import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { gasGet } from '../lib/api'
import { useKrClock } from '../lib/utils'

interface PhaseInfo {
  ok: boolean
  activePhase?: string
}

export default function Layout() {
  const [phaseBadge, setPhaseBadge] = useState('—')
  const [navClock, setNavClock] = useState('')
  const getKrTime = useKrClock()

  useEffect(() => {
    const tick = () => {
      const t = getKrTime()
      setNavClock(t.navDate + '  ' + t.navTime)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    gasGet<PhaseInfo>('getPhaseInfo')
      .then(d => { if (d.ok) setPhaseBadge(d.activePhase || '—') })
      .catch(() => {})
  }, [])

  const tabs = [
    { to: '/', label: '대시보드', end: true },
    { to: '/trends', label: '트렌드 분석' },
    { to: '/listup', label: '인플루언서 리스트업' },
    { to: '/outreach', label: '아웃리치' },
    { to: '/confirmed', label: '확정 인플루언서' },
    { to: '/ems', label: 'EMS 트래킹' },
    { to: '/monitoring', label: '인플루언서 모니터링' },
  ]

  return (
    <>
      <nav>
        <img className="logo" src="/img/logo-03.png" alt="MiMuse" />
        <div className="tabs">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          <span className="nav-clock">{navClock}</span>
          <span className="phase-badge-nav">{phaseBadge}</span>
        </div>
      </nav>
      <Outlet />
    </>
  )
}
