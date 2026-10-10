import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { scoutCampService } from './scoutCamp.service'

export const ScoutCampPage = () => (
  <FacilityModule config={getFacilityModuleConfig('scout_camp')} service={scoutCampService} />
)
