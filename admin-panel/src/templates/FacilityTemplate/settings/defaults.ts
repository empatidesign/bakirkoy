import type {
  GeneralSettings, ScopedSettings,
  DocumentCategory, DocumentVerification,
} from '@/types/facility.types'
import type { FacilityModuleId } from '../moduleConfig'
import { getDefaultDocuments } from './documentSets'

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  qrTurnstileEnabled: true,
  autoCheckoutMinutes: 0,
  waitlistEnabled: true,
  waitlistAutoPromote: true,
  waitlistConfirmHours: 6,
  requiredDocuments: [
    { id: 'health', label: 'Sağlık Raporu', category: 'health', verification: 'manual', required: true },
    { id: 'residence', label: 'İkametgâh Belgesi', category: 'residence', verification: 'mernis', required: true },
  ],
  attendanceLimitType: 'unlimited',
  attendanceLimitCount: 0,
  attendanceLimitResetDay: 1,
  notificationTemplates: [],
  participationClasses: [],
  sessionReminderEnabled: true,
  sessionReminderHoursBefore: 24,
  sessionReminderEmailEnabled: false,
  attendanceSmsEnabled: false,
  attendanceEnabled: true,
  crossFacilitySameBranchBlocked: false,
  crossFacilityYearlyMaxApplications: 0,
  defaultAbsenceLimit: 5,
  defaultConsecutiveAbsenceLimit: 3,
}

export const DEFAULT_SCOPED_SETTINGS: ScopedSettings = {
  yearlyEnabled: false,
  yearlyStartDate: '',
  yearlyEndDate: '',
  yearlyMaxApplications: 0,
  yearlyMinAge: 0,
  yearlyMaxAge: 99,
}

export const getDefaultGeneralSettings = (id: FacilityModuleId): GeneralSettings => ({
  ...DEFAULT_GENERAL_SETTINGS,
  requiredDocuments: getDefaultDocuments(id),
})

export const DOCUMENT_CATEGORY_META: Record<DocumentCategory, { label: string; tone: 'info' | 'danger' | 'success' | 'primary' | 'warning' | 'neutral' }> = {
  identity: { label: 'Kimlik', tone: 'info' },
  health: { label: 'Sağlık', tone: 'danger' },
  residence: { label: 'İkamet', tone: 'success' },
  education: { label: 'Eğitim', tone: 'primary' },
  permission: { label: 'İzin', tone: 'warning' },
  other: { label: 'Diğer', tone: 'neutral' },
}

export const DOCUMENT_VERIFICATION_META: Record<DocumentVerification, string> = {
  manual: 'Manuel İnceleme',
  mernis: 'MERNİS Otomatik',
  system: 'Sistem Otomatik',
}
