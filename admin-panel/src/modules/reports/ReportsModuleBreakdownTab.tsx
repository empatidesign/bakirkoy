import { useNavigate } from 'react-router-dom'
import { LayersIcon, CheckCircle2Icon, ClockIcon, XCircleIcon, UsersIcon, ArrowRightIcon, ActivityIcon } from 'lucide-react'
import { Badge, DataTable, EmptyState, IconButton, type DataTableColumn } from '@/design-system'
import type { ReportsOverview, ReportsModuleStat, ReportsAttendanceStat } from '@/types/reports.types'

const MODULE_ROUTES: Record<string, string> = {
  events: '/events',
  sports: '/sports',
  kasif: '/kasif',
  pool: '/pool',
  'youth-camp': '/youth-camp',
  'scout-camp': '/scout-camp',
  'science-center': '/science-center',
  'accessible-life': '/accessible-life',
  'women-family': '/women-family',
  travels: '/travels',
  seda: '/seda',
  library: '/library',
  muhtarlik: '/muhtarlik',
  quiz: '/quiz',
  survey: '/survey',
  wheel: '/wheel',
  companies: '/companies',
}

const Delta = ({ pct }: { pct: number }) => {
  const up = pct >= 0
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: up ? 'hsl(var(--success-soft))' : 'hsl(var(--danger-soft))', color: up ? 'hsl(var(--success))' : 'hsl(var(--danger))' }}>
      {Math.abs(pct)}%
    </span>
  )
}

export const ReportsModuleBreakdownTab = ({ data, loading }: { data: ReportsOverview; loading: boolean }) => {
  const navigate = useNavigate()

  const columns: DataTableColumn<ReportsModuleStat>[] = [
    { key: 'label', header: 'Modül', sortable: true, cell: (r) => <span className="type-body-strong">{r.label}</span> },
    { key: 'total', header: 'Toplam', align: 'center', cell: (r) => <span className="tabular-nums font-semibold">{r.totalApplications.toLocaleString('tr-TR')}</span> },
    { key: 'approved', header: 'Onaylı', align: 'center', cell: (r) => <Badge tone="success">{r.approved.toLocaleString('tr-TR')}</Badge> },
    { key: 'pending', header: 'Bekleyen', align: 'center', cell: (r) => r.pending > 0 ? <Badge tone="warning">{r.pending.toLocaleString('tr-TR')}</Badge> : <span className="type-muted">—</span> },
    { key: 'waitlisted', header: 'Yedek', align: 'center', hideable: true, cell: (r) => r.waitlisted > 0 ? <Badge tone="info">{r.waitlisted.toLocaleString('tr-TR')}</Badge> : <span className="type-muted">—</span> },
    { key: 'rejected', header: 'Reddedilen', align: 'center', hideable: true, cell: (r) => r.rejected > 0 ? <Badge tone="danger">{r.rejected.toLocaleString('tr-TR')}</Badge> : <span className="type-muted">—</span> },
    { key: 'unique', header: 'Tekil Kişi', align: 'center', cell: (r) => <span className="tabular-nums">{r.uniquePeople.toLocaleString('tr-TR')}</span> },
    { key: 'delta', header: 'Önceki Döneme Göre', align: 'center', cell: (r) => <Delta pct={r.deltaPct} /> },
    {
      key: 'actions', header: '', align: 'right',
      cell: (r) => (
        MODULE_ROUTES[r.module] ? (
          <IconButton tone="default" title={`${r.label} modülüne git`} onClick={() => navigate(MODULE_ROUTES[r.module])}>
            <ArrowRightIcon className="h-4 w-4" />
          </IconButton>
        ) : null
      ),
    },
  ]

  const attendanceColumns: DataTableColumn<ReportsAttendanceStat>[] = [
    { key: 'label', header: 'Modül', cell: (r) => <span className="type-body-strong">{r.label}</span> },
    { key: 'total', header: 'Toplam Yoklama', align: 'center', cell: (r) => <span className="tabular-nums">{r.totalSessions.toLocaleString('tr-TR')}</span> },
    { key: 'present', header: 'Katıldı', align: 'center', cell: (r) => <Badge tone="success">{r.present.toLocaleString('tr-TR')}</Badge> },
    { key: 'late', header: 'Geç Katıldı', align: 'center', hideable: true, cell: (r) => r.late > 0 ? <Badge tone="warning">{r.late.toLocaleString('tr-TR')}</Badge> : <span className="type-muted">—</span> },
    { key: 'absent', header: 'Katılmadı', align: 'center', cell: (r) => r.absent > 0 ? <Badge tone="danger">{r.absent.toLocaleString('tr-TR')}</Badge> : <span className="type-muted">—</span> },
    {
      key: 'rate', header: 'Katılım Oranı', align: 'center',
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="tabular-nums font-semibold" style={{ color: r.attendanceRate >= 80 ? 'hsl(var(--success))' : r.attendanceRate >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--danger))' }}>
            %{r.attendanceRate}
          </span>
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable<ReportsModuleStat>
        title="Modül Bazlı Kırılım"
        columns={columns}
        rows={data.modules}
        rowKey={(r) => r.module}
        loading={loading}
        showRowNumbers
        empty={<EmptyState icon={LayersIcon} title="Veri yok" description="Seçili dönemde hiçbir modülde kayıt yok." />}
      />

      <DataTable<ReportsAttendanceStat>
        title="Yoklama / Devam Oranları"
        columns={attendanceColumns}
        rows={data.attendance}
        rowKey={(r) => r.module}
        loading={loading}
        showRowNumbers
        empty={<EmptyState icon={ActivityIcon} title="Yoklama verisi yok" description="Seçili dönemde yoklama kaydı bulunamadı." />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-card border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-foreground-muted"><CheckCircle2Icon className="h-4 w-4 text-success" /><span className="type-caption">Toplam Onaylı</span></div>
          <p className="mt-1 type-kpi-value tabular-nums">{data.modules.reduce((s, m) => s + m.approved, 0).toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-card border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-foreground-muted"><ClockIcon className="h-4 w-4 text-warning" /><span className="type-caption">Toplam Bekleyen</span></div>
          <p className="mt-1 type-kpi-value tabular-nums">{data.modules.reduce((s, m) => s + m.pending, 0).toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-card border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-foreground-muted"><XCircleIcon className="h-4 w-4 text-danger" /><span className="type-caption">Toplam Reddedilen</span></div>
          <p className="mt-1 type-kpi-value tabular-nums">{data.modules.reduce((s, m) => s + m.rejected, 0).toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-card border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-foreground-muted"><UsersIcon className="h-4 w-4 text-primary" /><span className="type-caption">Aktif Modül</span></div>
          <p className="mt-1 type-kpi-value tabular-nums">{data.modules.length}</p>
        </div>
      </div>
    </div>
  )
}
