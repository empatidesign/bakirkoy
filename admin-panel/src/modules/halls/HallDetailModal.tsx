import { useState } from 'react'
import {
  Building2Icon, ArmchairIcon, LayersIcon, UsersIcon, StarIcon, MapPinIcon,
  SlidersHorizontalIcon, ChevronRightIcon,
} from 'lucide-react'
import { Modal, Badge, ToggleChip, FormSection } from '@/design-system'
import { FloorPreview } from '@/components/specialized/seating'
import { HallDevicesSection } from './HallDevicesSection'
import type { Hall } from '@/types/hall.types'
import { HALL_TYPE_LABELS, SEATING_MODE_LABELS } from '@/types/hall.types'

interface HallDetailModalProps {
  open: boolean
  onClose: () => void
  hall: Hall | null
  featureName: (id: string) => string
}

const Sparkline = ({ color, pill }: { color: string; pill: string }) => (
  <div className="relative h-14 w-32 shrink-0 self-end">
    <svg viewBox="0 0 128 44" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 38 C 22 36, 34 30, 52 26 S 92 16, 128 6 L 128 44 L 0 44 Z" fill={`url(#spark-${color.replace('#', '')})`} />
      <path d="M0 38 C 22 36, 34 30, 52 26 S 92 16, 128 6" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
    <span
      className="absolute bottom-1 right-0 rounded-pill px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {pill}
    </span>
  </div>
)

const StatTile = ({
  icon: Icon, iconBg, label, value, valueColor, sub, visual,
}: {
  icon: typeof UsersIcon
  iconBg: string
  label: string
  value: string | number
  valueColor: string
  sub: string
  visual: React.ReactNode
}) => (
  <div className="rounded-card border border-border bg-surface-1 p-4 shadow-card">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl shadow-md" style={{ background: iconBg }}>
        <Icon className="h-5 w-5 text-white" />
      </span>
      <span className="type-body-strong text-foreground-strong">{label}</span>
    </div>
    <div className="mt-2 flex items-end justify-between gap-2">
      <div>
        <p className="text-4xl font-black tabular-nums leading-tight" style={{ color: valueColor }}>{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</p>
        <p className="mt-1 type-caption text-foreground-muted">{sub}</p>
      </div>
      {visual}
    </div>
  </div>
)

export const HallDetailModal = ({ open, onClose, hall, featureName }: HallDetailModalProps) => {
  const [floorIdx, setFloorIdx] = useState(0)
  if (!hall) return null

  const seated = hall.seatingMode === 'seated'
  const floors = hall.layout?.floors ?? []
  const floor = floors[Math.min(floorIdx, Math.max(0, floors.length - 1))]
  const capacityPct = hall.capacity > 0 ? Math.round((hall.availableCapacity / hall.capacity) * 100) : 0
  const featureCount = hall.featureIds.length

  const heroStats = [
    { icon: UsersIcon, iconClass: '', value: hall.availableCapacity, label: 'Kontenjan' },
    { icon: LayersIcon, iconClass: '', value: seated ? hall.floorCount : '—', label: 'Kat / Seviye' },
    { icon: StarIcon, iconClass: 'text-amber-300 fill-amber-300', value: featureCount, label: 'Özellik' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={860}
      className="max-w-[96vw] overflow-hidden"
    >
      <div className="relative overflow-hidden p-4 ds-hero">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="pointer-events-none absolute -bottom-10 right-40 h-40 w-40 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
        <div className="pointer-events-none absolute right-8 top-6 hidden select-none opacity-25 sm:block">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => <ArmchairIcon key={i} className="h-10 w-10 text-white" />)}
          </div>
          <div className="mt-2 flex gap-2 pl-5">
            {[0, 1, 2, 3].map((i) => <ArmchairIcon key={i} className="h-10 w-10 text-white/70" />)}
          </div>
        </div>

        <div className="relative px-4 pb-4 pt-5">
          <div className="flex items-start gap-5">
            <div className="flex shrink-0 flex-col items-center gap-2.5">
              <span className="flex h-24 w-24 items-center justify-center rounded-[22px] shadow-xl" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0.10))', border: '2.5px solid rgba(255,255,255,0.55)' }}>
                <Building2Icon className="h-11 w-11 text-white" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-bold text-white shadow-md" style={{ background: 'rgba(17,12,34,0.55)' }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hall.isActive ? '#4ade80' : '#94a3b8' }} />
                {hall.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </div>

            <div className="min-w-0 pt-1">
              <h3 className="text-3xl font-black leading-tight text-white">{hall.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold" style={{ color: '#6d28d9' }}>{hall.isActive ? 'Aktif' : 'Pasif'}</span>
                <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>{HALL_TYPE_LABELS[hall.type] ?? hall.type}</span>
                <span className="inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>{SEATING_MODE_LABELS[hall.seatingMode]}</span>
              </div>
              {hall.facilityName && (
                <div className="mt-3.5 flex items-center gap-2 text-sm text-white/85">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.25)' }}>
                    <MapPinIcon className="h-3.5 w-3.5 text-white" />
                  </span>
                  {hall.facilityName}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl px-2 py-4" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)', backdropFilter: 'blur(12px)' }}>
          <div className="grid grid-cols-3">
            {heroStats.map((s, i) => (
              <div key={s.label} className={`flex items-center justify-center gap-3 px-3 ${i > 0 ? 'border-l border-white/25' : ''}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <s.icon className={`h-5 w-5 text-white ${s.iconClass}`} />
                </span>
                <div>
                  <p className="text-3xl font-black leading-none text-white tabular-nums">{typeof s.value === 'number' ? s.value.toLocaleString('tr-TR') : s.value}</p>
                  <p className="mt-1 text-xs font-medium text-white/70">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-h-[62vh] space-y-4 overflow-auto bg-surface-2 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            icon={UsersIcon}
            iconBg="linear-gradient(135deg, #7c3aed, #a855f7)"
            label="Kontenjan"
            value={hall.availableCapacity}
            valueColor="#6d28d9"
            sub="Kişilik kapasite"
            visual={<Sparkline color="#8b5cf6" pill={`${capacityPct}%`} />}
          />
          <StatTile
            icon={LayersIcon}
            iconBg="linear-gradient(135deg, #2563eb, #3b82f6)"
            label="Kat / Seviye"
            value={seated ? hall.floorCount : '—'}
            valueColor="#2563eb"
            sub={seated ? 'Kat' : 'Ayakta düzen'}
            visual={<LayersIcon className="h-14 w-14 shrink-0 self-end text-blue-200" />}
          />
          <StatTile
            icon={SlidersHorizontalIcon}
            iconBg="linear-gradient(135deg, #059669, #10b981)"
            label="Özellik"
            value={featureCount}
            valueColor="#059669"
            sub={featureCount === 0 ? 'Ek özellik bulunmuyor' : `${featureCount} ek özellik`}
            visual={<Sparkline color="#10b981" pill={featureCount > 0 ? `${featureCount}` : '0%'} />}
          />
        </div>

        {(hall.description || hall.about) && (
          <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-1 p-4 shadow-card">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
                <UsersIcon className="h-5 w-5" style={{ color: '#7c3aed' }} />
              </span>
              <div className="min-w-0">
                {hall.description && <p className="type-body-strong text-foreground-strong">{hall.description}</p>}
                {hall.about && <p className="mt-0.5 type-body whitespace-pre-line text-foreground-muted">{hall.about}</p>}
              </div>
            </div>
            <div className="hidden shrink-0 gap-1.5 sm:flex">
              {[0, 1, 2].map((i) => <ArmchairIcon key={i} className="h-9 w-9" style={{ color: '#ddd6fe' }} />)}
            </div>
          </div>
        )}

        <div className="rounded-card border border-border bg-surface-1 shadow-card">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full shadow-md" style={{ background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)' }}>
              <StarIcon className="h-[18px] w-[18px] text-white fill-white" />
            </span>
            <p className="text-base font-bold text-foreground-strong">Özellikler</p>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5">
            {featureCount === 0 ? (
              <>
                <p className="type-body text-foreground-muted">Özellik tanımlanmamış.</p>
                <ChevronRightIcon className="h-4 w-4 text-foreground-subtle" />
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {hall.featureIds.map((id) => <Badge key={id} tone="primary">{featureName(id)}</Badge>)}
              </div>
            )}
          </div>
        </div>

        <HallDevicesSection hallId={hall.id} />

        {seated && hall.layout && floors.length > 0 ? (
          <FormSection variant="card" title="Oturma Düzeni">
            <div className="mb-[15px] flex items-center justify-between gap-[15px]">
              <span className="type-caption">{floor?.name ?? 'Plan'}</span>
              {floors.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {floors.map((f, i) => (
                    <ToggleChip key={f.id} active={i === floorIdx} onClick={() => setFloorIdx(i)}>
                      {f.name}
                    </ToggleChip>
                  ))}
                </div>
              )}
            </div>
            {floor && <FloorPreview floor={floor} template={hall.layout.template} />}
          </FormSection>
        ) : (
          <FormSection variant="card" title="Oturma Düzeni">
            <p className="type-caption text-foreground-muted">Bu salon ayakta düzendedir; oturma planı yoktur.</p>
          </FormSection>
        )}
      </div>
    </Modal>
  )
}
