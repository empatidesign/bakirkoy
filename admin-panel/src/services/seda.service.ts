import { api } from './api'
import { filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult, SelectOption } from '@/types/common'
import type {
  SedaApplication,
  SedaApplicationForm,
  SedaApplicationStatus,
  SedaApplicationSummary,
  SedaDefinition,
  SedaDefinitionForm,
  SedaDefinitionType,
  SedaEducationImportResult,
  SedaEducationRecord,
  SedaPeriod,
  SedaPeriodForm,
  SedaSchool,
  SedaSchoolForm,
  SedaSettings,
  SedaManualMessageRequest,
  SedaManualMessageResult,
  SedaYearlyReport,
} from '@/types/seda.types'

const sedaService = {
  async getApplications(params: Record<string, unknown>): Promise<PagedResult<SedaApplication>> {
    const res = await api.get<{ data: PagedResult<SedaApplication> }>('/seda/applications', { params })
    return res.data.data
  },

  async getApplicationSummary(params: Record<string, unknown>): Promise<SedaApplicationSummary> {
    const res = await api.get<{ data: SedaApplicationSummary }>('/seda/applications/summary', { params })
    return res.data.data
  },

  async getYearlyReport(params: Record<string, unknown>): Promise<SedaYearlyReport> {
    const res = await api.get<{ data: SedaYearlyReport }>('/seda/applications/yearly-report', { params })
    return res.data.data
  },

  async getApplicationById(id: string): Promise<SedaApplication> {
    const res = await api.get<{ data: SedaApplication }>(`/seda/applications/${id}`)
    return res.data.data
  },

  async createApplication(data: SedaApplicationForm): Promise<SedaApplication> {
    const res = await api.post<{ data: SedaApplication }>('/seda/applications', data)
    return res.data.data
  },

  async updateApplication(id: string, data: SedaApplicationForm): Promise<SedaApplication> {
    const res = await api.put<{ data: SedaApplication }>(`/seda/applications/${id}`, data)
    return res.data.data
  },

  async setApplicationStatus(id: string, status: SedaApplicationStatus, reason?: string): Promise<SedaApplication> {
    const res = await api.patch<{ data: SedaApplication }>(`/seda/applications/${id}/status`, {
      status,
      reason: reason?.trim() || null,
    })
    return res.data.data
  },

  async deleteApplication(id: string): Promise<void> {
    await api.delete(`/seda/applications/${id}`)
  },

  async getSchools(params: Record<string, unknown>): Promise<PagedResult<SedaSchool>> {
    const res = await api.get<{ data: PagedResult<SedaSchool> }>('/seda/schools', { params })
    return res.data.data
  },

  async createSchool(data: SedaSchoolForm): Promise<SedaSchool> {
    const res = await api.post<{ data: SedaSchool }>('/seda/schools', data)
    return res.data.data
  },

  async updateSchool(id: string, data: SedaSchoolForm): Promise<SedaSchool> {
    const res = await api.put<{ data: SedaSchool }>(`/seda/schools/${id}`, data)
    return res.data.data
  },

  async toggleSchool(id: string): Promise<SedaSchool> {
    const res = await api.patch<{ data: SedaSchool }>(`/seda/schools/${id}/toggle-status`)
    return res.data.data
  },

  async deleteSchool(id: string): Promise<void> {
    await api.delete(`/seda/schools/${id}`)
  },

  async getSchoolOptions(): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>('/seda/schools/options')
    return res.data.data
  },

  async getDefinitions(type: SedaDefinitionType, params: Record<string, unknown>): Promise<PagedResult<SedaDefinition>> {
    const res = await api.get<{ data: PagedResult<SedaDefinition> }>('/seda/definitions', { params: { ...params, type } })
    return res.data.data
  },

  async createDefinition(type: SedaDefinitionType, data: SedaDefinitionForm): Promise<SedaDefinition> {
    const res = await api.post<{ data: SedaDefinition }>('/seda/definitions', { ...data, type })
    return res.data.data
  },

  async updateDefinition(id: string, data: SedaDefinitionForm): Promise<SedaDefinition> {
    const res = await api.put<{ data: SedaDefinition }>(`/seda/definitions/${id}`, data)
    return res.data.data
  },

  async toggleDefinition(id: string): Promise<SedaDefinition> {
    const res = await api.patch<{ data: SedaDefinition }>(`/seda/definitions/${id}/toggle-status`)
    return res.data.data
  },

  async deleteDefinition(id: string): Promise<void> {
    await api.delete(`/seda/definitions/${id}`)
  },

  async getDefinitionOptions(type: SedaDefinitionType): Promise<SelectOption[]> {
    const res = await api.get<{ data: SelectOption[] }>('/seda/definitions/options', { params: { type } })
    return res.data.data
  },

  async getPeriods(params: Record<string, unknown>): Promise<PagedResult<SedaPeriod>> {
    const res = await api.get<{ data: PagedResult<SedaPeriod> }>('/seda/periods', { params })
    return res.data.data
  },

  async createPeriod(data: SedaPeriodForm): Promise<SedaPeriod> {
    const res = await api.post<{ data: SedaPeriod }>('/seda/periods', data)
    return res.data.data
  },

  async updatePeriod(id: string, data: SedaPeriodForm): Promise<SedaPeriod> {
    const res = await api.put<{ data: SedaPeriod }>(`/seda/periods/${id}`, data)
    return res.data.data
  },

  async activatePeriod(id: string): Promise<SedaPeriod> {
    const res = await api.patch<{ data: SedaPeriod }>(`/seda/periods/${id}/activate`)
    return res.data.data
  },

  async deletePeriod(id: string): Promise<void> {
    await api.delete(`/seda/periods/${id}`)
  },

  async getSettings(): Promise<SedaSettings> {
    const res = await api.get<{ data: SedaSettings }>('/seda/settings')
    return res.data.data
  },

  async updateSettings(patch: Partial<Omit<SedaSettings, 'activePeriod'>>): Promise<SedaSettings> {
    const res = await api.put<{ data: SedaSettings }>('/seda/settings', patch)
    return res.data.data
  },

  async sendManualMessage(data: SedaManualMessageRequest): Promise<SedaManualMessageResult> {
    const res = await api.post<{ data: SedaManualMessageResult }>('/seda/applications/send-message', data)
    return res.data.data
  },

  async getEducationRecords(params: Record<string, unknown>): Promise<PagedResult<SedaEducationRecord>> {
    const res = await api.get<{ data: PagedResult<SedaEducationRecord> }>('/seda/education-records', { params })
    return res.data.data
  },

  async getEducationYears(): Promise<string[]> {
    const res = await api.get<{ data: string[] }>('/seda/education-records/years')
    return res.data.data
  },

  async exportEducationRecordsExcel(params: Record<string, unknown>): Promise<{ blob: Blob; fileName: string }> {
    const res = await api.get('/seda/education-records/export', { params, responseType: 'blob' })
    const fileName = filenameFromContentDisposition(
      (res.headers as Record<string, string>)['content-disposition'], 'SEDA_Egitim_Alanlar.xlsx')
    return { blob: res.data as Blob, fileName }
  },

  async importEducationRecords(file: File, academicYear: string, periodId?: string, periodStartDate?: string, periodEndDate?: string): Promise<SedaEducationImportResult> {
    const body = new FormData()
    body.append('file', file)
    body.append('academicYear', academicYear)
    if (periodId) body.append('periodId', periodId)
    // Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten başlangıç
    // ve bitiş yılı dönemi verecek bize" — önceden dönem oluşturmadan doğrudan tarih aralığı.
    if (periodStartDate) body.append('periodStartDate', periodStartDate)
    if (periodEndDate) body.append('periodEndDate', periodEndDate)
    const res = await api.post<{ data: SedaEducationImportResult }>('/seda/education-records/import', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  async updateEducationRecordResult(id: string, data: { score: number | null; resultNote: string | null }): Promise<SedaEducationRecord> {
    const res = await api.put<{ data: SedaEducationRecord }>(`/seda/education-records/${id}/result`, data)
    return res.data.data
  },

  async deleteEducationRecord(id: string): Promise<void> {
    await api.delete(`/seda/education-records/${id}`)
  },

  async exportApplicationsExcel(params: Record<string, unknown>): Promise<{ blob: Blob; fileName: string }> {
    const res = await api.get('/seda/applications/export', { params, responseType: 'blob' })
    const fileName = filenameFromContentDisposition(
      (res.headers as Record<string, string>)['content-disposition'], 'SEDA_Basvurular.xlsx')
    return { blob: res.data as Blob, fileName }
  },
}

export default sedaService
