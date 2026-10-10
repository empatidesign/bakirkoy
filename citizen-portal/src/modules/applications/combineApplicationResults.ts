import type { CitizenApplication } from '@/types/event.types'
import type { CitizenTravelApplication } from '@/types/travel.types'
import type { CitizenFacilityApplication } from '@/types/facility.types'
import type { CitizenLibraryReservation } from '@/types/library.types'

export interface CombinedSourceResult {
  eventApps: CitizenApplication[]
  travelApps: CitizenTravelApplication[]
  facilityApps: CitizenFacilityApplication[]
  libraryRes: CitizenLibraryReservation[]
  loadError: boolean
}

export const combineApplicationResults = (
  ev: PromiseSettledResult<{ items: CitizenApplication[] }>,
  tr: PromiseSettledResult<{ items: CitizenTravelApplication[] }>,
  fa: PromiseSettledResult<{ items: CitizenFacilityApplication[] }>,
  li: PromiseSettledResult<{ items: CitizenLibraryReservation[] }>,
): CombinedSourceResult => ({
  eventApps: ev.status === 'fulfilled' ? ev.value.items : [],
  travelApps: tr.status === 'fulfilled' ? tr.value.items : [],
  facilityApps: fa.status === 'fulfilled' ? fa.value.items : [],
  libraryRes: li.status === 'fulfilled' ? li.value.items : [],
  loadError: [ev, tr, fa, li].some((r) => r.status === 'rejected'),
})
