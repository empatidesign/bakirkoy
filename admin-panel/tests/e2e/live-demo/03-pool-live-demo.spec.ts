/** CANLI İZLEME DEMOSU — Modül 3: Yüzme Havuzu (/pool). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'pool')!
runFacilityLiveDemo(mod, 'Yüzme Kursu Başlangıç')
