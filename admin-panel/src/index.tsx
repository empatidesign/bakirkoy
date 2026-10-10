import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AppToaster } from './design-system'
import App from './App'
import { AuthProvider } from './framework/auth/AuthContext'
import { ThemeProvider } from './framework/theme/ThemeContext'
import './styles/globals.css'

// Bulgu (2026-09-20, canlı hata raporu): F21 route-bazlı code-splitting (bkz. App.tsx)
// her modülü ayrı, içerik-hash'li bir JS dosyasına (ör. StatCard-DoKJkiSp.js) ayırdı.
// Bir kullanıcı sekmeyi açık tutarken YENİ bir sürüm deploy edilirse, sunucudaki eski
// hash'li dosyalar silinir/üzerine yazılır; kullanıcının tarayıcısında hâlâ çalışan
// eski index-*.js, henüz ziyaret edilmemiş bir route'a tıklandığında ESKİ hash'i
// import etmeye çalışır -> 404 -> "Importing a module script failed" (canlı konsolda
// görülen tam hata). Vite, tam bu senaryo için `vite:preloadError` olayını window'a
// fırlatır. Yakalayıp SAYFAYI YENİDEN YÜKLÜYORUZ (yeni index.html + güncel hash
// haritasını indirir) — ama sunucu gerçekten erişilemezse (asıl kesinti) sonsuz
// yenileme döngüsüne girmemek için sessionStorage bayrağıyla bunu oturum başına
// yalnızca BİR kez deniyoruz.
window.addEventListener('vite:preloadError', () => {
  const key = 'nexora-admin-chunk-reload-attempted'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
})
// Yeniden yükleme başarıyla YENİ bir sürümü getirdiyse (bu modül tekrar
// çalıştıysa, yani index.html gerçekten tazelendiyse) bayrağı temizle —
// aksi halde AYNI oturumda İKİNCİ bir deploy daha olursa (nadir ama olası)
// otomatik kurtarma bir daha tetiklenmez.
sessionStorage.removeItem('nexora-admin-chunk-reload-attempted')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

// Çoklu slash veya //bypass gibi bozuk URL'leri tek slash'a normalize et
if (window.location.pathname.includes('//')) {
  const cleanPath = window.location.pathname.replace(/\/+/g, '/')
  window.history.replaceState(null, '', `${cleanPath}${window.location.search}${window.location.hash}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
          <AuthProvider>
            <App />
            <AppToaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
