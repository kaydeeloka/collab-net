import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'

import Lock        from './pages/Lock'
import Dashboard   from './pages/home'
import Trends      from './pages/trend'
import Listup      from './pages/influencer/search'
import Outreach    from './pages/influencer/contact'
import Confirmed   from './pages/influencer/confirmed'
import Ems         from './pages/kit/ems'
import Monitoring  from './pages/monitoring/reviews'

// TREND
import TiktokTrend from './pages/trend/TiktokTrend'

// INFLUENCER — search
import SearchSettings from './pages/influencer/search/Settings'
import SearchExplore  from './pages/influencer/search/Explore'
import SearchDbList   from './pages/influencer/search/DbList'
// INFLUENCER — contact
import ContactList      from './pages/influencer/contact/List'
import ContactTemplate  from './pages/influencer/contact/Template'
import ContactCompleted from './pages/influencer/contact/Completed'
// INFLUENCER — confirmed
import ConfirmedShipping       from './pages/influencer/confirmed/Shipping'
import ConfirmedMonitoringLink from './pages/influencer/confirmed/MonitoringLink'

// BRAND — db
import BrandDb       from './pages/brand/db/index'
import BrandDbMail   from './pages/brand/db/Mail'
import BrandDbContacts from './pages/brand/db/Contacts'
// BRAND — contact
import BrandContact          from './pages/brand/contact/index'
import BrandContactList      from './pages/brand/contact/List'
import BrandContactTemplate  from './pages/brand/contact/Template'
import BrandContactCompleted from './pages/brand/contact/Completed'
// BRAND — confirmed
import BrandConfirmed        from './pages/brand/confirmed/index'
import BrandConfirmedFolders from './pages/brand/confirmed/Folders'
import BrandConfirmedFiles   from './pages/brand/confirmed/Files'

// KIT — ems
import EmsDaily   from './pages/kit/ems/Daily'
import EmsCheck   from './pages/kit/ems/Check'
import EmsPending from './pages/kit/ems/Pending'
// KIT — design-archive
import DesignArchive       from './pages/kit/design-archive/index'
import DesignArchiveOrders from './pages/kit/design-archive/Orders'

// MONITORING — reviews
import ReviewsUploadStatus from './pages/monitoring/reviews/UploadStatus'
import ReviewsManualCheck  from './pages/monitoring/reviews/ManualCheck'
import ReviewsBrandCheck   from './pages/monitoring/reviews/BrandCheck'
// MONITORING — content
import ReviewContent   from './pages/monitoring/content/index'
import ContentFollowup from './pages/monitoring/content/Followup'
import ContentReport   from './pages/monitoring/content/Report'
// MONITORING — reports
import ReportArchive from './pages/monitoring/reports/index'
import ReportsBrand  from './pages/monitoring/reports/Brand'
import ReportsAll    from './pages/monitoring/reports/All'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/lock" element={<Lock />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>

                {/* ── HOME ── */}
                <Route path="/"                         element={<Dashboard />} />
                <Route path="/home/dday"                element={<Navigate to="/" replace />} />
                <Route path="/home/trend-summary"       element={<Navigate to="/" replace />} />
                <Route path="/home/influencer-status"   element={<Navigate to="/" replace />} />
                <Route path="/home/brand-status"        element={<Navigate to="/" replace />} />
                <Route path="/home/delivery-status"     element={<Navigate to="/" replace />} />
                <Route path="/home/review-upload"       element={<Navigate to="/" replace />} />

                {/* ── TREND ── */}
                <Route path="/trend/news"               element={<Trends />} />
                <Route path="/trend/tiktok"             element={<TiktokTrend />} />

                {/* ── INFLUENCER ── */}
                <Route path="/influencer/search"                    element={<Listup />} />
                <Route path="/influencer/search/settings"           element={<SearchSettings />} />
                <Route path="/influencer/search/explore"            element={<SearchExplore />} />
                <Route path="/influencer/search/db"                 element={<SearchDbList />} />
                <Route path="/influencer/contact"                   element={<Outreach />} />
                <Route path="/influencer/contact/list"              element={<ContactList />} />
                <Route path="/influencer/contact/template"          element={<ContactTemplate />} />
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
                <Route path="/brand/confirmed"                      element={<BrandConfirmed />} />
                <Route path="/brand/confirmed/folders"              element={<BrandConfirmedFolders />} />
                <Route path="/brand/confirmed/files"                element={<BrandConfirmedFiles />} />

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
                <Route path="/monitoring/content"                   element={<ReviewContent />} />
                <Route path="/monitoring/content/followup"          element={<ContentFollowup />} />
                <Route path="/monitoring/content/report"            element={<ContentReport />} />
                <Route path="/monitoring/reports"                   element={<ReportArchive />} />
                <Route path="/monitoring/reports/brand"             element={<ReportsBrand />} />
                <Route path="/monitoring/reports/all"               element={<ReportsAll />} />

                {/* ── old-path redirects ── */}
                <Route path="/trends"     element={<Navigate to="/trend/news"           replace />} />
                <Route path="/listup"     element={<Navigate to="/influencer/search"    replace />} />
                <Route path="/outreach"   element={<Navigate to="/influencer/contact"   replace />} />
                <Route path="/confirmed"  element={<Navigate to="/influencer/confirmed" replace />} />
                <Route path="/ems"        element={<Navigate to="/kit/ems"              replace />} />
                <Route path="/monitoring" element={<Navigate to="/monitoring/reviews"   replace />} />

              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
