import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { UsersIcon, CheckCircle2Icon, XCircleIcon, LockIcon, PencilIcon, BusIcon, ArmchairIcon, AlertTriangleIcon } from 'lucide-react'
import { Modal, Button, Badge, EmptyState, Skeleton, Banner } from '@/design-system'
import { AttendanceTable } from '@/components/specialized/AttendanceTable'
import { useAuth } from '@/framework/auth/AuthContext'
import { maskTC } from '@/lib/utils'
import travelService from '@/services/travel.service'
import type { Travel, TravelAttendanceRosterItem, TravelAttendanceStatus } from '@/types/travel.types'

/**
 * Kullanıcı isteği (2026-09-30): Facility modüllerindeki (Spor Salonu, Havuz vb.) "Yoklama Al"
 * ekranıyla — Tümü Geldi/Tümü Gelmedi toplu aksiyonları + checkbox'lı AttendanceTable —
 * birebir aynı desende Gezi (Travels) modülüne yoklama ekranı. Backend (TravelAttendanceService)
 * roster/save/reopen zaten hazırdı, admin-panel'de hiç UI yoktu (bkz. DevNotesPage.tsx
 * "travels-extra" — "YAZILACAK" olarak işaretliydi).
 *
 * Facility'deki "Devamsızlık Düzelt" (ayrı bir correct endpoint + ayrı izin) yerine, Travels
 * backend'i tek bir Save + Reopen çifti sunuyor: yoklama zaten alınmışsa Save "zaten alınmış"
 * hatası döner; düzeltmek isteyen yetkili önce Reopen çağırıp sonra Save eder. İkisi de aynı
 * "travels.edit" iznini istiyor — bu da kullanıcının istediği "admin yetkisi dahilinde manuel
 * düzeltme" şartını zaten karşılıyor (facility'deki gibi ayrı bir izin anahtarına gerek yok).
 */
interface Props {
  open: boolean
  onClose: () => void
  travel: Travel | null
  onSaved: () => void
}

export const TravelAttendanceMarkModal = ({ open, onClose, travel, onSaved }: Props) => {
  const { can } = useAuth()
  const canEdit = can('travels.edit')
  const [roster, setRoster] = useState<TravelAttendanceRosterItem[]>([])
  const [meta, setMeta] = useState<{ taken: boolean; started: boolean; ended: boolean } | null>(null)
  const [marks, setMarks] = useState<Record<string, TravelAttendanceStatus>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [editing, setEditing] = useState(false)

  const marksFromRoster = (items: TravelAttendanceRosterItem[]) =>
    Object.fromEntries(items.map((x) => [x.passengerId, x.status === 'none' ? 'present' : x.status])) as Record<string, TravelAttendanceStatus>

  const load = async () => {
    if (!travel) return
    setLoading(true)
    try {
      const r = await travelService.attendance.getRoster(travel.id)
      setRoster(r.items)
      setMeta({ taken: r.taken, started: r.started, ended: r.ended })
      setMarks(marksFromRoster(r.items))
    } catch {
      setRoster([])
      setMeta(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !travel) return
    setEditing(false)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, travel?.id])

  const alreadyTaken = meta?.taken ?? false
  const editable = !alreadyTaken || editing

  const setAll = (status: TravelAttendanceStatus) =>
    setMarks(Object.fromEntries(roster.map((x) => [x.passengerId, status])))

  const cancelEditing = () => { setMarks(marksFromRoster(roster)); setEditing(false) }

  const errInfo = (e: unknown): { code?: string; message?: string } => {
    const data = (e as { response?: { data?: { errorCode?: string; message?: string } } })?.response?.data
    return { code: data?.errorCode, message: data?.message }
  }

  const startEdit = async () => {
    if (!travel) return
    setReopening(true)
    try {
      await travelService.attendance.reopen(travel.id)
      await load()
      setEditing(true)
    } catch (e) {
      const { code, message } = errInfo(e)
      toast.error(code === 'ATTENDANCE_WINDOW_CLOSED'
        ? (message ?? 'Yoklama süresi doldu (gezi bitti); yeniden açılamaz.')
        : (message ?? 'Yoklama yeniden açılamadı.'))
    } finally {
      setReopening(false)
    }
  }

  const doSave = async () => {
    if (!travel) return
    setSaving(true)
    try {
      const payload = roster.map((x) => ({ passengerId: x.passengerId, status: marks[x.passengerId] ?? 'absent' as TravelAttendanceStatus }))
      await travelService.attendance.save(travel.id, payload)
      toast.success(editing ? 'Devamsızlık düzeltmesi kaydedildi.' : 'Yoklama kaydedildi.')
      onSaved()
      onClose()
    } catch (e) {
      const { code, message } = errInfo(e)
      if (code === 'TRAVEL_NOT_STARTED')
        toast.error(message ?? 'Gezi henüz başlamadı. Yoklama alınamaz.')
      else if (code === 'ATTENDANCE_WINDOW_CLOSED')
        toast.error(message ?? 'Yoklama süresi doldu (gezi bitti); değişiklik yapılamaz.')
      else if (code === 'ATTENDANCE_ALREADY_TAKEN')
        toast.error(message ?? 'Bu gezinin yoklaması zaten alınmış. Değiştirmek için yeniden açın.')
      else
        toast.error(message ?? 'Yoklama kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  if (!travel) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Devamsızlık Düzelt' : 'Yoklama Al'}
      subtitle={travel.name}
      width={760}
      footer={
        !editable ? (
          <div className="flex items-center justify-end gap-2">
            {alreadyTaken && canEdit && !meta?.ended && (
              <Button variant="outline" onClick={startEdit} isLoading={reopening} disabled={roster.length === 0}>
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
              <Button onClick={doSave} isLoading={saving} disabled={roster.length === 0 || !meta?.started}>
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
          <EmptyState icon={UsersIcon} title="Onaylı yolcu yok" description="Bu geziye ait onaylı başvuru bulunmuyor." />
        ) : (
          <div className="space-y-4">
            {meta && !meta.started && (
              <Banner tone="warning" variant="soft" icon={AlertTriangleIcon}>
                Gezi henüz başlamadı. Yoklama, gezi başlangıç tarihine ulaşınca alınabilir.
              </Banner>
            )}
            {alreadyTaken && !editing && (
              <Banner tone="info" variant="soft" icon={LockIcon}>
                Bu gezinin yoklaması alınmıştır. Liste salt-okunurdur{canEdit && !meta?.ended ? '; devamsızlığı düzeltmek için "Devamsızlık Düzelt"e tıklayın.' : '.'}
              </Banner>
            )}
            {editing && (
              <Banner tone="warning" variant="soft" icon={PencilIcon}>
                Devamsızlık düzeltme modundasınız. Kaydedince yeni durumlar geçerli olur.
              </Banner>
            )}
            <AttendanceTable
              editable={editable}
              marks={marks}
              onChange={(ids, st) => setMarks((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, st])) }))}
              rows={roster.map((r) => ({
                id: r.passengerId,
                name: r.fullName,
                meta: (
                  <>
                    <span className="type-caption tabular-nums">{maskTC(r.tckn)}</span>
                    {r.busName && <Badge tone="neutral"><BusIcon className="h-3 w-3" /> {r.busName}</Badge>}
                    {r.seatNumber && <Badge tone="neutral"><ArmchairIcon className="h-3 w-3" /> {r.seatNumber}</Badge>}
                  </>
                ),
              }))}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
