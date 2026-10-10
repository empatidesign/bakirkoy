import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { AppToaster } from './design-system'
import App from './App'
import { AuthProvider } from './framework/auth/AuthContext'
import { CompanyAuthProvider } from './framework/companyAuth/CompanyAuthContext'
import { CompanyStaffAuthProvider } from './framework/companyStaffAuth/CompanyStaffAuthContext'
import { NotificationProvider } from './framework/notifications/NotificationContext'
import { ThemeProvider } from './framework/theme/ThemeContext'
import { RootErrorBoundary } from './framework/ui/RootErrorBoundary'
import { adoptMobileSession } from './services/mobileSession'
import { initScreenCaptureProtection } from './lib/screenCapture'
import './styles/globals.css'

// Kullanıcı isteği (2026-10-07): ekran görüntüsü/ekran kaydı başka bir program veya
// arayüz yazılımıyla alınmaya çalışılırsa engellensin. Android'de native tarafta
// (capacitor.config.ts) uygulama açılır açılmaz FLAG_SECURE ile zaten engellenir;
// burada ayrıca idempotent bir enable() çağrısı yapılır ve iOS'ta (resmi engelleme
// API'si olmadığından) ekran kaydı başlarsa kullanıcı bilgilendirilir.
try {
  initScreenCaptureProtection((active) => {
    if (active) toast.warning('Ekran kaydı tespit edildi. Güvenliğiniz için hassas bilgileri paylaşmayın.')
  })
} catch (err) {
  console.error('[index] initScreenCaptureProtection hatası (yok sayıldı):', err)
}

// Kullanıcı bildirimi (2026-09-02, Android tablet beyaz ekran): modül yüklenirken çalışan
// bu çağrı (render'dan ÖNCE) bir hata fırlatırsa React hiç mount olmaz ve ErrorBoundary bile
// devreye giremez — ekran tamamen beyaz kalırdı. Sarmalayarak render'ın her koşulda başlaması
// garanti edilir (oturum devri başarısız olsa bile uygulama açılır, kullanıcı giriş yapabilir).
try {
  adoptMobileSession()
} catch (err) {
  console.error('[index] adoptMobileSession hatası (yok sayıldı):', err)
}

function resolveBasename(): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  if (!base) return '/'
  const path = window.location.pathname
  return path === base || path.startsWith(`${base}/`) ? base : '/'
}

window.addEventListener('vite:preloadError', () => {
  const key = 'nexora-citizen-chunk-reload-attempted'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})
sessionStorage.removeItem('nexora-citizen-chunk-reload-attempted')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={resolveBasename()}>
            <AuthProvider>
              <CompanyAuthProvider>
                <CompanyStaffAuthProvider>
                  <NotificationProvider>
                    <App />
                    <AppToaster />
                  </NotificationProvider>
                </CompanyStaffAuthProvider>
              </CompanyAuthProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>
)
