export type ResidencyMode = 'sultangazi_only' | 'outside_only' | 'anyone'

export const RESIDENCY_MODE_OPTIONS: { value: ResidencyMode; label: string; description: string }[] = [
  { value: 'sultangazi_only', label: 'Yalnız Bakırköy', description: 'Sadece Bakırköy’de ikamet edenler başvurabilir' },
  { value: 'outside_only', label: 'Yalnız Bakırköy Dışı', description: 'Sadece ilçe dışından başvurulara açık' },
  { value: 'anyone', label: 'Herkes', description: 'İkamet şartı aranmaz' },
]

export const RESIDENCY_MODE_OPTIONS_BINARY: { value: ResidencyMode; label: string; description: string }[] = [
  { value: 'sultangazi_only', label: 'Yalnız Bakırköy', description: 'Sadece Bakırköy’de ikamet edenler başvurabilir' },
  { value: 'anyone', label: 'Herkes', description: 'İkamet şartı aranmaz' },
]

export const RESIDENCY_MODE_LABEL: Record<ResidencyMode, string> = {
  sultangazi_only: 'Yalnız Bakırköy',
  outside_only: 'Yalnız Bakırköy dışı',
  anyone: 'İkamet şartı yok',
}

export const residencyModeTone = (mode: ResidencyMode): 'info' | 'warning' | 'neutral' =>
  mode === 'sultangazi_only' ? 'info' : mode === 'outside_only' ? 'warning' : 'neutral'

export const residencyModeFromFlags = (sultangaziResidentOnly?: boolean, allowOutsideSultangazi?: boolean): ResidencyMode => {
  if (sultangaziResidentOnly) return 'sultangazi_only'
  if (allowOutsideSultangazi) return 'anyone'
  return 'anyone'
}

export type FullResidencyMode = 'anyone' | 'sultangazi_only' | 'outside_only' | 'foreign_only' | 'tc_only' | 'sultangazi_tc' | 'sultangazi_foreign'

export const FULL_RESIDENCY_MODE_OPTIONS: { value: FullResidencyMode; label: string }[] = [
  { value: 'anyone', label: 'Herkes — kısıtlama yok' },
  { value: 'sultangazi_tc', label: "Bakırköy'de ikamet eden T.C. vatandaşları" },
  { value: 'sultangazi_foreign', label: "Bakırköy'de ikamet eden yabancılar" },
  { value: 'tc_only', label: 'T.C. vatandaşları' },
  { value: 'foreign_only', label: 'Yabancılar' },
  { value: 'sultangazi_only', label: "Bakırköy'de ikamet edenler (uyruk fark etmez)" },
  { value: 'outside_only', label: 'Yalnız Bakırköy dışında ikamet edenler' },
]

export const FULL_RESIDENCY_MODE_LABEL: Record<FullResidencyMode, string> = {
  anyone: 'İkamet/uyruk şartı yok',
  sultangazi_tc: "Bakırköy'de ikamet eden T.C. vatandaşları",
  sultangazi_foreign: "Bakırköy'de ikamet eden yabancılar",
  tc_only: 'T.C. vatandaşları',
  foreign_only: 'Yabancılar',
  sultangazi_only: "Bakırköy'de ikamet edenler (uyruk fark etmez)",
  outside_only: 'Yalnız Bakırköy dışında ikamet edenler',
}

export const fullResidencyModeTone = (mode: FullResidencyMode): 'info' | 'warning' | 'neutral' =>
  mode === 'anyone' ? 'neutral' : mode.startsWith('sultangazi') ? 'info' : 'warning'

export const BAKIRKOY_DISTRICT_CODE = '1166'
export const SULTANGAZI_DISTRICT_CODE = BAKIRKOY_DISTRICT_CODE

export interface CitizenAddress {
  fullAddress?: string | null
  city?: string | null
  district?: string | null
  neighborhood?: string | null
  districtCode?: string | null
}

export const isBakirkoyResident = (address?: CitizenAddress | null): boolean => {
  if (!address) return false
  if (address.districtCode) return address.districtCode === BAKIRKOY_DISTRICT_CODE || address.districtCode === '2055'
  const haystack = `${address.district ?? ''} ${address.fullAddress ?? ''}`.toLocaleLowerCase('tr-TR')
  return haystack.includes('bakırköy') || haystack.includes('bakirkoy')
}

export const isSultangaziResident = isBakirkoyResident

export const hasAnyAddress = (address?: CitizenAddress | null): boolean =>
  !!address && !!(address.fullAddress || address.city || address.district || address.neighborhood)

export const formatAddressLine = (address?: CitizenAddress | null): string => {
  if (!address) return ''
  if (address.fullAddress) return address.fullAddress
  return [address.neighborhood, address.district, address.city].filter(Boolean).join(' · ')
}
