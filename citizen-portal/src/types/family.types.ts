import type { Gender, CitizenStatus } from './auth.types'

export interface CitizenChild {
  id: string
  fullName: string
  tckn: string
  birthDate: string
  age: number
  gender: Gender
  isMinor: boolean
  status: CitizenStatus
  photoUrl?: string
}

export interface CitizenFamilyNviChild {
  tckn: string
  fullName: string
  birthDate: string
  gender: string
  address: string | null
  alreadyAdded: boolean
}

export interface CitizenFamilyNviPreview {
  tckn: string
  fullName: string
  children: CitizenFamilyNviChild[]
}

export interface CitizenFamilyConfirmResult {
  totalFound: number
  newlyAdded: number
  alreadyExisted: number
  children: CitizenChild[]
}

