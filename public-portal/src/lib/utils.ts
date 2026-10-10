import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const CITIZEN_PORTAL_URL = (import.meta.env.VITE_CITIZEN_PORTAL_URL as string) || 'http://localhost:3100'

export function citizenPortalEventUrl(eventId: string, sessionId?: string | null): string {
  const url = new URL('/etkinlikler', CITIZEN_PORTAL_URL)
  url.searchParams.set('eventId', eventId)
  if (sessionId) url.searchParams.set('sessionId', sessionId)
  return url.toString()
}

export function citizenPortalLoginUrl(): string {
  return new URL('/login', CITIZEN_PORTAL_URL).toString()
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}

export function formatDateRange(fromIso: string, toIso: string, isSingleDay: boolean): string {
  if (isSingleDay) return formatDate(fromIso)
  return `${formatDateShort(fromIso)} — ${formatDate(toIso)}`
}

export function localDayIso(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
