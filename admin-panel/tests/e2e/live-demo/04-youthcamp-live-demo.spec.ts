/** CANLI İZLEME DEMOSU — Modül 4: Gençlik Kampı (/youth-camp). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'youth_camp')!
runFacilityLiveDemo(mod, 'Doğa Sporları Kampı')
