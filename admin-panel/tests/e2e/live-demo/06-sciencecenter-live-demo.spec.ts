/** CANLI İZLEME DEMOSU — Modül 6: Bilim Merkezi (/science-center). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'science_center')!
runFacilityLiveDemo(mod, 'Fizik Atölyesi')
