import { cn } from '@/lib/utils'

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto">
    <table
      className={cn('w-full border-collapse text-sm', className)}
      {...props}
    />
  </div>
)

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-[hsl(var(--surface-1))]', className)} {...props} />
)

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
)

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      'border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--surface-1))]/50',
      className
    )}
    {...props}
  />
)

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      'h-10 px-3 text-left align-middle type-table-head border-r border-[hsl(var(--border))] last:border-r-0',
      className
    )}
    {...props}
  />
)

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn(
      'px-3 py-2.5 align-middle type-table-cell border-r border-[hsl(var(--border))] last:border-r-0',
      className
    )}
    {...props}
  />
)
