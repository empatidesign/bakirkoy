import type { SelectOption } from '@/types/common'
import type { SedaApplication, SedaApplicationForm, SedaPeriod, SedaPeriodForm } from '@/types/seda.types'

export const todayIso = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export const emptySedaApplicationForm = (): SedaApplicationForm => ({
  studentName: '',
  studentSurname: '',
  tckn: '',
  birthDate: '',
  schoolName: '',
  nextYearGrade: '',
  educationType: '',
  examCenterName: '',
  studentPhone: '',
  parentPhone: '',
  address: '',
  status: 'pending',
  notes: '',
})

export const sedaApplicationToForm = (r: SedaApplication): SedaApplicationForm => ({
  studentName: r.studentName,
  studentSurname: r.studentSurname,
  tckn: r.tckn,
  birthDate: r.birthDate ?? '',
  schoolName: r.schoolName,
  nextYearGrade: r.nextYearGrade,
  educationType: r.educationType,
  examCenterName: r.examCenterName,
  studentPhone: r.studentPhone,
  parentPhone: r.parentPhone,
  address: r.address,
  status: r.status,
  notes: r.notes ?? '',
})

export const emptySedaPeriodForm = (): SedaPeriodForm => ({
  name: '',
  startDate: '',
  endDate: '',
  maxApplications: 500,
  description: '',
})

export const sedaPeriodToForm = (r: SedaPeriod): SedaPeriodForm => ({
  name: r.name,
  startDate: r.startDate,
  endDate: r.endDate,
  maxApplications: r.maxApplications,
  description: r.description ?? '',
})

export const SEDA_GRADE_FALLBACK_OPTIONS: SelectOption[] = ['5', '6', '7', '8', '9', '10', '11', '12'].map((g) => ({
  value: g,
  label: `${g}. Sınıf`,
}))

export const SEDA_EDUCATION_TYPE_FALLBACK_OPTIONS: SelectOption[] = [
  { value: 'Deneme Kulübü', label: 'Deneme Kulübü' },
  { value: 'Örgün Öğretim', label: 'Örgün Öğretim' },
]
