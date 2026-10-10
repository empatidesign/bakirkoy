import { api } from './api'

export type LiveMapPointType = 'EmergencyArea' | 'Facility' | 'Event' | 'Library'

export interface LiveMapPoint {
  id: string
  type: LiveMapPointType
  title: string
  subtitle: string | null
  latitude: number
  longitude: number
  categoryColor: string | null
  when: string | null
  detailRoute: string | null
  hasParking?: boolean
  parkingCapacity?: number | null
  parkingType?: 'Free' | 'Paid' | 'Limited' | null
}

export interface LiveMapResult {
  points: LiveMapPoint[]
}

const liveMapService = {
  async get(): Promise<LiveMapResult> {
    const res = await api.get<{ data: LiveMapResult }>('/me/live-map')
    return res.data.data
  },
}

export default liveMapService
