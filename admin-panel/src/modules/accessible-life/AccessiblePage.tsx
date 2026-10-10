import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { accessibleService } from './accessible.service'

export const AccessiblePage = () => (
  <FacilityModule config={getFacilityModuleConfig('accessible')} service={accessibleService} />
)
