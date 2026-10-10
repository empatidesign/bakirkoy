import { cn } from '@/lib/utils'

type Tone = 'inside' | 'break' | 'free' | 'queue'

const TONE_CLS: Record<Tone, string> = {
  inside: 'bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))]/75 text-primary-foreground',
  break: 'bg-gradient-to-br from-[hsl(var(--warning))] to-[hsl(var(--warning))]/75 text-warning-foreground',
  free: 'bg-gradient-to-br from-[hsl(var(--success))] to-[hsl(var(--success))]/75 text-success-foreground',
  queue: 'bg-gradient-to-br from-[hsl(var(--info))] to-[hsl(var(--info))]/75 text-info-foreground',
}

export const LibraryStatPill = ({ label, value, tone }: { label: string; value: number | string; tone: Tone }) => (
  <div className={cn('flex flex-col items-center gap-0.5 rounded-card px-2 py-2.5 shadow-sm ring-1 ring-inset ring-white/10', TONE_CLS[tone])}>
    <span className="text-lg font-bold leading-none tabular-nums">{value}</span>
    <span className="text-[11px] font-medium leading-none opacity-90">{label}</span>
  </div>
)

type OccupancyProps = {
  inside: number
  onBreak: number
  capacity: number
  free: number
  waiting: number
  className?: string
}

export const LibraryOccupancy = ({ inside, onBreak, capacity, free, waiting, className }: OccupancyProps) => (
  <div className={cn('grid grid-cols-4 gap-2', className)}>
    <LibraryStatPill label="İçeride" value={`${inside}/${capacity}`} tone="inside" />
    <LibraryStatPill label="Molada" value={onBreak} tone="break" />
    <LibraryStatPill label="Boş" value={free} tone="free" />
    <LibraryStatPill label="Sırada" value={waiting} tone="queue" />
  </div>
)
