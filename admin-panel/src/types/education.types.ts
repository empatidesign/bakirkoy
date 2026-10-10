export type InstitutionType = 'Ilkokul' | 'Ortaokul' | 'Lise' | 'Universite' | 'MeslekYuksekokulu' | 'Diger'
export type EducationLevel = 'Ilkokul' | 'Ortaokul' | 'Lise' | 'Onlisans' | 'Lisans' | 'YuksekLisans' | 'Doktora'
export type DegreeLevel = 'Onlisans' | 'Lisans' | 'YuksekLisans' | 'Doktora'

export interface EducationInstitution {
  id: string
  type: InstitutionType
  typeLabel: string
  name: string
  faculty: string | null
  department: string | null
  degreeLevel: DegreeLevel | null
  degreeLevelLabel: string | null
  isActive: boolean
  createdAt: string
}

export interface EducationInstitutionOption {
  id: string
  name: string
  faculty: string | null
  department: string | null
  type: InstitutionType
  typeLabel: string
}

export interface EducationHistory {
  id: string
  participantId: string
  institutionId: string | null
  institutionName: string | null
  faculty: string | null
  department: string | null
  level: EducationLevel
  levelLabel: string
  startYear: number
  endYear: number | null
  isGraduated: boolean
  createdAt: string
}

export interface EducationInstitutionForm {
  type: InstitutionType | ''
  name: string
  faculty: string
  department: string
  degreeLevel: DegreeLevel | ''
}

export interface EducationHistoryForm {
  institutionId: string
  level: EducationLevel | ''
  startYear: string
  endYear: string
  isGraduated: boolean
}
