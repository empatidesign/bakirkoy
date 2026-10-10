import { ArchiveIcon } from 'lucide-react'
import { Drawer, Button } from '@/design-system'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import { FacilityArchiveTab } from './tabs/FacilityArchiveTab'

interface Props {
  open: boolean
  onClose: () => void
  config: FacilityModuleConfig
  service: FacilityModuleService
}

export const FacilityArchiveDrawer = ({ open, onClose, config, service }: Props) => (
  <Drawer
    open={open}
    onClose={onClose}
    icon={ArchiveIcon}
    title="Arşiv"
    subtitle={`Silinen ${config.terminology.facilitySingular.toLowerCase()} ve grupları görüntüleyin, geri yükleyin veya kalıcı olarak silin`}
    width={960}
    footer={<Button variant="outline" className="w-full" onClick={onClose}>Kapat</Button>}
  >
    {open && <FacilityArchiveTab config={config} service={service} />}
  </Drawer>
)
