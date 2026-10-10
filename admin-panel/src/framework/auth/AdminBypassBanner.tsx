import { EyeIcon } from 'lucide-react'
import { Banner, Button } from '@/design-system'
import { tokenStorage } from '@/services/tokenStorage'
import { useAuth } from './AuthContext'

// Kullanıcı isteği (2026-09-21): bir yönetici "Paneline git" (AdminsTab/
// MuhtarManagementTab) ile başka bir yöneticinin/muhtarın paneline bypass-code
// ile giriş yaptığında geri dönmek için hiçbir yol yoktu — sekme kapatılıp
// orijinal admin sekmesine manuel geçilmesi gerekiyordu. Bu şerit bypass
// oturumunun en üstünde kalıcı görünür ve tek tıkla bu sekmeyi kapatır.
//
// Bypass oturumu ayrı bir sekmede çalışır (window.open, opener=null,
// sessionStorage token'lar tab-scoped) — orijinal yöneticinin kendi oturumu
// başka bir sekmede zaten etkilenmemiştir, bu yüzden "geri dön" = bu sekmeyi
// kapatmak yeterlidir. Bazı tarayıcılar script tarafından açılmamış sekmelerin
// kapatılmasını engeller; window.close() burada güvenlidir çünkü sekme zaten
// window.open() ile script tarafından açılmıştı. Yine de engellenirse kısa
// bir gecikmeyle login sayfasına yönlendirme fallback'i devrede.
export const AdminBypassBanner = () => {
  const { state } = useAuth()
  if (!tokenStorage.isBypassSession() || state.status !== 'authenticated') return null

  const handleReturn = () => {
    tokenStorage.clearBypassTokens()
    window.close()
    setTimeout(() => { if (!window.closed) window.location.href = `${import.meta.env.BASE_URL}login` }, 300)
  }

  return (
    <Banner
      tone="warning"
      icon={EyeIcon}
      action={
        <Button
          variant="outline"
          size="sm"
          className="border-white/40 bg-white/15 text-white hover:bg-white/25"
          onClick={handleReturn}
        >
          Admine geri dön
        </Button>
      }
    >
      {state.user.fullName} panelini yönetici olarak görüntülüyorsunuz
    </Banner>
  )
}
