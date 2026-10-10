import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  Library, LibraryForm, LibraryOverviewSummary, LibraryDetailSummary,
  Occupant, QueueEntry, LibraryBreak, ExitedSession, AllLibrariesPerson,
  LibraryRule, LibraryRuleForm, RuleSummary,
  LibrarySettings, LibrarySeatPlan, SeatStructureFloor,
  LibraryStaff, LibraryStaffForm, LibraryShift, StartShiftForm, EditShiftForm, MesaiSummary, MesaiOverviewSummary, MyMesai, MyMesaiMonthSummary, MesaiMonthlyReport,
  LocationConsentStatus, StaffMesaiPeriodTotals, TopMesaiStaff, MesaiReportSummary,
  CheckInResult, OverdueBookEntry, LibraryAnalyticsParams, LibraryAnalytics,
  LibraryDeviceRecord, LibraryDeviceForm, LibraryOption,
  HardwareVerificationRequest, HardwareVerificationResult, LibraryTemplateDefinition,
  LibraryStaticQr, LibraryStaticQrMode,
  LibraryDoorQr,
  LibraryManualMessageRequest, LibraryManualMessageResult,
} from '@/types/library.types'

type Params = Record<string, unknown>

function toLibraryPayload(data: LibraryForm) {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))
  const { systemType, ...rest } = data
  const seatingMode = systemType === 'giris_cikis' ? 'sirali' : 'masali'
  const breakSystemEnabled = systemType === 'millet'
  return {
    ...rest,
    seatingMode,
    breakSystemEnabled,
    autoCheckOutAfterMinutes: num(data.autoCheckOutAfterMinutes) ?? 0,
    breakDurationMinutes: num(data.breakDurationMinutes) ?? 0,
    maxDailyBreaks: num(data.maxDailyBreaks) ?? 0,
    longBreakDurationMinutes: num(data.longBreakDurationMinutes) ?? 0,
    maxStudyHoursPerDay: num(data.maxStudyHoursPerDay) ?? 0,
    requireBreakAfterHours: num(data.requireBreakAfterHours) ?? 0,
    geofenceRadiusMeters: num(data.geofenceRadiusMeters) ?? 150,
    geofenceLatitude: data.geofenceEnabled ? numOrNull(data.geofenceLatitude) : null,
    geofenceLongitude: data.geofenceEnabled ? numOrNull(data.geofenceLongitude) : null,
  }
}

const libraryService = {
  async getList(params: Params): Promise<PagedResult<Library>> {
    const res = await api.get<{ data: PagedResult<Library> }>('/libraries', { params })
    return res.data.data
  },
  async getOptions(): Promise<LibraryOption[]> {
    const res = await api.get<{ data: LibraryOption[] }>('/libraries/options')
    return res.data.data
  },
  async uploadKroki(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/libraries/kroki', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
  async uploadImage(file: File): Promise<{ url: string }> {
    const body = new FormData()
    body.append('file', file)
    const res = await api.post<{ data: { url: string } }>('/libraries/images', body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
  async getOverviewSummary(): Promise<LibraryOverviewSummary> {
    const res = await api.get<{ data: LibraryOverviewSummary }>('/libraries/overview-summary')
    return res.data.data
  },
  // Kullanıcı isteği (2026-09-30): kütüphane ana ekranında kişi adına göre "hangi kütüphanede"
  // arayabilmek için tüm kütüphaneler çapında kişi arama.
  async getAllPersons(params: Params): Promise<PagedResult<AllLibrariesPerson>> {
    const res = await api.get<{ data: PagedResult<AllLibrariesPerson> }>('/libraries/all/persons', { params })
    return res.data.data
  },
  async getById(id: string): Promise<Library> {
    const res = await api.get<{ data: Library }>(`/libraries/${id}`)
    return res.data.data
  },
  async getDetailSummary(id: string): Promise<LibraryDetailSummary> {
    const res = await api.get<{ data: LibraryDetailSummary }>(`/libraries/${id}/summary`)
    return res.data.data
  },
  async create(data: LibraryForm): Promise<Library> {
    const res = await api.post<{ data: Library }>('/libraries', toLibraryPayload(data))
    return res.data.data
  },
  async update(id: string, data: LibraryForm): Promise<Library> {
    const res = await api.put<{ data: Library }>(`/libraries/${id}`, toLibraryPayload(data))
    return res.data.data
  },
  async delete(id: string): Promise<void> {
    await api.delete(`/libraries/${id}`)
  },
  async toggleStatus(id: string): Promise<Library> {
    const res = await api.patch<{ data: Library }>(`/libraries/${id}/toggle-status`)
    return res.data.data
  },
  async getTemplates(): Promise<LibraryTemplateDefinition[]> {
    const res = await api.get<{ data: LibraryTemplateDefinition[] }>('/library-templates')
    return res.data.data
  },
  async validateTemplate(req: HardwareVerificationRequest): Promise<HardwareVerificationResult> {
    const res = await api.post<{ data: HardwareVerificationResult }>('/libraries/validate-template', req)
    return res.data.data
  },

  async checkIn(libraryId: string, data: { tckn?: string; participantId?: string; memberName?: string; seat?: string; method?: string }): Promise<CheckInResult> {
    const res = await api.post<{ data: CheckInResult }>(`/libraries/${libraryId}/check-in`, { ...data, method: data.method ?? 'manual' })
    return res.data.data
  },

  async sendManualMessage(libraryId: string, data: LibraryManualMessageRequest): Promise<LibraryManualMessageResult> {
    const res = await api.post<{ data: LibraryManualMessageResult }>(`/libraries/${libraryId}/messages/send`, data)
    return res.data.data
  },

  reservations: {
    async cancel(reservationId: string): Promise<void> {
      await api.delete(`/libraries/reservations/${reservationId}`)
    },
  },

  occupants: {
    async getList(libraryId: string, params: Params): Promise<PagedResult<Occupant>> {
      const res = await api.get<{ data: PagedResult<Occupant> }>(`/libraries/${libraryId}/occupants`, { params })
      return res.data.data
    },
    async exit(sessionId: string): Promise<void> {
      await api.post(`/library-sessions/${sessionId}/exit`)
    },
    async changeSeat(sessionId: string, seat: string): Promise<void> {
      await api.patch(`/library-sessions/${sessionId}/seat`, { seat })
    },
  },

  queue: {
    async getList(libraryId: string, params: Params): Promise<PagedResult<QueueEntry>> {
      const res = await api.get<{ data: PagedResult<QueueEntry> }>(`/libraries/${libraryId}/queue`, { params })
      return res.data.data
    },
    async callNext(libraryId: string): Promise<void> {
      await api.post(`/libraries/${libraryId}/queue/call-next`)
    },
    async markEntered(queueId: string): Promise<void> {
      await api.post(`/library-queue/${queueId}/enter`)
    },
    async expire(queueId: string): Promise<void> {
      await api.post(`/library-queue/${queueId}/expire`)
    },
  },

  breaks: {
    async getList(libraryId: string, params: Params): Promise<PagedResult<LibraryBreak>> {
      const res = await api.get<{ data: PagedResult<LibraryBreak> }>(`/libraries/${libraryId}/breaks`, { params })
      return res.data.data
    },
    async end(breakId: string): Promise<void> {
      await api.post(`/library-breaks/${breakId}/end`)
    },
    async warn(memberId: string, message: string): Promise<void> {
      await api.post(`/library-members/${memberId}/warn`, { message })
    },
  },

  exited: {
    async getList(libraryId: string, params: Params): Promise<PagedResult<ExitedSession>> {
      const res = await api.get<{ data: PagedResult<ExitedSession> }>(`/libraries/${libraryId}/exited`, { params })
      return res.data.data
    },
  },

  rules: {
    async getList(params: Params): Promise<PagedResult<LibraryRule>> {
      const res = await api.get<{ data: PagedResult<LibraryRule> }>('/library-rules', { params })
      return res.data.data
    },
    async getSummary(params: Params): Promise<RuleSummary> {
      const res = await api.get<{ data: RuleSummary }>('/library-rules/summary', { params })
      return res.data.data
    },
    async create(data: LibraryRuleForm & { libraryId?: string }): Promise<LibraryRule> {
      const res = await api.post<{ data: LibraryRule }>('/library-rules', data)
      return res.data.data
    },
    async update(id: string, data: LibraryRuleForm): Promise<LibraryRule> {
      const res = await api.put<{ data: LibraryRule }>(`/library-rules/${id}`, data)
      return res.data.data
    },
    async delete(id: string): Promise<void> {
      await api.delete(`/library-rules/${id}`)
    },
    async toggleStatus(id: string): Promise<LibraryRule> {
      const res = await api.patch<{ data: LibraryRule }>(`/library-rules/${id}/toggle-status`)
      return res.data.data
    },
  },

  seatPlan: {
    async get(libraryId: string): Promise<LibrarySeatPlan> {
      const res = await api.get<{ data: LibrarySeatPlan }>(`/libraries/${libraryId}/seat-plan`)
      return res.data.data
    },
    async saveMaintenance(libraryId: string, maintenanceKeys: string[]): Promise<void> {
      await api.put(`/libraries/${libraryId}/seat-plan`, { maintenanceKeys })
    },
    async saveStructure(libraryId: string, payload: { isMultiFloor: boolean; floors: SeatStructureFloor[] }): Promise<LibrarySeatPlan> {
      const res = await api.put<{ data: LibrarySeatPlan }>(`/libraries/${libraryId}/seat-structure`, payload)
      return res.data.data
    },
  },

  settings: {
    async get(libraryId?: string): Promise<LibrarySettings> {
      const res = await api.get<{ data: LibrarySettings }>('/library-settings', {
        params: libraryId ? { libraryId } : {},
      })
      return res.data.data
    },
    async save(libraryId: string | null, data: LibrarySettings): Promise<LibrarySettings> {
      const res = await api.put<{ data: LibrarySettings }>('/library-settings', data, {
        params: libraryId ? { libraryId } : {},
      })
      return res.data.data
    },
  },

  staff: {
    async getList(params: Params): Promise<PagedResult<LibraryStaff>> {
      const res = await api.get<{ data: PagedResult<LibraryStaff> }>('/library-staff', { params })
      return res.data.data
    },
    async getMyLibraries(): Promise<LibraryOption[]> {
      const res = await api.get<{ data: LibraryOption[] }>('/library-staff/me/libraries')
      return res.data.data
    },
    async autoStart(): Promise<LibraryShift | null> {
      const res = await api.post<{ data: LibraryShift | null }>('/library-staff/me/auto-start')
      return res.data.data
    },
    async getEligible(libraryId: string): Promise<LibraryStaff[]> {
      const res = await api.get<{ data: LibraryStaff[] }>('/library-staff/eligible', { params: { libraryId } })
      return res.data.data
    },
    async create(form: LibraryStaffForm): Promise<LibraryStaff> {
      const res = await api.post<{ data: LibraryStaff }>('/library-staff', form)
      return res.data.data
    },
    async update(id: string, form: LibraryStaffForm): Promise<LibraryStaff> {
      const res = await api.put<{ data: LibraryStaff }>(`/library-staff/${id}`, form)
      return res.data.data
    },
    async delete(id: string): Promise<void> {
      await api.delete(`/library-staff/${id}`)
    },
    async toggleStatus(id: string): Promise<void> {
      await api.patch(`/library-staff/${id}/toggle-status`)
    },
    async getShifts(staffId: string): Promise<LibraryShift[]> {
      const res = await api.get<{ data: LibraryShift[] }>(`/library-staff/${staffId}/shifts`)
      return res.data.data
    },
    async setMyLocationConsent(status: LocationConsentStatus): Promise<LibraryStaff> {
      const res = await api.patch<{ data: LibraryStaff }>('/library-staff/me/location-consent', { status })
      return res.data.data
    },
    async getMyDoorQr(): Promise<LibraryDoorQr> {
      const res = await api.get<{ data: LibraryDoorQr }>('/library-staff/me/door-qr')
      return res.data.data
    },
  },

  overdue: {
    async getAll(params: { page: number; limit: number; libraryId?: string; search?: string }): Promise<import('@/types/common').PagedResult<OverdueBookEntry>> {
      const res = await api.get<{ data: import('@/types/common').PagedResult<OverdueBookEntry> }>('/libraries/overdue-books', { params })
      return res.data.data
    },
    async getStatus(): Promise<import('@/types/library.types').EmanetStatus> {
      const res = await api.get<{ data: import('@/types/library.types').EmanetStatus }>('/libraries/emanet-status')
      return res.data.data
    },
  },

  shifts: {
    async getActive(libraryId: string): Promise<LibraryShift[]> {
      const res = await api.get<{ data: LibraryShift[] }>(`/libraries/${libraryId}/shifts/active`)
      return res.data.data
    },
    async getList(libraryId: string, params: Params): Promise<PagedResult<LibraryShift>> {
      const res = await api.get<{ data: PagedResult<LibraryShift> }>(`/libraries/${libraryId}/shifts`, { params })
      return res.data.data
    },
    async getSummary(libraryId: string): Promise<MesaiSummary> {
      const res = await api.get<{ data: MesaiSummary }>(`/libraries/${libraryId}/shifts/summary`)
      return res.data.data
    },
    async start(libraryId: string, form: StartShiftForm): Promise<LibraryShift> {
      const res = await api.post<{ data: LibraryShift }>(`/libraries/${libraryId}/shifts`, form)
      return res.data.data
    },
    async end(shiftId: string): Promise<void> {
      await api.post(`/library-shifts/${shiftId}/end`)
    },
    async getMine(libraryId: string): Promise<MyMesai> {
      const res = await api.get<{ data: MyMesai }>(`/libraries/${libraryId}/shifts/me`)
      return res.data.data
    },
    async startMine(libraryId: string, body: { location: string; notes: string; latitude?: number; longitude?: number }): Promise<LibraryShift> {
      const res = await api.post<{ data: LibraryShift }>(`/libraries/${libraryId}/shifts/me/start`, body)
      return res.data.data
    },
    async endMine(libraryId: string): Promise<void> {
      await api.post(`/libraries/${libraryId}/shifts/me/end`)
    },
    async getAllActive(): Promise<LibraryShift[]> {
      const res = await api.get<{ data: LibraryShift[] }>('/mesai/shifts/active')
      return res.data.data
    },
    async getOverviewSummary(): Promise<MesaiOverviewSummary> {
      const res = await api.get<{ data: MesaiOverviewSummary }>('/mesai/summary')
      return res.data.data
    },
    async edit(shiftId: string, form: EditShiftForm): Promise<LibraryShift> {
      const res = await api.post<{ data: LibraryShift }>(`/library-shifts/${shiftId}/edit`, form)
      return res.data.data
    },
    async getMyShifts(params: Params): Promise<PagedResult<LibraryShift>> {
      const res = await api.get<{ data: PagedResult<LibraryShift> }>('/mesai/mine/shifts', { params })
      return res.data.data
    },
    async getMyMonthSummary(year: number, month: number): Promise<MyMesaiMonthSummary> {
      const res = await api.get<{ data: MyMesaiMonthSummary }>('/mesai/mine/summary', { params: { year, month } })
      return res.data.data
    },
    async editMine(shiftId: string, form: EditShiftForm): Promise<LibraryShift> {
      const res = await api.post<{ data: LibraryShift }>(`/mesai/mine/shifts/${shiftId}/edit`, form)
      return res.data.data
    },
    async getOverviewShifts(params: Params): Promise<PagedResult<LibraryShift>> {
      const res = await api.get<{ data: PagedResult<LibraryShift> }>('/mesai/shifts', { params })
      return res.data.data
    },
    async getReportSummary(params: Params): Promise<MesaiReportSummary> {
      const res = await api.get<{ data: MesaiReportSummary }>('/mesai/report-summary', { params })
      return res.data.data
    },
    async getLeaderboard(params: { year?: number; month?: number; libraryId?: string; limit?: number }): Promise<TopMesaiStaff[]> {
      const res = await api.get<{ data: TopMesaiStaff[] }>('/mesai/leaderboard', { params })
      return res.data.data
    },
    async getMonthlyReport(params: { year: number; month: number; libraryId?: string; staffId?: string }): Promise<MesaiMonthlyReport> {
      const res = await api.get<{ data: MesaiMonthlyReport }>('/mesai/monthly-report', { params })
      return res.data.data
    },
    async exportMonthlyReport(params: { year: number; month: number; libraryId?: string; staffId?: string }): Promise<Blob> {
      const res = await api.get('/mesai/monthly-report/export', { params, responseType: 'blob' })
      return res.data as Blob
    },
    async getStaffPeriodTotals(staffId: string, startDate: string, endDate: string): Promise<StaffMesaiPeriodTotals> {
      const res = await api.get<{ data: StaffMesaiPeriodTotals }>(`/mesai/staff/${staffId}/period-totals`, { params: { startDate, endDate } })
      return res.data.data
    },
  },
  async getAnalytics(params: LibraryAnalyticsParams): Promise<LibraryAnalytics> {
    const res = await api.get<{ data: LibraryAnalytics }>('/libraries/analytics', { params })
    return res.data.data
  },

  devices: {
    async getList(libraryId: string): Promise<LibraryDeviceRecord[]> {
      const res = await api.get<{ data: LibraryDeviceRecord[] }>(`/libraries/${libraryId}/devices`)
      return res.data.data
    },
    async getById(id: string): Promise<LibraryDeviceRecord> {
      const res = await api.get<{ data: LibraryDeviceRecord }>(`/library-devices/${id}`)
      return res.data.data
    },
    async create(libraryId: string, form: LibraryDeviceForm): Promise<LibraryDeviceRecord> {
      const res = await api.post<{ data: LibraryDeviceRecord }>(`/libraries/${libraryId}/devices`, form)
      return res.data.data
    },
    async update(id: string, form: LibraryDeviceForm): Promise<LibraryDeviceRecord> {
      const res = await api.put<{ data: LibraryDeviceRecord }>(`/library-devices/${id}`, form)
      return res.data.data
    },
    async remove(id: string): Promise<void> {
      await api.delete(`/library-devices/${id}`)
    },
    async toggleStatus(id: string): Promise<LibraryDeviceRecord> {
      const res = await api.patch<{ data: LibraryDeviceRecord }>(`/library-devices/${id}/toggle-status`)
      return res.data.data
    },
    async revealApiKey(id: string): Promise<string | null> {
      const res = await api.get<{ data: { apiKey: string | null } }>(`/library-devices/${id}/api-key`)
      return res.data.data.apiKey
    },
    async rotateKey(id: string): Promise<LibraryDeviceRecord> {
      const res = await api.post<{ data: LibraryDeviceRecord }>(`/library-devices/${id}/rotate-key`)
      return res.data.data
    },
    async move(id: string, targetLibraryId: string): Promise<LibraryDeviceRecord> {
      const res = await api.post<{ data: LibraryDeviceRecord }>(`/library-devices/${id}/move`, { targetLibraryId })
      return res.data.data
    },
    async testLock(id: string): Promise<{ ok: boolean; message: string }> {
      const res = await api.post<{ data: { ok: boolean; message: string } }>(`/library-devices/${id}/test-lock`)
      return res.data.data
    },
  },

  staticQr: {
    async get(libraryId: string): Promise<LibraryStaticQr> {
      const res = await api.get<{ data: LibraryStaticQr }>(`/libraries/${libraryId}/static-qr`)
      return res.data.data
    },
    async toggle(libraryId: string, enabled: boolean): Promise<LibraryStaticQr> {
      const res = await api.patch<{ data: LibraryStaticQr }>(`/libraries/${libraryId}/static-qr/toggle`, { enabled })
      return res.data.data
    },
    async setMode(libraryId: string, mode: LibraryStaticQrMode): Promise<LibraryStaticQr> {
      const res = await api.patch<{ data: LibraryStaticQr }>(`/libraries/${libraryId}/static-qr/mode`, { mode })
      return res.data.data
    },
    async setTiming(libraryId: string, minExitSeconds: number, reentryCooldownSeconds: number): Promise<LibraryStaticQr> {
      const res = await api.patch<{ data: LibraryStaticQr }>(`/libraries/${libraryId}/static-qr/timing`, {
        minExitSeconds, reentryCooldownSeconds,
      })
      return res.data.data
    },
    async rotate(libraryId: string): Promise<LibraryStaticQr> {
      const res = await api.post<{ data: LibraryStaticQr }>(`/libraries/${libraryId}/static-qr/rotate`)
      return res.data.data
    },
  },
}

export default libraryService
