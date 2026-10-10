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
