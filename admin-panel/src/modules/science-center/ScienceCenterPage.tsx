import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { scienceCenterService } from './scienceCenter.service'

export const ScienceCenterPage = () => (
  <FacilityModule config={getFacilityModuleConfig('science_center')} service={scienceCenterService} />
)
