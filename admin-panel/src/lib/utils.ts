import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const inheritToneClass = (el: HTMLElement | null | undefined): string =>
  el?.closest('.tone-danger') ? 'tone-danger' : ''

export const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(d)
}

export const formatDateTime = (date: string | Date): string =>
  formatDate(date, { hour: '2-digit', minute: '2-digit' })

export const maskTC = (tc: string): string =>
  tc.length >= 11 ? `${tc.slice(0, 3)}${'*'.repeat(5)}${tc.slice(-3)}` : tc

export const maskPhone = (phone: string): string =>
  phone.length >= 10 ? `${phone.slice(0, 4)}${'*'.repeat(4)}${phone.slice(-2)}` : phone

export const truncate = (str: string, length: number): string =>
  str.length > length ? `${str.slice(0, length)}...` : str

export const isValidHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const safeExternalUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? value : undefined
  } catch {
    return undefined
  }
}

export const isValidAppVersion = (value: string): boolean => /^\d+(\.\d+){0,2}$/.test(value)

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const safeUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export const filenameFromContentDisposition = (
  disposition: string | null | undefined,
  fallback: string,
): string => {
  if (!disposition) return fallback
  const utf8 = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i)
  if (utf8?.[1]) {
    const raw = utf8[1].trim().replace(/^["']|["']$/g, '')
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  const ascii = disposition.match(/filename=\s*"?([^";]+)"?/i)
  if (ascii?.[1]) return ascii[1].trim()
  return fallback
}
