export interface DutyPharmacy {
  id: string
  name: string
  phone: string | null
  directions: string | null
  address: string | null
  neighborhood: string | null
  district: string
  latitude: number | null
  longitude: number | null
  dutyEndTime: string | null
  dutyDate: string
  syncedAt: string
}

export interface DutyPharmacySyncStatus {
  lastSyncedAt: string | null
  lastDutyDate: string | null
  latestCount: number
  isStale: boolean
}
