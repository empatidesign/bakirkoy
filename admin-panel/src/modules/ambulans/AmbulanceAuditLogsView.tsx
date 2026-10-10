import { ShieldAlertIcon } from 'lucide-react'
import { Badge, DataTable, type DataTableColumn } from '@/design-system'
import { AmbulanceAuditLog } from './types'

interface Props {
  logs: AmbulanceAuditLog[]
}

export const AmbulanceAuditLogsView = ({ logs }: Props) => {
  const columns: DataTableColumn<AmbulanceAuditLog>[] = [
    { key: 'timestamp', header: 'Zaman Damgası', cell: log => <span className="text-foreground-muted font-medium">{log.timestamp}</span> },
    {
      key: 'actor', header: 'İşlemi Yapan Personel / Sistem',
      cell: log => (
        <>
          <div className="font-bold text-foreground font-sans">{log.actorName}</div>
          <div className="text-xs text-foreground-muted">{log.actorRole}</div>
        </>
      ),
    },
    { key: 'action', header: 'İşlem Türü', cell: log => <Badge className="text-xs font-bold">{log.action}</Badge> },
    { key: 'targetTrackingNo', header: 'Hedef Takip No', cell: log => <span className="font-bold">{log.targetTrackingNo}</span> },
    { key: 'details', header: 'Detay ve Açıklama', cell: log => <span className="text-foreground-muted max-w-md">{log.details}</span> },
    { key: 'ipAddress', header: 'IP Adresi', align: 'right', cell: log => <span className="text-foreground-muted">{log.ipAddress}</span> },
  ]

  return (
    <div className="space-y-4">
      <DataTable<AmbulanceAuditLog>
        title="KVKK & İşlem Güvenliği Denetim İzi (Audit Log)"
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <span className="type-muted flex items-center gap-1.5">
              <ShieldAlertIcon className="h-3.5 w-3.5" />
              Sağlık verileri erişimi, onay/ret işlemleri, ambulans atamaları ve şoför GPS kayıtları silinemez formatta saklanır
            </span>
            <Badge tone="success">WORM (Write Once Read Many) Uyumlu</Badge>
          </div>
        }
        showRowNumbers
        columns={columns}
        rows={logs}
        rowKey={log => log.id}
      />
    </div>
  )
}
