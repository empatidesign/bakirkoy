import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { Event, EventFormData, EventSummary, EventAuditEntry, EventBulkCopyTarget, EventBulkCopyResult, EventStaticQr, EventStaticQrMode } from '@/types/event.types'
import type { SeatStateMap } from '@/types/hall.types'
import { withEventEndFallback } from '@/modules/events/eventDateRules'

const eventService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Event>> {
    const res = await api.get<{ data: PagedResult<Event> }>('/events', { params })
    return res.data.data
  },

  async getTrash(params: Record<string, unknown>): Promise<PagedResult<Event>> {
    const res = await api.get<{ data: PagedResult<Event> }>('/events/trash', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<EventSummary> {
    const res = await api.get<{ data: EventSummary }>('/events/summary', { params })
    return res.data.data
  },

  async getOptions(search?: string): Promise<{ value: string; label: string; description?: string }[]> {
    const res = await api.get<{ data: { id: string; name: string; startDate: string; endDate: string }[] }>('/events/options', {
      params: search ? { search } : {},
    })
    return res.data.data.map((e) => ({ value: e.id, label: e.name, description: e.startDate?.slice(0, 10) }))
  },

  async getById(id: string): Promise<Event> {
    const res = await api.get<{ data: Event }>(`/events/${id}`)
    return res.data.data
  },

  async create(data: EventFormData): Promise<Event> {
    const res = await api.post<{ data: Event }>('/events', withEventEndFallback(data))
    return res.data.data
  },

  async update(id: string, data: EventFormData): Promise<Event> {
    const res = await api.put<{ data: Event }>(`/events/${id}`, withEventEndFallback(data))
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/events/${id}`)
  },

  async restore(id: string): Promise<Event> {
    const res = await api.patch<{ data: Event }>(`/events/${id}/restore`)
    return res.data.data
  },

  async permanentDelete(id: string): Promise<void> {
    await api.delete(`/events/${id}/permanent`)
  },

  async copy(id: string): Promise<Event> {
    const res = await api.post<{ data: Event }>(`/events/${id}/copy`)
    return res.data.data
  },

  // Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — tek etkinlikten birden
  // fazla hedef tarih aralığı için bağımsız etkinlik kopyası tek istekte oluşturur.
  async bulkCopy(id: string, targets: EventBulkCopyTarget[]): Promise<EventBulkCopyResult> {
    const res = await api.post<{ data: EventBulkCopyResult }>(`/events/${id}/bulk-copy`, { targets })
    return res.data.data
  },

  async toggleStatus(id: string): Promise<Event> {
    const res = await api.patch<{ data: Event }>(`/events/${id}/toggle-status`)
    return res.data.data
  },

  async getAuditLog(id: string): Promise<EventAuditEntry[]> {
    const res = await api.get<{ data: EventAuditEntry[] }>(`/events/${id}/audit`)
    return res.data.data
  },

  async getSeatPlan(id: string): Promise<SeatStateMap> {
    const res = await api.get<{ data: SeatStateMap }>(`/events/${id}/seat-plan`)
    return res.data.data
  },

  async saveSeatPlan(id: string, states: SeatStateMap): Promise<void> {
    await api.put(`/events/${id}/seat-plan`, { states })
  },

  async getStaffOptions(search?: string): Promise<{ value: string; label: string; description?: string }[]> {
    const params: Record<string, unknown> = { page: 1, limit: 20, isActive: true }
    if (search) params.search = search
    const res = await api.get<{ data: { items: { id: string; fullName: string; roleName?: string }[] } }>('/admins', { params })
    return res.data.data.items.map((s) => ({ value: s.id, label: s.fullName, description: s.roleName }))
  },

  async uploadImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/events/images?purpose=variant', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async uploadGalleryPhoto(file: File): Promise<{ id: string; url: string; name: string; size: number }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/events/images?purpose=gallery', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const url = res.data.data.url
    const id = url.split('/').pop() || url
    return { id, url, name: file.name, size: Math.round(file.size / 1024) }
  },

  // Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
  // cihazsız çalışsın" — Facility'deki getStaticQr/toggleStaticQr/.../rotateStaticQr ile
  // birebir aynı istek şekli.
  async getStaticQr(id: string): Promise<EventStaticQr> {
    const res = await api.get<{ data: EventStaticQr }>(`/events/${id}/static-qr`)
    return res.data.data
  },
  async toggleStaticQr(id: string, enabled: boolean): Promise<EventStaticQr> {
    const res = await api.patch<{ data: EventStaticQr }>(`/events/${id}/static-qr/toggle`, { enabled })
    return res.data.data
  },
  async setStaticQrMode(id: string, mode: EventStaticQrMode): Promise<EventStaticQr> {
    const res = await api.patch<{ data: EventStaticQr }>(`/events/${id}/static-qr/mode`, { mode })
    return res.data.data
  },
  async setStaticQrTiming(id: string, minExitSeconds: number, reentryCooldownSeconds: number): Promise<EventStaticQr> {
    const res = await api.patch<{ data: EventStaticQr }>(`/events/${id}/static-qr/timing`, {
      minExitSeconds, reentryCooldownSeconds,
    })
    return res.data.data
  },
  async rotateStaticQr(id: string): Promise<EventStaticQr> {
    const res = await api.post<{ data: EventStaticQr }>(`/events/${id}/static-qr/rotate`)
    return res.data.data
  },
}

export default eventService
