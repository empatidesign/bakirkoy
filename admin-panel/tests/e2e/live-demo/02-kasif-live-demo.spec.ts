/** CANLI İZLEME DEMOSU — Modül 2: Kaşif Çocuk (/kasif). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'kasif_cocuk')!
runFacilityLiveDemo(mod, 'Robotik Atölyesi')
