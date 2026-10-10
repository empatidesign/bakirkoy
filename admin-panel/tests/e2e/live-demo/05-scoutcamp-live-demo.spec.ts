/** CANLI İZLEME DEMOSU — Modül 5: İzcilik Kampı (/scout-camp). Bkz. helpers/facilityLiveDemoRunner.ts */
import { FACILITY_MODULE_MATRIX } from '../helpers/facilitySessionMatrix'
import { runFacilityLiveDemo } from '../helpers/facilityLiveDemoRunner'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'scout_camp')!
runFacilityLiveDemo(mod, 'İzci Modül Eğitimi')
