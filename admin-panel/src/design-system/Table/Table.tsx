import { cn } from '@/lib/utils'

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-hidden border border-[hsl(var(--border))] bg-white">
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse', className)} {...props} />
    </div>
  </div>
)

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('', className)} {...props} />
)

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
)

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn('border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--surface-1))]', className)}
    {...props}
  />
)

export const TableHead = ({ className, align, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) => (
  <th
    className={cn(
      'h-10 px-[5px] align-middle text-xs font-semibold uppercase tracking-wider text-[hsl(var(--foreground-subtle))] bg-[hsl(var(--surface-1))]',
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
)

export const TableCell = ({ className, align, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) => (
  <td
    className={cn(
      'px-[5px] py-1.5 align-middle text-xs text-[hsl(var(--foreground-default))]',
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      className
    )}
    {...props}
  />
)
