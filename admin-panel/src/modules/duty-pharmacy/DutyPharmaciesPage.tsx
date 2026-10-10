import { useCallback, useEffect, useState } from 'react'
import { PillIcon, PhoneIcon, MapPinIcon, RefreshCwIcon, ClockIcon, AlertTriangleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Card, Badge, Button, EmptyState, SkeletonRows, Banner } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { formatDate } from '@/lib/utils'
import dutyPharmacyService from '@/services/dutyPharmacy.service'
import type { DutyPharmacy, DutyPharmacySyncStatus } from '@/types/dutyPharmacy.types'

const formatSyncedAt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

const daysAgo = (isoDate: string): number => {
  const then = new Date(`${isoDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000))
}

export const DutyPharmaciesPage = () => {
  const [items, setItems] = useState<DutyPharmacy[] | null>(null)
  const [status, setStatus] = useState<DutyPharmacySyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, syncStatus] = await Promise.all([
        dutyPharmacyService.getList(),
        dutyPharmacyService.getSyncStatus(),
      ])
      setItems(list)
      setStatus(syncStatus)
    } catch {
      setItems([])
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await dutyPharmacyService.sync()
      toast.success('Nöbetçi eczane listesi İstanbul Eczacı Odası\'ndan yeniden senkronize edildi.')
      await load()
    } catch {
      void 0
    } finally {
      setSyncing(false)
    }
  }

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={PillIcon}
          title="Nöbetçi Eczaneler"
          subtitle="Bakırköy bölgesindeki bugünkü nöbetçi eczaneler (İstanbul Eczacı Odası'ndan 3 saatte bir otomatik senkronize edilir)"
          breadcrumb="Hizmetlerimiz / Nöbetçi Eczaneler"
          actions={
            <Button
              variant="outline"
              size="sm"
              isLoading={syncing}
              iconLeft={<RefreshCwIcon className="h-4 w-4" />}
              onClick={() => void handleSync()}
            >
              Şimdi Senkronize Et
            </Button>
          }
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
        {!loading && status?.isStale && (
          <Banner tone="warning" icon={AlertTriangleIcon}>
            {status.lastDutyDate ? (
              <>
                <span className="font-semibold">Bu liste bugüne ait değil.</span>{' '}
                En son başarılı senkronizasyon {formatDate(status.lastDutyDate)} tarihine ait
                ({daysAgo(status.lastDutyDate)} gün önce). Otomatik senkronizasyon (3 saatte bir) çalışmıyor olabilir —
                aşağıdaki eczaneler güncel olmayabilir. "Şimdi Senkronize Et" ile kontrol edin.
              </>
            ) : (
              <>
                <span className="font-semibold">Henüz hiç senkronizasyon yapılmamış.</span>{' '}
                "Şimdi Senkronize Et" ile İstanbul Eczacı Odası'ndan ilk senkronizasyonu başlatın.
              </>
            )}
          </Banner>
        )}
        {loading ? (
          <SkeletonRows rows={5} />
        ) : !items || items.length === 0 ? (
          <EmptyState
            icon={PillIcon}
            title="Nöbetçi eczane bulunamadı"
            description="Bugün için henüz senkronize edilmiş bir kayıt yok. Günlük senkronizasyon her 3 saatte bir otomatik çalışır; hemen çekmek için 'Şimdi Senkronize Et' butonunu kullanabilirsiniz."
          />
        ) : (
          <>
            <p className="type-caption text-foreground-muted">
              {items.length} eczane · {formatDate(items[0].dutyDate)} tarihi için nöbetçi · son senkronizasyon: {formatSyncedAt(items[0].syncedAt)}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <Card key={p.id} padded accent="green">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="type-body-strong truncate">{p.name}</p>
                      <Badge tone="success" className="mt-1">{p.district}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {p.phone && (
                      <p className="type-caption flex items-center gap-1.5 text-foreground-muted">
                        <PhoneIcon className="h-3.5 w-3.5 shrink-0" /> {p.phone}
                      </p>
                    )}
                    {p.address && (
                      <p className="type-caption flex items-start gap-1.5 text-foreground-muted">
                        <MapPinIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" /> <span>{p.address}</span>
                      </p>
                    )}
                    {p.directions && (
                      <p className="type-caption text-foreground-subtle">{p.directions}</p>
                    )}
                    {p.dutyEndTime && (
                      <p className="type-caption flex items-center gap-1.5 text-foreground-muted">
                        <ClockIcon className="h-3.5 w-3.5 shrink-0" /> Nöbet bitiş: {p.dutyEndTime}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
