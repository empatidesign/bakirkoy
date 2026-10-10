import { useCallback, useEffect, useState } from 'react'
import {
  LogOutIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon,
} from 'lucide-react'
import {
  SectionToolbar, DataTable, FilterBar, FilterField, Input, DatePicker, Badge, IconButton, Button,
  EmptyState, type DataTableColumn,
} from '@/design-system'
import libraryService from '@/services/library.service'
import { EXIT_TYPE_LABELS, EXIT_TYPE_TONE } from '@/types/library.types'
import type { ExitedSession, LibraryReadFloor } from '@/types/library.types'
import type { PagedResult } from '@/types/common'
import { KrokiViewerModal, useKrokiViewer, KrokiIcon } from '@/components/specialized/KrokiViewerModal'
import { fmtTime, fmtDuration, todayIso } from './libraryHelpers'

const shiftIso = (iso: string, delta: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fmtDateLong = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '')

export const ExitedTab = ({ libraryId, floors, refreshKey }: { libraryId: string; floors: LibraryReadFloor[]; refreshKey?: number }) => {
  const [date, setDate] = useState(todayIso())
  const [result, setResult] = useState<PagedResult<ExitedSession> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const kroki = useKrokiViewer()

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit, date }
      if (search) params.search = search
      setResult(await libraryService.exited.getList(libraryId, params))
    } catch { setResult(null) } finally { setLoading(false) }
  }, [libraryId, page, limit, date, search])
  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { if (refreshKey) fetchList() }, [refreshKey, fetchList])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const goDate = (iso: string) => { setDate(iso); setPage(1) }
  const rows = result?.items ?? []
  const hasFloors = floors.length > 0

  const columns: DataTableColumn<ExitedSession>[] = [
    { key: 'member', header: 'Üye', cell: (r) => <span className="type-body-strong">{r.memberName}</span> },
    {
      key: 'inout', header: 'Giriş - Çıkış',
      cell: (r) => (
        <div className="leading-tight tabular-nums">
          <span className="block type-caption text-success">Giriş: {fmtTime(r.entryTime)}</span>
          <span className="block type-caption text-danger">Çıkış: {fmtTime(r.exitTime)}</span>
        </div>
      ),
    },
    { key: 'duration', header: 'Oturum Süresi', sortable: true, sortKey: 'duration', cell: (r) => <span className="tabular-nums text-foreground-strong">{fmtDuration(r.durationMinutes)}</span> },
    {
      key: 'breaks', header: 'Mola Özeti', align: 'center',
      cell: (r) => <span className="type-muted">Kısa {r.shortBreaksUsed} · Uzun {r.longBreaksUsed}</span>,
    },
    { key: 'exitType', header: 'Çıkış Tipi', align: 'center', cell: (r) => <Badge tone={EXIT_TYPE_TONE[r.exitType]}>{EXIT_TYPE_LABELS[r.exitType]}</Badge> },
    ...(hasFloors ? [{
      key: 'kroki', header: 'Kroki', align: 'center' as const,
      cell: (r: ExitedSession) => (
        <IconButton title="Oturma planı krokisini gör" onClick={() => kroki.show(r.floorId)}>
          <KrokiIcon className="h-3.5 w-3.5" />
        </IconButton>
      ),
    }] : []),
  ]

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={LogOutIcon}
        title="Çıkanlar"
        subtitle={`Seçilen gün çıkış yapan üyeler${fmtDateLong(date) ? ` · ${fmtDateLong(date)}` : ''}`}
        actions={hasFloors && (
          <Button variant="outline" size="sm" onClick={() => kroki.show(null)}>
            <KrokiIcon className="h-4 w-4" /> Kroki
          </Button>
        )}
      />

      <FilterBar
        columns={2}
        hasActiveFilters={!!searchInput || date !== todayIso()}
        onClear={() => { setSearchInput(''); setSearch(''); goDate(todayIso()) }}
      >
        <FilterField label="Ara">
          <Input placeholder="Üye adı ara..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} iconLeft={<SearchIcon className="h-3.5 w-3.5" />} />
        </FilterField>
        <FilterField label="Tarih">
          <div className="flex items-center gap-1.5">
            <IconButton title="Önceki gün" onClick={() => goDate(shiftIso(date, -1))}><ChevronLeftIcon className="h-4 w-4" /></IconButton>
            <div className="min-w-0 flex-1"><DatePicker value={date} onChange={(v) => goDate(v || todayIso())} /></div>
            <IconButton title="Sonraki gün" onClick={() => goDate(shiftIso(date, 1))}><ChevronRightIcon className="h-4 w-4" /></IconButton>
            <Button variant="outline" size="sm" onClick={() => goDate(todayIso())}>Bugün</Button>
          </div>
        </FilterField>
      </FilterBar>

      <DataTable<ExitedSession>
        title="Çıkış Kayıtları"
        showRowNumbers
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        page={result?.page ?? 1}
        totalPages={result?.totalPages ?? 1}
        total={result?.total ?? 0}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        empty={<EmptyState icon={LogOutIcon} title="Çıkış kaydı yok" description="Seçilen güne ait çıkış kaydı bulunamadı." />}
      />

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={floors} initialFloorId={kroki.floorId} />
    </div>
  )
}
