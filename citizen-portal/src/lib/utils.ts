import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const inheritToneClass = (el: HTMLElement | null | undefined): string =>
  el?.closest('.tone-danger') ? 'tone-danger' : ''

export const isMenuTargetActive = (
  linkTarget: string,
  currentPathname: string,
  currentSearch: string,
): boolean => {
  const [targetPath, targetQuery = ''] = linkTarget.split('?')
  if (targetPath !== currentPathname) return false
  if (!targetQuery) return true

  const target = new URLSearchParams(targetQuery)
  const current = new URLSearchParams(currentSearch)
  for (const [key, value] of target) {
    if (current.get(key) !== value) return false
  }
  return true
}

export const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const localDayIso = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const isPastDay = (d: string | Date): boolean => {
  const date = typeof d === 'string' ? new Date(d) : d
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return date.getTime() < startOfToday.getTime()
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

export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

export const maskTC = (tc: string): string =>
  tc.length >= 11 ? `${tc.slice(0, 3)}${'*'.repeat(5)}${tc.slice(-3)}` : tc

export const maskPhone = (phone: string): string =>
  phone.length >= 10 ? `${phone.slice(0, 4)}${'*'.repeat(4)}${phone.slice(-2)}` : phone

export const formatPhone = (raw: string): string => {
  let d = (raw ?? '').replace(/\D/g, '')
  // PhoneInput.tsx normalize ile aynı düzeltme: ülke kodlu (12 haneli "90...") veya
  // fazla haneli girdilerde önce '0' eklenip sondan kırpma yapılırsa numara bozulur.
  if (d.length > 10) d = d.slice(-10)
  if (d.length > 0 && d[0] !== '0') d = '0' + d
  d = d.slice(0, 11)
  if (d.length === 0) return raw
  const area = d.slice(1, 4)
  const p2 = d.slice(4, 7)
  const p3 = d.slice(7, 9)
  const p4 = d.slice(9, 11)
  let out = '0'
  if (area) out += `(${area}`
  if (area.length === 3) out += ')'
  if (p2) out += ` ${p2}`
  if (p3) out += ` ${p3}`
  if (p4) out += ` ${p4}`
  return out
}

export const truncate = (str: string, length: number): string =>
  str.length > length ? `${str.slice(0, length)}...` : str

export const safeExternalUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? value : undefined
  } catch {
    return undefined
  }
}
