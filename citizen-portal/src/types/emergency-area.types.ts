export interface CitizenEmergencyArea {
  id: string
  name: string
  neighborhood: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  capacity: number
  areaSizeM2: number
  emergencyPhone: string | null
  toilet: boolean
  water: boolean
  electricity: boolean
  generator: boolean
  heating: boolean
  tentArea: boolean
}
