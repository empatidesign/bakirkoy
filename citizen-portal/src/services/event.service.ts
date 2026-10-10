import { currentCoordinates } from '@/lib/geolocation'
import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenEvent, CitizenEventDetail, CitizenApplication, EventCheckInActivity } from '@/types/event.types'
import type { SeatMap } from '@/types/seating.types'
import type { CitizenReviewsDto, CitizenReviewDto, SubmitReviewRequest } from '@/types/review.types'

const eventService = {
  async discover(params: Record<string, unknown>): Promise<PagedResult<CitizenEvent>> {
    const res = await api.get<{ data: PagedResult<CitizenEvent> }>('/me/events/discover', { params })
    return res.data.data
  },

  async detail(id: string): Promise<CitizenEventDetail> {
    const res = await api.get<{ data: CitizenEventDetail }>(`/me/events/${id}`)
    return res.data.data
  },

  async seatMap(id: string, sessionId?: string | null): Promise<SeatMap> {
    const params: Record<string, string> = {}
    if (sessionId) params.sessionId = sessionId
    const res = await api.get<{ data: SeatMap }>(`/me/events/${id}/seat-map`, { params })
    return res.data.data
  },

  async apply(id: string, payload: { sessionId?: string | null; participantId?: string | null; seatNumber?: string | null }): Promise<CitizenApplication> {
    const res = await api.post<{ data: CitizenApplication }>(`/me/events/${id}/apply`, {
      sessionId: payload.sessionId ?? null,
      participantId: payload.participantId ?? null,
      seatNumber: payload.seatNumber ?? null,
    })
    return res.data.data
  },

  async applications(params: Record<string, unknown>): Promise<PagedResult<CitizenApplication>> {
    const res = await api.get<{ data: PagedResult<CitizenApplication> }>('/me/events/applications', { params })
    return res.data.data
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/me/events/applications/${id}`)
  },

  async checkIn(eventId: string, payload: { sessionId?: string | null; kind: 'check_in' | 'check_out'; qrCode?: string | null; latitude?: number; longitude?: number }): Promise<EventCheckInActivity> {
    const res = await api.post<{ data: EventCheckInActivity }>(`/me/events/${eventId}/check-in`, {
      sessionId: payload.sessionId ?? null,
      kind: payload.kind,
      qrCode: payload.qrCode ?? null,
      ...(await currentCoordinates()),
    })
    return res.data.data
  },

  async getReviews(eventId: string): Promise<CitizenReviewsDto> {
    const res = await api.get<{ data: CitizenReviewsDto }>(`/me/events/${eventId}/reviews`)
    return res.data.data
  },

  async submitReview(eventId: string, req: SubmitReviewRequest): Promise<CitizenReviewDto> {
    const res = await api.post<{ data: CitizenReviewDto }>(`/me/events/${eventId}/reviews`, req)
    return res.data.data
  },

  // Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
  // cihazsız çalışsın" — facilityService.staticScan ile birebir aynı istek şekli.
  async staticScan(code: string): Promise<{ allowed: boolean; message: string; participantName?: string | null; eventName?: string | null; action?: string | null; errorCode?: string | null }> {
    const res = await api.post<{ data: { allowed: boolean; message: string; participantName?: string | null; eventName?: string | null; action?: string | null; errorCode?: string | null } }>('/me/events/static-scan', { code, ...(await currentCoordinates()) })
    return res.data.data
  },
}

export default eventService
