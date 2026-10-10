import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontalIcon, Eye, EyeOff, SearchIcon, ArrowUp, ArrowDown, ArrowUpDown, GripVerticalIcon } from 'lucide-react'
import { cn, inheritToneClass } from '@/lib/utils'
import { Checkbox } from '@/design-system/Checkbox'
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

  // Kullanıcı isteği (2026-10-05): manuel sürükle-bırak sıralama — FacilityRosterModal'daki
  // yedek liste deseniyle aynı (draggable satır + grip ikonu). Verilirse her satırın solunda
  // bir tutamaç (grip) gösterilir; satır sürükleyip bırakıldığında yeni sıralı ID listesi döner.
  onReorder?: (orderedKeys: string[]) => void

  rowActions?: (row: T) => React.ReactNode
  actionsHeader?: string

  selectionActions?: React.ReactNode
  selectionPlacement?: 'start' | 'end'

  empty?: React.ReactNode
  toolbarExtra?: React.ReactNode
  toolbarActions?: React.ReactNode

  highlightedRowKey?: string | null

  /** Satıra tıklandığında çağrılır (bölünmüş ekran / detay paneli için). */
  onRowClick?: (row: T) => void
  /** Tıklanarak seçili olan satırın anahtarı — vurgulanarak gösterilir. */
  activeRowKey?: string | null

  showRowNumbers?: boolean
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
  onReorder,
  rowActions,
  actionsHeader = 'İşlemler',
  selectionActions,
  selectionPlacement = 'start',
  empty,
  toolbarExtra,
  toolbarActions,
  highlightedRowKey,
  onRowClick,
  activeRowKey,
  showRowNumbers,
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

  const rowNumberColumn: DataTableColumn<T> = {
    key: '__rowNumber',
    header: '#',
    hideable: false,
    align: 'center',
    width: 'w-px whitespace-nowrap',
    cell: (_row, idx) => (
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[hsl(var(--surface-2))] px-1.5 text-xs font-bold tabular-nums text-[hsl(var(--foreground-strong))]">
        {(page - 1) * limit + idx + 1}
      </span>
    ),
  }
  const allColumns = showRowNumbers ? [rowNumberColumn, ...columns] : columns

  const hideableColumns = allColumns.filter(c => c.hideable !== false)
  const visibleColumns = allColumns.filter(c => c.hideable === false || visible[c.key])
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

  // Kullanıcı isteği (2026-10-05): manuel sürükle-bırak sıralama — FacilityRosterModal'daki
  // yedek liste reorder deseniyle aynı (dragId/overId local state, drop'ta yeniden sıralı
  // key listesi üst bileşene bildirilir).
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const handleDrop = (targetKey: string) => {
    if (!onReorder || !dragKey || dragKey === targetKey) { setDragKey(null); setOverKey(null); return }
    const keys = rows.map(rowKey)
    const from = keys.indexOf(dragKey)
    const to = keys.indexOf(targetKey)
    if (from < 0 || to < 0) { setDragKey(null); setOverKey(null); return }
    keys.splice(to, 0, keys.splice(from, 1)[0])
    onReorder(keys)
    setDragKey(null); setOverKey(null)
  }

  return (
    <div
      data-table-root
      className="overflow-hidden rounded-lg bg-white"
      style={{ border: '0.5px solid hsl(var(--border))', boxShadow: '0 1px 4px rgb(0 0 0 / 0.05)' }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '0.5px solid hsl(var(--border))' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {title && (
            <span className="text-xs font-semibold text-[hsl(var(--foreground-strong))]">{title}</span>
          )}
          {selectable && selectionPlacement === 'start' && selectedSet.size > 0 && (
            <span className="rounded-full bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--primary))]">
              {selectedSet.size} seçili
            </span>
          )}
          {selectable && selectionPlacement === 'start' && selectedSet.size > 0 && selectionActions}
          {toolbarExtra}
        </div>
        <div className="flex items-center gap-2">
          {searchable && onSearchChange && (
            <div className="w-60">
              <Input
                size="sm"
                iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          {selectable && selectionPlacement === 'end' && selectedSet.size > 0 && selectionActions}
          {toolbarActions}
          {hideableColumns.length > 0 && (
            <button
              ref={gearBtnRef}
              onClick={() => setGearOpen(o => !o)}
              className="flex h-[var(--control-h-sm)] items-center gap-2 rounded-lg px-4 text-sm font-medium text-[hsl(var(--foreground-muted))] transition-colors hover:bg-[hsl(var(--surface-0))] hover:text-[hsl(var(--foreground-strong))]"
              style={{ border: '0.5px solid hsl(var(--border))' }}
            >
              <SlidersHorizontalIcon className="h-4 w-4" />
              <span>Sütunlar</span>
              <span className="rounded-full bg-[hsl(var(--surface-2))] px-2 py-0.5 text-xs font-bold">{visCount}</span>
            </button>
          )}
        </div>
      </div>

      {gearOpen && createPortal(
        <div
          ref={gearMenuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className={cn('z-[100] w-56 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-white shadow-[0_8px_24px_rgb(0_0_0/0.12)]', inheritToneClass(gearBtnRef.current))}
        >
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '0.5px solid hsl(var(--border))' }}>
            <span className="text-sm font-semibold text-[hsl(var(--foreground-strong))]">Görünür Sütunlar</span>
            <div className="flex gap-2">
              <button onClick={() => setAllVisible(true)} className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline">Tümü</button>
              <button onClick={() => setAllVisible(false)} className="text-xs font-semibold text-[hsl(var(--danger))] hover:underline">Hiçbiri</button>
            </div>
          </div>
          <div className="max-h-72 space-y-0.5 overflow-y-auto p-2">
            {hideableColumns.map(col => (
              <label key={col.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[hsl(var(--surface-0))]">
                <Checkbox
                  checked={!!visible[col.key]}
                  onCheckedChange={v => setVisible(prev => ({ ...prev, [col.key]: !!v }))}
                />
                <span className="flex-1 text-xs text-[hsl(var(--foreground-default))]">{col.header}</span>
                {visible[col.key]
                  ? <Eye className="h-3 w-3 text-[hsl(var(--success))]" />
                  : <EyeOff className="h-3 w-3 text-[hsl(var(--foreground-subtle))]" />}
              </label>
            ))}
          </div>
          <div
            className="px-3 py-2"
            style={{ borderTop: '0.5px solid hsl(var(--border))', background: 'hsl(var(--surface-0))' }}
          >
            <p className="text-xs text-[hsl(var(--foreground-muted))]">{visCount}/{hideableColumns.length} sütun görünür</p>
          </div>
        </div>,
        document.body
      )}

      <div data-table-body className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={Math.min(limit, 10)} />
        ) : rows.length === 0 ? (
          empty
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow
                  className="hover:bg-transparent"
                  style={{ background: 'hsl(214, 40%, 98.5%)' }}
                >
                  {selectable && (
                    <TableHead className="w-14 pl-[15px] text-center">
                      <Checkbox aria-label="Bu sayfadaki tüm kayıtları seç" checked={allSelected} onCheckedChange={v => toggleAll(!!v)} />
                    </TableHead>
                  )}
                  {onReorder && <TableHead className="w-8" />}
                  {visibleColumns.map(col => {
                    const sortable = !!col.sortable && !!onSortChange
                    const sortKey = col.sortKey ?? col.key
                    const active = sort?.key === sortKey
                    return (
                      <TableHead
                        key={col.key}
                        onClick={sortable ? () => handleSort(col) : undefined}
                        className={cn(
                          alignClass(col.align),
                          col.width,
                          sortable && 'cursor-pointer select-none transition-colors hover:text-[hsl(var(--foreground-strong))]'
                        )}
                      >
                        <span className={cn('inline-flex items-center gap-1', col.align === 'center' && 'justify-center', col.align === 'right' && 'flex-row-reverse')}>
                          {col.header}
                          {sortable && (
                            active
                              ? (sort?.dir === 'asc'
                                  ? <ArrowUp data-sort-icon="active" className="h-3 w-3 text-[hsl(var(--primary))]" />
                                  : <ArrowDown data-sort-icon="active" className="h-3 w-3 text-[hsl(var(--primary))]" />)
                              : <ArrowUpDown data-sort-icon="" className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      </TableHead>
                    )
                  })}
                  {rowActions && <TableHead className="w-px whitespace-nowrap pr-4 text-right">{actionsHeader}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => {
                  const key = rowKey(row)
                  const isSelected = selectedSet.has(key)
                  const isHighlighted = !!highlightedRowKey && key === highlightedRowKey
                  const isActive = !!activeRowKey && key === activeRowKey
                  return (
                    <TableRow
                      key={key}
                      data-row-key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      draggable={!!onReorder}
                      onDragStart={onReorder ? () => setDragKey(key) : undefined}
                      onDragOver={onReorder ? (e) => { e.preventDefault(); setOverKey(key) } : undefined}
                      onDragEnd={onReorder ? () => { setDragKey(null); setOverKey(null) } : undefined}
                      onDrop={onReorder ? (e) => { e.preventDefault(); handleDrop(key) } : undefined}
                      className={cn(
                        'transition-colors',
                        onRowClick && 'cursor-pointer',
                        isActive
                          ? 'bg-[hsl(var(--primary)/0.08)]'
                          : isSelected
                            ? 'bg-[hsl(var(--primary)/0.04)]'
                            : overKey === key && dragKey !== key
                              ? 'bg-[hsl(var(--primary)/0.08)]'
                              : idx % 2 === 0
                                ? 'bg-white hover:bg-[hsl(var(--surface-0))]'
                                : 'hover:bg-[hsl(var(--surface-0))]',
                        isHighlighted && 'animate-row-flash',
                        dragKey === key && 'opacity-50'
                      )}
                      style={!isSelected && !isActive && idx % 2 !== 0 ? { background: 'hsl(214, 55%, 99%)' } : undefined}
                    >
                      {selectable && (
                        <TableCell className="pl-[15px] text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox aria-label={`${idx + 1}. kaydı seç`} checked={isSelected} onCheckedChange={() => toggleOne(key)} />
                        </TableCell>
                      )}
                      {onReorder && (
                        <TableCell className="text-center cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
                          <GripVerticalIcon className="h-4 w-4 text-foreground-subtle" />
                        </TableCell>
                      )}
                      {visibleColumns.map(col => (
                        <TableCell key={col.key} className={cn(alignClass(col.align), col.width)}>
                          {col.cell(row, idx)}
                        </TableCell>
                      ))}
                      {rowActions && (
                        <TableCell className="w-px whitespace-nowrap pr-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
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
            onLimitChange={onLimitChange}
            pageSizeOptions={pageSizeOptions}
          />
        )}
      </div>
    </div>
  )
}
