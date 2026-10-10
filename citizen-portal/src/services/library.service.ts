import { currentCoordinates } from '@/lib/geolocation'
import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenLibrary, CitizenLibraryDetail, CitizenLibrarySeatPlan, CitizenLibraryReservation, CitizenSession, CitizenMyQueue, CitizenLibraryStatus, CitizenQueueJoinResult, PendingExitResult, CitizenLibraryStats, CitizenLibraryMovement, CitizenLibraryMyStats, CitizenLibraryFilters } from '@/types/library.types'

const libraryService = {
  async discover(params: Record<string, unknown>): Promise<PagedResult<CitizenLibrary>> {
    const res = await api.get<{ data: PagedResult<CitizenLibrary> }>('/me/libraries', { params })
    return res.data.data
  },

  async filters(params?: Record<string, unknown>): Promise<CitizenLibraryFilters> {
    const res = await api.get<{ data: CitizenLibraryFilters }>('/me/libraries/filters', { params })
    return res.data.data
  },

  async detail(id: string): Promise<CitizenLibraryDetail> {
    const res = await api.get<{ data: CitizenLibraryDetail }>(`/me/libraries/${id}`)
    return res.data.data
  },

  async seatPlan(id: string, date: string): Promise<CitizenLibrarySeatPlan> {
    const res = await api.get<{ data: CitizenLibrarySeatPlan }>(`/me/libraries/${id}/seat-plan`, { params: { date } })
    return res.data.data
  },

  async reserve(id: string, payload: { slotStart?: string | null; slotEnd?: string | null; seat?: string | null }): Promise<CitizenLibraryReservation> {
    const res = await api.post<{ data: CitizenLibraryReservation }>(`/me/libraries/${id}/reservations`, {
      slotStart: payload.slotStart ?? null,
      slotEnd: payload.slotEnd ?? null,
      seat: payload.seat ?? null,
    })
    return res.data.data
  },

  async reservations(params: Record<string, unknown>): Promise<PagedResult<CitizenLibraryReservation>> {
    const res = await api.get<{ data: PagedResult<CitizenLibraryReservation> }>('/me/libraries/reservations', { params })
    return res.data.data
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/me/libraries/reservations/${id}`)
  },

  async status(id: string): Promise<CitizenLibraryStatus> {
    const res = await api.get<{ data: CitizenLibraryStatus }>(`/me/libraries/${id}/status`)
    return res.data.data
  },

  async stats(id: string, date?: string): Promise<CitizenLibraryStats> {
    const res = await api.get<{ data: CitizenLibraryStats }>(`/me/libraries/${id}/stats`, { params: date ? { date } : undefined })
    return res.data.data
  },

  async walkIn(id: string, seat?: string | null): Promise<CitizenLibraryReservation> {
    const res = await api.post<{ data: CitizenLibraryReservation }>(`/me/libraries/${id}/walk-in`, { seat: seat ?? null })
    return res.data.data
  },

  async joinQueue(id: string): Promise<CitizenQueueJoinResult> {
    const res = await api.post<{ data: CitizenQueueJoinResult }>(`/me/libraries/${id}/queue`, {})
    return res.data.data
  },

  async leaveQueue(id: string): Promise<void> {
    await api.delete(`/me/libraries/${id}/queue`)
  },

  async session(): Promise<CitizenSession | null> {
    const res = await api.get<{ data: CitizenSession | null }>('/me/libraries/session')
    return res.data.data
  },

  async myQueue(): Promise<CitizenMyQueue | null> {
    const res = await api.get<{ data: CitizenMyQueue | null }>('/me/libraries/my-queue')
    return res.data.data
  },

  async history(date?: string): Promise<CitizenLibraryMovement[]> {
    const res = await api.get<{ data: { items: CitizenLibraryMovement[] } }>('/me/libraries/history', { params: date ? { date } : undefined })
    return res.data.data.items
  },

  async checkIn(libraryId: string, _latitude?: number | null, _longitude?: number | null): Promise<CitizenSession> {
    const res = await api.post<{ data: CitizenSession }>(`/me/libraries/${libraryId}/check-in`, await currentCoordinates())
    return res.data.data
  },

  async startBreak(type?: 'short' | 'long'): Promise<CitizenSession> {
    const res = await api.post<{ data: CitizenSession }>('/me/libraries/break', { type: type ?? 'short' })
    return res.data.data
  },

  async endBreak(): Promise<CitizenSession> {
    const res = await api.post<{ data: CitizenSession }>('/me/libraries/break/end', {})
    return res.data.data
  },

  async pendingExit(): Promise<PendingExitResult> {
    const res = await api.post<{ data: PendingExitResult }>('/me/libraries/pending-exit', {})
    return res.data.data
  },

  async pendingBreak(type: 'short' | 'long'): Promise<PendingExitResult> {
    const res = await api.post<{ data: PendingExitResult }>('/me/libraries/pending-break', { type })
    return res.data.data
  },

  async exit(): Promise<void> {
    await api.post('/me/libraries/exit', await currentCoordinates())
  },

  async getMyStats(): Promise<CitizenLibraryMyStats> {
    const res = await api.get<{ data: CitizenLibraryMyStats }>('/me/libraries/my-stats')
    return res.data.data
  },

  async getMyOverdueBooks(): Promise<{ hasOverdue: boolean; count: number; books: { title: string; author?: string | null; dueDate: string; daysOverdue: number }[] }> {
    const res = await api.get<{ data: { hasOverdue: boolean; count: number; books: { title: string; author?: string | null; dueDate: string; daysOverdue: number }[] } }>('/me/libraries/overdue-books')
    return res.data.data
  },

  async staticScan(code: string, _latitude?: number | null, _longitude?: number | null): Promise<{ action: string; message: string; seat?: string | null; participantName?: string | null }> {
    const res = await api.post<{ data: { action: string; message: string; seat?: string | null; participantName?: string | null } }>('/me/libraries/static-scan', { code, ...(await currentCoordinates()) })
    return res.data.data
  },
}

export default libraryService
