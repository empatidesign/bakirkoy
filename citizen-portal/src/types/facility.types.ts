export type CitizenFacilityStatus = 'pending' | 'approved' | 'waitlist' | 'rejected'

export interface CitizenFacilityGroup {
  id: string
  module: string
  moduleLabel: string
  facilityName: string
  branchName: string
  name: string
  type: string
  gender: string
  ageMin: number
  ageMax: number
  capacity: number
  registeredCount: number
  reserveCapacity: number
  waitlistCount: number
  periodStart?: string | null
  periodEnd?: string | null
  scheduleSummary: string
  feeText?: string | null
  instructorName?: string | null
  serviceFacilityName?: string | null
  serviceFacilityAddress?: string | null
  serviceFacilityLatitude?: number | null
  serviceFacilityLongitude?: number | null
  hasParking?: boolean
  parkingCapacity?: number | null
  parkingType?: 'Free' | 'Paid' | 'Limited' | null
  eligible: boolean
  alreadyApplied: boolean
  // Başvuru tarih penceresi backend'de zorunlu (ParticipantFacilityService.ApplyAsync).
  // Bu alanlar olmadan UI pencereyi bilemiyordu ve kapalı programda da "Başvur"
  // gösteriyordu; kullanıcı ancak butona bastıktan sonra 409 hatasını görüyordu.
  applicationOpen?: boolean
  applicationClosedReason?: string | null
  applicationStartDate?: string | null
  applicationEndDate?: string | null
}

export interface CitizenFacilityBranch {
  branchName: string
  count: number
  eligibleCount: number
}

export interface CitizenFacilityFacilityOption {
  id: string
  name: string
  count: number
}

export interface CitizenFacilityGenderOption {
  value: string
  label: string
  count: number
}

export interface CitizenFacilityAgeGroupOption {
  ageMin: number
  ageMax: number
  label: string
  count: number
}

export interface CitizenFacilityFilters {
  facilities: CitizenFacilityFacilityOption[]
  branches: CitizenFacilityBranch[]
  genders: CitizenFacilityGenderOption[]
  ageGroups: CitizenFacilityAgeGroupOption[]
  availableCount: number
  totalCount: number
  withParkingCount: number
}

export interface CitizenFacilityDiscoverResult {
  items: CitizenFacilityGroup[]
  total: number
  page: number
  limit: number
  eligibleCount: number
  totalCount: number
}

export interface CitizenFacilitySession {
  id: string
  date: string
  day: string
  startTime: string
  endTime: string
  isCancelled: boolean
}

export interface CitizenFacilityApplicant {
  participantId: string
  fullName: string
  isSelf: boolean
  age: number
  gender: string
  eligible: boolean
  ineligibleReason?: string | null
  alreadyApplied: boolean
}

export interface CitizenFacilityDocumentType {
  key: string
  label: string
  required: boolean
  allowedFormats?: string[]
}

export interface CitizenFacilityApplyDocument {
  type: string
  objectName: string
  fileName: string
  label?: string
}

export interface CitizenFacilityGroupDetail extends CitizenFacilityGroup {
  descriptionHtml?: string | null
  conditions?: string | null
  sessions: CitizenFacilitySession[]
  applicants: CitizenFacilityApplicant[]
  documentsRequired: boolean
  documentsMessage?: string | null
  requiredDocuments: CitizenFacilityDocumentType[]
  participationLimitText?: string | null
  requirements?: string | null
  applicationConditions?: string | null
  aboutHtml?: string | null
  imageUrl?: string | null
  // Kullanıcı isteği (2026-10-04): önkoşul kurs ("Arapça Seviye 2" yalnızca "Arapça Seviye 1"i
  // tamamlamış kişilere açık) + grup bazında özel evet/hayır soruları (örn. Havuz'da "Yüzme
  // biliyor musunuz?").
  prerequisiteGroupId?: string | null
  prerequisiteGroupName?: string | null
  prerequisiteMet?: boolean
  customQuestions?: CitizenFacilityCustomQuestion[]
}

export interface CitizenFacilityCustomQuestion {
  id: string
  question: string
  required: boolean
}

export interface CitizenFacilityApplicationDocument {
  type: string
  fileName: string
  label?: string | null
}

export interface CitizenFacilityApplication {
  id: string
  module: string
  moduleLabel: string
  groupId?: string | null
  groupName: string
  branchName: string
  facilityName: string
  status: CitizenFacilityStatus
  canCancel: boolean
  periodStart?: string | null
  periodEnd?: string | null
  scheduleSummary: string
  personId?: string | null
  personName: string
  isSelf: boolean
  appliedAt: string
  instructorName?: string | null
  serviceFacilityName?: string | null
  serviceFacilityAddress?: string | null
  serviceFacilityLatitude?: number | null
  serviceFacilityLongitude?: number | null
  hasParking?: boolean
  parkingCapacity?: number | null
  parkingType?: 'Free' | 'Paid' | 'Limited' | null
  documents?: CitizenFacilityApplicationDocument[] | null
}

export const FACILITY_STATUS_LABELS: Record<CitizenFacilityStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  waitlist: 'Yedek Liste',
  rejected: 'Reddedildi',
}

export const FACILITY_STATUS_TONE: Record<CitizenFacilityStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  waitlist: 'warning',
  rejected: 'danger',
}

export const GENDER_LABEL: Record<string, string> = {
  male: 'Erkek',
  female: 'Kadın',
  mixed: 'Karma',
}
