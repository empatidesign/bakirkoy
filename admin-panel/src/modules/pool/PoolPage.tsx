import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { poolService } from './pool.service'

export const PoolPage = () => (
  <FacilityModule config={getFacilityModuleConfig('pool')} service={poolService} />
)
