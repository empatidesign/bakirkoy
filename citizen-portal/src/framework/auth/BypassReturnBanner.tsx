import { EyeIcon } from 'lucide-react'
import { Banner, Button } from '@/design-system'
import { tokenStorage } from '@/services/tokenStorage'

// Kullanıcı isteği (2026-09-21): admin panelden "Paneline git" ile bir vatandaşın
// veya firmanın portalına bypass-code ile giriş yapıldığında geri dönmek için hiçbir
// yol yoktu. Bu şerit yalnızca admin bypass oturumunda (isBypassSession) görünür ve
// bu sekmeyi kapatarak orijinal admin panel sekmesine dönüşü sağlar. Ayrı bir
// sekmede açıldığı için (window.open, opener=null) admin'in kendi oturumu zaten
// etkilenmemiştir — "geri dön" = bu sekmeyi kapatmak yeterlidir.
export const BypassReturnBanner = ({ label }: { label: string }) => {
  if (!tokenStorage.isBypassSession()) return null

  const handleReturn = () => {
    tokenStorage.clearBypassSession()
    window.close()
    setTimeout(() => { if (!window.closed) window.location.href = `${import.meta.env.BASE_URL}login` }, 300)
  }

  return (
    <div className="px-4 pt-3">
      <Banner
        tone="warning"
        variant="soft"
        icon={EyeIcon}
        action={<Button size="sm" variant="outline" onClick={handleReturn}>Admine geri dön</Button>}
      >
        {label}
      </Banner>
    </div>
  )
}
