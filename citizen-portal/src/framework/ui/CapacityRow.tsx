export interface CapacityRowData {
  capacity: number
  registeredCount: number
  reserveCapacity: number
  waitlistCount: number
}

interface CapacityCell {
  key: string
  label: string
  value: number
  tone: string
}

const buildCells = (d: CapacityRowData): CapacityCell[] => {
  const free = Math.max(0, d.capacity - d.registeredCount)
  const cells: CapacityCell[] = [
    { key: 'capacity', label: 'Kontenjan', value: d.capacity, tone: 'hsl(var(--foreground-strong))' },
    { key: 'registered', label: 'Kayıtlı', value: d.registeredCount, tone: 'hsl(var(--danger))' },
    { key: 'free', label: 'Boş', value: free, tone: 'hsl(var(--success))' },
  ]
  if (d.reserveCapacity > 0) {
    const waitRoom = Math.max(0, d.reserveCapacity - d.waitlistCount)
    cells.push({ key: 'reserve', label: 'Yedek', value: waitRoom, tone: 'hsl(var(--warning))' })
  }
  return cells
}

export const CapacityRow = ({ data, className = '', size = 'sm' }: { data: CapacityRowData; className?: string; size?: 'sm' | 'lg' | 'xl' }) => {
  const cells = buildCells(data)
  const valueClass = size === 'xl'
    ? 'text-[22px] md:text-[27px] font-black leading-none tabular-nums'
    : size === 'lg'
      ? 'text-[17px] md:text-[20px] font-black leading-none tabular-nums'
      : 'text-[17px] font-black leading-none tabular-nums'
  const labelClass = size === 'xl'
    ? 'text-[11px] md:text-[11px] font-semibold text-[hsl(var(--foreground-subtle))]'
    : size === 'lg'
      ? 'text-[11px] md:text-[12px] font-medium text-[hsl(var(--foreground-subtle))]'
      : 'text-[11px] font-medium text-[hsl(var(--foreground-subtle))]'
  const cellPad = size === 'xl' ? 'px-2 py-2.5 md:py-3' : size === 'lg' ? 'px-2 py-2 md:py-2.5' : 'px-2 py-2'
  return (
    <div className={`grid gap-px overflow-hidden rounded-xl border border-border bg-border ${className}`} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((c) => (
        <div key={c.key} className={`flex flex-col items-center justify-center gap-0.5 bg-card ${cellPad}`}>
          <span className={labelClass}>{c.label}</span>
          <span className={valueClass} style={{ color: c.tone }}>{c.value}</span>
        </div>
      ))}
    </div>
  )
}

export default CapacityRow
