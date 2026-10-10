import type { ComponentType } from 'react'
import { ArrowRightIcon, UsersIcon, UserCheck2Icon, ClockIcon, LayersIcon, UserIcon } from 'lucide-react'
import { Card, Badge, Button, Progress } from '@/design-system'
import { cn } from '@/lib/utils'
import type { FacilityRecord } from '@/types/facility.types'

interface Props {
  facility: FacilityRecord
  icon: ComponentType<{ className?: string }>
  participantLabel: string
  groupLabel: string
  onPick: (id: string) => void
}

const occTone = (rate: number): 'danger' | 'warning' | 'success' => (rate > 90 ? 'danger' : rate > 70 ? 'warning' : 'success')
const occLabel = (rate: number) => (rate > 90 ? 'Çok Dolu' : rate > 70 ? 'Dolu' : 'Müsait')

export const FacilityOverviewCard = ({ facility: f, icon: Icon, participantLabel, groupLabel, onPick }: Props) => {
  const quota = f.totalGroupCapacity ?? 0
  const rate = quota > 0 ? ((f.registeredCount || 0) / quota) * 100 : 0
  const total = (f.registeredCount || 0) + (f.waitlistCount || 0)
  const address = [f.district, f.address].filter(Boolean).join(' · ')

  const metrics: { label: string; value: number; icon: ComponentType<{ className?: string }>; chip: string; num: string }[] = [
    { label: 'Kontenjan', value: quota, icon: UsersIcon, chip: 'bg-accent-blue-soft text-accent-blue', num: 'text-foreground-strong' },
    { label: 'Kayıtlı', value: f.registeredCount || 0, icon: UserCheck2Icon, chip: 'bg-accent-green-soft text-accent-green', num: 'text-accent-green' },
    { label: 'Bekleyen', value: f.waitlistCount || 0, icon: ClockIcon, chip: 'bg-accent-orange-soft text-accent-orange', num: 'text-accent-orange' },
    { label: groupLabel, value: f.groupCount || 0, icon: LayersIcon, chip: 'bg-accent-blue-soft text-accent-blue', num: 'text-accent-blue' },
  ]

  const go = () => onPick(f.id)

  return (
    <Card onClick={go} className="flex h-full w-full cursor-pointer flex-col p-6 transition-shadow hover:shadow-pop">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
              <Icon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground-strong">{f.name}</p>
              <p className="type-caption truncate">{address || '—'}</p>
            </div>
          </div>
          <Badge tone={f.isActive ? occTone(rate) : 'neutral'}>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {f.isActive ? occLabel(rate) : 'Pasif'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="flex items-center gap-4 rounded-card border border-border p-4">
              <span className={cn('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full', m.chip)}>
                <m.icon className="h-6 w-6" />
              </span>
              <div>
                <p className={cn('text-3xl font-bold leading-none tabular-nums', m.num)}>{m.value}</p>
                <p className="type-caption mt-1.5">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-card border border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="type-body">Doluluk Oranı</span>
            <span className="type-body-strong tabular-nums">{f.registeredCount || 0} / {quota} · %{rate.toFixed(0)}</span>
          </div>
          <Progress value={rate} tone={occTone(rate)} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-2 type-body">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <UserIcon className="h-4 w-4" />
            </span>
            Toplam {participantLabel} <span className="type-body-strong text-primary">{total}</span>
          </span>
          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); go() }}>
            Detaylara Git <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
