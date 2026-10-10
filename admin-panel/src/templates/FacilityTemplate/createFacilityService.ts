import { api } from '@/services/api'
import { filenameFromContentDisposition } from '@/lib/utils'
import type { PagedResult } from '@/types/common'
import type {
  FacilityRecord, BranchRecord, GroupRecord, SessionRecord,
  FacilityApplication, CalendarDay, FacilitySummary,
  FacilityForm, BranchForm, GroupForm, AttendanceResult, FacilityDevice, FacilityDeviceForm, FacilityDeviceTestResult, FacilityDeviceOpenResult, ReportSummary,
  GeneralSettings, FacilityScopeSettings, GroupType, FacilityGender, AttendanceMode,
  AttendanceRosterItem, AttendanceMark, SaveAttendanceResult, AttendanceHistoryItem, AttendanceStatus, RegistrationRecord,
  InstructorRecord, InstructorOption, InstructorForm, InstructorDeliveryChannel, BulkSessionsScope, BulkSessionsResult,
  BulkPreRegisterResult, RegistrationTarget, FacilityStaticQr, FacilityStaticQrMode, CopyGroupResult, CopyGroupOptions,
} from '@/types/facility.types'
import type { FacilityModuleService, BulkApproveResult } from './types'

interface ScheduleApiItem { day: string; startTime: string; endTime: string }

interface GroupApiDto {
  id: string
  facilityId: string
  facilityName?: string | null
  branchId: string
  branchName?: string
  parentGroupId?: string | null
  parentGroupName?: string | null
  instructorId?: string | null
  instructorName?: string | null
  name: string
  type: GroupType
  gender: FacilityGender
  capacity: number
  reserveCapacity: number
  registeredCount: number
  waitlistCount: number
  pendingCount?: number
  subGroupCount?: number
  subGroupCapacity?: number
  subGroupRegistered?: number
  subGroupWaitlist?: number
  ageMin: number
  ageMax: number
  schedule: ScheduleApiItem[]
  attendanceMode: AttendanceMode
  lateTrackingEnabled?: boolean
  description?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  periodType?: string | null
  periodCount?: number | null
  periodMonths?: number | null
  periodUnit?: string | null
  periodDays?: number | null
  applicationStartDate?: string | null
  applicationEndDate?: string | null
  academyWhitelistEnabled?: boolean
  autoApprove?: boolean
  absenceLimit?: number
  consecutiveAbsenceLimit?: number
  entryGraceMinutes?: number
  fee?: { isPaid?: boolean; feeType?: string; amount?: number; siblingDiscount?: boolean; staffDiscount?: boolean } | null
  attendanceLimitOverride?: boolean
  attendanceLimitType?: string
  attendanceLimitCount?: number
  conditions?: { documentsRequired?: boolean; requiredDocumentIds?: string[]; documentFormats?: Record<string, string[]>; residenceRequired?: boolean; requirements?: string; applicationConditions?: string; aboutHtml?: string; prerequisiteGroupId?: string | null; customQuestions?: { id: string; question: string; required: boolean }[] }
  residencyMode?: 'anyone' | 'sultangazi_only' | 'outside_only' | 'foreign_only' | 'tc_only' | 'sultangazi_tc' | 'sultangazi_foreign'
  isActive: boolean
  createdAt: string
  deletedAt?: string | null
  deletedBy?: string | null
  scheduleSync?: {
    removedEmptySessions: number
    protectedApplicationSessions: number
    protectedAttendanceSessions: number
  } | null
  sessionCount?: number
}

const toGroupRecord = (d: GroupApiDto): GroupRecord => {
  const schedule = Array.isArray(d.schedule) ? d.schedule : []
  return {
    id: d.id, facilityId: d.facilityId, facilityName: d.facilityName ?? '', branchId: d.branchId, branchName: d.branchName ?? '',
    parentGroupId: d.parentGroupId, parentGroupName: d.parentGroupName,
    instructorId: d.instructorId, instructorName: d.instructorName,
    name: d.name, type: d.type, gender: d.gender,
    capacity: d.capacity, reserveCapacity: d.reserveCapacity,
    registeredCount: d.registeredCount, waitlistCount: d.waitlistCount, pendingCount: d.pendingCount ?? 0,
    subGroupCount: d.subGroupCount ?? 0,
    subGroupCapacity: d.subGroupCapacity ?? 0,
    subGroupRegistered: d.subGroupRegistered ?? 0,
    subGroupWaitlist: d.subGroupWaitlist ?? 0,
    ageMin: d.ageMin, ageMax: d.ageMax,
    days: [...new Set(schedule.map((s) => s.day.toLowerCase()))],
    schedules: schedule.map((s) => ({ day: s.day.toLowerCase(), start: s.startTime, end: s.endTime })),
    attendanceMode: d.attendanceMode,
    lateTrackingEnabled: d.lateTrackingEnabled ?? true,
    description: d.description ?? '',
    periodStart: d.periodStart, periodEnd: d.periodEnd,
    periodType: d.periodType, periodCount: d.periodCount, periodMonths: d.periodMonths,
    periodUnit: d.periodUnit, periodDays: d.periodDays,
    applicationStartDate: d.applicationStartDate, applicationEndDate: d.applicationEndDate,
    academyWhitelistEnabled: d.academyWhitelistEnabled ?? false,
    autoApprove: d.autoApprove ?? true,
    absenceLimit: d.absenceLimit, consecutiveAbsenceLimit: d.consecutiveAbsenceLimit,
    entryGraceMinutes: d.entryGraceMinutes,
    isPaid: d.fee?.isPaid ?? false,
    feeType: d.fee?.feeType,
    feeAmount: d.fee?.amount,
    siblingDiscount: d.fee?.siblingDiscount ?? false,
    staffDiscount: d.fee?.staffDiscount ?? false,
    attendanceLimitOverride: d.attendanceLimitOverride ?? false,
    attendanceLimitType: d.attendanceLimitType,
    attendanceLimitCount: d.attendanceLimitCount,
    documentsRequired: d.conditions?.documentsRequired ?? false,
    requiredDocumentIds: d.conditions?.requiredDocumentIds ?? [],
    documentFormats: d.conditions?.documentFormats ?? {},
    residenceRequired: d.conditions?.residenceRequired ?? true,
    residencyMode: (String(d.residencyMode) === 'district_only' || !d.residencyMode || d.residencyMode === 'anyone') ? 'sultangazi_only' : d.residencyMode,
    requirements: d.conditions?.requirements ?? '',
    applicationConditions: d.conditions?.applicationConditions ?? '',
    aboutHtml: d.conditions?.aboutHtml ?? '',
    isActive: d.isActive, createdAt: d.createdAt,
    deletedAt: d.deletedAt, deletedBy: d.deletedBy,
    scheduleSync: d.scheduleSync ?? null,
    sessionCount: d.sessionCount ?? 0,
    prerequisiteGroupId: d.conditions?.prerequisiteGroupId ?? null,
    customQuestions: d.conditions?.customQuestions ?? [],
  }
}

const toGroupPayload = (f: GroupForm) => ({
  facilityId: f.facilityId,
  branchId: f.branchId,
  parentGroupId: f.parentGroupId || null,
  name: f.name,
  type: f.type,
  gender: f.gender,
  capacity: Number(f.capacity) || 0,
  reserveCapacity: Number(f.reserveCapacity) || 0,
  ageMin: Number(f.ageMin) || 0,
  ageMax: Number(f.ageMax) || 0,
  schedule: f.schedules.map((s) => ({ day: s.day, startTime: s.start, endTime: s.end })),
  attendanceMode: f.attendanceMode,
  lateTrackingEnabled: f.lateTrackingEnabled,
  description: f.description.trim() || null,
  fee: { isPaid: f.isPaid, feeType: f.feeType, amount: Number(f.feeAmount) || 0, siblingDiscount: f.siblingDiscount, staffDiscount: f.staffDiscount },
  conditions: { documentsRequired: f.documentsRequired, requiredDocumentIds: f.requiredDocumentIds, documentFormats: f.documentFormats, residenceRequired: f.residenceRequired, requirements: f.requirements.trim(), applicationConditions: f.applicationConditions.trim(), aboutHtml: f.aboutHtml.trim(), prerequisiteGroupId: f.prerequisiteGroupId || null, customQuestions: f.customQuestions.filter((q) => q.question.trim()) },
  autoApprove: f.autoApprove ?? true,
  periodStart: f.periodStart || null,
  periodEnd: f.periodEnd || null,
  periodMonths: Number(f.periodMonths) || 0,
  periodType: f.periodType || 'date_range',
  periodCount: Number(f.periodCount) || 0,
  periodUnit: f.periodUnit || 'month',
  periodDays: Number(f.periodDays) || 0,
  applicationStartDate: f.applicationStartDate || null,
  applicationEndDate: f.applicationEndDate || null,
  academyWhitelistEnabled: f.academyWhitelistEnabled ?? false,
  residencyMode: (String(f.residencyMode) === 'district_only' || !f.residencyMode || f.residencyMode === 'anyone') ? 'sultangazi_only' : f.residencyMode,
  attendanceLimitOverride: f.attendanceLimitOverride ?? false,
  attendanceLimitType: f.attendanceLimitType ?? 'unlimited',
  attendanceLimitCount: Number(f.attendanceLimitCount) || 0,
  absenceLimit: Number(f.absenceLimit) || 0,
  consecutiveAbsenceLimit: Number(f.consecutiveAbsenceLimit) || 0,
  entryGraceMinutes: Number(f.entryGraceMinutes) || 0,
  instructorId: f.instructorId || null,
  isActive: f.isActive,
})

const toFacilityPayload = (f: FacilityForm) => ({
  ...f,
  capacity: Number(f.capacity),
})

const toBranchPayload = (f: BranchForm) => ({
  name: f.name,
  description: f.description,
  category: f.category ?? '',
  periodMonths: Number(f.periodMonths) || 0,
  absenceLimit: Number(f.absenceLimit) || 0,
  consecutiveAbsenceLimit: Number(f.consecutiveAbsenceLimit) || 0,
  isActive: f.isActive,
})

export const createFacilityService = (basePath: string): FacilityModuleService => ({
  facilities: {
    async getList(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<FacilityRecord> }>(`${basePath}/facilities`, { params })
      return res.data.data
    },
    async getOptions() {
      const res = await api.get<{ data: FacilityRecord[] }>(`${basePath}/facilities/options`)
      return res.data.data
    },
    async getSummary() {
      const res = await api.get<{ data: FacilitySummary }>(`${basePath}/facilities/summary`)
      return res.data.data
    },
    async create(form: FacilityForm) {
      const res = await api.post<{ data: FacilityRecord }>(`${basePath}/facilities`, toFacilityPayload(form))
      return res.data.data
    },
    async update(id: string, form: FacilityForm) {
      const res = await api.put<{ data: FacilityRecord }>(`${basePath}/facilities/${id}`, toFacilityPayload(form))
      return res.data.data
    },
    async remove(id: string) {
      await api.delete(`${basePath}/facilities/${id}`)
    },
    async toggleStatus(id: string) {
      const res = await api.patch<{ data: FacilityRecord }>(`${basePath}/facilities/${id}/toggle-status`)
      return res.data.data
    },
    async getStaticQr(id: string) {
      const res = await api.get<{ data: FacilityStaticQr }>(`${basePath}/facilities/${id}/static-qr`)
      return res.data.data
    },
    async toggleStaticQr(id: string, enabled: boolean) {
      const res = await api.patch<{ data: FacilityStaticQr }>(`${basePath}/facilities/${id}/static-qr/toggle`, { enabled })
      return res.data.data
    },
    async setStaticQrMode(id: string, mode: FacilityStaticQrMode) {
      const res = await api.patch<{ data: FacilityStaticQr }>(`${basePath}/facilities/${id}/static-qr/mode`, { mode })
      return res.data.data
    },
    async setStaticQrTiming(id: string, minExitSeconds: number, reentryCooldownSeconds: number) {
      const res = await api.patch<{ data: FacilityStaticQr }>(`${basePath}/facilities/${id}/static-qr/timing`, {
        minExitSeconds, reentryCooldownSeconds,
      })
      return res.data.data
    },
    async rotateStaticQr(id: string) {
      const res = await api.post<{ data: FacilityStaticQr }>(`${basePath}/facilities/${id}/static-qr/rotate`)
      return res.data.data
    },
    async getTrash(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<FacilityRecord> }>(`${basePath}/facilities/trash`, { params })
      return res.data.data
    },
    async restore(id: string) {
      const res = await api.patch<{ data: FacilityRecord }>(`${basePath}/facilities/${id}/restore`)
      return res.data.data
    },
    async permanentDelete(id: string) {
      await api.delete(`${basePath}/facilities/${id}/permanent`)
    },
    async reorder(orderedIds: string[]) {
      await api.put(`${basePath}/facilities/order`, { orderedIds })
    },
  },

  branches: {
    async getList(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<BranchRecord> }>(`${basePath}/branches`, { params })
      return res.data.data
    },
    async getOptions() {
      const res = await api.get<{ data: Array<{ id: string; name: string; periodMonths: number; absenceLimit: number; consecutiveAbsenceLimit: number }> }>(`${basePath}/branches/options`)
      return res.data.data
    },
    async create(form: BranchForm) {
      const res = await api.post<{ data: BranchRecord }>(`${basePath}/branches`, toBranchPayload(form))
      return res.data.data
    },
    async update(id: string, form: BranchForm) {
      const res = await api.put<{ data: BranchRecord }>(`${basePath}/branches/${id}`, toBranchPayload(form))
      return res.data.data
    },
    async remove(id: string) {
      await api.delete(`${basePath}/branches/${id}`)
    },
    async toggleStatus(id: string) {
      const res = await api.patch<{ data: BranchRecord }>(`${basePath}/branches/${id}/toggle-status`)
      return res.data.data
    },
    async getTrash(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<BranchRecord> }>(`${basePath}/branches/trash`, { params })
      return res.data.data
    },
    async restore(id: string) {
      const res = await api.patch<{ data: BranchRecord }>(`${basePath}/branches/${id}/restore`)
      return res.data.data
    },
    async permanentDelete(id: string) {
      await api.delete(`${basePath}/branches/${id}/permanent`)
    },
    async bulkUpdateCategory(ids: string[], category: string) {
      const res = await api.patch<{ data: { updatedCount: number } }>(`${basePath}/branches/bulk-category`, { ids, category })
      return res.data.data
    },
  },

  groups: {
    async getList(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<GroupApiDto> }>(`${basePath}/groups`, { params })
      const d = res.data.data
      return { ...d, items: d.items.map(toGroupRecord) }
    },
    async getById(id: string) {
      const res = await api.get<{ data: GroupApiDto }>(`${basePath}/groups/${id}`)
      return toGroupRecord(res.data.data)
    },
    async create(form: GroupForm) {
      const res = await api.post<{ data: GroupApiDto }>(`${basePath}/groups`, toGroupPayload(form))
      return toGroupRecord(res.data.data)
    },
    async createSubGroup(parentGroupId: string, form: GroupForm) {
      const payload = toGroupPayload(form)
      const res = await api.post<{ data: GroupApiDto }>(`${basePath}/groups/${parentGroupId}/sub-groups`, payload)
      return toGroupRecord(res.data.data)
    },
    async copyToFacilities(id: string, targetFacilityIds: string[], options?: CopyGroupOptions) {
      const res = await api.post<{ data: CopyGroupResult }>(`${basePath}/groups/${id}/copy`, { targetFacilityIds, ...options })
      return res.data.data
    },
    async update(id: string, form: GroupForm, confirmAttendanceDeletion = false) {
      const res = await api.put<{ data: GroupApiDto }>(
        `${basePath}/groups/${id}`, toGroupPayload(form),
        { params: confirmAttendanceDeletion ? { confirmAttendanceDeletion: true } : undefined },
      )
      return toGroupRecord(res.data.data)
    },
    async remove(id: string) {
      await api.delete(`${basePath}/groups/${id}`)
    },
    async toggleStatus(id: string) {
      const res = await api.patch<{ data: GroupApiDto }>(`${basePath}/groups/${id}/toggle-status`)
      return toGroupRecord(res.data.data)
    },
    async getTrash(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<GroupApiDto> }>(`${basePath}/groups/trash`, { params })
      const d = res.data.data
      return { ...d, items: d.items.map(toGroupRecord) }
    },
    async restore(id: string) {
      const res = await api.patch<{ data: GroupApiDto }>(`${basePath}/groups/${id}/restore`)
      return toGroupRecord(res.data.data)
    },
    async permanentDelete(id: string) {
      await api.delete(`${basePath}/groups/${id}/permanent`)
    },
    async reorder(facilityId: string, parentGroupId: string | null, orderedIds: string[]) {
      await api.put(`${basePath}/groups/order`, { facilityId, parentGroupId, orderedIds })
    },
  },

  sessions: {
    async getCalendar(facilityId: string, year: number, month: number) {
      const res = await api.get<{ data: { date: string }[] }>(`${basePath}/sessions/calendar`, {
        params: { facilityId, year, month },
      })
      const counts = new Map<string, number>()
      for (const s of res.data.data) {
        const day = s.date.slice(0, 10)
        counts.set(day, (counts.get(day) ?? 0) + 1)
      }
      return Array.from(counts, ([date, sessionCount]) => ({ date, sessionCount })) satisfies CalendarDay[]
    },
    async getByDay(facilityId: string, date: string) {
      const res = await api.get<{ data: SessionRecord[] }>(`${basePath}/sessions`, {
        params: { facilityId, date },
      })
      return res.data.data
    },
    async generateSessions(groupId: string) {
      const res = await api.post<{ data: { generated: number; skipped: number } }>(`${basePath}/sessions/generate`, { groupId })
      return res.data.data
    },
    async createSession(form: { facilityId: string; groupId: string; date: string; startTime: string; endTime: string }) {
      const res = await api.post<{ data: SessionRecord }>(`${basePath}/sessions`, form)
      return res.data.data
    },
    async cancelSession(id: string, reason?: string) {
      const res = await api.post<{ data: SessionRecord }>(`${basePath}/sessions/${id}/cancel`, { reason })
      return res.data.data
    },
    async reopenSession(id: string) {
      const res = await api.post<{ data: SessionRecord }>(`${basePath}/sessions/${id}/reopen`)
      return res.data.data
    },
    async bulkCancel(req: BulkSessionsScope & { reason?: string }) {
      const res = await api.post<{ data: BulkSessionsResult }>(`${basePath}/sessions/bulk-cancel`, req)
      return res.data.data
    },
    async bulkReopen(req: BulkSessionsScope) {
      const res = await api.post<{ data: BulkSessionsResult }>(`${basePath}/sessions/bulk-reopen`, req)
      return res.data.data
    },
  },

  applications: {
    async getList(params: Record<string, unknown>) {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
      const res = await api.get<{ data: PagedResult<FacilityApplication> }>(`${basePath}/applications`, { params: clean })
      const d = res.data.data
      return { ...d, items: d.items.map((a) => ({ ...a, absenceCount: a.absenceCount ?? 0 })) }
    },
    async approve(id: string, groupId?: string) {
      await api.post(`${basePath}/applications/${id}/approve`, groupId ? { groupId } : {})
    },
    async bulkApprove(ids: string[], preview: boolean) {
      const res = await api.post<{ data: BulkApproveResult }>(`${basePath}/applications/bulk-approve`, { ids, preview })
      return res.data.data
    },
    async reject(id: string) {
      await api.post(`${basePath}/applications/${id}/reject`)
    },
    async remove(id: string) {
      await api.delete(`${basePath}/applications/${id}`)
    },
    async exportExcel(params: Record<string, unknown>) {
      const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
      const res = await api.get(`${basePath}/applications/export`, { params: clean, responseType: 'blob' })
      const fileName = filenameFromContentDisposition(res.headers['content-disposition'] as string | undefined, 'basvurular.xlsx')
      return { blob: res.data as Blob, fileName }
    },
    async getRegistrationId(id: string) {
      const res = await api.get<{ data: { registrationId: string | null } }>(`${basePath}/applications/${id}/registration`)
      return res.data.data.registrationId
    },
    async sendManualMessage(req: import('./types').FacilityManualMessageRequest) {
      const res = await api.post<{ data: import('./types').FacilityManualMessageResult }>(`${basePath}/messages/send`, req)
      return res.data.data
    },
  },

  attendance: {
    async manualCheckIn(facilityId: string, tckn: string) {
      const res = await api.post<{ data: AttendanceResult }>(`${basePath}/attendance/manual`, { facilityId, tckn })
      return res.data.data
    },
    async qrCheckIn(facilityId: string, code: string) {
      const res = await api.post<{ data: AttendanceResult }>(`${basePath}/attendance/qr`, { facilityId, code })
      return res.data.data
    },
    async getRoster(sessionId: string) {
      const res = await api.get<{ data: AttendanceRosterItem[] }>(`${basePath}/attendance/roster`, { params: { sessionId } })
      return res.data.data
    },
    async saveRoster(sessionId: string, marks: AttendanceMark[], confirm = false) {
      const res = await api.post<{ data: SaveAttendanceResult }>(`${basePath}/attendance/save`, { sessionId, marks, confirm })
      return res.data.data
    },
    async correctRoster(sessionId: string, marks: AttendanceMark[], confirm = false) {
      const res = await api.post<{ data: SaveAttendanceResult }>(`${basePath}/attendance/correct`, { sessionId, marks, confirm })
      return res.data.data
    },
    async getHistoryByRegistration(registrationId: string) {
      const res = await api.get<{ data: AttendanceHistoryItem[] }>(`${basePath}/attendance/registrations/${registrationId}/history`)
      return res.data.data
    },
    async reviseByRegistration(registrationId: string, sessionId: string, status: AttendanceStatus, confirm = false) {
      const res = await api.post<{ data: SaveAttendanceResult }>(`${basePath}/attendance/registrations/${registrationId}/revise`, { sessionId, status, confirm })
      return res.data.data
    },
  },

  registrations: {
    async getRoster(groupId: string) {
      const res = await api.get<{ data: RegistrationRecord[] }>(`${basePath}/registrations/roster`, { params: { groupId } })
      return res.data.data
    },
    async getWaitlist(groupId: string) {
      const res = await api.get<{ data: RegistrationRecord[] }>(`${basePath}/registrations/waitlist`, { params: { groupId } })
      return res.data.data
    },
    async promote(id: string) {
      const res = await api.post<{ data: RegistrationRecord }>(`${basePath}/registrations/${id}/promote`)
      return res.data.data
    },
    async demote(id: string) {
      const res = await api.post<{ data: RegistrationRecord }>(`${basePath}/registrations/${id}/demote`)
      return res.data.data
    },
    async reorderWaitlist(groupId: string, orderedIds: string[]) {
      await api.put(`${basePath}/registrations/waitlist/order`, { groupId, orderedIds })
    },
    async remove(id: string, reason?: string) {
      await api.post(`${basePath}/registrations/${id}/remove`, { reason })
    },
    async bulkPreRegister(groupId: string, tckns: string[], membershipDate?: string, target: RegistrationTarget = 'auto') {
      const res = await api.post<{ data: BulkPreRegisterResult }>(`${basePath}/registrations/bulk-pre-register`, { groupId, tckns, membershipDate, target })
      return res.data.data
    },
    async bulkImport(groupId: string, rows: { tckn: string; absenceUsed?: number; consecutiveAbsenceUsed?: number; periodEnd?: string }[], target: RegistrationTarget = 'auto') {
      const res = await api.post<{ data: BulkPreRegisterResult }>(`${basePath}/registrations/bulk-import`, {
        groupId,
        target,
        rows: rows.map((r) => ({ tckn: r.tckn, absenceUsed: r.absenceUsed ?? null, consecutiveAbsenceUsed: r.consecutiveAbsenceUsed ?? null, periodEnd: r.periodEnd || null })),
      })
      return res.data.data
    },
    async exportRoster(groupId: string) {
      const res = await api.get(`${basePath}/registrations/roster/export`, { params: { groupId }, responseType: 'blob' })
      const fileName = filenameFromContentDisposition(res.headers['content-disposition'] as string | undefined, 'katilimci-listesi.xlsx')
      return { blob: res.data as Blob, fileName }
    },
  },

  devices: {
    async getList(facilityId: string) {
      const res = await api.get<{ data: FacilityDevice[] }>(`${basePath}/facilities/${facilityId}/devices`)
      return res.data.data
    },
    async getListByServiceFacility(serviceFacilityId: string) {
      const res = await api.get<{ data: FacilityDevice[] }>(`${basePath}/service-facilities/${serviceFacilityId}/devices`)
      return res.data.data
    },
    async create(facilityId: string, form: FacilityDeviceForm) {
      const res = await api.post<{ data: FacilityDevice }>(`${basePath}/facilities/${facilityId}/devices`, form)
      return res.data.data
    },
    async createGeneral(form: FacilityDeviceForm) {
      const res = await api.post<{ data: FacilityDevice }>(`${basePath}/devices`, form)
      return res.data.data
    },
    async update(id: string, form: FacilityDeviceForm) {
      const res = await api.put<{ data: FacilityDevice }>(`${basePath}/devices/${id}`, form)
      return res.data.data
    },
    async remove(id: string) {
      await api.delete(`${basePath}/devices/${id}`)
    },
    async toggleStatus(id: string) {
      const res = await api.patch<{ data: FacilityDevice }>(`${basePath}/devices/${id}/toggle-status`)
      return res.data.data
    },
    async rotateKey(id: string) {
      const res = await api.post<{ data: FacilityDevice }>(`${basePath}/devices/${id}/rotate-key`)
      return res.data.data
    },
    async testLock(id: string) {
      const res = await api.post<{ data: FacilityDeviceTestResult }>(`${basePath}/devices/${id}/test-lock`)
      return res.data.data
    },
    async open(id: string) {
      const res = await api.post<{ data: FacilityDeviceOpenResult }>(`${basePath}/devices/${id}/open`)
      return res.data.data
    },
  },

  reports: {
    async getSummary(facilityId: string, range: string) {
      const res = await api.get<{ data: ReportSummary }>(`${basePath}/reports/summary`, { params: { facilityId, range } })
      return res.data.data
    },
  },

  settings: {
    async getGeneral() {
      const res = await api.get<{ data: { settings: GeneralSettings } }>(`${basePath}/settings/general`)
      return res.data.data.settings
    },
    async saveGeneral(settings: GeneralSettings) {
      const res = await api.put<{ data: { settings: GeneralSettings } }>(`${basePath}/settings/general`, { settings })
      return res.data.data.settings
    },
    async getForFacility(facilityId: string) {
      const res = await api.get<{ data: FacilityScopeSettings }>(`${basePath}/facilities/${facilityId}/settings`)
      return res.data.data
    },
    async saveForFacility(facilityId: string, scope: FacilityScopeSettings) {
      const res = await api.put<{ data: FacilityScopeSettings }>(`${basePath}/facilities/${facilityId}/settings`, scope)
      return res.data.data
    },
  },

  instructors: {
    async getList(params: Record<string, unknown>) {
      const res = await api.get<{ data: PagedResult<InstructorRecord> }>(`${basePath}/instructors`, { params })
      return res.data.data
    },
    async getOptions() {
      const res = await api.get<{ data: InstructorOption[] }>(`${basePath}/instructors/options`)
      return res.data.data
    },
    async create(form: InstructorForm, channel: InstructorDeliveryChannel) {
      const res = await api.post<{ data: InstructorRecord }>(`${basePath}/instructors`, { ...form, deliveryChannel: channel })
      return res.data.data
    },
    async update(id: string, form: InstructorForm) {
      const res = await api.put<{ data: InstructorRecord }>(`${basePath}/instructors/${id}`, form)
      return res.data.data
    },
    async remove(id: string) {
      await api.delete(`${basePath}/instructors/${id}`)
    },
    async toggleStatus(id: string) {
      const res = await api.patch<{ data: InstructorRecord }>(`${basePath}/instructors/${id}/toggle-status`)
      return res.data.data
    },
  },
})
