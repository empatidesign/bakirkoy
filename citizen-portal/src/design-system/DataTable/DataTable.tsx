import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { SettingsIcon, Eye, EyeOff, SearchIcon, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn, inheritToneClass } from '@/lib/utils'
import { Checkbox } from '@/design-system/Checkbox'
import { Select } from '@/design-system/Select'
import { Input } from '@/design-system/Input'
import { Pagination } from '@/design-system/Pagination'
import { SkeletonRows } from '@/design-system/Skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/design-system/Table'

export interface DataTableColumn<T> {
  key: string
  header: string
  cell: (row: T, index: number) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  width?: string
  defaultHidden?: boolean
  hideable?: boolean
  sortable?: boolean
  sortKey?: string
}

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  title?: string
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean

  selectable?: boolean
  selected?: Set<string>
  onSelectedChange?: (next: Set<string>) => void

  searchable?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string

  limit?: number
  onLimitChange?: (limit: number) => void
  pageSizeOptions?: number[]

  page?: number
  totalPages?: number
  total?: number
  onPageChange?: (page: number) => void

  sort?: SortState | null
  onSortChange?: (sort: SortState | null) => void

  rowActions?: (row: T) => React.ReactNode
  actionsHeader?: string

  selectionActions?: React.ReactNode

  empty?: React.ReactNode
  toolbarExtra?: React.ReactNode
}

const alignClass = (align?: 'left' | 'center' | 'right') =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

export const DataTable = <T,>({
  title,
  columns,
  rows,
  rowKey,
  loading,
  selectable,
  selected,
  onSelectedChange,
  searchable,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Tüm alanlarda ara...',
  limit = 10,
  onLimitChange,
  pageSizeOptions = [5, 10, 25, 50, 100],
  page = 1,
  totalPages = 1,
  total = 0,
  onPageChange,
  sort,
  onSortChange,
  rowActions,
  actionsHeader = 'İşlemler',
  selectionActions,
  empty,
  toolbarExtra,
}: DataTableProps<T>) => {
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    columns.reduce((acc, c) => ({ ...acc, [c.key]: !c.defaultHidden }), {})
  )
  const [gearOpen, setGearOpen] = useState(false)
  const gearBtnRef = useRef<HTMLButtonElement>(null)
  const gearMenuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })

  useLayoutEffect(() => {
    if (!gearOpen || !gearBtnRef.current) return
    const rect = gearBtnRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) })
  }, [gearOpen])

  useEffect(() => {
    if (!gearOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (gearBtnRef.current?.contains(t) || gearMenuRef.current?.contains(t)) return
      setGearOpen(false)
    }
    const onScroll = (e: Event) => {
      if (gearMenuRef.current?.contains(e.target as Node)) return
      setGearOpen(false)
    }
    const onResize = () => setGearOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [gearOpen])

  const hideableColumns = columns.filter(c => c.hideable !== false)
  const visibleColumns = columns.filter(c => c.hideable === false || visible[c.key])
  const visCount = hideableColumns.filter(c => visible[c.key]).length

  const selectedSet = selected ?? new Set<string>()
  const pageKeys = rows.map(rowKey)
  const allSelected = rows.length > 0 && pageKeys.every(k => selectedSet.has(k))

  const toggleAll = (checked: boolean) => {
    if (!onSelectedChange) return
    const next = new Set(selectedSet)
    if (checked) pageKeys.forEach(k => next.add(k))
    else pageKeys.forEach(k => next.delete(k))
    onSelectedChange(next)
  }

  const toggleOne = (key: string) => {
    if (!onSelectedChange) return
    const next = new Set(selectedSet)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectedChange(next)
  }

  const setAllVisible = (value: boolean) =>
    setVisible(hideableColumns.reduce((acc, c) => ({ ...acc, [c.key]: value }), { ...visible }))

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !onSortChange) return
    const key = col.sortKey ?? col.key
    if (sort?.key !== key) onSortChange({ key, dir: 'asc' })
    else if (sort.dir === 'asc') onSortChange({ key, dir: 'desc' })
    else onSortChange(null)
  }

  return (
    <div className="rounded-card border border-border bg-surface-0 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          {title && <span className="text-xs font-semibold text-foreground-strong">{title}</span>}
          {selectable && selectedSet.size > 0 && (
            <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {selectedSet.size} seçili
            </span>
          )}
          {selectable && selectedSet.size > 0 && selectionActions}
          {toolbarExtra}
        </div>
        <div className="flex items-center gap-2">
          {searchable && onSearchChange && (
            <div className="w-56">
              <Input
                size="sm"
                iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {onLimitChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-foreground-muted">Sayfa başına</span>
              <Select
                value={String(limit)}
                onChange={e => onLimitChange(Number(e.target.value))}
                className="w-20"
              >
                {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          )}
          {hideableColumns.length > 0 && (
            <button
              ref={gearBtnRef}
              onClick={() => setGearOpen(o => !o)}
              className="flex h-9 items-center gap-1.5 rounded-field border border-border px-3 text-[11px] font-medium text-foreground-muted transition-colors hover:bg-surface-1 hover:text-foreground-strong"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              <span>Sütunlar ({visCount})</span>
            </button>
          )}
        </div>
      </div>

      {gearOpen && createPortal(
        <div
          ref={gearMenuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className={cn('z-[100] w-56 overflow-hidden rounded-card border border-border bg-surface-0 shadow-pop', inheritToneClass(gearBtnRef.current))}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-[11px] font-semibold text-foreground-strong">Görünür Sütunlar</span>
            <div className="flex gap-2">
              <button onClick={() => setAllVisible(true)} className="text-[11px] font-medium text-primary hover:underline">Tümü</button>
              <button onClick={() => setAllVisible(false)} className="text-[11px] font-medium text-danger hover:underline">Hiçbiri</button>
            </div>
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
            {hideableColumns.map(col => (
              <label key={col.key} className="flex cursor-pointer items-center gap-2.5 rounded-field px-2 py-1.5 transition-colors hover:bg-surface-1">
                <Checkbox
                  checked={!!visible[col.key]}
                  onCheckedChange={v => setVisible(prev => ({ ...prev, [col.key]: !!v }))}
                />
                <span className="flex-1 text-xs text-foreground-default">{col.header}</span>
                {visible[col.key]
                  ? <Eye className="h-3 w-3 text-success" />
                  : <EyeOff className="h-3 w-3 text-foreground-subtle" />}
              </label>
            ))}
          </div>
          <div className="border-t border-border bg-surface-1 px-3 py-2">
            <p className="text-[10px] text-foreground-muted">{visCount}/{hideableColumns.length} sütun görünür</p>
          </div>
        </div>,
        document.body
      )}

      <div className="overflow-hidden rounded-b-card">
      {loading ? (
        <SkeletonRows rows={Math.min(limit, 10)} />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface-1 hover:bg-surface-1">
                {selectable && (
                  <TableHead className="w-10 text-center">
                    <Checkbox checked={allSelected} onCheckedChange={v => toggleAll(!!v)} />
                  </TableHead>
                )}
                {visibleColumns.map(col => {
                  const sortable = !!col.sortable && !!onSortChange
                  const sortKey = col.sortKey ?? col.key
                  const active = sort?.key === sortKey
                  return (
                    <TableHead
                      key={col.key}
                      onClick={sortable ? () => handleSort(col) : undefined}
                      className={cn('text-[10px]', alignClass(col.align), col.width, sortable && 'cursor-pointer select-none transition-colors hover:text-foreground-strong')}
                    >
                      <span className={cn('inline-flex items-center gap-1', col.align === 'center' && 'justify-center', col.align === 'right' && 'flex-row-reverse')}>
                        {col.header}
                        {sortable && (
                          active
                            ? (sort?.dir === 'asc'
                                ? <ChevronUp className="h-3 w-3 text-primary" />
                                : <ChevronDown className="h-3 w-3 text-primary" />)
                            : <ChevronsUpDown className="h-3 w-3 text-foreground-subtle" />
                        )}
                      </span>
                    </TableHead>
                  )
                })}
                {rowActions && <TableHead className="w-px whitespace-nowrap text-center text-[10px]">{actionsHeader}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => {
                const key = rowKey(row)
                const isSelected = selectedSet.has(key)
                return (
                  <TableRow
                    key={key}
                    className={cn(
                      'border-b border-border transition-colors',
                      isSelected ? 'bg-primary/5' : idx % 2 === 1 ? 'bg-surface-1/40' : 'hover:bg-surface-1/40'
                    )}
                  >
                    {selectable && (
                      <TableCell className="text-center">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(key)} />
                      </TableCell>
                    )}
                    {visibleColumns.map(col => (
                      <TableCell key={col.key} className={cn(alignClass(col.align), col.width)}>
                        {col.cell(row, idx)}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="w-px whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {rowActions(row)}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && total > 0 && onPageChange && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={onPageChange}
        />
      )}
      </div>
    </div>
  )
}
