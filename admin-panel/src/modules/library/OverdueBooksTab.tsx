import { useCallback, useEffect, useState } from 'react'
import { AlertTriangleIcon, SearchIcon } from 'lucide-react'
import {
  SectionToolbar, DataTable, FilterBar, FilterField, Input, Select, Badge,
  EmptyState, type DataTableColumn,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import { maskTC } from '@/lib/utils'
import libraryService from '@/services/library.service'
import type { EmanetStatus, OverdueBookEntry } from '@/types/library.types'
import type { PagedResult, SelectOption } from '@/types/common'
import { fmtDate } from './libraryHelpers'

export const OverdueBooksTab = ({ libraryId, refreshKey }: { libraryId: string; refreshKey?: number }) => {
  const { state } = useAuth()
  const isSuperAdmin = state.status === 'authenticated' && state.user.isSuperAdmin === true

  const [result, setResult] = useState<PagedResult<OverdueBookEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedLibraryId, setSelectedLibraryId] = useState(isSuperAdmin ? '' : libraryId)
  const [libraryOptions, setLibraryOptions] = useState<SelectOption[]>([])
  const [emanet, setEmanet] = useState<EmanetStatus | null>(null)
  useEffect(() => { libraryService.overdue.getStatus().then(setEmanet).catch(() => setEmanet(null)) }, [refreshKey])

  useEffect(() => {
    if (isSuperAdmin) {
      libraryService.getOptions().then(setLibraryOptions).catch(() => setLibraryOptions([]))
    }
  }, [isSuperAdmin])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: { page: number; limit: number; libraryId?: string; search?: string } = {
        page,
        limit,
        libraryId: selectedLibraryId || undefined,
        search: search || undefined,
      }
      setResult(await libraryService.overdue.getAll(params))
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, selectedLibraryId, search])

  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { if (refreshKey) fetchList() }, [refreshKey, fetchList])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const rows = result?.items ?? []

  const columns: DataTableColumn<OverdueBookEntry>[] = [
    {
      key: 'memberName',
      header: 'Üye Adı',
      sortable: true,
      sortKey: 'memberName',
      cell: (r) => <span className="type-body-strong">{r.memberName}</span>,
    },
    {
      key: 'tckn',
      header: 'TC Kimlik',
      cell: (r) => <span className="tabular-nums type-muted">{maskTC(r.tckn)}</span>,
    },
    ...(isSuperAdmin
      ? [
          {
            key: 'libraryName',
            header: 'Kütüphane',
            cell: (r: OverdueBookEntry) => <span className="type-body">{r.libraryName}</span>,
          },
        ]
      : []),
    {
      key: 'bookTitle',
      header: 'Kitap Adı',
      cell: (r) => <span className="type-body">{r.bookTitle}</span>,
    },
    {
      key: 'bookAuthor',
      header: 'Yazar',
      cell: (r) => <span className="type-muted">{r.bookAuthor ?? '-'}</span>,
    },
    {
      key: 'dueDate',
      header: 'İade Tarihi',
      sortable: true,
      sortKey: 'dueDate',
      cell: (r) => <span className="tabular-nums type-body">{fmtDate(r.dueDate)}</span>,
    },
    {
      key: 'daysOverdue',
      header: 'Gecikme',
      align: 'center' as const,
      sortable: true,
      sortKey: 'daysOverdue',
      cell: (r) => (
        <Badge tone={r.daysOverdue >= 7 ? 'danger' : 'warning'}>
          {r.daysOverdue} gün
        </Badge>
      ),
    },
  ]

  const hasActiveFilters = !!searchInput || (isSuperAdmin && !!selectedLibraryId)

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={AlertTriangleIcon}
        title="Gecikmiş Kitaplar"
        subtitle="İade tarihi geçmiş emanet kayıtları"
      />

      {emanet && (!emanet.enabled || !emanet.configured) && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground-strong">
          <b>Flexcity ödünç kitap bağlantısı kapalı.</b> Bu yüzden liste boş görünür ve girişte gecikmiş kitap uyarısı çıkmaz.
          Kullanmak isterseniz <b>Ayarlar → Entegrasyonlar → Flexcity</b> bölümünden adres ve anahtarları girip açabilirsiniz.
        </div>
      )}
      {emanet?.enabled && emanet.configured && emanet.lastErrorAt && (!emanet.lastSuccessAt || emanet.lastErrorAt > emanet.lastSuccessAt) && (
        <div className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-foreground-strong">
          <b>Flexcity'ye ulaşılamıyor.</b> Son hata: {emanet.lastError} ({fmtDate(emanet.lastErrorAt)}). Liste eksik olabilir.
        </div>
      )}

      <FilterBar
        columns={isSuperAdmin ? 2 : 1}
        hasActiveFilters={hasActiveFilters}
        onClear={() => {
          setSearchInput('')
          setSearch('')
          if (isSuperAdmin) setSelectedLibraryId('')
          setPage(1)
        }}
      >
        <FilterField label="Ara">
          <Input
            placeholder="Üye adı veya kitap ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        </FilterField>
        {isSuperAdmin && (
          <FilterField label="Kütüphane">
            <Select
              value={selectedLibraryId}
              onChange={(e) => { setSelectedLibraryId(e.target.value); setPage(1) }}
            >
              <option value="">Tüm Kütüphaneler</option>
              {libraryOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FilterField>
        )}
      </FilterBar>

      <DataTable<OverdueBookEntry>
        title="Gecikmiş Emanet Listesi"
        showRowNumbers
        columns={columns}
        rows={rows}
        rowKey={(r) => `${r.tckn}-${r.bookTitle}-${r.dueDate}`}
        loading={loading}
        page={result?.page ?? 1}
        totalPages={result?.totalPages ?? 1}
        total={result?.total ?? 0}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        empty={
          <EmptyState
            icon={AlertTriangleIcon}
            title="Gecikmiş kitap bulunamadı"
            description="Şu an iade tarihi geçmiş emanet kaydı yok."
          />
        }
      />
    </div>
  )
}
