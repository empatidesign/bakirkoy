import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  CitizenSedaInfoDto,
  CitizenSedaResultDto,
  CitizenSedaResultItemDto,
  CitizenSedaOptionsDto,
  CitizenSedaApplyRequest,
  SedaApplicationDto,
} from '@/types/seda.types'

const sedaService = {
  async info(): Promise<CitizenSedaInfoDto> {
    const res = await api.get<{ data: CitizenSedaInfoDto }>('/me/seda/info')
    return res.data.data
  },

  async options(): Promise<CitizenSedaOptionsDto> {
    const res = await api.get<{ data: CitizenSedaOptionsDto }>('/me/seda/options')
    return res.data.data
  },

  async myResult(): Promise<CitizenSedaResultDto> {
    const res = await api.get<{ data: CitizenSedaResultDto }>('/me/seda/my-result')
    return res.data.data
  },

  // Kullanıcı isteği (2026-08-12): "her eğitim öğretim yılı için gerekli olacak" +
  // "telefon numaraları ile sorgulayabilmesi" — TCKN veya kayıtlı telefon numarasıyla eşleşen
  // TÜM yılların sonucu.
  async myResults(): Promise<CitizenSedaResultItemDto[]> {
    const res = await api.get<{ data: CitizenSedaResultItemDto[] }>('/me/seda/my-results')
    return res.data.data
  },

  async myApplications(page = 1, limit = 25): Promise<PagedResult<SedaApplicationDto>> {
    const res = await api.get<{ data: PagedResult<SedaApplicationDto> }>('/me/seda/applications', {
      params: { page, limit },
    })
    return res.data.data
  },

  async apply(req: CitizenSedaApplyRequest): Promise<SedaApplicationDto> {
    const res = await api.post<{ data: SedaApplicationDto }>('/me/seda/apply', req)
    return res.data.data
  },
}

export default sedaService
