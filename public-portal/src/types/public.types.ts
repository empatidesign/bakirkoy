export type EventGender = 'male' | 'female' | 'mixed'
export type VenueType = 'indoor' | 'outdoor'

export interface PublicEventLocation {
  name: string | null
  latitude: number | null
  longitude: number | null
}

export interface PublicEvent {
  id: string
  code: string
  name: string
  categoryName: string
  categoryColor: string | null
  venueType: VenueType
  facilityId: string | null
  facilityName: string | null
  hallId: string | null
  hallName: string | null
  location: PublicEventLocation | null
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  isSingleDay: boolean
  gender: EventGender
  minAge: number
  maxAge: number
  capacity: number
  registeredCount: number
  availableCapacity: number
  registrationOpen: boolean
  isPaid: boolean
  priceInfo: string | null
  sultangaziResidentOnly: boolean
  description: string | null
  primaryImageUrl: string | null
  sessionCount: number
}

export interface PublicEventSession {
  id: string
  date: string
  startTime: string
  endTime: string
  isCancelled: boolean
}

export interface PublicEventCategory {
  id: string
  name: string
  color: string | null
  eventCount: number
}

export interface PublicEventCalendarDay {
  date: string
  events: PublicEvent[]
}

export interface PublicWorkingHours {
  weekdayOpen: string | null
  weekdayClose: string | null
  weekendOpen: string | null
  weekendClose: string | null
}

export interface PublicServiceOffering {
  name: string
  module: string
  description: string | null
}

export interface PublicFacilityImage {
  url: string
  name: string | null
  isPrimary: boolean
}

export interface PublicServiceFacility {
  id: string
  name: string
  type: string
  locationType: string
  outdoorCategory: string | null
  areaSizeM2: number | null
  description: string | null
  about: string | null
  city: string | null
  district: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  emergencyPhone: string | null
  website: string | null
  facebook: string | null
  instagram: string | null
  twitter: string | null
  workingHours: PublicWorkingHours | null
  facilities: string[]
  accessibilityFeatures: string[]
  parkingCapacity: number | null
  parkingType: string | null
  capacity: number | null
  services: PublicServiceOffering[]
  images: PublicFacilityImage[]
  primaryImageUrl: string | null
  updatedAt: string | null
}

export interface PublicFacilityMapPoint {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  district: string | null
  primaryImageUrl: string | null
}

export const GENDER_LABELS: Record<EventGender, string> = {
  male: 'Erkek',
  female: 'Kadın',
  mixed: 'Karma',
}
