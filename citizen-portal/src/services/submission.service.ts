import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenSubmission, CreateSubmissionRequest, UpdateSubmissionRequest } from '@/types/submission.types'

export interface SubmissionOption { value: string; label: string }
export interface SubmissionFormOptions {
  categories: SubmissionOption[]
  types: SubmissionOption[]
  priorities: SubmissionOption[]
  neighborhoods: SubmissionOption[]
  addressTypes: SubmissionOption[]
  scopes: SubmissionOption[]
  /** Vatandaşın kayıtlı ikametgah mahallesi (varsa) — form otomatik dolar. */
  residenceNeighborhood: string | null
  residenceAddress: string | null
  residenceDistrict?: string | null
}

const submissionService = {
  async list(params: Record<string, unknown>): Promise<PagedResult<CitizenSubmission>> {
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    const res = await api.get<{ data: PagedResult<CitizenSubmission> }>('/me/submissions', { params: filtered })
    return res.data.data
  },

  async create(data: CreateSubmissionRequest): Promise<CitizenSubmission> {
    const res = await api.post<{ data: CitizenSubmission }>('/me/submissions', data)
    return res.data.data
  },

  /** Hata raporu (docs/hata.md #4.4): başvuru düzenleme. */
  async update(id: string, data: UpdateSubmissionRequest): Promise<CitizenSubmission> {
    const res = await api.put<{ data: CitizenSubmission }>(`/me/submissions/${id}`, data)
    return res.data.data
  },

  /** Kullanıcı isteği (2026-08-28): "başvurusunun durumunu sorgulayabilir" — tek kayıt + tüm süreç. */
  async getById(id: string): Promise<CitizenSubmission> {
    const res = await api.get<{ data: CitizenSubmission }>(`/me/submissions/${id}`)
    return res.data.data
  },

  /** Takip numarası ile durum sorgulama. */
  async getByTrackingNo(trackingNo: string): Promise<CitizenSubmission> {
    const res = await api.get<{ data: CitizenSubmission }>(`/me/submissions/track/${encodeURIComponent(trackingNo)}`)
    return res.data.data
  },

  async options(): Promise<SubmissionFormOptions> {
    const res = await api.get<{ data: SubmissionFormOptions }>('/me/submissions/options')
    return res.data.data
  },

  async uploadMedia(file: File): Promise<{ url: string; objectName: string; sizeBytes: number }> {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<{ data: { url: string; objectName: string; sizeBytes: number } }>(
      '/me/submissions/media',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return res.data.data
  },
}

export default submissionService
