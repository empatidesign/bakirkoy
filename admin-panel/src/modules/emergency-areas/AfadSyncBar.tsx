import { useCallback, useEffect, useState } from 'react'
import { RefreshCwIcon, DatabaseIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/design-system'
import emergencyAreaService from '@/services/emergencyArea.service'
import type { AfadSyncStatus } from '@/types/emergencyArea.types'

// API zaman damgasını offset ile (örn. +03:00) döndürüyor; offset yoksa UTC kabul edilir.
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return 'Henüz yapılmadı'
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso)
  const d = new Date(hasZone ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
}

/** AFAD toplanma alanlarının Netcad GIS servisinden çekilmesi: son durum + elle tetikleme. */
export const AfadSyncBar = ({ canSync, onSynced }: { canSync: boolean; onSynced: () => void }) => {
  const [status, setStatus] = useState<AfadSyncStatus | null>(null)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    try { setStatus(await emergencyAreaService.getAfadSyncStatus()) } catch { setStatus(null) }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async () => {
    setSyncing(true)
    try {
      const r = await emergencyAreaService.runAfadSync()
      toast.success(`AFAD senkronizasyonu tamamlandı: ${r.fetched} kayıt, ${r.created} yeni, ${r.updated} güncellendi, ${r.removed} pasife alındı.`)
      onSynced()
      await load()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'AFAD GIS servisine ulaşılamadı.')
    } finally {
      setSyncing(false)
    }
  }

  if (!status) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <DatabaseIcon className="h-5 w-5 text-info" />
        <div>
          <p className="text-sm font-semibold text-foreground-strong">AFAD GIS Entegrasyonu</p>
          <p className="type-caption">
            {status.configured
              ? <>Son senkronizasyon: {fmtDateTime(status.lastSyncedAt)} · {status.syncedCount.toLocaleString('tr-TR')} alan</>
              : 'Entegrasyon yapılandırılmamış (AfadGis ayarları).'}
          </p>
        </div>
      </div>
      {canSync && status.configured && (
        <Button size="sm" variant="outline" isLoading={syncing} disabled={syncing} onClick={run}
          iconLeft={!syncing ? <RefreshCwIcon className="h-4 w-4" /> : undefined}>
          AFAD'dan Güncelle
        </Button>
      )}
    </div>
  )
}
