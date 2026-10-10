import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  className?: string
}

export const Pagination = ({ page, totalPages, total, limit, onPageChange, className }: PaginationProps) => {
  const navBase = 'flex h-7 w-7 items-center justify-center rounded-field border text-[10px] font-medium transition-all sm:h-8 sm:w-8 sm:text-[11px]'
  const numBase = navBase
  const navDisabled = 'border-border text-foreground-subtle bg-surface-1 cursor-not-allowed'
  const navIdle = 'border-border text-foreground-strong hover:bg-primary hover:text-white hover:border-primary'
  const numIdle = navIdle
  const numActive = 'bg-primary text-white border-primary shadow-sm'

  const navButtons: { Icon: typeof ChevronLeft; to: number; disabled: boolean }[] = [
    { Icon: ChevronsLeft, to: 1, disabled: page === 1 },
    { Icon: ChevronLeft, to: page - 1, disabled: page === 1 },
    { Icon: ChevronRight, to: page + 1, disabled: page >= totalPages },
    { Icon: ChevronsRight, to: totalPages, disabled: page >= totalPages },
  ]

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border bg-surface-1/40 px-4 py-3', className)}>
      <p className="text-[11px] text-foreground-muted">
        <span className="font-semibold text-foreground-strong">
          {((page - 1) * limit + 1).toLocaleString('tr-TR')}–{Math.min(page * limit, total).toLocaleString('tr-TR')}
        </span>{' '}
        arası gösteriliyor, toplam{' '}
        <span className="font-semibold text-foreground-strong">{total.toLocaleString('tr-TR')}</span> kayıt
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {navButtons.map(({ Icon, to, disabled }, i) => (
          <button
            key={i}
            onClick={() => onPageChange(to)}
            disabled={disabled}
            className={cn(navBase, disabled ? navDisabled : navIdle)}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p =
            totalPages <= 5
              ? i + 1
              : page <= 3
                ? i + 1
                : page >= totalPages - 2
                  ? totalPages - 4 + i
                  : page - 2 + i
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(numBase, page === p ? numActive : numIdle)}
            >
              {p}
            </button>
          )
        })}
      </div>
    </div>
  )
}
