import axios, { type AxiosRequestConfig } from 'axios'
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

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

export const silentRequest = {
  headers: { 'X-Suppress-Error-Toast': 'true' },
} as const

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
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
      window.dispatchEvent(new Event('session:invalidated'))
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      const refreshToken = tokenStorage.getRefreshToken()

      if (!refreshToken) {
        tokenStorage.clearTokens()
        window.location.href = `${import.meta.env.BASE_URL}login`
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token) => {
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
        const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefresh } = res.data.data
        if (tokenStorage.isBypassSession()) {
          tokenStorage.setBypassTokens(accessToken, newRefresh)
        } else {
          tokenStorage.setTokens(accessToken, newRefresh)
        }
        processQueue(accessToken)
        original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` }
        return api(original)
      } catch (refreshError) {
        const refreshStatus = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined
        if (refreshStatus === undefined || refreshStatus >= 500) {
          processQueue(null, refreshError)
          return Promise.reject(error)
        }
        if (tokenStorage.isBypassSession()) {
          tokenStorage.clearBypassTokens()
        } else {
          tokenStorage.clearTokens()
        }
        processQueue(null, refreshError)
        window.location.href = `${import.meta.env.BASE_URL}login`
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
    const errorCode: string | undefined = error.response?.data?.errorCode
    const isConfirmPrompt = typeof errorCode === 'string' && errorCode.endsWith('_CONFIRM')
    const isSilentRequest = original?.headers?.['X-Suppress-Error-Toast'] === 'true'
    const isForbiddenRead = method === 'get' && status === 403
    // SMS gönderim doğrulama hataları (SMS_VERIFICATION_REQUIRED/SMS_PIN_INVALID/OTP_*):
    // ilgili modal bunu useSmsVerification hook'u üzerinden yakalayıp kendi hata alanında
    // gösteriyor, genel toast ile ikinci kez göstermeye gerek yok.
    const isSmsVerificationError = typeof errorCode === 'string'
      && (errorCode.startsWith('SMS_') || errorCode.startsWith('OTP_'))
      && errorCode !== 'SMS_OTP_NO_PHONE'
    const suppressToast = (method === 'get' && status === 404) || isForbiddenRead || isConfirmPrompt || isSilentRequest || isSmsVerificationError

    if (status !== 401 && !suppressToast) {
      toast.error(toUserMessage(status, error.response?.data), {
        id: `api-error-${status ?? 'network'}-${errorCode ?? 'generic'}`,
        duration: 5000,
      })
    }

    return Promise.reject(error)
  }
)
