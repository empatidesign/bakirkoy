/** CANLI İZLEME DEMOSU — Modül 8: Kadın ve Aile (/women-family). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'women_family')!
runFacilityLiveDemo(mod, 'El Sanatları Atölyesi')
