import { toast } from 'sonner'
import { todayIso } from '@/lib/utils'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { GroupForm, GroupRecord, FeeType, AttendanceLimitType } from '@/types/facility.types'

export const makeEmptyGroupForm = (
  config: FacilityModuleConfig,
  facilityId: string,
  overrides?: Partial<GroupForm>,
): GroupForm => ({
  facilityId, name: '', branchId: '', parentGroupId: '', instructorId: '', type: 'kurs', gender: config.defaultGender,
  capacity: '', reserveCapacity: '', ageMin: String(config.defaultAgeRange.min), ageMax: String(config.defaultAgeRange.max),
  days: [], schedules: [], attendanceMode: 'full', lateTrackingEnabled: true, description: '',
  isPaid: false, feeType: 'monthly', feeAmount: '', siblingDiscount: false, staffDiscount: false,
  documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: true, residencyMode: 'sultangazi_only',
  requirements: '', applicationConditions: '', aboutHtml: '',
  autoApprove: true,
  periodStart: '', periodEnd: '', periodMonths: '', periodType: 'date_range', periodCount: '', periodUnit: 'month', periodDays: '',
  applicationStartDate: '', applicationEndDate: '', academyWhitelistEnabled: false,
  absenceLimit: '5', consecutiveAbsenceLimit: '3', entryGraceMinutes: '15',
  isActive: true,
  attendanceLimitOverride: false, attendanceLimitType: 'monthly', attendanceLimitCount: '',
  prerequisiteGroupId: '', customQuestions: [],
  ...overrides,
})

export const groupRecordToForm = (r: GroupRecord, emptyForm: GroupForm): GroupForm => {
  const rawMode = r.residencyMode ?? 'sultangazi_only'
  const normalizedMode = (String(rawMode) === 'district_only' || !rawMode || rawMode === 'anyone') ? 'sultangazi_only' : rawMode
  return {
    ...emptyForm,
    facilityId: r.facilityId, name: r.name, branchId: r.branchId, parentGroupId: r.parentGroupId ?? '',
    instructorId: r.instructorId ?? '', type: r.type, gender: r.gender,
    capacity: String(r.capacity), reserveCapacity: String(r.reserveCapacity),
    ageMin: String(r.ageMin), ageMax: String(r.ageMax),
    days: r.days, schedules: r.schedules, attendanceMode: r.attendanceMode,
    lateTrackingEnabled: r.lateTrackingEnabled ?? true,
    description: r.description ?? '',
    documentsRequired: r.documentsRequired ?? false,
    requiredDocumentIds: r.requiredDocumentIds ?? [],
    documentFormats: r.documentFormats ?? {},
    residenceRequired: r.residenceRequired ?? true,
    residencyMode: (normalizedMode as GroupForm['residencyMode']) || 'sultangazi_only',
  requirements: r.requirements ?? '',
  applicationConditions: r.applicationConditions ?? '',
  aboutHtml: r.aboutHtml ?? '',
  autoApprove: r.autoApprove ?? true,
  periodStart: r.periodStart ?? '',
  periodEnd: r.periodEnd ?? '',
  periodMonths: r.periodMonths != null ? String(r.periodMonths) : '',
  periodType: (r.periodType as 'date_range' | 'recurring') ?? 'date_range',
  periodCount: r.periodCount != null ? String(r.periodCount) : '',
  periodUnit: (r.periodUnit as 'month' | 'day') ?? 'month',
  periodDays: r.periodDays != null ? String(r.periodDays) : '',
  applicationStartDate: r.applicationStartDate ?? '',
  applicationEndDate: r.applicationEndDate ?? '',
  academyWhitelistEnabled: r.academyWhitelistEnabled ?? false,
  absenceLimit: r.absenceLimit != null ? String(r.absenceLimit) : '',
  consecutiveAbsenceLimit: r.consecutiveAbsenceLimit != null ? String(r.consecutiveAbsenceLimit) : '',
  entryGraceMinutes: r.entryGraceMinutes != null ? String(r.entryGraceMinutes) : '15',
  isPaid: r.isPaid ?? false,
  feeType: (r.feeType as FeeType) ?? 'monthly',
  feeAmount: r.feeAmount != null ? String(r.feeAmount) : '',
  siblingDiscount: r.siblingDiscount ?? false,
  staffDiscount: r.staffDiscount ?? false,
  attendanceLimitOverride: r.attendanceLimitOverride ?? false,
  attendanceLimitType: (r.attendanceLimitType as AttendanceLimitType) ?? 'monthly',
  attendanceLimitCount: r.attendanceLimitCount != null ? String(r.attendanceLimitCount) : '',
  isActive: r.isActive,
  prerequisiteGroupId: r.prerequisiteGroupId ?? '',
  customQuestions: r.customQuestions ?? [],
  }
}

export const isGroupPeriodValid = (f: GroupForm): boolean => {
  if (f.periodType === 'recurring') return !!f.periodStart && Number(f.periodMonths) >= 1
  if (f.periodUnit === 'day') return !!f.periodStart && Number(f.periodDays) >= 1
  return true
}

export const getGroupFormErrors = (f: GroupForm, mode: 'create' | 'edit', groupLabel: string, facilityCapacity?: number): string[] => {
  const errors: string[] = []
  if (!f.name.trim()) errors.push(`${groupLabel} adı zorunludur.`)
  if (!f.branchId) errors.push('Branş/program seçimi zorunludur.')
  if (f.isActive && (mode === 'create' || !!f.parentGroupId || Number(f.capacity) > 0)
    && (!Number.isInteger(Number(f.capacity)) || Number(f.capacity) <= 0))
    errors.push('Aktif grubun kontenjanı 0’dan büyük bir tam sayı olmalıdır.')
  if (facilityCapacity && f.capacity && Number(f.capacity) > facilityCapacity)
    errors.push(`Kontenjan, tesis kapasitesini (${facilityCapacity}) aşamaz.`)
  // Kullanıcı isteği (2026-10-02): yaş aralığı tüm modüllerde zorunlu — tesis kapasitesi
  // (facilityCapacity, bkz. FacilityFormDrawer) ayrı bir kavram ve opsiyonel kalmaya devam
  // eder. Yaş alanları yalnızca gerçek kontenjan/program alanlarının göründüğü durumda
  // (showSessionSettings — GroupFormFields ile birebir aynı koşul) zorunludur; henüz
  // seans ayarları girilmemiş "Ana Grup" oluşturma adımında bu alanlar hiç gösterilmez.
  const hasSessionData = mode === 'edit' && (
    Number(f.capacity) > 0 || f.schedules.length > 0 || !!f.periodStart || !!f.periodEnd
  )
  const isParentMode = !f.parentGroupId && !hasSessionData
  const showAgeFields = mode === 'create' || !isParentMode
  if (showAgeFields) {
    if (f.ageMin.trim() === '') errors.push('Yaş (En Az) zorunludur.')
    if (f.ageMax.trim() === '') errors.push('Yaş (En Çok) zorunludur.')
  }
  if (mode === 'create' && f.periodStart && f.periodStart < todayIso())
    errors.push('Başlangıç tarihi bugünden önce olamaz.')
  if (!isGroupPeriodValid(f)) {
    if (f.periodType === 'recurring') errors.push('Tekrarlanan dönem için başlangıç tarihi ve dönem (ay) sayısı zorunludur.')
    else errors.push('Başlangıç tarihi ve dönem gün sayısı zorunludur.')
  }
  if (f.documentsRequired && f.requiredDocumentIds.length === 0)
    errors.push('En az bir zorunlu evrak seçilmelidir.')
  if (f.customQuestions.some((q) => !q.question.trim()))
    errors.push('Boş özel soru bırakılamaz — soru metnini girin veya satırı kaldırın.')
  return errors
}

export const saveGroupUpdate = async (service: FacilityModuleService, id: string, f: GroupForm) => {
  try {
    const updated = await service.groups.update(id, f)
    toast.success('Değişiklikler kaydedildi.')
    const sync = updated.scheduleSync
    if (sync && sync.protectedApplicationSessions > 0) {
      toast.warning(
        `${sync.protectedApplicationSessions} seans, grupta aktif başvuru/kayıt bulunduğu için ` +
        `yeni programa uymamasına rağmen otomatik silinmedi ve takvimde görünmeye devam edecek. ` +
        `Bu seansları elle iptal etmeniz veya kayıtları yönettikten sonra tekrar düzenlemeniz gerekebilir.`,
        { duration: 8000 },
      )
    }
    if (sync && sync.removedEmptySessions > 0) {
      toast.info(`${sync.removedEmptySessions} seans yeni programa uymadığı için otomatik kaldırıldı.`)
    }
  } catch (e) {
    const code = (e as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode
    const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    if (code === 'SCHEDULE_SYNC_ATTENDANCE_CONFIRM') {
      const ok = window.confirm(message ?? 'Bu seanslarda yoklama kayıtları bulunmaktadır. Seans değişikliğinin uygulanabilmesi için mevcut yoklama kayıtlarının silinmesi gerekiyor. Yoklama kayıtlarını silmek istiyor musunuz?')
      if (ok) {
        const updated = await service.groups.update(id, f, true)
        toast.success('Değişiklikler kaydedildi, ilgili seansların yoklama kayıtları silindi.')
        const sync = updated.scheduleSync
        if (sync && sync.protectedApplicationSessions > 0) {
          toast.warning(
            `${sync.protectedApplicationSessions} seans, grupta aktif başvuru/kayıt bulunduğu için ` +
            `yeni programa uymamasına rağmen otomatik silinmedi ve takvimde görünmeye devam edecek.`,
            { duration: 8000 },
          )
        }
        return
      }
      return
    }
    throw e
  }
}
