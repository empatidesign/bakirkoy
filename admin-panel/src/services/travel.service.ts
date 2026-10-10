import { api } from './api'
import { safeUuid, filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type {
  Travel, TravelFormData, TravelSummary, TravelAuditEntry, TravelSettings, TravelCopyRequest,
  TravelBulkCopyResult,
  TravelAttendanceRoster, TravelAttendanceMark, TravelAttendanceSaveResult,
} from '@/types/travel.types'

const travelService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Travel>> {
    const res = await api.get<{ data: PagedResult<Travel> }>('/travels', { params })
    return res.data.data
  },

  async getTrash(params: Record<string, unknown>): Promise<PagedResult<Travel>> {
    const res = await api.get<{ data: PagedResult<Travel> }>('/travels/trash', { params })
    return res.data.data
  },

  async getSummary(params: Record<string, unknown>): Promise<TravelSummary> {
    const res = await api.get<{ data: TravelSummary }>('/travels/summary', { params })
    return res.data.data
  },

  async getById(id: string): Promise<Travel> {
    const res = await api.get<{ data: Travel }>(`/travels/${id}`)
    return res.data.data
  },

  async create(data: TravelFormData): Promise<Travel> {
    const res = await api.post<{ data: Travel }>('/travels', data)
    return res.data.data
  },

  async update(id: string, data: TravelFormData): Promise<Travel> {
    const res = await api.put<{ data: Travel }>(`/travels/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/travels/${id}`)
  },

  async restore(id: string): Promise<Travel> {
    const res = await api.patch<{ data: Travel }>(`/travels/${id}/restore`)
    return res.data.data
  },

  async permanentDelete(id: string): Promise<void> {
    await api.delete(`/travels/${id}/permanent`)
  },

  async copy(id: string, data: TravelCopyRequest): Promise<Travel> {
    const res = await api.post<{ data: Travel }>(`/travels/${id}/copy`, data)
    return res.data.data
  },

  // Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — tek seferden birden fazla
  // hedef tarih aralığı için bağımsız sefer kopyası tek istekte oluşturur.
  async bulkCopy(id: string, targets: TravelCopyRequest[]): Promise<TravelBulkCopyResult> {
    const res = await api.post<{ data: TravelBulkCopyResult }>(`/travels/${id}/bulk-copy`, { targets })
    return res.data.data
  },

  async toggleStatus(id: string): Promise<Travel> {
    const res = await api.patch<{ data: Travel }>(`/travels/${id}/toggle-status`)
    return res.data.data
  },

  async getOptions(search?: string, includeInactive?: boolean): Promise<{ value: string; label: string; description?: string }[]> {
    // SORUN 10 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
    // includeInactive parametresi eklendi — pasif/geçmiş seferleri de görmesi gereken
    // çağıranlar (katılımcı/başvuru filtreleri gibi) artık bunu iletebilir. Varsayılan
    // davranış (yalnızca aktif) değişmedi, mevcut çağıranlar etkilenmez.
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (includeInactive) params.includeInactive = 'true'
    const res = await api.get<{ data: { id: string; name: string; destination?: string; code: string; startDate: string; endDate: string }[] }>('/travels/options', {
      params,
    })
    // Kullanıcı isteği (2026-08-05): sefer seçicilerinde artık yalnızca gezi (rota) adı
    // ("Bursa") görünmüyor — aynı geziye ait farklı tarihli seferleri birbirinden
    // ayırt edebilmek için tarih (gidiş–dönüş) ve sefer kodu da eklendi.
    const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR')
    return res.data.data.map((t) => {
      const sameDay = new Date(t.startDate).toDateString() === new Date(t.endDate).toDateString()
      const dateLabel = sameDay ? fmt(t.startDate) : `${fmt(t.startDate)} – ${fmt(t.endDate)}`
      return {
        value: t.id,
        label: `${t.name} · ${dateLabel} · ${t.code}`,
        description: t.destination,
      }
    })
  },

  async getAuditLog(id: string): Promise<TravelAuditEntry[]> {
    const res = await api.get<{ data: TravelAuditEntry[] }>(`/travels/${id}/audit`)
    return res.data.data
  },

  async uploadImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/travels/images', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async uploadGalleryPhoto(file: File): Promise<{ id: string; url: string; name: string; size: number }> {
    const body = new FormData()
    body.append('file', file)
    // SORUN 5 düzeltmesi (2026-08-07, kullanıcı bulgusu — canlı testte kanıtlandı):
    // purpose parametresi eksikti, bu yüzden backend görseli sabit kapak ölçüleriyle
    // (1920x1080 vb.) kıyaslıyordu ve galeri fotoğrafları neredeyse hiç uymadığı için
    // 409 IMAGE_SPEC_MISMATCH dönüyordu. Events modülündeki doğru desenle hizalandı.
    const res = await api.post<{ data: { url: string } }>('/travels/images?purpose=gallery', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return { id: safeUuid(), url: res.data.data.url, name: file.name, size: Math.round(file.size / 1024) }
  },

  async getSettings(): Promise<TravelSettings> {
    const res = await api.get<{ data: TravelSettings }>('/travel-settings')
    return res.data.data
  },

  async saveSettings(data: TravelSettings): Promise<TravelSettings> {
    const res = await api.put<{ data: TravelSettings }>('/travel-settings', data)
    return res.data.data
  },

  // Kullanıcı isteği (2026-09-30): Facility modüllerindeki "Yoklama Al" ekranıyla aynı
  // desende gezi yoklaması — backend (TravelAttendanceEndpoints) zaten hazırdı.
  attendance: {
    async getRoster(travelId: string): Promise<TravelAttendanceRoster> {
      const res = await api.get<{ data: TravelAttendanceRoster }>(`/travels/${travelId}/attendance/roster`)
      return res.data.data
    },
    async save(travelId: string, marks: TravelAttendanceMark[]): Promise<TravelAttendanceSaveResult> {
      const res = await api.post<{ data: TravelAttendanceSaveResult }>(`/travels/${travelId}/attendance/save`, { marks })
      return res.data.data
    },
    async reopen(travelId: string): Promise<void> {
      await api.post(`/travels/${travelId}/attendance/reopen`)
    },
    async exportExcel(travelId: string): Promise<{ blob: Blob; fileName: string }> {
      const res = await api.get(`/travels/${travelId}/attendance/export`, { responseType: 'blob' })
      const fileName = filenameFromContentDisposition(
        res.headers['content-disposition'] as string | undefined, 'gezi-yoklama.xlsx')
      return { blob: res.data as Blob, fileName }
    },
  },
}

export default travelService
