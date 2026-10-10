import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import { MainLayout } from '@/framework/layout/MainLayout'
import { ProtectedRoute } from '@/framework/auth/ProtectedRoute'
import { RequirePermission } from '@/framework/auth/RequirePermission'
import { RequireSuperAdmin } from '@/framework/auth/RequireSuperAdmin'
import { SkeletonRows } from '@/design-system'
import { LoginPage } from '@/modules/auth/LoginPage'
import { OtpVerifyPage } from '@/modules/auth/OtpVerifyPage'
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage'
import { FirstLoginPasswordPage } from '@/modules/auth/FirstLoginPasswordPage'
import { AdminBypassPage } from '@/modules/auth/AdminBypassPage'

// F21 (denetim 2026-09-16): önceden 30 modül sayfasının tamamı statik import
// ediliyordu, tek bir JS bundle'ında birleştiriliyordu (3.19 MB, gzip 844 KB).
// Kullanıcı sadece yetkili olduğu birkaç modülü açsa da tüm modüllerin kodu
// ilk yüklemede indiriliyordu — düşük donanım/ağda açılış maliyeti riski.
// React.lazy + route-bazlı code-splitting: her modül artık ayrı bir chunk,
// yalnızca ziyaret edilen route'un JS'i indirilir. Login/OTP/forgot-password
// gibi ilk-erişim sayfaları statik kalır (zaten küçük, lazy'nin ekstra ağ
// round-trip'i ilk yüklemeyi yavaşlatmasın diye).
const AdminPage = lazy(() => import('@/modules/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const DeviceMonitorPage = lazy(() => import('@/modules/device-monitor/DeviceMonitorPage').then(m => ({ default: m.DeviceMonitorPage })))
const ParticipantsPage = lazy(() => import('@/modules/participants/ParticipantsPage').then(m => ({ default: m.ParticipantsPage })))
const ServiceFacilitiesPage = lazy(() => import('@/modules/service-facilities/ServiceFacilitiesPage').then(m => ({ default: m.ServiceFacilitiesPage })))
const HallsPage = lazy(() => import('@/modules/halls/HallsPage').then(m => ({ default: m.HallsPage })))
const EventsPage = lazy(() => import('@/modules/events/EventsPage').then(m => ({ default: m.EventsPage })))
const TravelsPage = lazy(() => import('@/modules/travels/TravelsPage').then(m => ({ default: m.TravelsPage })))
const LibraryPage = lazy(() => import('@/modules/library/LibraryPage').then(m => ({ default: m.LibraryPage })))
const SportsPage = lazy(() => import('@/modules/sports/SportsPage').then(m => ({ default: m.SportsPage })))
const WomenFamilyPage = lazy(() => import('@/modules/women-family/WomenFamilyPage').then(m => ({ default: m.WomenFamilyPage })))
const PoolPage = lazy(() => import('@/modules/pool/PoolPage').then(m => ({ default: m.PoolPage })))
const YouthCampPage = lazy(() => import('@/modules/youth-camp/YouthCampPage').then(m => ({ default: m.YouthCampPage })))
const ScoutCampPage = lazy(() => import('@/modules/scout-camp/ScoutCampPage').then(m => ({ default: m.ScoutCampPage })))
const ScienceCenterPage = lazy(() => import('@/modules/science-center/ScienceCenterPage').then(m => ({ default: m.ScienceCenterPage })))
const AccessiblePage = lazy(() => import('@/modules/accessible-life/AccessiblePage').then(m => ({ default: m.AccessiblePage })))
const MuhtarlikPage = lazy(() => import('@/modules/muhtarlik/MuhtarlikPage').then(m => ({ default: m.MuhtarlikPage })))
const EmergencyAreasPage = lazy(() => import('@/modules/emergency-areas/EmergencyAreasPage').then(m => ({ default: m.EmergencyAreasPage })))
const DutyPharmaciesPage = lazy(() => import('@/modules/duty-pharmacy/DutyPharmaciesPage').then(m => ({ default: m.DutyPharmaciesPage })))
const QuizPage = lazy(() => import('@/modules/quiz/QuizPage').then(m => ({ default: m.QuizPage })))
const WheelPage = lazy(() => import('@/modules/wheel/WheelPage').then(m => ({ default: m.WheelPage })))
const SurveyPage = lazy(() => import('@/modules/survey/SurveyPage').then(m => ({ default: m.SurveyPage })))
const PopupPage = lazy(() => import('@/modules/popups/PopupPage').then(m => ({ default: m.PopupPage })))
const CompaniesPage = lazy(() => import('@/modules/companies/CompaniesPage').then(m => ({ default: m.CompaniesPage })))
const SettingsPage = lazy(() => import('@/modules/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ReportsPage = lazy(() => import('@/modules/reports/ReportsPage').then(m => ({ default: m.ReportsPage })))
const MobileConfigPage = lazy(() => import('@/modules/mobile-config/MobileConfigPage').then(m => ({ default: m.MobileConfigPage })))
const LoyaltyPage = lazy(() => import('@/modules/loyalty/LoyaltyPage').then(m => ({ default: m.LoyaltyPage })))
const LogsPage = lazy(() => import('@/modules/logs/LogsPage').then(m => ({ default: m.LogsPage })))
const BakkartAdminPage = lazy(() => import('@/modules/bakkart/BakkartAdminPage').then(m => ({ default: m.BakkartAdminPage })))
const EBelediyeAdminPage = lazy(() => import('@/modules/e-belediye/EBelediyeAdminPage').then(m => ({ default: m.EBelediyeAdminPage })))
const NikahAdminPage = lazy(() => import('@/modules/nikah/NikahAdminPage').then(m => ({ default: m.NikahAdminPage })))
const VeterinerlikAdminPage = lazy(() => import('@/modules/veterinerlik/VeterinerlikAdminPage').then(m => ({ default: m.VeterinerlikAdminPage })))
const ImarAdminPage = lazy(() => import('@/modules/imar/ImarAdminPage').then(m => ({ default: m.ImarAdminPage })))
const SaglikAdminPage = lazy(() => import('@/modules/saglik/SaglikAdminPage').then(m => ({ default: m.SaglikAdminPage })))

const RouteFallback = () => (
  <div className="p-6">
    <SkeletonRows rows={8} />
  </div>
)

// Kullanıcı isteği (2026-09-01): "Anket Kullanıcısı" yetkisindeki yönetici için
// varsayılan yönlendirme /dashboard değil /survey olsun (dashboard'a erişimi yok).
const DefaultRedirect = () => {
  const { isSurveyOnlyUser, can, isSuperAdmin, getFacilityScope } = useAuth()
  // Kullanıcı isteği (2026-09-25): kütüphane görevlisi girişte doğrudan kütüphane/mesai
  // ekranına gelir, orada çalıştığı kütüphaneyi seçip mesaisini başlatır. Görevli = kapı/mesai
  // yetkisi (library-mesai.door-access) olan ve genel yönetici olmayan kullanıcı.
  const isLibraryStaff = !isSuperAdmin && can('library-mesai.door-access') && !can('admins.create')
  const isMuhtar = !isSuperAdmin && getFacilityScope('muhtarlik') !== null
  return <Navigate to={isSurveyOnlyUser ? '/survey' : isLibraryStaff ? '/library' : isMuhtar ? '/muhtarlik?tab=panelim' : '/dashboard'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/otp" element={<OtpVerifyPage />} />
      <Route path="/login/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/bypass" element={<AdminBypassPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/first-login" element={<FirstLoginPasswordPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/dashboard" element={<Suspense fallback={<RouteFallback />}><DashboardPage /></Suspense>} />
          <Route path="/reports" element={<RequirePermission permission="reports.view"><Suspense fallback={<RouteFallback />}><ReportsPage /></Suspense></RequirePermission>} />
          <Route path="/admin" element={<RequirePermission permission="admins.view"><Suspense fallback={<RouteFallback />}><AdminPage /></Suspense></RequirePermission>} />
          <Route path="/device-monitor" element={<RequirePermission permission="device-monitor.view"><Suspense fallback={<RouteFallback />}><DeviceMonitorPage /></Suspense></RequirePermission>} />
          <Route path="/mobile-config" element={<RequirePermission permission="mobile-config.view"><Suspense fallback={<RouteFallback />}><MobileConfigPage /></Suspense></RequirePermission>} />
          <Route path="/participants" element={<RequirePermission permission="participants.view"><Suspense fallback={<RouteFallback />}><ParticipantsPage /></Suspense></RequirePermission>} />
          <Route path="/service-facilities" element={<RequirePermission permission="service-facilities.view"><Suspense fallback={<RouteFallback />}><ServiceFacilitiesPage /></Suspense></RequirePermission>} />
          <Route path="/halls" element={<RequirePermission permission="halls.view"><Suspense fallback={<RouteFallback />}><HallsPage /></Suspense></RequirePermission>} />
          <Route path="/events" element={<RequirePermission permission="events.view"><Suspense fallback={<RouteFallback />}><EventsPage /></Suspense></RequirePermission>} />
          <Route path="/travels" element={<RequirePermission permission="travels.view"><Suspense fallback={<RouteFallback />}><TravelsPage /></Suspense></RequirePermission>} />
          <Route path="/library" element={<RequirePermission permission={['library.view', 'library-mesai.view']}><Suspense fallback={<RouteFallback />}><LibraryPage /></Suspense></RequirePermission>} />
          <Route path="/sports" element={<RequirePermission permission="sports.view"><Suspense fallback={<RouteFallback />}><SportsPage /></Suspense></RequirePermission>} />
          <Route path="/women-family" element={<RequirePermission permission="women-family.view"><Suspense fallback={<RouteFallback />}><WomenFamilyPage /></Suspense></RequirePermission>} />
          <Route path="/pool" element={<RequirePermission permission="pool.view"><Suspense fallback={<RouteFallback />}><PoolPage /></Suspense></RequirePermission>} />
          <Route path="/youth-camp" element={<RequirePermission permission="youth-camp.view"><Suspense fallback={<RouteFallback />}><YouthCampPage /></Suspense></RequirePermission>} />
          <Route path="/scout-camp" element={<RequirePermission permission="scout-camp.view"><Suspense fallback={<RouteFallback />}><ScoutCampPage /></Suspense></RequirePermission>} />
          <Route path="/science-center" element={<RequirePermission permission="science-center.view"><Suspense fallback={<RouteFallback />}><ScienceCenterPage /></Suspense></RequirePermission>} />
          <Route path="/accessible-life" element={<RequirePermission permission="accessible-life.view"><Suspense fallback={<RouteFallback />}><AccessiblePage /></Suspense></RequirePermission>} />
          <Route path="/muhtarlik" element={<RequirePermission permission="muhtarlik.view"><Suspense fallback={<RouteFallback />}><MuhtarlikPage /></Suspense></RequirePermission>} />
          <Route path="/emergency-areas" element={<RequirePermission permission="emergency-areas.view"><Suspense fallback={<RouteFallback />}><EmergencyAreasPage /></Suspense></RequirePermission>} />
          <Route path="/duty-pharmacies" element={<RequireSuperAdmin><Suspense fallback={<RouteFallback />}><DutyPharmaciesPage /></Suspense></RequireSuperAdmin>} />
          <Route path="/quiz" element={<RequirePermission permission="quiz.view"><Suspense fallback={<RouteFallback />}><QuizPage /></Suspense></RequirePermission>} />
          <Route path="/wheel" element={<RequirePermission permission="wheel.view"><Suspense fallback={<RouteFallback />}><WheelPage /></Suspense></RequirePermission>} />
          <Route path="/survey" element={<RequirePermission permission="survey.view"><Suspense fallback={<RouteFallback />}><SurveyPage /></Suspense></RequirePermission>} />
          <Route path="/popups" element={<RequirePermission permission="popups.view"><Suspense fallback={<RouteFallback />}><PopupPage /></Suspense></RequirePermission>} />
          <Route path="/companies" element={<RequirePermission permission="companies.view"><Suspense fallback={<RouteFallback />}><CompaniesPage /></Suspense></RequirePermission>} />
          <Route path="/settings" element={<RequireSuperAdmin><Suspense fallback={<RouteFallback />}><SettingsPage /></Suspense></RequireSuperAdmin>} />
          <Route path="/loyalty" element={<RequirePermission permission="loyalty.view"><Suspense fallback={<RouteFallback />}><LoyaltyPage /></Suspense></RequirePermission>} />
          <Route path="/logs" element={<RequirePermission permission="logs.view"><Suspense fallback={<RouteFallback />}><LogsPage /></Suspense></RequirePermission>} />
          <Route path="/halk-masasi" element={<Navigate to="/muhtarlik" replace />} />
          <Route path="/bakkart" element={<Suspense fallback={<RouteFallback />}><BakkartAdminPage /></Suspense>} />
          <Route path="/e-belediye" element={<Suspense fallback={<RouteFallback />}><EBelediyeAdminPage /></Suspense>} />
          <Route path="/nikah" element={<Suspense fallback={<RouteFallback />}><NikahAdminPage /></Suspense>} />
          <Route path="/veterinerlik" element={<Suspense fallback={<RouteFallback />}><VeterinerlikAdminPage /></Suspense>} />
          <Route path="/imar" element={<Suspense fallback={<RouteFallback />}><ImarAdminPage /></Suspense>} />
          <Route path="/saglik" element={<Suspense fallback={<RouteFallback />}><SaglikAdminPage /></Suspense>} />
          <Route path="*" element={<DefaultRedirect />} />
        </Route>
      </Route>
    </Routes>
  )
}
