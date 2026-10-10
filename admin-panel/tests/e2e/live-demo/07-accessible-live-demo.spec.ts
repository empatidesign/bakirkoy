/** CANLI İZLEME DEMOSU — Modül 7: Engelsiz Yaşam (/accessible-life). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'accessible')!
runFacilityLiveDemo(mod, 'Fizyoterapi Programı')
