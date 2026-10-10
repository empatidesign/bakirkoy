import axios, { type AxiosRequestConfig } from 'axios'
import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'
import { tokenStorage } from './tokenStorage'

const SERVER_ERROR_MESSAGE = 'Bir sorun oluştu. Lütfen daha sonra tekrar deneyin.'
const NETWORK_ERROR_MESSAGE = 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.'

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Geçersiz istek. Lütfen bilgileri kontrol edin.',
  403: 'Bu işlem için yetkiniz bulunmuyor.',
  404: 'Aradığınız kayıt bulunamadı.',
  429: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.',
  500: SERVER_ERROR_MESSAGE,
  502: SERVER_ERROR_MESSAGE,
  503: 'Sistem şu anda bakımda. Lütfen daha sonra tekrar deneyin.',
}

interface ApiErrorData {
  message?: string
  errorCode?: string
  correlationId?: string
  errors?: Record<string, string[]>
}

function toUserMessage(status: number | undefined, data: ApiErrorData | undefined): string {
  if (!status) return NETWORK_ERROR_MESSAGE
  if (status >= 500) return SERVER_ERROR_MESSAGE
  const fieldMessages = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : []
  if (fieldMessages.length > 0) return fieldMessages.join(' ')
  const message = data?.message
  if (message && message.trim().toLowerCase() !== 'validation failed.') return message
  return STATUS_MESSAGES[status] ?? 'Bir hata oluştu. Lütfen tekrar deneyin.'
}

export function showApiErrorToast(err: unknown): void {
  const response = (err as { response?: { status?: number; data?: ApiErrorData } } | undefined)?.response
  toast.error(toUserMessage(response?.status, response?.data), { duration: 5000 })
}

// Kullanıcı isteği (2026-09-03): Android tablete kurulan uygulama aynı ağdaki
// API'ye erişemiyordu. Kök neden: paket VITE_API_URL=http://localhost:5207 ile
// derlenmişti; mobil cihazda "localhost" SUNUCU değil CİHAZIN KENDİSİ demektir,
// bu yüzden istekler hiçbir zaman geliştirme makinesine ulaşmaz.
//
// Bu, derleme anında sessizce oluşan ve ancak cihazda fark edilen bir hatadır;
// aşağıdaki kontrol onu paketleme sırasında görünür kılar.
const RAW_BASE = import.meta.env.VITE_API_URL ?? ''
const IS_NATIVE = Capacitor.isNativePlatform() || (typeof window !== 'undefined' && /^(capacitor|ionic):/.test(window.location.protocol))
const PLATFORM = Capacitor.getPlatform()

const RESOLVED_BASE = (() => {
  if (!IS_NATIVE) {
    return ''
  }
  // Android emulator uses 10.0.2.2 for host
  if (PLATFORM === 'android') {
    if (!RAW_BASE || /localhost|127\.0\.0\.1/i.test(RAW_BASE)) {
      return 'http://10.0.2.2:34000'
    }
    return RAW_BASE
  }
  // iOS Simulator uses localhost directly to reach Mac host
  return RAW_BASE || 'http://localhost:34000'
})()

const BASE_URL = RESOLVED_BASE
const POINTS_TO_DEVICE = !RAW_BASE || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(RAW_BASE)

/** Tanılama: cihazda hangi adrese gidildiğini ve yapılandırmanın geçerli olup olmadığını söyler. */
export const apiTarget = {
  baseUrl: BASE_URL,
  isNative: IS_NATIVE,
  misconfiguredForDevice: POINTS_TO_DEVICE && !import.meta.env.DEV && !IS_NATIVE,
}

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  /**
   * Ölçüm bulgusu (2026-09-03, VIA_L40 tablet): timeout tanımlı olmadığı için
   * şebekesiz bölgede istekler süresiz asılı kalıyordu. Açılıştaki me() çağrısı
   * hiç sonuçlanmadığı için uygulama sonsuza dek yükleme çarkında donuyor,
   * anketör boş ekranla kalıyordu (cihazda gözlendi: /saha metin uzunluğu 0).
   *
   * Süre dolduğunda axios ECONNABORTED üretir; bu bir "yanıt gelmedi" hatasıdır,
   * yani çevrimdışı dalına düşer ve profil önbelleğinden oturum geri yüklenir.
   */
  timeout: 12000,
  paramsSerializer: (params) =>
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .flatMap(([k, v]) =>
        Array.isArray(v)
          ? v.map((i) => `${encodeURIComponent(k)}=${encodeURIComponent(String(i))}`)
          : [`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`]
      )
      .join('&'),
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Kullanıcı isteği (2026-10-04): admin panelde "mobil uygulamada kaç kişi online,
  // kaçı iOS kaçı Android" takibi yapılabilsin — her istekte gerçek platform
  // (Capacitor.getPlatform(): 'ios' | 'android' | 'web') backend'e bildirilir.
  config.headers['X-Client-Platform'] = PLATFORM
  return config
})

let isRefreshing = false
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

const processQueue = (token: string | null, err?: unknown) => {
  refreshQueue.forEach(({ resolve, reject }) => (token ? resolve(token) : reject(err)))
  refreshQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original: AxiosRequestConfig & { _retry?: boolean } = error.config

    if (error.response?.status === 401 && error.response?.data?.errorCode === 'SESSION_INVALIDATED') {
      tokenStorage.clearTokens()
      toast.warning(
        error.response?.data?.message ?? 'Oturumunuz başka bir cihazdan yenilendiği için sonlandırıldı.',
        { duration: 6000 },
      )
      window.dispatchEvent(new Event('session:invalidated'))
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      const refreshToken = tokenStorage.getRefreshToken()
      const kind = tokenStorage.getKind()
      const loginPath = kind === 'company_staff' ? '/firma/personel/login' : kind === 'company' ? '/firma/login' : '/login'
      const refreshPath = kind === 'company_staff' ? '/auth/company-staff/refresh' : kind === 'company' ? '/auth/company/refresh' : '/auth/citizen/refresh'

      if (!refreshToken) {
        tokenStorage.clearTokens()
        window.location.href = loginPath
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
              original._retry = true
              original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
              resolve(api(original))
            },
            reject,
          })
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        const res = await axios.post(`${BASE_URL}/api/v1${refreshPath}`, { refreshToken })
        const { accessToken, refreshToken: newRefresh } = res.data.data
        tokenStorage.setTokens(accessToken, newRefresh)
        processQueue(accessToken)
        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` }
        return api(original)
      } catch (refreshError) {
        processQueue(null, refreshError)
        const refreshStatus = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined
        if (refreshStatus === undefined || refreshStatus >= 500) return Promise.reject(error)
        tokenStorage.clearTokens()
        window.location.href = loginPath
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    const status = error.response?.status
    const correlationId: string | undefined = error.response?.data?.correlationId

    if (import.meta.env.DEV && correlationId) {
      console.debug('[API Error] correlationId:', correlationId)
    }

    const method = (original?.method ?? 'get').toLowerCase()
    const isForbiddenRead = method === 'get' && status === 403
    const suppressToast = (method === 'get' && status === 404) || isForbiddenRead || (original as (AxiosRequestConfig & { _silent?: boolean }) | undefined)?._silent === true

    if (status !== 401 && !suppressToast) {
      toast.error(toUserMessage(status, error.response?.data), { duration: 5000 })
    }

    return Promise.reject(error)
  }
)
