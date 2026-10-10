import type { PagedResult } from '@/types/common'
import type {
  FacilityRecord, BranchRecord, GroupRecord, SessionRecord,
  FacilityApplication, CalendarDay, FacilitySummary,
  FacilityForm, BranchForm, GroupForm, AttendanceResult, FacilityDevice, FacilityDeviceForm, FacilityDeviceTestResult, FacilityDeviceOpenResult, ReportSummary,
  GeneralSettings, FacilityScopeSettings, AttendanceRosterItem, AttendanceMark, SaveAttendanceResult, AttendanceHistoryItem, AttendanceStatus,
  RegistrationRecord, InstructorRecord, InstructorOption, InstructorForm, InstructorDeliveryChannel,
  BulkSessionsScope, BulkSessionsResult, BulkPreRegisterResult, RegistrationTarget, FacilityStaticQr, FacilityStaticQrMode, CopyGroupResult, CopyGroupOptions,
} from '@/types/facility.types'

export interface BulkApproveResult {
  approved: number
  waitlisted: number
  rejected: number
  skipped: number
}

// Kullanıcı isteği (2026-08-11): gezi modülündeki şablon-bazlı toplu mesaj gönderme sistemiyle
// aynı desen — bkz. TravelManualMessageResult.
export interface FacilityManualMessageResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode?: boolean
}

export interface FacilityManualMessageRequest {
  module: string
  target: 'group' | 'application' | 'registration' | 'instructor' | 'facility'
  ids: string[]
  templateEvent: string
  customText: string | null
  sms: boolean
  notify: boolean
  statusFilter?: string[]
  // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS göndermek için
  // doğrulama kodu (OTP) zorunlu. PIN yöntemi kaldırıldı.
  smsOtp?: string
}

export interface FacilityModuleService {
  facilities: {
    getList: (params: Record<string, unknown>) => Promise<PagedResult<FacilityRecord>>
    getOptions: () => Promise<FacilityRecord[]>
    getSummary: () => Promise<FacilitySummary>
    create: (form: FacilityForm) => Promise<FacilityRecord>
    update: (id: string, form: FacilityForm) => Promise<FacilityRecord>
    remove: (id: string) => Promise<void>
    toggleStatus: (id: string) => Promise<FacilityRecord>
    getStaticQr: (id: string) => Promise<FacilityStaticQr>
    toggleStaticQr: (id: string, enabled: boolean) => Promise<FacilityStaticQr>
    setStaticQrMode: (id: string, mode: FacilityStaticQrMode) => Promise<FacilityStaticQr>
    setStaticQrTiming: (id: string, minExitSeconds: number, reentryCooldownSeconds: number) => Promise<FacilityStaticQr>
    rotateStaticQr: (id: string) => Promise<FacilityStaticQr>
    getTrash: (params: Record<string, unknown>) => Promise<PagedResult<FacilityRecord>>
    restore: (id: string) => Promise<FacilityRecord>
    permanentDelete: (id: string) => Promise<void>
    // Kullanıcı isteği (2026-10-05): tesisler manuel sürükle-bırak ile sıralanabilsin —
    // reorderWaitlist (registrations) ile aynı desen.
    reorder: (orderedIds: string[]) => Promise<void>
  }
  branches: {
    getList: (params: Record<string, unknown>) => Promise<PagedResult<BranchRecord>>
    // Denetim bulgusu (2026-09-05): Bu uç, backend'in tam listesini (sayfalama YOK) döndürür —
    // FacilityGroupsTab'in "Yeni Grup" formundaki branş dropdown'ı için kritik. getList kullanılırsa
    // backend Repository.PaginateAsync limiti sessizce 100'e kırptığı için (bkz. api Repository.cs),
    // 100'den fazla branşı olan bir modülde 100. sıradan sonraki hiçbir branş (yeni eklenenler dahil)
    // formda seçilemez hale gelirdi — canlı testte ZZTEST-UI branşı (109. kayıt) ile doğrulandı.
    // Backend yalnızca aktif branşları döndürür (FacilityBranchOptionDto: id/name/periodMonths/
    // absenceLimit/consecutiveAbsenceLimit) — BranchRecord'un isActive/createdAt alanları yok,
    // bu yüzden Pick ile daraltılmış tip kullanılıyor.
    getOptions: () => Promise<Pick<BranchRecord, 'id' | 'name' | 'periodMonths' | 'absenceLimit' | 'consecutiveAbsenceLimit'>[]>
    create: (form: BranchForm) => Promise<BranchRecord>
    update: (id: string, form: BranchForm) => Promise<BranchRecord>
    remove: (id: string) => Promise<void>
    toggleStatus: (id: string) => Promise<BranchRecord>
    getTrash: (params: Record<string, unknown>) => Promise<PagedResult<BranchRecord>>
    restore: (id: string) => Promise<BranchRecord>
    permanentDelete: (id: string) => Promise<void>
    bulkUpdateCategory?: (ids: string[], category: string) => Promise<{ updatedCount: number }>
  }
  groups: {
    getList: (params: Record<string, unknown>) => Promise<PagedResult<GroupRecord>>
    getById: (id: string) => Promise<GroupRecord>
    create: (form: GroupForm) => Promise<GroupRecord>
    createSubGroup: (parentGroupId: string, form: GroupForm) => Promise<GroupRecord>
    copyToFacilities: (id: string, targetFacilityIds: string[], options?: CopyGroupOptions) => Promise<CopyGroupResult>
    update: (id: string, form: GroupForm, confirmAttendanceDeletion?: boolean) => Promise<GroupRecord>
    remove: (id: string) => Promise<void>
    toggleStatus: (id: string) => Promise<GroupRecord>
    getTrash: (params: Record<string, unknown>) => Promise<PagedResult<GroupRecord>>
    restore: (id: string) => Promise<GroupRecord>
    permanentDelete: (id: string) => Promise<void>
    // Kullanıcı isteği (2026-10-05): grup/seans manuel sürükle-bırak sıralama. parentGroupId
    // null ise ana gruplar, doluysa o grubun seansları (bağımsız sıralama alanı) kapsamındadır.
    reorder: (facilityId: string, parentGroupId: string | null, orderedIds: string[]) => Promise<void>
  }
  sessions: {
    getCalendar: (facilityId: string, year: number, month: number) => Promise<CalendarDay[]>
    getByDay: (facilityId: string, date: string) => Promise<SessionRecord[]>
    generateSessions: (groupId: string) => Promise<{ generated: number; skipped: number }>
    createSession?: (form: { facilityId: string; groupId: string; date: string; startTime: string; endTime: string }) => Promise<SessionRecord>
    cancelSession: (id: string, reason?: string) => Promise<SessionRecord>
    reopenSession: (id: string) => Promise<SessionRecord>
    bulkCancel: (req: BulkSessionsScope & { reason?: string }) => Promise<BulkSessionsResult>
    bulkReopen: (req: BulkSessionsScope) => Promise<BulkSessionsResult>
  }
  applications: {
    getList: (params: Record<string, unknown>) => Promise<PagedResult<FacilityApplication>>
    approve: (id: string, groupId?: string) => Promise<void>
    bulkApprove: (ids: string[], preview: boolean) => Promise<BulkApproveResult>
    reject: (id: string) => Promise<void>
    remove: (id: string) => Promise<void>
    exportExcel: (params: Record<string, unknown>) => Promise<{ blob: Blob; fileName: string }>
    getRegistrationId: (id: string) => Promise<string | null>
    sendManualMessage: (req: FacilityManualMessageRequest) => Promise<FacilityManualMessageResult>
  }
  attendance: {
    manualCheckIn: (facilityId: string, tckn: string) => Promise<AttendanceResult>
    qrCheckIn: (facilityId: string, code: string) => Promise<AttendanceResult>
    getRoster: (sessionId: string) => Promise<AttendanceRosterItem[]>
    saveRoster: (sessionId: string, marks: AttendanceMark[], confirm?: boolean) => Promise<SaveAttendanceResult>
    correctRoster: (sessionId: string, marks: AttendanceMark[], confirm?: boolean) => Promise<SaveAttendanceResult>
    getHistoryByRegistration: (registrationId: string) => Promise<AttendanceHistoryItem[]>
    reviseByRegistration: (registrationId: string, sessionId: string, status: AttendanceStatus, confirm?: boolean) => Promise<SaveAttendanceResult>
  }
  registrations: {
    getRoster: (groupId: string) => Promise<RegistrationRecord[]>
    getWaitlist: (groupId: string) => Promise<RegistrationRecord[]>
    promote: (id: string) => Promise<RegistrationRecord>
    demote: (id: string) => Promise<RegistrationRecord>
    remove: (id: string, reason?: string) => Promise<void>
    reorderWaitlist: (groupId: string, orderedIds: string[]) => Promise<void>
    bulkPreRegister: (groupId: string, tckns: string[], membershipDate?: string, target?: RegistrationTarget) => Promise<BulkPreRegisterResult>
    bulkImport: (groupId: string, rows: { tckn: string; absenceUsed?: number; consecutiveAbsenceUsed?: number; periodEnd?: string }[], target?: RegistrationTarget) => Promise<BulkPreRegisterResult>
    exportRoster: (groupId: string) => Promise<{ blob: Blob; fileName: string }>
  }
  devices: {
    getList: (facilityId: string) => Promise<FacilityDevice[]>
    getListByServiceFacility: (serviceFacilityId: string) => Promise<FacilityDevice[]>
    create: (facilityId: string, form: FacilityDeviceForm) => Promise<FacilityDevice>
    createGeneral: (form: FacilityDeviceForm) => Promise<FacilityDevice>
    update: (id: string, form: FacilityDeviceForm) => Promise<FacilityDevice>
    remove: (id: string) => Promise<void>
    toggleStatus: (id: string) => Promise<FacilityDevice>
    rotateKey: (id: string) => Promise<FacilityDevice>
    testLock: (id: string) => Promise<FacilityDeviceTestResult>
    open: (id: string) => Promise<FacilityDeviceOpenResult>
  }
  reports: {
    getSummary: (facilityId: string, range: string) => Promise<ReportSummary>
  }
  settings: {
    getGeneral: () => Promise<GeneralSettings>
    saveGeneral: (settings: GeneralSettings) => Promise<GeneralSettings>
    getForFacility: (facilityId: string) => Promise<FacilityScopeSettings>
    saveForFacility: (facilityId: string, scope: FacilityScopeSettings) => Promise<FacilityScopeSettings>
  }
  instructors: {
    getList: (params: Record<string, unknown>) => Promise<PagedResult<InstructorRecord>>
    getOptions: () => Promise<InstructorOption[]>
    create: (form: InstructorForm, channel: InstructorDeliveryChannel) => Promise<InstructorRecord>
    update: (id: string, form: InstructorForm) => Promise<InstructorRecord>
    remove: (id: string) => Promise<void>
    toggleStatus: (id: string) => Promise<InstructorRecord>
  }
  serviceFacilities?: {
    getList: (params: Record<string, unknown>) => Promise<PagedResult<{ id: string; name: string }>>
  }
}
