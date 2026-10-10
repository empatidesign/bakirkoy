import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ClockIcon, PencilIcon, QrCodeIcon, HistoryIcon } from 'lucide-react'
import { Modal, Button, Badge, EmptyState, Skeleton, SegmentedControl, ConfirmModal } from '@/design-system'
import type { SegmentOption } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import type { FacilityModuleService } from './types'
import type { AttendanceHistoryItem, AttendanceStatus } from '@/types/facility.types'

interface Props {
  open: boolean
  onClose: () => void
  service: FacilityModuleService
  registrationId: string
  participantName: string
  onRevised?: () => void
}

const STATUS_LABEL: Record<AttendanceStatus, string> = { present: 'Geldi', late: 'Geç', absent: 'Gelmedi', none: '—' }
const STATUS_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = { present: 'success', late: 'warning', absent: 'danger', none: 'neutral' }

const STATUS_OPTIONS: SegmentOption[] = [
  { value: 'present', label: 'Geldi', tone: 'green' },
  { value: 'late', label: 'Geç', tone: 'orange' },
  { value: 'absent', label: 'Gelmedi', tone: 'red' },
]

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const AttendanceHistoryModal = ({ open, onClose, service, registrationId, participantName, onRevised }: Props) => {
  const { can } = useAuth()
  const canEdit = can('facility-attendance.edit')
  const [items, setItems] = useState<AttendanceHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<AttendanceHistoryItem | null>(null)
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present')
  const [busy, setBusy] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!open || !registrationId) return
    setLoading(true)
    try {
      setItems(await service.attendance.getHistoryByRegistration(registrationId))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [open, registrationId, service])

  useEffect(() => { load() }, [load])

  const openEdit = (item: AttendanceHistoryItem) => {
    setEditing(item)
    setNewStatus(item.status === 'none' ? 'present' : item.status)
  }

  const errInfo = (e: unknown): { code?: string; message?: string } => {
    const data = (e as { response?: { data?: { errorCode?: string; message?: string } } })?.response?.data
    return { code: data?.errorCode, message: data?.message }
  }

  const doRevise = async (confirm: boolean) => {
    if (!editing) return
    setBusy(true)
    try {
      await service.attendance.reviseByRegistration(registrationId, editing.sessionId, newStatus, confirm)
      toast.success('Yoklama kaydı revize edildi.')
      setEditing(null)
      setConfirmMessage(null)
      await load()
      onRevised?.()
    } catch (e) {
      const { code, message } = errInfo(e)
      if (code === 'ATTENDANCE_ENTERED_BUT_ABSENT_CONFIRM' || code === 'ATTENDANCE_NOT_CHECKED_IN')
        setConfirmMessage(message ?? 'Bu değişiklik onay gerektiriyor. Yine de kaydetmek istiyor musunuz?')
      else
        toast.error(message ?? 'Revize işlemi başarısız oldu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Yoklama / Devamsızlık Geçmişi"
        subtitle={participantName}
        width={640}
        footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Kapat</Button></div>}
      >
        <div className="p-5">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <EmptyState icon={HistoryIcon} title="Yoklama kaydı yok" description="Bu katılımcı için henüz seans bazlı yoklama kaydı bulunmuyor." />
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.attendanceId} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3">
                  <div className="min-w-0">
                    <p className="type-body-strong">{fmtDate(it.sessionDate)}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] text-foreground-muted">
                        <ClockIcon className="h-3 w-3" /> {it.startTime}–{it.endTime}
                      </span>
                      {it.checkedInViaQr && (
                        <Badge tone="info"><QrCodeIcon className="h-3 w-3" /> QR ile giriş</Badge>
                      )}
                      {it.markedBy && <span className="text-[11px] text-foreground-muted">İşleyen: {it.markedBy}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={STATUS_TONE[it.status]}>{STATUS_LABEL[it.status]}</Badge>
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(it)}>
                        <PencilIcon className="h-3.5 w-3.5" /> Revize Et
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Yoklamayı Revize Et"
        subtitle={editing ? `${fmtDate(editing.sessionDate)} · ${editing.startTime}–${editing.endTime}` : ''}
        width={420}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>İptal</Button>
            <Button onClick={() => doRevise(false)} isLoading={busy}>Kaydet</Button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          <p className="type-caption">Bu seans için yeni durum seçin. Değişiklik katılımcının devamsızlık hakkını yeniden hesaplar.</p>
          <SegmentedControl value={newStatus} onChange={(v) => setNewStatus(v as AttendanceStatus)} columns={3} options={STATUS_OPTIONS} />
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmMessage}
        onClose={() => setConfirmMessage(null)}
        onConfirm={() => doRevise(true)}
        title="Onay Gerekiyor"
        description={confirmMessage ?? ''}
        confirmLabel="Yine de Kaydet"
        cancelLabel="Vazgeç"
        tone="primary"
        icon={QrCodeIcon}
        loading={busy}
      />
    </>
  )
}
