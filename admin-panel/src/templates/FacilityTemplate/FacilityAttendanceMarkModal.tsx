import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { UsersIcon, CheckCircle2Icon, XCircleIcon, LockIcon, QrCodeIcon, PencilIcon } from 'lucide-react'
import { Modal, Button, Badge, EmptyState, Skeleton, Banner, ConfirmModal } from '@/design-system'
import { AttendanceTable } from '@/components/specialized/AttendanceTable'
import { useAuth } from '@/framework/auth/AuthContext'
import type { FacilityModuleService } from './types'
import type { AttendanceRosterItem, AttendanceStatus } from '@/types/facility.types'

interface Props {
  open: boolean
  onClose: () => void
  service: FacilityModuleService
  sessionId: string
  groupName: string
  alreadyTaken?: boolean
  lateTrackingEnabled?: boolean
  onSaved: () => void
}

const remainingTone = (used: number, limit: number): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (limit <= 0) return 'neutral'
  const remaining = limit - used
  if (remaining <= 0) return 'danger'
  if (remaining === 1) return 'warning'
  return 'success'
}

export const FacilityAttendanceMarkModal = ({ open, onClose, service, sessionId, groupName, alreadyTaken, lateTrackingEnabled = true, onSaved }: Props) => {
  const { can } = useAuth()
  const canEditAttendance = can('facility-attendance.edit')
  const [roster, setRoster] = useState<AttendanceRosterItem[]>([])
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  const marksFromRoster = (items: AttendanceRosterItem[]) =>
    Object.fromEntries(items.map((x) => [x.registrationId, x.status === 'none' ? 'present' : x.status])) as Record<string, AttendanceStatus>

  useEffect(() => {
    if (!open || !sessionId) return
    let active = true
    setEditing(false)
    setLoading(true)
    service.attendance.getRoster(sessionId)
      .then((items) => {
        if (!active) return
        setRoster(items)
        setMarks(marksFromRoster(items))
      })
      .catch(() => { if (active) setRoster([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, sessionId, service])

  const editable = !alreadyTaken || editing

  const setAll = (status: AttendanceStatus) =>
    setMarks(Object.fromEntries(roster.map((x) => [x.registrationId, status])))

  const cancelEditing = () => { setMarks(marksFromRoster(roster)); setEditing(false) }

  const errInfo = (e: unknown): { code?: string; message?: string } => {
    const data = (e as { response?: { data?: { errorCode?: string; message?: string } } })?.response?.data
    return { code: data?.errorCode, message: data?.message }
  }

  const doSave = async (confirm: boolean) => {
    setSaving(true)
    try {
      const payload = roster.map((x) => ({ registrationId: x.registrationId, status: marks[x.registrationId] ?? 'absent' as AttendanceStatus }))
      const res = editing
        ? await service.attendance.correctRoster(sessionId, payload, confirm)
        : await service.attendance.saveRoster(sessionId, payload, confirm)
      const removedNote = res.removed > 0 ? ` ${res.removed} kişi devamsızlık hakkı dolduğu için programdan çıkarıldı.` : ''
      toast.success((editing ? 'Devamsızlık düzeltmesi kaydedildi.' : 'Yoklama kaydedildi.') + removedNote)
      setConfirmMessage(null)
      onSaved()
      onClose()
    } catch (e) {
      const { code, message } = errInfo(e)
      if (code === 'ATTENDANCE_ENTERED_BUT_ABSENT_CONFIRM')
        setConfirmMessage(message ?? 'Bazı katılımcılar tesise QR ile giriş yapmış. Yine de kaydetmek istiyor musunuz?')
      else if (code === 'SESSION_NOT_STARTED')
        toast.error(message ?? 'Seans henüz başlamadı. Yoklama alınamaz.')
      else if (code === 'SESSION_ENDED')
        toast.error(message ?? 'Seans sona erdi. Yeni yoklama girilemez.')
      else if (code === 'LATE_TRACKING_DISABLED')
        toast.error(message ?? 'Bu grupta "Geç Gelme Takibi" kapalı.')
      else if (message)
        toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const mainCount = roster.filter((r) => r.kind === 'main').length
  const reserveCount = roster.filter((r) => r.kind === 'reserve').length

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Devamsızlık Düzelt' : 'Yoklama Al'}
      subtitle={groupName}
      width={760}
      footer={
        !editable ? (
          <div className="flex items-center justify-end gap-2">
            {alreadyTaken && canEditAttendance && (
              <Button variant="outline" onClick={() => setEditing(true)} disabled={roster.length === 0}>
                <PencilIcon className="h-4 w-4" /> Devamsızlık Düzelt
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Kapat</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={() => setAll('present')} disabled={roster.length === 0}>
                <CheckCircle2Icon className="h-4 w-4" /> Tümü Geldi
              </Button>
              <Button variant="danger" size="sm" onClick={() => setAll('absent')} disabled={roster.length === 0}>
                <XCircleIcon className="h-4 w-4" /> Tümü Gelmedi
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={editing ? cancelEditing : onClose}>İptal</Button>
              <Button onClick={() => doSave(false)} isLoading={saving} disabled={roster.length === 0}>
                {editing ? 'Düzeltmeyi Kaydet' : 'Yoklamayı Kaydet'}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="p-6">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : roster.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Kayıtlı katılımcı yok" description="Bu grupta aktif kayıt bulunmuyor." />
        ) : (
          <div className="space-y-4">
            {alreadyTaken && !editing && (
              <Banner tone="info" variant="soft" icon={LockIcon}>
                Bu seansın yoklaması alınmıştır. Liste salt-okunurdur{canEditAttendance ? '; devamsızlığı düzeltmek için “Devamsızlık Düzelt”e tıklayın.' : '.'}
              </Banner>
            )}
            {editing && (
              <Banner tone="warning" variant="soft" icon={PencilIcon}>
                Devamsızlık düzeltme modundasınız. Kaydedince katılımcıların devamsızlık ve kalan hakları yeniden hesaplanır.
              </Banner>
            )}
            <div className="flex items-center gap-2">
              <Badge tone="info">Asıl: {mainCount}</Badge>
              <Badge tone="neutral">Yedek: {reserveCount}</Badge>
            </div>
            <AttendanceTable
              editable={editable}
              lateEnabled={lateTrackingEnabled}
              marks={marks}
              onChange={(ids, st) => setMarks((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, st])) }))}
              rows={roster.map((r) => ({
                id: r.registrationId,
                name: r.fullName,
                badges: (
                  <>
                    {r.kind === 'reserve' && <Badge tone="neutral">Yedek</Badge>}
                    {r.checkedInViaQr && <Badge tone="success"><QrCodeIcon className="h-3 w-3" /> QR ile giriş</Badge>}
                  </>
                ),
                meta: (
                  <>
                    <span className="type-caption">Devamsızlık: {r.absenceUsed}{r.absenceLimit > 0 ? ` / ${r.absenceLimit}` : ''}</span>
                    {r.absenceLimit > 0 && (
                      <Badge tone={remainingTone(r.absenceUsed, r.absenceLimit)}>Kalan hak: {Math.max(r.absenceLimit - r.absenceUsed, 0)}</Badge>
                    )}
                    {r.consecutiveAbsenceLimit > 0 && (
                      <Badge tone={remainingTone(r.consecutiveAbsenceUsed, r.consecutiveAbsenceLimit)}>Üst üste: {r.consecutiveAbsenceUsed} / {r.consecutiveAbsenceLimit}</Badge>
                    )}
                  </>
                ),
              }))}
            />
          </div>
        )}
      </div>
    </Modal>
    <ConfirmModal
      open={!!confirmMessage}
      onClose={() => setConfirmMessage(null)}
      onConfirm={() => doSave(true)}
      title="Tesise giriş yapan katılımcılar var"
      description={confirmMessage ?? ''}
      confirmLabel="Yine de Kaydet"
      cancelLabel="Vazgeç"
      tone="primary"
      icon={QrCodeIcon}
      loading={saving}
    />
    </>
  )
}
