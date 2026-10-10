import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { tokenStorage } from '@/services/tokenStorage'
import { api } from '@/services/api'

interface BypassTokenResponse {
  accessToken: string
  refreshToken: string
}

export const AdminBypassPage = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(false)
  // Bulgu (2026-09-20, canlı hata raporu: "Geçersiz veya süresi dolmuş bypass kodu"):
  // bypass kodu backend'de tek kullanımlık (Redis GETDEL, atomik silme-ile-oku).
  // React.StrictMode (bkz. index.tsx) geliştirme modunda her effect'i mount->unmount->
  // remount ile İKİ KEZ çalıştırır; ilk çağrı kodu tüketip token alıyordu ama
  // unmount'ta `active=false` olduğu için sonuç atılıyordu, ikinci çağrı ise kod
  // zaten silindiği için "geçersiz kod" hatası görüyordu — kullanıcı deneyiminde
  // panel her zaman "süresi dolmuş" hatasıyla açılıyordu. ref ile exchange'in bu
  // component ömründe yalnızca BİR KEZ tetiklenmesi garanti ediliyor.
  const exchangedRef = useRef(false)

  useEffect(() => {
    const code = params.get('code')
    if (!code) {
      navigate('/login', { replace: true })
      return
    }
    if (exchangedRef.current) return
    exchangedRef.current = true

    const exchange = async () => {
      try {
        const res = await api.post<{ data: BypassTokenResponse }>('/auth/exchange-bypass-code', { code })
        const { accessToken, refreshToken } = res.data.data
        tokenStorage.setBypassTokens(accessToken, refreshToken)
        const nextParam = params.get('next')
        const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
        window.location.replace(`${base}${safeNext.startsWith('/') ? safeNext : `/${safeNext}`}`)
      } catch {
        setError(true)
      }
    }

    void exchange()
  }, [params, navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[hsl(var(--surface-1))]">
        <p className="text-sm font-medium text-danger">Geçersiz veya süresi dolmuş bağlantı.</p>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="text-sm text-primary underline"
        >
          Giriş sayfasına dön
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--surface-1))]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-foreground-muted">Oturum açılıyor...</p>
      </div>
    </div>
  )
}
