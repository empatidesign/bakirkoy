import { LayersIcon } from 'lucide-react'
import {
  Badge, EmptyState,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/design-system'
import type { ServiceFacility } from '@/types/serviceFacility.types'
import { SERVICE_MODULE_LABELS, SERVICE_MODULE_COLOR } from '@/types/serviceFacility.types'

export const FacilityServicesView = ({ facility }: { facility: ServiceFacility }) => {
  const services = facility.offeredServices ?? []

  if (services.length === 0) {
    return (
      <EmptyState
        icon={LayersIcon}
        title="Sunulan hizmet yok"
        description="Bu tesise tanımlı bir hizmet bulunmuyor. Hizmetler tesis formunun “Hizmetler” sekmesinden eklenir."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hizmet</TableHead>
          <TableHead>Modül</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {services.map((s) => (
          <TableRow key={s.id}>
            <TableCell>
              <span className="font-medium text-foreground-strong">{s.name}</span>
              {s.description && <p className="type-caption">{s.description}</p>}
            </TableCell>
            <TableCell><Badge color={SERVICE_MODULE_COLOR[s.module]}>{SERVICE_MODULE_LABELS[s.module]}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
