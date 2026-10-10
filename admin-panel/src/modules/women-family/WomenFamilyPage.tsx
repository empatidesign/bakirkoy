import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { womenFamilyService } from './womenFamily.service'

export const WomenFamilyPage = () => (
  <FacilityModule config={getFacilityModuleConfig('women_family')} service={womenFamilyService} />
)
