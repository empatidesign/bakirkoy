import { UserCheckIcon } from 'lucide-react'
import { Modal, EmptyState, Button, Badge } from '@/design-system'
import type { Library } from '@/types/library.types'
import type { LiveTileKey } from './LibraryAnalyticsPanel'
export type { LiveTileKey }

export const BREAKDOWN_META: Record<LiveTileKey, { title: string; getValue: (lib: Library) => number; tone: 'success' | 'warning' | 'primary' }> = {
  occupancy: { title: 'Şu An İçeride Olanlar', getValue: (lib) => lib.currentOccupancy, tone: 'success' },
  onBreak: { title: 'Molada Olanlar', getValue: (lib) => lib.onBreakCount, tone: 'warning' },
  waiting: { title: 'Sırada Bekleyenler', getValue: (lib) => lib.waitingCount, tone: 'primary' },
}

const fmt = (n: number) => n.toLocaleString('tr-TR')
const locationOf = (lib: Library) => [lib.serviceFacilityName, lib.district].filter(Boolean).join(' · ')

export const FacilityBreakdownModal = ({
  open, onClose, breakdownKey, libraries, onSelect,
}: { open: boolean; onClose: () => void; breakdownKey: LiveTileKey | null; libraries: Library[]; onSelect?: (id: string) => void }) => {
  if (!breakdownKey) return null
  const meta = BREAKDOWN_META[breakdownKey]
  const rows = libraries
    .map((lib) => ({ lib, value: meta.getValue(lib) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      bodyClassName="bg-surface-2 p-4"
      header={
        <div className="flex items-center gap-3 pr-10">
          <div className="pilot-form-icon flex h-10 w-10 flex-shrink-0 items-center justify-center">
            <UserCheckIcon className="h-5 w-5" />
          </div>
          <div>
            <h3>{meta.title}</h3>
            <p className="mt-0.5 type-caption">Kütüphaneye göre dağılım</p>
          </div>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="py-8">
          <EmptyState icon={UserCheckIcon} title="Şu anda kimse yok" description="Bu durumda olan bir kütüphane bulunmuyor." />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ lib, value }) => (
            <Button
              key={lib.id}
              variant="outline"
              className="h-auto w-full justify-between gap-3 py-3 text-left"
              onClick={() => { if (onSelect) onSelect(lib.id); onClose() }}
            >
              <span className="min-w-0">
                <span className="block truncate type-body-strong">{lib.name}</span>
                {locationOf(lib) && <span className="block truncate type-caption">{locationOf(lib)}</span>}
              </span>
              <Badge tone={meta.tone} className="shrink-0 tabular-nums">{fmt(value)}</Badge>
            </Button>
          ))}
        </div>
      )}
    </Modal>
  )
}
