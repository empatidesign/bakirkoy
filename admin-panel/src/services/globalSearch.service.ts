import { api } from '@/services/api'

export interface GlobalSearchFacilityHit {
  id: string
  module: string
  name: string
  district: string | null
  isActive: boolean
}

export interface GlobalSearchGroupHit {
  id: string
  module: string
  name: string
  facilityId: string
  facilityName: string | null
  isActive: boolean
}

export interface GlobalSearchApplicationHit {
  id: string
  module: string
  fullName: string
  tckn: string
  phone: string
  facilityId: string
  facilityName: string | null
  status: string
}

export interface GlobalSearchParticipantHit {
  id: string
  fullName: string
  tckn: string
  phone: string | null
}

export interface GlobalSearchNamedHit {
  id: string
  name: string
  detail: string | null
}

export interface GlobalSearchResult {
  facilities: GlobalSearchFacilityHit[]
  groups: GlobalSearchGroupHit[]
  applications: GlobalSearchApplicationHit[]
  participants: GlobalSearchParticipantHit[]
  travels: GlobalSearchNamedHit[]
  events: GlobalSearchNamedHit[]
  libraries: GlobalSearchNamedHit[]
  serviceFacilities: GlobalSearchNamedHit[]
}

const EMPTY: GlobalSearchResult = {
  facilities: [], groups: [], applications: [], participants: [],
  travels: [], events: [], libraries: [], serviceFacilities: [],
}

export const globalSearchService = {
  async search(query: string, limit = 5): Promise<GlobalSearchResult> {
    if (query.trim().length < 2) {
      return EMPTY
    }
    const res = await api.get<{ data: Partial<GlobalSearchResult> }>('/search', { params: { q: query, limit } })
    return { ...EMPTY, ...res.data.data }
  },
}
