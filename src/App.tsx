import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { PhaseProvider } from '@/contexts/PhaseContext'
import RequireAuth from '@/components/RequireAuth'
import Layout from '@/components/Layout'

import Lock        from './pages/Lock'
import Dashboard   from './pages/home'
import BeautyNews  from './pages/trend/beauty-news'
import Listup      from './pages/influencer/search'
import Outreach    from './pages/influencer/contact'
import Confirmed   from './pages/influencer/confirmed'
import Ems         from './pages/kit/ems'
import EmsLayout   from './pages/kit/ems/layout'
import EmsErrors   from './pages/kit/ems/errors'
import EmsTemplate from './pages/kit/ems-template'
// TREND
import TiktokTrend from './pages/trend/tiktok'

// INFLUENCER — template
import InfluencerTemplate from './pages/influencer/template'
// INFLUENCER — confirmed
import ConfirmedShipping       from './pages/influencer/confirmed/shipping'
import InfluencerMonitoring from './pages/influencer/monitoring'

// BRAND — db
import BrandDb         from './pages/brand/db'
import BrandDbGeneral  from './pages/brand/db/general'
import BrandDbPersonal from './pages/brand/db/personal'
import BrandTemplate         from './pages/brand/template'
import BrandContact          from './pages/brand/contact'
// BRAND — confirmed
import BrandConfirmed        from './pages/brand/confirmed'
import BrandConfirmedFolders from './pages/brand/confirmed/management'
import BrandConfirmedArchive from './pages/brand/confirmed/archive'
import BrandArchiveList       from './pages/brand/confirmed/archive/list'
import BrandArchiveDetail     from './pages/brand/confirmed/archive/detail'

// KIT — ems
import EmsData    from './pages/kit/ems-data'
// ARCHIVE
import ArchiveDesign        from './pages/archive/design'
import ArchiveOverallReport from './pages/archive/overall-report'
import ArchiveBrandReport   from './pages/archive/brand-report'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PhaseProvider>
        <ToastProvider>
          <Routes>
            <Route path="/lock" element={<Lock />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>

                {/* ── HOME ── */}
                <Route path="/"                         element={<Dashboard />} />

                {/* ── TREND ── */}
                <Route path="/trend/beauty-news"        element={<BeautyNews />} />
                <Route path="/trend/news"               element={<Navigate to="/trend/beauty-news" replace />} />
                <Route path="/trend/tiktok"             element={<TiktokTrend />} />

                {/* ── INFLUENCER ── */}
                <Route path="/influencer/search"                    element={<Listup />} />
                <Route path="/influencer/search/db"                 element={<Listup />} />
                <Route path="/influencer/template"                  element={<InfluencerTemplate />} />
                <Route path="/influencer/contact"                   element={<Outreach />} />
                <Route path="/influencer/confirmed"                 element={<Confirmed />} />
                <Route path="/influencer/confirmed/shipping"        element={<ConfirmedShipping />} />
                <Route path="/influencer/monitoring"                  element={<InfluencerMonitoring />} />

                {/* ── BRAND ── */}
                <Route path="/brand/db" element={<BrandDb />}>
                  <Route index element={<Navigate to="general" replace />} />
                  <Route path="general"  element={<BrandDbGeneral />} />
                  <Route path="personal" element={<BrandDbPersonal />} />
                </Route>
                <Route path="/brand/contact"                        element={<BrandContact />} />
                <Route path="/brand/template"                           element={<BrandTemplate />} />
                <Route path="/brand/confirmed" element={<BrandConfirmed />}>
                  <Route index element={<Navigate to="management" replace />} />
                  <Route path="management" element={<BrandConfirmedFolders />} />
                  <Route path="archive" element={<BrandConfirmedArchive />}>
                    <Route index element={<BrandArchiveList />} />
                    <Route path=":slug" element={<BrandArchiveDetail />} />
                  </Route>
                </Route>

                {/* ── KIT ── */}
                <Route path="/kit/ems" element={<EmsLayout />}>
                  <Route index element={<Ems />} />
                  <Route path="errors" element={<EmsErrors />} />
                </Route>
                <Route path="/kit/ems-template" element={<EmsTemplate />} />
                <Route path="/kit/ems-email" element={<Navigate to="/kit/ems-template" replace />} />
                <Route path="/kit/ems-error" element={<Navigate to="/kit/ems/errors" replace />} />
                <Route path="/kit/ems/check"   element={<Navigate to="/kit/ems/errors" replace />} />
                <Route path="/kit/ems-data"                        element={<EmsData />} />
                <Route path="/kit/design-archive"        element={<Navigate to="/archive/design" replace />} />

                {/* ── ARCHIVE ── */}
                <Route path="/archive/design"          element={<ArchiveDesign />} />
                <Route path="/archive/overall-report"  element={<ArchiveOverallReport />} />
                <Route path="/archive/brand-report"    element={<ArchiveBrandReport />} />

              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
        </PhaseProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
