import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClockIcon, UsersRoundIcon, BuildingIcon, AlertTriangleIcon, PencilRulerIcon, DownloadIcon,
  CalendarDaysIcon, TableIcon, ListIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  StatCard, FilterBar, FilterField, Select, Button, SectionToolbar, EmptyState, Badge,
} from '@/design-system'
import libraryService from '@/services/library.service'
import type { MesaiMonthlyReport, MesaiMonthlyStaffRow } from '@/types/library.types'
import type { SelectOption } from '@/types/common'
import { fmtDuration } from './libraryHelpers'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const DAY_SHORT = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']
const hm = (min: number) => (min > 0 ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : '')

type View = 'staff' | 'grid' | 'library'

/** Yönetici: seçili ay için kişi bazlı toplam, kişi × gün saat tablosu, kütüphane bazlı toplam ve Excel. */
export const MesaiMonthlyReportPanel = () => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [libraryId, setLibraryId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [view, setView] = useState<View>('staff')
  const [data, setData] = useState<MesaiMonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [libraryOptions, setLibraryOptions] = useState<SelectOption[]>([])
  const [staffOptions, setStaffOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    libraryService.getOptions().then(setLibraryOptions).catch(() => setLibraryOptions([]))
    libraryService.staff.getList({ page: 1, limit: 500 })
      .then((r) => setStaffOptions(r.items.map((s) => ({ value: s.id, label: s.fullName }))))
      .catch(() => setStaffOptions([]))
  }, [])

  const params = useMemo(() => ({ year, month, libraryId: libraryId || undefined, staffId: staffId || undefined }), [year, month, libraryId, staffId])

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await libraryService.shifts.getMonthlyReport(params)) }
    catch { setData(null); toast.error('Rapor yüklenemedi') }
    finally { setLoading(false) }
  }, [params])
  useEffect(() => { load() }, [load])

  const exportExcel = async () => {
    setExporting(true)
    try {
      const blob = await libraryService.shifts.exportMonthlyReport(params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mesai-raporu-${year}-${String(month).padStart(2, '0')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Excel indirilemedi') }
    finally { setExporting(false) }
  }

  const days = data?.daysInMonth ?? 0
  const weekday = (d: number) => new Date(year, month - 1, d).getDay()
  const maxDay = Math.max(1, ...(data?.staff.flatMap((s) => s.dayMinutes) ?? [0]))

  const tabBtn = (v: View, label: string, Icon: typeof ListIcon) => (
    <button type="button" onClick={() => setView(v)}
      className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors ${
        view === v ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface-1 text-foreground-muted hover:bg-surface-2'}`}>
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  )

  const staffRow = (s: MesaiMonthlyStaffRow, i: number) => (
    <Fragment key={s.staffId}>
      <tr className="cursor-pointer border-t border-border/60 hover:bg-surface-2"
        onClick={() => setExpanded(expanded === s.staffId ? null : s.staffId)}>
        <td className="px-3 py-2 text-center tabular-nums text-foreground-muted">{i + 1}</td>
        <td className="px-3 py-2"><div className="type-body-strong">{s.staffName}</div>{s.roleName && <div className="type-caption text-foreground-muted">{s.roleName}</div>}</td>
        <td className="px-3 py-2 text-center font-semibold tabular-nums">{fmtDuration(s.totalMinutes)}</td>
        <td className="px-3 py-2 text-center tabular-nums">{s.workedDays}</td>
        <td className="px-3 py-2 text-center tabular-nums">{s.shiftCount}</td>
        <td className="px-3 py-2 text-center tabular-nums">{fmtDuration(s.avgDailyMinutes)}</td>
        <td className="px-3 py-2 text-center tabular-nums">{fmtDuration(s.longestDayMinutes)}</td>
        <td className="px-3 py-2 text-center">
          {s.autoClosedCount > 0 && <Badge tone="warning">{s.autoClosedCount} otomatik</Badge>}{' '}
          {s.editedCount > 0 && <Badge tone="info">{s.editedCount} düzenlendi</Badge>}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {s.byLibrary.map((b) => <Badge key={b.libraryId} tone="neutral">{b.libraryName}: {fmtDuration(b.totalMinutes)}</Badge>)}
          </div>
        </td>
      </tr>
      {expanded === s.staffId && (
        <tr className="bg-surface-1">
          <td />
          <td colSpan={8} className="px-3 py-3">
            <div className="mb-2 type-caption text-foreground-muted">İlk giriş: {s.firstEntry ?? '-'} · Son çıkış: {s.lastExit ?? '-'}</div>
            <div className="flex flex-wrap gap-1.5">
              {s.dayMinutes.map((m, d) => m > 0 && (
                <div key={d} className="rounded-md border border-border bg-surface-0 px-2 py-1 text-center">
                  <div className="type-caption text-foreground-muted">{d + 1} {DAY_SHORT[weekday(d + 1)]}</div>
                  <div className="text-xs font-semibold tabular-nums">{hm(m)}</div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )

  return (
    <div className="space-y-5 p-5">
      <FilterBar columns={4} hasActiveFilters={!!libraryId || !!staffId} onClear={() => { setLibraryId(''); setStaffId('') }}>
        <FilterField label="Yıl">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 4 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Ay">
          <Select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Kütüphane">
          <Select value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
            <option value="">Tüm Kütüphaneler</option>
            {libraryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Personel">
          <Select searchable searchPlaceholder="Personel ara..." value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Tüm Personel</option>
            {staffOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Aylık Toplam Süre" value={fmtDuration(data?.totalMinutes ?? 0)} icon={ClockIcon} accent="green" loading={loading} />
        <StatCard label="Mesai Sayısı" value={data?.shiftCount ?? 0} icon={CalendarDaysIcon} accent="blue" loading={loading} />
        <StatCard label="Çalışan Personel" value={data?.staffCount ?? 0} icon={UsersRoundIcon} accent="violet" loading={loading}
          hint={data && data.staffCount > 0 ? `Kişi başı ort. ${fmtDuration(Math.round(data.totalMinutes / data.staffCount))}` : undefined} />
        <StatCard label="Otomatik Kapanan" value={data?.autoClosedCount ?? 0} icon={AlertTriangleIcon} accent="orange" loading={loading}
          hint="Çıkış yapılmadı, 23:00'te kapandı" />
        <StatCard label="Düzenlenen" value={data?.editedCount ?? 0} icon={PencilRulerIcon} accent="primary" loading={loading} />
      </div>

      <SectionToolbar
        icon={TableIcon}
        title={`${MONTHS[month - 1]} ${year} Mesai Raporu`}
        subtitle="Satıra tıklayınca kişinin gün gün saatleri açılır. Gece yarısını aşan mesai iki güne bölünür."
        actions={<Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting || !data?.shiftCount}>
          <DownloadIcon className="h-4 w-4" /> {exporting ? 'Hazırlanıyor...' : "Excel'e Aktar"}
        </Button>}
      />

      <div className="flex flex-wrap gap-2">
        {tabBtn('staff', 'Personel Bazında', UsersRoundIcon)}
        {tabBtn('grid', 'Gün Gün Saat Tablosu', TableIcon)}
        {tabBtn('library', 'Kütüphane Bazında', BuildingIcon)}
      </div>

      {!loading && !data?.shiftCount ? (
        <EmptyState icon={ClockIcon} title="Kayıt yok" description="Seçili ay ve filtrelerde mesai bulunamadı." />
      ) : view === 'staff' ? (
        <div className="overflow-auto rounded-xl border border-border bg-surface-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-left type-caption text-foreground-muted">
              <tr>
                <th className="px-3 py-2 text-center">#</th><th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2 text-center">Aylık Toplam</th><th className="px-3 py-2 text-center">Çalıştığı Gün</th>
                <th className="px-3 py-2 text-center">Mesai</th><th className="px-3 py-2 text-center">Günlük Ort.</th>
                <th className="px-3 py-2 text-center">En Uzun Gün</th><th className="px-3 py-2 text-center">Uyarı</th>
                <th className="px-3 py-2">Kütüphane Dağılımı</th>
              </tr>
            </thead>
            <tbody>{data?.staff.map(staffRow)}</tbody>
          </table>
        </div>
      ) : view === 'grid' ? (
        <div className="overflow-auto rounded-xl border border-border bg-surface-0">
          <table className="text-xs">
            <thead className="bg-surface-1 type-caption text-foreground-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-1 px-3 py-2 text-left">Personel</th>
                {Array.from({ length: days }, (_, d) => {
                  const wd = weekday(d + 1)
                  return <th key={d} className={`px-1.5 py-2 text-center ${wd === 0 || wd === 6 ? 'text-danger' : ''}`}>{d + 1}<br />{DAY_SHORT[wd]}</th>
                })}
                <th className="px-3 py-2 text-center">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {data?.staff.map((s) => (
                <tr key={s.staffId} className="border-t border-border/60">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-0 px-3 py-1.5 font-semibold">{s.staffName}</td>
                  {s.dayMinutes.map((m, d) => (
                    <td key={d} className="px-1 py-1.5 text-center tabular-nums"
                      style={m > 0 ? { background: `rgba(34,197,94,${0.12 + 0.5 * (m / maxDay)})` } : undefined}
                      title={m > 0 ? `${d + 1}. gün: ${fmtDuration(m)}` : undefined}>{hm(m)}</td>
                  ))}
                  <td className="px-3 py-1.5 text-center font-semibold tabular-nums">{hm(s.totalMinutes)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-surface-1 font-semibold">
                <td className="sticky left-0 z-10 bg-surface-1 px-3 py-1.5">Günlük Toplam</td>
                {data?.daily.map((d) => <td key={d.date} className="px-1 py-1.5 text-center tabular-nums">{hm(d.totalMinutes)}</td>)}
                <td className="px-3 py-1.5 text-center tabular-nums">{hm(data?.totalMinutes ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-surface-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 text-left type-caption text-foreground-muted">
              <tr><th className="px-3 py-2">Kütüphane</th><th className="px-3 py-2 text-center">Toplam Süre</th>
                <th className="px-3 py-2 text-center">Mesai</th><th className="px-3 py-2 text-center">Personel</th><th className="px-3 py-2 text-center">Açık Olduğu Gün</th></tr>
            </thead>
            <tbody>
              {data?.libraries.map((l) => (
                <tr key={l.libraryId} className="border-t border-border/60">
                  <td className="px-3 py-2 type-body-strong">{l.libraryName}</td>
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{fmtDuration(l.totalMinutes)}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{l.shiftCount}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{l.staffCount}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{l.workedDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
