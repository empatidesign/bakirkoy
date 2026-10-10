import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { youthCampService } from './youthCamp.service'

export const YouthCampPage = () => (
  <FacilityModule config={getFacilityModuleConfig('youth_camp')} service={youthCampService} />
)
