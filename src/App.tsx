import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { PhaseProvider } from './contexts/PhaseContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'

import Lock        from './pages/Lock'
import Dashboard   from './pages/home'
import Trends      from './pages/trend/news'
import Listup      from './pages/influencer/search'
import Outreach    from './pages/influencer/contact'
import Confirmed   from './pages/influencer/confirmed'
import Ems         from './pages/kit/ems'
import Monitoring  from './pages/monitoring/reviews'

// TREND
import TiktokTrend from './pages/trend/tiktok'

// INFLUENCER — template
import InfluencerTemplate from './pages/influencer/template'
// INFLUENCER — contact
import ContactList      from './pages/influencer/contact/list'
import ContactCompleted from './pages/influencer/contact/completed'
// INFLUENCER — confirmed
import ConfirmedShipping       from './pages/influencer/confirmed/shipping'
import ConfirmedMonitoringLink from './pages/influencer/confirmed/monitoring'

// BRAND — db
import BrandDb         from './pages/brand/db'
import BrandDbMail     from './pages/brand/db/mail'
import BrandDbContacts from './pages/brand/db/contacts'
// BRAND — contact
import BrandContact          from './pages/brand/contact'
import BrandContactList      from './pages/brand/contact/list'
import BrandContactTemplate  from './pages/brand/contact/template'
import BrandContactCompleted from './pages/brand/contact/completed'
// BRAND — confirmed
import BrandConfirmed        from './pages/brand/confirmed'
import BrandConfirmedFolders from './pages/brand/confirmed/management'
import BrandConfirmedFiles   from './pages/brand/confirmed/archive'

// KIT — ems
import EmsDaily   from './pages/kit/ems/daily'
import EmsCheck   from './pages/kit/ems/check'
import EmsPending from './pages/kit/ems/pending'
// KIT — design-archive
import DesignArchive       from './pages/kit/design-archive'
import DesignArchiveOrders from './pages/kit/design-archive/orders'

// MONITORING — reviews
import ReviewsUploadStatus from './pages/monitoring/reviews/upload-status'
import ReviewsManualCheck  from './pages/monitoring/reviews/manual-check'
import ReviewsBrandCheck   from './pages/monitoring/reviews/brand-check'
import ReviewsList         from './pages/monitoring/reviews/list'
// MONITORING — content
import ReviewContent   from './pages/monitoring/content'
import ContentFollowup from './pages/monitoring/content/followup'
import ContentReport   from './pages/monitoring/content/report'
// MONITORING — reports
import ReportArchive from './pages/monitoring/reports'
import ReportsBrand  from './pages/monitoring/reports/brand'
import ReportsAll    from './pages/monitoring/reports/all'

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
                <Route path="/trend/news"               element={<Trends />} />
                <Route path="/trend/tiktok"             element={<TiktokTrend />} />

                {/* ── INFLUENCER ── */}
                <Route path="/influencer/search"                    element={<Listup />} />
                <Route path="/influencer/search/db"                 element={<Listup />} />
                <Route path="/influencer/template"                  element={<InfluencerTemplate />} />
                <Route path="/influencer/contact"                   element={<Outreach />} />
                <Route path="/influencer/contact/list"              element={<ContactList />} />
                <Route path="/influencer/contact/completed"         element={<ContactCompleted />} />
                <Route path="/influencer/confirmed"                 element={<Confirmed />} />
                <Route path="/influencer/confirmed/shipping"        element={<ConfirmedShipping />} />
                <Route path="/influencer/confirmed/monitoring"      element={<ConfirmedMonitoringLink />} />

                {/* ── BRAND ── */}
                <Route path="/brand/db"                             element={<BrandDb />} />
                <Route path="/brand/db/mail"                        element={<BrandDbMail />} />
                <Route path="/brand/db/contacts"                    element={<BrandDbContacts />} />
                <Route path="/brand/contact"                        element={<BrandContact />} />
                <Route path="/brand/contact/list"                   element={<BrandContactList />} />
                <Route path="/brand/contact/template"               element={<BrandContactTemplate />} />
                <Route path="/brand/contact/completed"              element={<BrandContactCompleted />} />
                <Route path="/brand/confirmed" element={<BrandConfirmed />}>
                  <Route index element={<Navigate to="management" replace />} />
                  <Route path="management" element={<BrandConfirmedFolders />} />
                  <Route path="archive"    element={<BrandConfirmedFiles />} />
                </Route>

                {/* ── KIT ── */}
                <Route path="/kit/ems"                              element={<Ems />} />
                <Route path="/kit/ems/daily"                        element={<EmsDaily />} />
                <Route path="/kit/ems/check"                        element={<EmsCheck />} />
                <Route path="/kit/ems/pending"                      element={<EmsPending />} />
                <Route path="/kit/design-archive"                   element={<DesignArchive />} />
                <Route path="/kit/design-archive/orders"            element={<DesignArchiveOrders />} />

                {/* ── MONITORING ── */}
                <Route path="/monitoring/reviews"                   element={<Monitoring />} />
                <Route path="/monitoring/reviews/upload-status"     element={<ReviewsUploadStatus />} />
                <Route path="/monitoring/reviews/manual-check"      element={<ReviewsManualCheck />} />
                <Route path="/monitoring/reviews/brand-check"       element={<ReviewsBrandCheck />} />
                <Route path="/monitoring/reviews/list"              element={<ReviewsList />} />
                <Route path="/monitoring/content"                   element={<ReviewContent />} />
                <Route path="/monitoring/content/followup"          element={<ContentFollowup />} />
                <Route path="/monitoring/content/report"            element={<ContentReport />} />
                <Route path="/monitoring/reports"                   element={<ReportArchive />} />
                <Route path="/monitoring/reports/brand"             element={<ReportsBrand />} />
                <Route path="/monitoring/reports/all"               element={<ReportsAll />} />

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
