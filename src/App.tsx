import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { PhaseProvider, usePhase } from '@/contexts/PhaseContext'
import RequireAuth from '@/components/RequireAuth'
import Layout from '@/components/Layout'
import Spinner from '@/components/Spinner'
import { archiveSectionPath } from '@/pages/archive/archive-slug'

import Lock        from './pages/Lock'
import Dashboard   from './pages/home'
import BeautyNews         from './pages/trend/beauty-news'
import BeautyNewsArchive  from './pages/trend/beauty-news/archive/index'
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
import InfluencerMonitoring from './pages/influencer/monitoring'
import InfluencerMonitoringReport from './pages/influencer/monitoring/report'
import InfluencerMonitoringArchive from './pages/influencer/monitoring/archive'

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
import ArchivePicker              from './pages/archive'
import ArchiveDesignPhase         from './pages/archive/design/phase'
import ArchiveBrandReportPhase    from './pages/archive/season/phase'
import ArchiveCapture             from './pages/archive/season/report/capture'
import ArchiveBrandReportLayout    from './pages/archive/brand-report/layout'
import ArchiveBrandReportList      from './pages/archive/brand-report/index'
import ArchiveBrandReportIndex     from './pages/archive/brand-report/report-index'
import ArchiveBrandReportBrand     from './pages/archive/brand-report/report-brand'
import { phaseFromDesignSlug }    from './pages/archive/design/design-slug'
import { phaseFromSlug }          from './pages/archive/season/slug'

function ArchiveRedirectSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spinner />
    </div>
  )
}

function RedirectArchivePhaseDefault() {
  const { phaseName } = useParams<{ phaseName: string }>()
  return <Navigate to={`/archive/${phaseName}/season`} replace />
}

function RedirectLegacyDesignPhase() {
  const { legacySlug } = useParams<{ legacySlug: string }>()
  const { phases, loading } = usePhase()
  if (loading) return <ArchiveRedirectSpinner />
  const phase = phaseFromDesignSlug(phases, legacySlug)
  if (!phase) return <Navigate to="/archive" replace />
  return <Navigate to={archiveSectionPath(phase, 'design')} replace />
}

function RedirectLegacySeasonPhase() {
  const { legacySlug } = useParams<{ legacySlug: string }>()
  const { phases, loading } = usePhase()
  if (loading) return <ArchiveRedirectSpinner />
  const phase = phaseFromSlug(phases, legacySlug, {})
  if (!phase) return <Navigate to="/archive" replace />
  return <Navigate to={archiveSectionPath(phase, 'season')} replace />
}

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
                <Route path="/trend/beauty-news"              element={<BeautyNews />} />
                <Route path="/trend/beauty-news-archive"      element={<BeautyNewsArchive />} />
                <Route path="/trend/beauty-news-archive/:slug" element={<BeautyNewsArchive />} />
                <Route path="/trend/news"               element={<Navigate to="/trend/beauty-news" replace />} />
                <Route path="/trend/tiktok"             element={<TiktokTrend />} />

                {/* ── INFLUENCER ── */}
                <Route path="/influencer/search"                    element={<Listup />} />
                <Route path="/influencer/search/db"                 element={<Listup />} />
                <Route path="/influencer/template"                  element={<InfluencerTemplate />} />
                <Route path="/influencer/contact"                   element={<Outreach />} />
                <Route path="/influencer/confirmed"                 element={<Confirmed />} />
                <Route path="/influencer/monitoring"                element={<InfluencerMonitoring />} />
                <Route path="/influencer/monitoring-list"          element={<InfluencerMonitoring />} />
                <Route path="/influencer/monitoring/report"        element={<InfluencerMonitoringReport />} />
                <Route path="/influencer/monitoring/archive"       element={<InfluencerMonitoringArchive />} />

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
                <Route path="/kit/design-archive" element={<Navigate to="/archive" replace />} />

                {/* ── ARCHIVE ── */}
                <Route path="/archive" element={<ArchivePicker />} />
                <Route path="/archive/:phaseName" element={<RedirectArchivePhaseDefault />} />
                <Route path="/archive/:phaseName/design" element={<ArchiveDesignPhase />} />
                <Route path="/archive/:phaseName/season" element={<ArchiveBrandReportPhase />} />
                <Route path="/archive/:phaseName/capture" element={<ArchiveCapture />} />
                <Route path="/archive/:phaseName/brand-report" element={<ArchiveBrandReportLayout />}>
                  <Route index element={<ArchiveBrandReportIndex />} />
                  <Route path=":brandSlug" element={<ArchiveBrandReportBrand />} />
                </Route>
                <Route path="/archive/design" element={<Navigate to="/archive" replace />} />
                <Route path="/archive/design/:legacySlug" element={<RedirectLegacyDesignPhase />} />
                <Route path="/archive/season" element={<Navigate to="/archive" replace />} />
                <Route path="/archive/season/:legacySlug" element={<RedirectLegacySeasonPhase />} />
                <Route path="/archive/brand-report" element={<ArchiveBrandReportList />} />
                <Route path="/archive/brand-report/:legacySlug" element={<RedirectLegacySeasonPhase />} />
                <Route path="/archive/overall-report" element={<Navigate to="/archive" replace />} />

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
