import { AxiosError } from 'axios'
import { api } from './api'
import type {
  PublicEvent, PublicEventSession, PublicEventCategory, PublicEventCalendarDay,
  PublicServiceFacility, PublicFacilityMapPoint,
} from '@/types/public.types'

export interface EventQuery {
  search?: string
  categoryId?: string
  facilityId?: string
  district?: string
  from?: string
  to?: string
  includePast?: boolean
  page?: number
  limit?: number
}

export interface FacilityQuery {
  search?: string
  type?: string
  district?: string
  serviceModule?: string
  page?: number
  limit?: number
}

// Backend 404 (kayıt yok) döndürdüğünde axios reject eder; bunu genel
// network/sunucu hatasından ayırmak için burada yakalayıp null'a çeviriyoruz.
// Diğer tüm hatalar (bağlantı yok, 5xx, timeout) olduğu gibi fırlatılmaya
// devam eder — çağıran taraf bunu 'yüklenemedi' durumuyla ayırt edebilir.
function isNotFound(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 404
}

const publicService = {
  async getEvents(params: EventQuery = {}): Promise<PublicEvent[]> {
    const res = await api.get<{ data: PublicEvent[] }>('/public/events', { params })
    return res.data.data
  },

  async getEvent(id: string): Promise<PublicEvent | null> {
    try {
      const res = await api.get<{ data: PublicEvent | null }>(`/public/events/${id}`)
      return res.data.data
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  },

  async getEventSessions(id: string): Promise<PublicEventSession[]> {
    const res = await api.get<{ data: PublicEventSession[] }>(`/public/events/${id}/sessions`)
    return res.data.data
  },

  async getEventCategories(): Promise<PublicEventCategory[]> {
    const res = await api.get<{ data: PublicEventCategory[] }>('/public/events/categories')
    return res.data.data
  },

  async getEventCalendar(from: string, to: string): Promise<PublicEventCalendarDay[]> {
    const res = await api.get<{ data: PublicEventCalendarDay[] }>('/public/events/calendar', { params: { from, to } })
    return res.data.data
  },

  async getFacilities(params: FacilityQuery = {}): Promise<PublicServiceFacility[]> {
    const res = await api.get<{ data: PublicServiceFacility[] }>('/public/service-facilities', { params })
    return res.data.data
  },

  async getFacility(id: string): Promise<PublicServiceFacility | null> {
    try {
      const res = await api.get<{ data: PublicServiceFacility | null }>(`/public/service-facilities/${id}`)
      return res.data.data
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  },

  async getFacilityMapPoints(): Promise<PublicFacilityMapPoint[]> {
    const res = await api.get<{ data: PublicFacilityMapPoint[] }>('/public/service-facilities/map-points')
    return res.data.data
  },
}

export default publicService
