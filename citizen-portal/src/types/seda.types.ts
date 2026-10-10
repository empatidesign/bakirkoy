export type SedaApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface SedaOptionDto {
  value: string
  label: string
}

export interface SedaPeriodDto {
  id: string
  name: string
  startDate: string
  endDate: string
  maxApplications: number
  currentApplications: number
  description?: string
  isActive: boolean
}

export interface CitizenSedaInfoDto {
  applicationsOpen: boolean
  requireApproval: boolean
  activePeriod?: SedaPeriodDto
}

export interface CitizenSedaResultDto {
  hasActivePeriod: boolean
  periodName?: string | null
  isWinner: boolean
  score?: number | null
  resultNote?: string | null
}

// Kullanıcı isteği (2026-08-12): "her eğitim öğretim yılı için gerekli olacak" — vatandaş sadece
// aktif dönemin değil, kendi adına kayıtlı TÜM yılların sonucunu görebilsin.
export interface CitizenSedaResultItemDto {
  academicYear: string
  periodName?: string | null
  isWinner: boolean
  score?: number | null
  rank?: number | null
  resultNote?: string | null
  detailsJson: string
  matchedBy: string
}

export interface CitizenSedaOptionsDto {
  schools: SedaOptionDto[]
  educationTypes: SedaOptionDto[]
  grades: SedaOptionDto[]
  examCenters: SedaOptionDto[]
}

export interface SedaApplicationDto {
  id: string
  code: string
  studentName: string
  studentSurname: string
  tckn: string
  birthDate?: string
  schoolName: string
  nextYearGrade: string
  educationType: string
  examCenterName: string
  studentPhone?: string
  parentPhone: string
  address: string
  status: SedaApplicationStatus
  notes?: string
  rejectionReason?: string
  createdAt: string
  appliedBy?: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface CitizenSedaApplyRequest {
  schoolName: string
  nextYearGrade: string
  educationType: string
  examCenterName: string
  notes?: string
}

export const SEDA_STATUS_LABELS: Record<SedaApplicationStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

export const SEDA_STATUS_TONE: Record<SedaApplicationStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}
