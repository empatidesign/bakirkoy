import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Loader2Icon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import { ProtectedRoute } from '@/framework/auth/ProtectedRoute'
import { AppShell } from '@/framework/layout/AppShell'
import { LoginPage } from '@/modules/auth/LoginPage'
import { OtpVerifyPage } from '@/modules/auth/OtpVerifyPage'
import { RegisterPage } from '@/modules/auth/RegisterPage'
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage'
import { FirstLoginPasswordPage } from '@/modules/auth/FirstLoginPasswordPage'
import { AppModeSelectPage } from '@/modules/auth/AppModeSelectPage'
import { HomePage } from '@/modules/home/HomePage'
import { PendingSurveyGate } from '@/modules/survey/PendingSurveyGate'
import { ConsentGate } from '@/modules/consent/ConsentGate'
import { CompanyConsentGate } from '@/modules/consent/CompanyConsentGate'
import { CompanyStaffConsentGate } from '@/modules/consent/CompanyStaffConsentGate'
import { CompanyProtectedRoute } from '@/framework/companyAuth/CompanyProtectedRoute'
import { CompanyAppShell } from '@/framework/companyLayout/CompanyAppShell'
import { CompanyLoginPage } from '@/modules/companyAuth/CompanyLoginPage'
import { CompanyOtpVerifyPage } from '@/modules/companyAuth/CompanyOtpVerifyPage'
import { CompanyChangeInitialPage } from '@/modules/companyAuth/CompanyChangeInitialPage'
import { CompanyRegisterPage } from '@/modules/companyAuth/CompanyRegisterPage'
import { CompanyForgotPasswordPage } from '@/modules/companyAuth/CompanyForgotPasswordPage'
import { useCompanyStaffAuth } from '@/framework/companyStaffAuth/CompanyStaffAuthContext'
import { CompanyStaffProtectedRoute } from '@/framework/companyStaffAuth/CompanyStaffProtectedRoute'
import { CompanyStaffAppShell } from '@/framework/companyStaffAuth/CompanyStaffAppShell'
import { CompanyStaffLoginPage } from '@/modules/companyStaffAuth/CompanyStaffLoginPage'
import { BypassPage } from '@/modules/bypass/BypassPage'
import { pendingDeepLink } from '@/services/pendingDeepLink'

// F21 (denetim 2026-09-16): önceden tüm modül sayfaları (vatandaş/firma/firma-personeli,
// ~35 sayfa) statik import ediliyordu, tek bir JS bundle'ında birleştiriliyordu
// (2.68 MB, gzip 668 KB). Bu mobil bir uygulama (Capacitor ile Android/iOS'a paketleniyor,
// bkz. vite.config.ts'teki eski Android tablet uyumluluk notu) — düşük donanım/ağda açılış
// maliyeti burada admin panelden bile daha kritik. React.lazy + route-bazlı code-splitting:
// her modül artık ayrı bir chunk. HomePage (vatandaşın giriş sonrası ilk gördüğü ana sayfa)
// ve tüm auth/QR-giriş sayfaları statik kalır (zaten küçük, kritik ilk-yol).
const EventsPage = lazy(() => import('@/modules/events/EventsPage').then(m => ({ default: m.EventsPage })))
const PlansPage = lazy(() => import('@/modules/plans/PlansPage').then(m => ({ default: m.PlansPage })))
const FacilitiesPage = lazy(() => import('@/modules/facilities/FacilitiesPage').then(m => ({ default: m.FacilitiesPage })))
const TravelsPage = lazy(() => import('@/modules/travels/TravelsPage').then(m => ({ default: m.TravelsPage })))
const LibrariesPage = lazy(() => import('@/modules/library/LibrariesPage').then(m => ({ default: m.LibrariesPage })))
const SportsPage = lazy(() => import('@/modules/sports/SportsPage').then(m => ({ default: m.SportsPage })))
const FamilyPage = lazy(() => import('@/modules/family/FamilyPage').then(m => ({ default: m.FamilyPage })))
const NotificationsPage = lazy(() => import('@/modules/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const NotificationPreferencesPage = lazy(() => import('@/modules/notifications/NotificationPreferencesPage').then(m => ({ default: m.NotificationPreferencesPage })))
const ProfilePage = lazy(() => import('@/modules/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const ActiveSessionsPage = lazy(() => import('@/modules/profile/ActiveSessionsPage').then(m => ({ default: m.ActiveSessionsPage })))
const CampaignsPage = lazy(() => import('@/modules/campaigns/CampaignsPage').then(m => ({ default: m.CampaignsPage })))
const CampaignCompanyPage = lazy(() => import('@/modules/campaigns/CampaignCompanyPage').then(m => ({ default: m.CampaignCompanyPage })))
const SavedCampaignsPage = lazy(() => import('@/modules/campaigns/SavedCampaignsPage').then(m => ({ default: m.SavedCampaignsPage })))
const WheelPage = lazy(() => import('@/modules/wheel/WheelPage').then(m => ({ default: m.WheelPage })))
const SubmissionsPage = lazy(() => import('@/modules/submissions/SubmissionsPage').then(m => ({ default: m.SubmissionsPage })))
const QuizPage = lazy(() => import('@/modules/quiz/QuizPage').then(m => ({ default: m.QuizPage })))
const EmergencyAreasPage = lazy(() => import('@/modules/emergency-areas/EmergencyAreasPage').then(m => ({ default: m.EmergencyAreasPage })))
const DutyPharmacyPage = lazy(() => import('@/modules/duty-pharmacy/DutyPharmacyPage').then(m => ({ default: m.DutyPharmacyPage })))
const LiveMapPage = lazy(() => import('@/modules/live-map/LiveMapPage').then(m => ({ default: m.LiveMapPage })))
const SurveyPage = lazy(() => import('@/modules/survey/SurveyPage').then(m => ({ default: m.SurveyPage })))
const FieldTasksPage = lazy(() => import('@/modules/survey/FieldTasksPage').then(m => ({ default: m.FieldTasksPage })))
const SedaPage = lazy(() => import('@/modules/seda/SedaPage').then(m => ({ default: m.SedaPage })))
const ApplicationsAllPage = lazy(() => import('@/modules/applications/ApplicationsAllPage').then(m => ({ default: m.ApplicationsAllPage })))
const HistoryPage = lazy(() => import('@/modules/history/HistoryPage').then(m => ({ default: m.HistoryPage })))
const QrHubPage = lazy(() => import('@/modules/qr/QrHubPage').then(m => ({ default: m.QrHubPage })))
const QrGirisPage = lazy(() => import('@/modules/qr/QrGirisPage').then(m => ({ default: m.QrGirisPage })))
const CampaignAppLinkPage = lazy(() => import('@/modules/app-link/CampaignAppLinkPage').then(m => ({ default: m.CampaignAppLinkPage })))
const LoyaltyPage = lazy(() => import('@/modules/loyalty/LoyaltyPage').then(m => ({ default: m.LoyaltyPage })))
const EBelediyePage = lazy(() => import('@/modules/e-belediye/EBelediyePage').then(m => ({ default: m.EBelediyePage })))
const CarkMenuPage = lazy(() => import('@/modules/cark/CarkMenuPage').then(m => ({ default: m.CarkMenuPage })))
const BakkartPage = lazy(() => import('@/modules/bakkart/BakkartPage').then(m => ({ default: m.BakkartPage })))
const KesfetPage = lazy(() => import('@/modules/kesfet/KesfetPage').then(m => ({ default: m.KesfetPage })))
const OdemePage = lazy(() => import('@/modules/odeme/OdemePage').then(m => ({ default: m.OdemePage })))
const NikahPage = lazy(() => import('@/modules/nikah/NikahPage').then(m => ({ default: m.NikahPage })))
const VeterinerlikPage = lazy(() => import('@/modules/veterinerlik/VeterinerlikPage').then(m => ({ default: m.VeterinerlikPage })))
const SaglikPage = lazy(() => import('@/modules/saglik/SaglikPage').then(m => ({ default: m.SaglikPage })))
const ImarPage = lazy(() => import('@/modules/imar/ImarPage').then(m => ({ default: m.ImarPage })))
const GenclikPage = lazy(() => import('@/modules/genclik/GenclikPage').then(m => ({ default: m.GenclikPage })))
const CompanyHomePage = lazy(() => import('@/modules/companyApp/CompanyHomePage').then(m => ({ default: m.CompanyHomePage })))
const CompanyCampaignsPage = lazy(() => import('@/modules/companyApp/CompanyCampaignsPage').then(m => ({ default: m.CompanyCampaignsPage })))
const CompanyRedeemPage = lazy(() => import('@/modules/companyApp/CompanyRedeemPage').then(m => ({ default: m.CompanyRedeemPage })))
const CompanyProfilePage = lazy(() => import('@/modules/companyApp/CompanyProfilePage').then(m => ({ default: m.CompanyProfilePage })))
const CompanyQrPage = lazy(() => import('@/modules/companyApp/CompanyQrPage').then(m => ({ default: m.CompanyQrPage })))
const CompanyStaffPage = lazy(() => import('@/modules/companyApp/CompanyStaffPage').then(m => ({ default: m.CompanyStaffPage })))
const CompanyStaffRedeemPage = lazy(() => import('@/modules/companyStaffAuth/CompanyStaffRedeemPage').then(m => ({ default: m.CompanyStaffRedeemPage })))
const CompanyStaffCampaignsPage = lazy(() => import('@/modules/companyStaffAuth/CompanyStaffCampaignsPage').then(m => ({ default: m.CompanyStaffCampaignsPage })))

const FullScreenLoader = () => (
  <div className="flex h-[100dvh] items-center justify-center bg-surface-1">
    <Loader2Icon className="h-7 w-7 animate-spin text-primary" />
  </div>
)

// Route chunk'ı indirilirken de aynı tam-ekran spinner'ı kullanır — kullanıcı için görsel
// olarak auth-yükleme durumundan ayırt edilemez, tutarlı bir bekleme deneyimi verir.
const RouteFallback = FullScreenLoader

// Eski (İngilizce/eski yazım) rota takma adlarından Türkçe rotaya yönlendirme.
// Düz <Navigate to="/yeni"> query string'i ve hash'i DÜŞÜRÜR — bildirim/SMS/QR
// derin bağlantılarındaki ?tab=, ?m=, ?id= sessizce kaybolur ve kullanıcı yanlış
// sekmeye düşer. Bu yüzden arama ve hash korunarak taşınır.
const RedirectKeepQuery = ({ to }: { to: string }) => {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}

const PublicRoutes = () => {
  // Kullanıcı isteği (2026-08-02): dış sitelerden gelen /etkinlikler?eventId=<id> gibi derin
  // bağlantılar, vatandaş giriş yapmamışsa aşağıdaki "*" route'unda query string düşürülerek
  // /login'e yönlendiriliyordu — ilgili etkinlik kimliği kaybolup girişten sonra genel listeye
  // düşülüyordu. Yakalanabilir bir derin bağlantıysa (şimdilik /etkinlikler) girişten önce
  // sessionStorage'a kaydedilir; DiscoverTab girişten sonra bunu okuyup açar (bkz. pendingDeepLink.ts).
  const location = useLocation()
  useEffect(() => {
    if (location.pathname === '/etkinlikler' && location.search.includes('eventId=')) {
      pendingDeepLink.set(`${location.pathname}${location.search}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Routes>
      <Route path="/bypass" element={<BypassPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/otp" element={<OtpVerifyPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route path="/firma/login" element={<CompanyLoginPage />} />
      <Route path="/firma/login/otp" element={<CompanyOtpVerifyPage />} />
      <Route path="/firma/login/change-initial" element={<CompanyChangeInitialPage />} />
      <Route path="/firma/register" element={<CompanyRegisterPage />} />
      <Route path="/firma/forgot-password" element={<CompanyForgotPasswordPage />} />

      <Route path="/firma/personel/login" element={<CompanyStaffLoginPage />} />

      <Route path="/firma/*" element={<Navigate to="/firma/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

const CitizenRoutes = () => (
  <Routes>
    <Route element={<ProtectedRoute />}>
      <Route path="/first-login" element={<FirstLoginPasswordPage />} />
      <Route path="/mod-secimi" element={<AppModeSelectPage />} />
      {/* Kullanıcı isteği (2026-09-01): saha anket sistemi tam ekran çalışır — vatandaş
          AppShell'i (alt menü/başlık) saha ekranında gösterilmez. */}
      <Route path="/saha" element={<Suspense fallback={<RouteFallback />}><FieldTasksPage /></Suspense>} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/etkinlikler" element={<Suspense fallback={<RouteFallback />}><EventsPage /></Suspense>} />
        <Route path="/planlarim" element={<Suspense fallback={<RouteFallback />}><PlansPage /></Suspense>} />
        <Route path="/hizmetler" element={<Suspense fallback={<RouteFallback />}><FacilitiesPage /></Suspense>} />
        <Route path="/geziler" element={<Suspense fallback={<RouteFallback />}><TravelsPage /></Suspense>} />
        <Route path="/kutuphane" element={<Suspense fallback={<RouteFallback />}><LibrariesPage /></Suspense>} />
        <Route path="/spor" element={<Suspense fallback={<RouteFallback />}><SportsPage /></Suspense>} />
        <Route path="/ailem" element={<Suspense fallback={<RouteFallback />}><FamilyPage /></Suspense>} />
        <Route path="/bildirimler" element={<Suspense fallback={<RouteFallback />}><NotificationsPage /></Suspense>} />
        <Route path="/bildirimler/tercihler" element={<Suspense fallback={<RouteFallback />}><NotificationPreferencesPage /></Suspense>} />
        <Route path="/profil" element={<Suspense fallback={<RouteFallback />}><ProfilePage /></Suspense>} />
        <Route path="/profil/oturumlar" element={<Suspense fallback={<RouteFallback />}><ActiveSessionsPage /></Suspense>} />
        <Route path="/kampanyalar" element={<Suspense fallback={<RouteFallback />}><CampaignsPage /></Suspense>} />
        <Route path="/kampanyalar/firma/:companyId" element={<Suspense fallback={<RouteFallback />}><CampaignCompanyPage /></Suspense>} />
        <Route path="/kaydettiklerim" element={<Suspense fallback={<RouteFallback />}><SavedCampaignsPage /></Suspense>} />
        <Route path="/carkim" element={<Suspense fallback={<RouteFallback />}><WheelPage /></Suspense>} />
        <Route path="/carkım" element={<RedirectKeepQuery to="/carkim" />} />
        <Route path="/qr" element={<Suspense fallback={<RouteFallback />}><QrHubPage /></Suspense>} />
        <Route path="/formlarim" element={<Suspense fallback={<RouteFallback />}><SubmissionsPage /></Suspense>} />
        <Route path="/yarisma" element={<Suspense fallback={<RouteFallback />}><QuizPage /></Suspense>} />
        <Route path="/acil-alanlar" element={<Suspense fallback={<RouteFallback />}><EmergencyAreasPage /></Suspense>} />
        <Route path="/nobetci-eczane" element={<Suspense fallback={<RouteFallback />}><DutyPharmacyPage /></Suspense>} />
        <Route path="/e-belediye" element={<Suspense fallback={<RouteFallback />}><EBelediyePage /></Suspense>} />
        <Route path="/cark" element={<Suspense fallback={<RouteFallback />}><CarkMenuPage /></Suspense>} />
        <Route path="/bakkart" element={<Suspense fallback={<RouteFallback />}><BakkartPage /></Suspense>} />
        <Route path="/kesfet" element={<Suspense fallback={<RouteFallback />}><KesfetPage /></Suspense>} />
        <Route path="/halk-masasi" element={<RedirectKeepQuery to="/formlarim" />} />
        <Route path="/odeme" element={<Suspense fallback={<RouteFallback />}><OdemePage /></Suspense>} />
        <Route path="/nikah" element={<Suspense fallback={<RouteFallback />}><NikahPage /></Suspense>} />
        <Route path="/veterinerlik" element={<Suspense fallback={<RouteFallback />}><VeterinerlikPage /></Suspense>} />
        <Route path="/saglik" element={<Suspense fallback={<RouteFallback />}><SaglikPage /></Suspense>} />
        <Route path="/imar" element={<Suspense fallback={<RouteFallback />}><ImarPage /></Suspense>} />
        <Route path="/genclik" element={<Suspense fallback={<RouteFallback />}><GenclikPage /></Suspense>} />
        <Route path="/canli-harita" element={<Suspense fallback={<RouteFallback />}><LiveMapPage /></Suspense>} />
        <Route path="/anketler" element={<Suspense fallback={<RouteFallback />}><SurveyPage /></Suspense>} />
        <Route path="/seda" element={<Suspense fallback={<RouteFallback />}><SedaPage /></Suspense>} />
        <Route path="/gecmisim" element={<Suspense fallback={<RouteFallback />}><HistoryPage /></Suspense>} />
        <Route path="/basvurularim" element={<Suspense fallback={<RouteFallback />}><ApplicationsAllPage /></Suspense>} />
        <Route path="/sadakat" element={<Suspense fallback={<RouteFallback />}><LoyaltyPage /></Suspense>} />
        <Route path="/events" element={<RedirectKeepQuery to="/etkinlikler" />} />
        <Route path="/plans" element={<RedirectKeepQuery to="/planlarim" />} />
        <Route path="/services" element={<RedirectKeepQuery to="/hizmetler" />} />
        <Route path="/travels" element={<RedirectKeepQuery to="/geziler" />} />
        <Route path="/libraries" element={<RedirectKeepQuery to="/kutuphane" />} />
        <Route path="/family" element={<RedirectKeepQuery to="/ailem" />} />
        <Route path="/notifications" element={<RedirectKeepQuery to="/bildirimler" />} />
        <Route path="/profile" element={<RedirectKeepQuery to="/profil" />} />
        <Route path="/profile/sessions" element={<RedirectKeepQuery to="/profil/oturumlar" />} />
        <Route path="/campaigns" element={<RedirectKeepQuery to="/kampanyalar" />} />
        <Route path="/wheel" element={<RedirectKeepQuery to="/carkim" />} />
        <Route path="/submissions" element={<RedirectKeepQuery to="/formlarim" />} />
        <Route path="/quiz" element={<RedirectKeepQuery to="/yarisma" />} />
        <Route path="/emergency-areas" element={<RedirectKeepQuery to="/acil-alanlar" />} />
        <Route path="/surveys" element={<RedirectKeepQuery to="/anketler" />} />
        <Route path="/history" element={<RedirectKeepQuery to="/gecmisim" />} />
        <Route path="/applications" element={<RedirectKeepQuery to="/basvurularim" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
)

const CompanyRoutes = () => (
  <Routes>
    <Route element={<CompanyProtectedRoute />}>
      <Route element={<CompanyAppShell />}>
        <Route path="/firma" element={<Suspense fallback={<RouteFallback />}><CompanyHomePage /></Suspense>} />
        <Route path="/firma/redeem" element={<Suspense fallback={<RouteFallback />}><CompanyRedeemPage /></Suspense>} />
        <Route path="/firma/campaigns" element={<Suspense fallback={<RouteFallback />}><CompanyCampaignsPage /></Suspense>} />
        <Route path="/firma/qr" element={<Suspense fallback={<RouteFallback />}><CompanyQrPage /></Suspense>} />
        <Route path="/firma/personel" element={<Suspense fallback={<RouteFallback />}><CompanyStaffPage /></Suspense>} />
        <Route path="/firma/profile" element={<Suspense fallback={<RouteFallback />}><CompanyProfilePage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/firma" replace />} />
    </Route>
  </Routes>
)

const CompanyStaffRoutes = () => {
  const { state } = useCompanyStaffAuth()
  const canManageCampaigns = state.status === 'authenticated' && state.staff.canManageCampaigns
  return (
    <Routes>
      <Route element={<CompanyStaffProtectedRoute />}>
        <Route element={<CompanyStaffAppShell />}>
          <Route path="/firma/personel/kullandir" element={<Suspense fallback={<RouteFallback />}><CompanyStaffRedeemPage /></Suspense>} />
          {canManageCampaigns && (
            <Route path="/firma/personel/kampanyalar" element={<Suspense fallback={<RouteFallback />}><CompanyStaffCampaignsPage /></Suspense>} />
          )}
        </Route>
        <Route path="*" element={<Navigate to="/firma/personel/kullandir" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { state: citizen } = useAuth()
  const { state: company } = useCompanyAuth()
  const { state: companyStaff } = useCompanyStaffAuth()
  const location = useLocation()

  if (location.pathname.startsWith('/qr-giris/')) return <Suspense fallback={<FullScreenLoader />}><QrGirisPage /></Suspense>
  if (location.pathname.startsWith('/kampanya/')) return <Suspense fallback={<FullScreenLoader />}><CampaignAppLinkPage /></Suspense>

  if (citizen.status === 'idle' || company.status === 'idle' || companyStaff.status === 'idle') return <FullScreenLoader />
  if (companyStaff.status === 'authenticated') return <CompanyStaffConsentGate><CompanyStaffRoutes /></CompanyStaffConsentGate>
  if (company.status === 'authenticated') return <CompanyConsentGate><CompanyRoutes /></CompanyConsentGate>
  if (citizen.status === 'authenticated') return <ConsentGate><PendingSurveyGate><CitizenRoutes /></PendingSurveyGate></ConsentGate>
  return <PublicRoutes />
}
