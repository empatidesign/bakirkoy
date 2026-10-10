import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { tokenStorage } from '@/services/tokenStorage'
import { api } from '@/services/api'
import { useAuth } from '@/framework/auth/AuthContext'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'

interface BypassTokenResponse {
  accessToken: string
  refreshToken: string
  user: unknown
  sessionConfig: unknown
}

export const BypassPage = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const { refreshCompany } = useCompanyAuth()
  const [error, setError] = useState(false)
  const exchangedRef = useRef(false)

  useEffect(() => {
    const code = params.get('code')
    const kind = params.get('kind') === 'company' ? 'company' : 'citizen'
    // Webview devri (mobil kill-switch): mobil uygulama kendi oturumu için
    // kısa ömürlü bir devir kodu üretip portalı bu adresle açar. Admin
    // taklidinden ayrı bir uç kullanılır; o uç vatandaşın TÜM oturumlarını
    // kapatıyor ve devirde mobil uygulamanın kendi oturumunu da düşürürdü.
    const isHandoff = params.get('mode') === 'handoff'

    if (!code) {
      navigate(kind === 'company' ? '/firma/login' : '/login', { replace: true })
      return
    }
    if (exchangedRef.current) return
    exchangedRef.current = true

    const exchange = async () => {
      try {
        const endpoint = kind === 'company'
          ? isHandoff
            ? '/auth/company/exchange-handoff-code'
            : '/auth/company/exchange-bypass-code'
          : isHandoff
            ? '/auth/citizen/exchange-handoff-code'
            : '/auth/citizen/exchange-bypass-code'
        const res = await api.post<{ data: BypassTokenResponse }>(endpoint, { code })
        // Not: burada artık `active` kontrolü YOK. Kod tek kullanımlık olduğu için
        // takas başarılıysa token'ı her hâlükârda saklamalıyız; StrictMode'un
        // sahte unmount'unda sonucu atmak, kodu yakıp oturumu kaybetmek demekti.
        const { accessToken, refreshToken } = res.data.data
        tokenStorage.clearBypassSession()
        tokenStorage.setBypassTokens(accessToken, refreshToken)
        tokenStorage.setBypassKind(kind)
        if (kind === 'company') await refreshCompany()
        else await refreshUser()
        // Kullanıcı isteği (2026-09-01): admin panelden saha görevlisinin gördüğü ekrana
        // ("/saha") doğrudan düşebilmek için `to` parametresi desteklenir.
        const to = params.get('to')
        const safeTo = to && to.startsWith('/') && !to.startsWith('//') ? to : null
        if (safeTo && safeTo.startsWith('/saha')) sessionStorage.setItem('app_mode', 'survey')
        navigate(safeTo ?? (kind === 'company' ? '/firma' : '/'), { replace: true })
      } catch {
        setError(true)
      }
    }

    void exchange()
  }, [params, navigate, refreshUser, refreshCompany])

  if (error) {
    const kind = params.get('kind') === 'company' ? 'company' : 'citizen'
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-1">
        <p className="text-sm font-medium text-danger">Geçersiz veya süresi dolmuş bağlantı.</p>
        <button
          type="button"
          onClick={() => navigate(kind === 'company' ? '/firma/login' : '/login', { replace: true })}
          className="text-sm text-primary underline"
        >
          Giriş sayfasına dön
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-foreground-muted">Oturum açılıyor...</p>
      </div>
    </div>
  )
}
