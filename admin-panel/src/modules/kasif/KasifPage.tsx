import { FacilityModule } from '@/templates/FacilityTemplate/FacilityModule'
import { getFacilityModuleConfig } from '@/templates/FacilityTemplate/moduleConfig'
import { kasifService } from './kasif.service'

export const KasifPage = () => (
  <FacilityModule config={getFacilityModuleConfig('kasif_cocuk')} service={kasifService} />
)
