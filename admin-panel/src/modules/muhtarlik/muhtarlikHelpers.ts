import type { SubmissionFilters } from '@/types/muhtarlik.types'

export const EMPTY_FILTERS: SubmissionFilters = {
  search: '',
  neighborhood: '',
  submissionType: '',
  categoryId: '',
  priority: '',
  status: '',
  notifyMuhtar: 'all',
  dateRange: 'all',
  sort: 'newest',
}

export const hasActiveFilters = (f: SubmissionFilters): boolean =>
  f.search.trim() !== '' ||
  f.neighborhood !== '' ||
  f.submissionType !== '' ||
  f.categoryId !== '' ||
  f.priority !== '' ||
  f.status !== '' ||
  f.notifyMuhtar !== 'all' ||
  f.dateRange !== 'all'

export const filtersToParams = (f: SubmissionFilters): Record<string, string> => {
  const p: Record<string, string> = {}
  if (f.search.trim()) p.search = f.search.trim()
  if (f.neighborhood) p.neighborhood = f.neighborhood
  if (f.submissionType) p.submissionType = f.submissionType
  if (f.categoryId) p.categoryId = f.categoryId
  if (f.priority) p.priority = f.priority
  if (f.status) p.status = f.status
  if (f.notifyMuhtar !== 'all') p.notifyMuhtar = f.notifyMuhtar
  if (f.dateRange !== 'all') p.dateRange = f.dateRange
  return p
}

export const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
}

export const timeAgo = (iso: string, now: number): string => {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const seconds = Math.floor((now - t) / 1000)
  if (seconds < 60) return 'az önce'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR')
}
