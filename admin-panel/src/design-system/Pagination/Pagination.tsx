import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/design-system/Select'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export const Pagination = ({ page, totalPages, total, limit, onPageChange, onLimitChange, pageSizeOptions = [5, 10, 25, 50, 100], className }: PaginationProps) => {
  const base = 'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-medium transition-all'
  const idle = 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--surface-0))] hover:text-[hsl(var(--foreground-strong))]'
  const disabled = 'text-[hsl(var(--foreground-subtle))] cursor-not-allowed opacity-40'
  const active = 'bg-[hsl(var(--primary))] text-white shadow-sm'

  const navBtns: { Icon: typeof ChevronLeft; to: number; off: boolean; label: string }[] = [
    { Icon: ChevronsLeft, label: 'İlk sayfa', to: 1, off: page === 1 },
    { Icon: ChevronLeft, label: 'Önceki sayfa', to: page - 1, off: page === 1 },
    { Icon: ChevronRight, label: 'Sonraki sayfa', to: page + 1, off: page >= totalPages },
    { Icon: ChevronsRight, label: 'Son sayfa', to: totalPages, off: page >= totalPages },
  ]

  const pageNums = (() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 3) return [1, 2, 3, 4, 5]
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [page - 2, page - 1, page, page + 1, page + 2]
  })()

  return (
    <div
      className={cn('flex flex-wrap gap-3 items-center justify-between px-4 py-3', className)}
      style={{ borderTop: '0.5px solid hsl(var(--border))', background: 'hsl(214, 40%, 98.5%)' }}
    >
      <p className="text-[11px] text-[hsl(var(--foreground-muted))]">
        <span className="font-semibold text-[hsl(var(--foreground-strong))]">
          {(total === 0 ? 0 : (page - 1) * limit + 1).toLocaleString('tr-TR')}–{Math.min(page * limit, total).toLocaleString('tr-TR')}
        </span>{' '}
        / toplam{' '}
        <span className="font-semibold text-[hsl(var(--foreground-strong))]">{total.toLocaleString('tr-TR')}</span>
        {onLimitChange && (
          <span className="ml-2 inline-flex items-center gap-1.5">
            <span>· Sayfa başına</span>
            <span className="inline-block w-[68px] align-middle">
              <Select aria-label="Sayfa başına kayıt sayısı" value={String(limit)} onChange={(e) => onLimitChange(Number(e.target.value))}>
                {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </span>
          </span>
        )}
      </p>
      <div className="flex items-center gap-0.5">
        {navBtns.slice(0, 2).map(({ Icon, to, off, label }, i) => (
          <button
            key={i}
            type="button"
            aria-label={label}
            onClick={() => onPageChange(to)}
            disabled={off}
            className={cn(base, off ? disabled : idle)}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="mx-1 flex items-center gap-0.5">
          {pageNums.map(p => (
            <button
              key={p}
              type="button"
              aria-label={`${p}. sayfa`}
              aria-current={page === p ? "page" : undefined}
              onClick={() => onPageChange(p)}
              className={cn(base, page === p ? active : idle)}
            >
              {p}
            </button>
          ))}
        </div>
        {navBtns.slice(2).map(({ Icon, to, off, label }, i) => (
          <button
            key={i}
            type="button"
            aria-label={label}
            onClick={() => onPageChange(to)}
            disabled={off}
            className={cn(base, off ? disabled : idle)}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  )
}
