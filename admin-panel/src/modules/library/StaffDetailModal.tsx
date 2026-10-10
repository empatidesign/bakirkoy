import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClockIcon, Phone, Mail, ShieldCheck, Briefcase, XIcon, PencilIcon, AlertTriangleIcon, CalendarDaysIcon, TrendingUpIcon } from 'lucide-react'
import { Modal, Badge, SkeletonRows, EmptyState, IconButton } from '@/design-system'
import libraryService from '@/services/library.service'
import { SHIFT_STATUS_LABELS } from '@/types/library.types'
import type { LibraryStaff, LibraryShift, StaffMesaiPeriodTotals } from '@/types/library.types'
import { fmtTime, fmtDuration, fmtDate, sumDailyBreakdown, startOfToday, daysAgo, startOfMonth } from './libraryHelpers'
import { ShiftEditModal } from './ShiftEditModal'

export const StaffDetailModal = ({
  staff, onClose, canEdit,
}: { staff: LibraryStaff | null; onClose: () => void; canEdit?: boolean }) => {
  const [history, setHistory] = useState<LibraryShift[] | null>(null)
  const [editingShift, setEditingShift] = useState<LibraryShift | null>(null)
  const [periodTotals, setPeriodTotals] = useState<StaffMesaiPeriodTotals | null>(null)

  const loadHistory = useCallback(() => {
    if (!staff) { setHistory(null); return }
    libraryService.staff.getShifts(staff.id)
      .then((h) => setHistory(h))
      .catch(() => setHistory([]))
  }, [staff])

  const loadPeriodTotals = useCallback(() => {
    if (!staff) { setPeriodTotals(null); return }
    const start = daysAgo(365).toISOString()
    const end = new Date().toISOString()
    libraryService.shifts.getStaffPeriodTotals(staff.id, start, end)
      .then(setPeriodTotals)
      .catch(() => setPeriodTotals(null))
  }, [staff])

  useEffect(() => {
    setHistory(null)
    setPeriodTotals(null)
    loadHistory()
    loadPeriodTotals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id])

  const submitEdit = async (shiftId: string, startIso: string, endIso: string, reason: string) => {
    await libraryService.shifts.edit(shiftId, { startTime: startIso, endTime: endIso, reason })
    toast.success('Mesai saati güncellendi.')
    loadHistory()
    loadPeriodTotals()
  }

  const initials = staff?.fullName
    ? staff.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <Modal
      open={!!staff}
      onClose={onClose}
      width={760}
      hideCloseButton
      header={
        <div className="-mx-6 -my-4 relative overflow-hidden bg-gradient-library">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-field text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-4 px-6 py-5 pr-14">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-lg"
              style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}
            >
              {initials}
            </span>
            <div>
              <p className="text-lg font-bold text-white">{staff?.fullName}</p>
              <p className="text-[12px] text-white/70">{staff?.roleName || 'Personel'}</p>
              <span className="mt-1.5 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold bg-white/20 text-white">
                {staff?.isActive ? 'Aktif' : 'Pasif'}
              </span>
            </div>
          </div>
        </div>
      }
    >
      {staff && (
        <div>
          <div className="space-y-4 p-5">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-surface-1 px-4 py-3">
                <p className="text-sm font-semibold text-foreground-strong">Personel Bilgileri</p>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10">
                    <Briefcase className="h-3.5 w-3.5 text-accent-blue" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Rol</p>
                    <p className="text-sm font-semibold text-foreground-default">{staff.roleName || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-green/10">
                    <ShieldCheck className="h-3.5 w-3.5 text-accent-green" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Durum</p>
                    <Badge tone={staff.isActive ? 'success' : 'neutral'}>{staff.isActive ? 'Aktif' : 'Pasif'}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-soft">
                    <Phone className="h-3.5 w-3.5 text-info" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Telefon</p>
                    <p className="text-sm font-semibold text-foreground-default">{staff.phone || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-violet/10">
                    <Mail className="h-3.5 w-3.5 text-accent-violet" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">E-posta</p>
                    <p className="text-sm font-semibold text-foreground-default truncate max-w-[240px]">{staff.email || '—'}</p>
                  </div>
                </div>
              </div>
            </div>

            {periodTotals && periodTotals.dailyBreakdown.length > 0 && (() => {
              const today = sumDailyBreakdown(periodTotals.dailyBreakdown, startOfToday(), new Date())
              const week = sumDailyBreakdown(periodTotals.dailyBreakdown, daysAgo(6), new Date())
              const month = sumDailyBreakdown(periodTotals.dailyBreakdown, startOfMonth(), new Date())
              return (
                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border bg-surface-1 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground-strong">
                      <TrendingUpIcon className="h-3.5 w-3.5 text-primary" />
                      Çalışma Süresi Özeti
                    </p>
                    <span className="type-caption">Son 1 yıl · toplam {fmtDuration(periodTotals.totalMinutes)}</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border">
                    <div className="flex flex-col items-center gap-1 px-3 py-3.5">
                      <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Bugün</p>
                      <p className="tabular-nums text-base font-bold text-foreground-strong">{fmtDuration(today.totalMinutes)}</p>
                      <p className="type-caption tabular-nums">{today.shiftCount} mesai</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-3 py-3.5">
                      <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Bu Hafta</p>
                      <p className="tabular-nums text-base font-bold text-foreground-strong">{fmtDuration(week.totalMinutes)}</p>
                      <p className="type-caption tabular-nums">{week.shiftCount} mesai</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 px-3 py-3.5">
                      <p className="text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">Bu Ay</p>
                      <p className="tabular-nums text-base font-bold text-primary">{fmtDuration(month.totalMinutes)}</p>
                      <p className="type-caption tabular-nums">{month.shiftCount} mesai</p>
                    </div>
                  </div>
                  <div className="border-t border-border px-4 py-2.5">
                    <p className="type-caption flex items-center gap-1.5">
                      <CalendarDaysIcon className="h-3 w-3" />
                      İlk mesai: {periodTotals.firstShiftStart ? fmtDate(periodTotals.firstShiftStart) : '—'}
                      {periodTotals.lastShiftEnd && <> · Son çıkış: {fmtDate(periodTotals.lastShiftEnd)}</>}
                    </p>
                  </div>
                  {periodTotals.hasWeekOverLimit && (
                    <div className="border-t border-border bg-warning-soft px-4 py-2.5">
                      <p className="type-caption flex items-center gap-1.5 text-warning">
                        <AlertTriangleIcon className="h-3 w-3" />
                        Son 1 yıl içinde en az bir hafta {periodTotals.maxWeeklyHours ?? 60} saatlik sınırı aştı — kontrol edilmesi önerilir.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-surface-1 px-4 py-3">
                <p className="text-sm font-semibold text-foreground-strong">Mesai Geçmişi</p>
                {history && history.length > 0 && (
                  <span className="text-xs text-foreground-subtle">
                    {history.length} kayıt{history.length >= 100 ? ' (en yeni 100)' : ''}
                  </span>
                )}
              </div>
              {history && history.length >= 100 && (
                <div className="border-b border-border bg-surface-1 px-4 py-1.5 text-[11px] text-foreground-subtle">
                  Yalnızca en yeni 100 kayıt gösteriliyor. Daha eski kayıtlar için Mesai Raporları sayfasındaki detaylı filtreleri kullanın.
                </div>
              )}

              {history === null ? (
                <div className="p-4">
                  <SkeletonRows rows={3} />
                </div>
              ) : history.length === 0 ? (
                <div className="py-6">
                  <EmptyState icon={ClockIcon} title="Mesai kaydı yok" description="Bu personelin geçmiş mesai kaydı bulunmuyor." />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {history.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="type-body-strong truncate flex items-center gap-1.5">
                          {fmtDate(s.startTime)} · {s.libraryName}
                          {s.autoClosedAtCutoff && (
                            <span title="Gün sonu otomatik kapatıldı">
                              <AlertTriangleIcon className="h-3.5 w-3.5 text-warning" />
                            </span>
                          )}
                        </p>
                        <p className="type-caption tabular-nums">
                          {fmtTime(s.startTime)} – {s.endTime ? fmtTime(s.endTime) : 'devam ediyor'}
                          {s.wasEdited && <span className="ml-1.5 text-warning">· düzenlendi</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {s.workedMinutes == null ? (
                          <span
                            className="tabular-nums type-caption text-foreground-subtle"
                            title="Kaynak sistemde bu kaydın çıkış zamanı toplu/otomatik kapatma olduğu için gerçek süre hesaplanamadı."
                          >
                            Süre bilinmiyor
                          </span>
                        ) : (
                          <span className="tabular-nums type-body-strong">{fmtDuration(s.workedMinutes)}</span>
                        )}
                        <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{SHIFT_STATUS_LABELS[s.status]}</Badge>
                        {canEdit && s.status === 'ended' && (
                          <IconButton tone="primary" title="Giriş/çıkış saatini düzenle" onClick={() => setEditingShift(s)}>
                            <PencilIcon className="h-3.5 w-3.5" />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ShiftEditModal shift={editingShift} onClose={() => setEditingShift(null)} onSubmit={submitEdit} />
    </Modal>
  )
}
