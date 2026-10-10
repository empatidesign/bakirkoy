import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { sportsService } from './sports.service'

export const SportsPage = () => (
  <FacilityModule config={getFacilityModuleConfig('sports')} service={sportsService} />
)
