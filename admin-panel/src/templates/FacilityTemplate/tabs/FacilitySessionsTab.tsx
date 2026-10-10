import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CalendarIcon, CalendarDaysIcon, ClipboardCheckIcon, CalendarOffIcon, BanIcon, RotateCcwIcon, ClockIcon, MessageSquareIcon, UsersIcon, UserPlusIcon } from 'lucide-react'
import { SectionToolbar, Card, Button, Badge, EmptyState, SkeletonRows, IconButton, Modal, Textarea, Field, Drawer, Checkbox } from '@/design-system'
import { MonthCalendar } from '@/components/specialized/MonthCalendar'
import { FacilityAttendanceMarkModal } from '../FacilityAttendanceMarkModal'
import { SessionClosureModal } from '../SessionClosureModal'
import { FacilitySendMessageModal } from '../FacilitySendMessageModal'
import { FacilityRosterModal } from '../FacilityRosterModal'
import { FacilityMemberTransferModal, type MemberTransferGroup } from '../FacilityMemberTransferPanel'
import { GroupFormFields } from '../GroupFormFields'
import { makeEmptyGroupForm, groupRecordToForm, getGroupFormErrors, saveGroupUpdate } from '../groupForm.utils'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { CalendarDay, SessionRecord, GroupRecord, GroupForm, BranchRecord, InstructorOption, RequiredDocument, FacilityRecord } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilityId: string
  facilityCapacity?: number
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const formatDayLabel = (d: string) => {
  const dt = new Date(`${d}T00:00:00`)
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()} · ${DAYS[dt.getDay()]}`
}

export const FacilitySessionsTab = ({ config, service, facilityId, facilityCapacity }: Props) => {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState('')
  const [calendar, setCalendar] = useState<CalendarDay[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loadingCal, setLoadingCal] = useState(true)
  const [loadingDay, setLoadingDay] = useState(false)
  const [markSession, setMarkSession] = useState<SessionRecord | null>(null)
  const [daySignal, setDaySignal] = useState(0)
  const [closureOpen, setClosureOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<SessionRecord | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  // Kullanıcı isteği (2026-08-12): Seans Takvimi'nde de (Gruplar sekmesindeki gibi) seçili
  // seanslara şablonlu SMS/bildirim gönderilebilsin. Seans, kendi Group kaydı üzerinden şablon
  // sistemine bağlanıyor (FacilitySendMessageModal target="group", seçili seansların groupId'leri).
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
  const [templateMessageGroupIds, setTemplateMessageGroupIds] = useState<string[] | null>(null)

  // Kullanıcı isteği (2026-10-06): Seans Takvimi'nden de seansın grubuna TC ile tek/toplu üye veya
  // yedek aktarılabilsin; seçili seansların gruplarına toplu aktarım da yapılabilsin.
  const [rosterGroup, setRosterGroup] = useState<GroupRecord | null>(null)
  const [transferGroups, setTransferGroups] = useState<MemberTransferGroup[] | null>(null)

  const openRoster = async (s: SessionRecord) => {
    try {
      setRosterGroup(await service.groups.getById(s.groupId))
    } catch {
      toast.error('Grup bilgileri yüklenemedi.')
    }
  }

  const openBulkTransfer = () => {
    const seen = new Set<string>()
    const groups: MemberTransferGroup[] = []
    for (const s of sessions) {
      if (!selectedSessionIds.has(s.id) || seen.has(s.groupId)) continue
      seen.add(s.groupId)
      groups.push({ id: s.groupId, name: s.branchName ? `${s.branchName} – ${s.groupName}` : s.groupName })
    }
    setTransferGroups(groups)
  }

  // Kullanıcı isteği: Seans Takvimi sekmesindeki seans listesinde, seans/grup ismine tıklanınca
  // gerekirse düzenleme yapılabilsin diye bir düzenleme modalı açılsın (seans içindeki Açıklama
  // alanı, evrak ekle/çıkar / belge yönetimi dahil — GroupFormFields zaten bu alanları içeriyor).
  const [editTarget, setEditTarget] = useState<GroupRecord | null>(null)
  const [editForm, setEditForm] = useState<GroupForm | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [instructors, setInstructors] = useState<InstructorOption[]>([])
  const [documentLibrary, setDocumentLibrary] = useState<RequiredDocument[]>([])
  const [allFacilities, setAllFacilities] = useState<FacilityRecord[]>([])

  useEffect(() => {
    service.branches.getList({ page: 1, limit: 200 }).then((r) => setBranches(r.items)).catch(() => setBranches([]))
    service.instructors.getOptions().then(setInstructors).catch(() => setInstructors([]))
    service.settings.getGeneral().then((s) => setDocumentLibrary(s.requiredDocuments ?? [])).catch(() => setDocumentLibrary([]))
    service.facilities.getOptions().then(setAllFacilities).catch(() => setAllFacilities([]))
  }, [service])

  const openSessionEdit = useCallback(async (s: SessionRecord) => {
    setEditLoading(true)
    try {
      const group = await service.groups.getById(s.groupId)
      const empty = makeEmptyGroupForm(config, group.facilityId)
      setEditTarget(group)
      setEditForm(groupRecordToForm(group, empty))
    } catch {
      toast.error('Seans bilgileri yüklenemedi.')
    } finally {
      setEditLoading(false)
    }
  }, [service, config])

  const closeSessionEdit = () => { setEditTarget(null); setEditForm(null) }

  const saveSessionEdit = async () => {
    if (!editTarget || !editForm) return
    setEditSaving(true)
    try {
      await saveGroupUpdate(service, editTarget.id, editForm)
      closeSessionEdit()
      setDaySignal((n) => n + 1)
    } finally {
      setEditSaving(false)
    }
  }

  const loadCalendar = useCallback(async () => {
    setLoadingCal(true)
    try {
      setCalendar(await service.sessions.getCalendar(facilityId, year, month + 1))
    } catch {
      setCalendar([])
    } finally {
      setLoadingCal(false)
    }
  }, [service, facilityId, year, month])

  useEffect(() => { loadCalendar() }, [loadCalendar])

  useEffect(() => {
    if (!selectedDate) { setSessions([]); return }
    let active = true
    setLoadingDay(true)
    setSelectedSessionIds(new Set())
    service.sessions.getByDay(facilityId, selectedDate)
      .then((s) => { if (active) setSessions(s) })
      .catch(() => { if (active) setSessions([]) })
      .finally(() => { if (active) setLoadingDay(false) })
    return () => { active = false }
  }, [service, facilityId, selectedDate, daySignal])

  const refresh = () => { setDaySignal((n) => n + 1); loadCalendar() }

  const toggleSessionSelected = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedSessionGroupIds = () => {
    const ids = sessions.filter((s) => selectedSessionIds.has(s.id)).map((s) => s.groupId)
    return [...new Set(ids)]
  }

  const doSingleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return
    setActionBusy(true)
    try {
      await service.sessions.cancelSession(cancelTarget.id, cancelReason.trim())
      toast.success('Seans kapatıldı, katılımcılara bilgilendirme gönderildi.')
      setCancelTarget(null); setCancelReason(''); refresh()
    } finally {
      setActionBusy(false)
    }
  }

  const doReopen = async (s: SessionRecord) => {
    await service.sessions.reopenSession(s.id)
    toast.success('Seans yeniden açıldı.')
    refresh()
  }

  const counts = Object.fromEntries(calendar.map((c) => [c.date, c.sessionCount]))

  return (
    <>
      <SectionToolbar
        icon={CalendarIcon}
        title="Seans Takvimi"
        subtitle="Takvimden bir gün seçerek o günün seanslarını yönetin"
        actions={
          <Button variant="outline" onClick={() => setClosureOpen(true)}>
            <CalendarOffIcon className="h-4 w-4" /> Seans Kapatma
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <MonthCalendar
          year={year}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onMonthChange={(y, m) => { setYear(y); setMonth(m); setSelectedDate('') }}
          counts={counts}
          countLabel="seans"
          loading={loadingCal}
        />

        <Card padded className="min-h-[440px]">
          {!selectedDate ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <EmptyState icon={CalendarDaysIcon} title="Bir gün seçin" description="Takvimden bir gün seçtiğinizde o günün seansları burada listelenir." />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div className="min-w-0">
                  <p className="type-section truncate">{formatDayLabel(selectedDate)}</p>
                  <p className="type-caption">{sessions.length} seans{selectedSessionIds.size > 0 ? ` · ${selectedSessionIds.size} seçili` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSessionIds.size > 0 && (
                    <Button size="sm" variant="outline" onClick={openBulkTransfer}>
                      <UserPlusIcon className="h-3.5 w-3.5" /> TC ile Üye / Yedek Ekle
                    </Button>
                  )}
                  {selectedSessionIds.size > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setTemplateMessageGroupIds(selectedSessionGroupIds())}>
                      <MessageSquareIcon className="h-3.5 w-3.5" /> Şablonlu Mesaj Gönder
                    </Button>
                  )}
                </div>
              </div>

              {loadingDay ? (
                <SkeletonRows rows={4} />
              ) : sessions.length === 0 ? (
                <div className="py-10">
                  <EmptyState icon={CalendarIcon} title="Seans yok" description="Seçili gün için seans bulunmuyor." />
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div
                    className="grid items-center border-b border-border bg-surface-1 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-foreground-subtle"
                    style={{ gridTemplateColumns: '2rem 2rem 1fr 8rem 8rem 7rem 8rem' }}
                  >
                    <div className="flex justify-center">
                      <Checkbox
                        checked={sessions.length > 0 && selectedSessionIds.size === sessions.length}
                        onCheckedChange={() => setSelectedSessionIds(selectedSessionIds.size === sessions.length ? new Set() : new Set(sessions.map((s) => s.id)))}
                      />
                    </div>
                    <div className="text-center">#</div>
                    <div>Grup Adı</div>
                    <div>Yaş Grubu</div>
                    <div>Branş</div>
                    <div className="text-center">Seans Saati</div>
                    <div className="text-right">İşlemler</div>
                  </div>

                  {sessions.map((s, idx) => (
                    <div
                      key={s.id}
                      className={`grid items-center border-b border-border px-4 py-3 last:border-0 transition-colors ${s.isCancelled ? 'bg-[hsl(var(--danger-soft))]/50' : 'hover:bg-[hsl(var(--accent-blue-soft))]/20'}`}
                      style={{ gridTemplateColumns: '2rem 2rem 1fr 8rem 8rem 7rem 8rem' }}
                    >
                      <div className="flex justify-center">
                        <Checkbox checked={selectedSessionIds.has(s.id)} onCheckedChange={() => toggleSessionSelected(s.id)} />
                      </div>
                      <div className="flex justify-center">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold text-foreground-muted">
                          {idx + 1}
                        </span>
                      </div>

                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            title="Seansı düzenle"
                            disabled={editLoading}
                            onClick={() => openSessionEdit(s)}
                            className={`text-[13px] font-bold truncate text-left hover:text-primary cursor-pointer ${s.isCancelled ? 'text-danger line-through' : 'text-foreground-strong'}`}
                          >
                            {s.branchName ? `${s.branchName} – ${s.groupName}` : s.groupName}
                          </button>
                          {s.isCancelled
                            ? <Badge tone="danger">İptal</Badge>
                            : s.attendanceMode === 'off'
                              ? <Badge tone="neutral">Yoklama Kapalı</Badge>
                              : s.attendanceTaken
                                ? <Badge tone="success">Yoklama Alındı</Badge>
                                : <Badge tone="neutral">Bekliyor</Badge>}
                        </div>
                        {s.isCancelled && s.cancelReason && (
                          <p className="mt-0.5 text-[10px] text-danger truncate">↳ {s.cancelReason}</p>
                        )}
                      </div>

                      <div>
                        {(s as SessionRecord & { ageMin?: number; ageMax?: number }).ageMin != null ? (
                          <span className="inline-flex items-center rounded-lg bg-[hsl(var(--accent-violet-soft))] px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--accent-violet))]">
                            {(s as SessionRecord & { ageMin?: number; ageMax?: number }).ageMin}–{(s as SessionRecord & { ageMin?: number; ageMax?: number }).ageMax} yaş
                          </span>
                        ) : (
                          <span className="text-[11px] text-foreground-subtle">—</span>
                        )}
                      </div>

                      <div>
                        {s.branchName
                          ? <span className="text-[11px] font-medium text-foreground-muted truncate block">{s.branchName}</span>
                          : <span className="text-[11px] text-foreground-subtle">—</span>}
                      </div>

                      <div className="flex justify-center">
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${s.isCancelled ? 'bg-[hsl(var(--danger-soft))] text-[hsl(var(--danger))]' : 'bg-[hsl(var(--accent-blue-soft))] text-[hsl(var(--accent-blue))]'}`}>
                          <ClockIcon className="h-3 w-3" />
                          {s.startTime}–{s.endTime}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        {s.isCancelled ? (
                          <IconButton tone="success" title="Geri Aç" onClick={() => doReopen(s)}>
                            <RotateCcwIcon className="h-4 w-4" />
                          </IconButton>
                        ) : (
                          <>
                            <IconButton tone="default" title="Kayıtlar / Yedekler (TC ile üye ekle)" onClick={() => openRoster(s)}>
                              <UsersIcon className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              tone="primary"
                              title={s.attendanceMode === 'off' ? 'Bu grupta yoklama kapalı (devamsızlık takibi yok)' : s.attendanceTaken ? 'Yoklamayı Görüntüle' : 'Yoklama Al'}
                              disabled={s.attendanceMode === 'off'}
                              onClick={() => setMarkSession(s)}
                            >
                              <ClipboardCheckIcon className="h-4 w-4" />
                            </IconButton>
                            <IconButton tone="danger" title="Seansı Kapat" onClick={() => { setCancelTarget(s); setCancelReason('') }}>
                              <BanIcon className="h-4 w-4" />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {markSession && (
        <FacilityAttendanceMarkModal
          open={!!markSession}
          onClose={() => setMarkSession(null)}
          service={service}
          sessionId={markSession.id}
          groupName={markSession.groupName}
          alreadyTaken={markSession.attendanceTaken}
          lateTrackingEnabled={markSession.lateTrackingEnabled ?? true}
          onSaved={() => setDaySignal((n) => n + 1)}
        />
      )}

      <SessionClosureModal
        open={closureOpen}
        onClose={() => setClosureOpen(false)}
        service={service}
        facilityId={facilityId}
        groupSingular={config.terminology.groupSingular}
        onDone={refresh}
      />

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Seansı Kapat"
        subtitle={cancelTarget ? `${cancelTarget.groupName} · ${cancelTarget.startTime}-${cancelTarget.endTime}` : ''}
        width={480}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={actionBusy}>İptal</Button>
            <Button variant="danger" onClick={doSingleCancel} isLoading={actionBusy} disabled={!cancelReason.trim()}>
              Kapat
            </Button>
          </div>
        }
      >
        <div className="p-6">
          <Field label="Kapatma Sebebi" required hint="Bu sebep, gruptaki katılımcılara mesaj olarak gönderilir.">
            <Textarea rows={2} placeholder="Örn. Eğitmen rahatsızlığı" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Drawer
        open={!!editTarget}
        onClose={closeSessionEdit}
        title={`Seans Düzenle — ${editTarget?.name ?? ''}`}
        width={620}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={closeSessionEdit} disabled={editSaving}>İptal</Button>
            <Button
              variant="primary"
              isLoading={editSaving}
              disabled={!editForm || getGroupFormErrors(editForm, 'edit', config.terminology.groupSingular, facilityCapacity).length > 0}
              onClick={saveSessionEdit}
            >
              Kaydet
            </Button>
          </div>
        }
      >
        {editForm && (
          <GroupFormFields
            config={config}
            form={editForm}
            setForm={(updater) => setEditForm((prev) => prev ? (typeof updater === 'function' ? updater(prev) : updater) : prev)}
            branches={branches}
            instructors={instructors}
            documentLibrary={documentLibrary}
            facilityCapacity={facilityCapacity}
            mode="edit"
            isSubGroup={!!editForm.parentGroupId}
            editingRow={editTarget}
            service={service}
            allFacilities={allFacilities}
          />
        )}
      </Drawer>

      <FacilitySendMessageModal
        open={!!templateMessageGroupIds}
        module={config.routeId}
        target="group"
        ids={templateMessageGroupIds ?? []}
        service={service}
        onClose={() => setTemplateMessageGroupIds(null)}
        onSent={() => setSelectedSessionIds(new Set())}
      />

      {rosterGroup && (
        <FacilityRosterModal
          open={!!rosterGroup}
          onClose={() => setRosterGroup(null)}
          service={service}
          module={config.routeId}
          groupId={rosterGroup.id}
          groupName={rosterGroup.name}
          capacity={rosterGroup.capacity}
          periodType={rosterGroup.periodType}
          periodStart={rosterGroup.periodStart}
          periodMonths={rosterGroup.periodMonths}
          groupType={rosterGroup.type}
        />
      )}

      <FacilityMemberTransferModal
        open={!!transferGroups}
        onClose={() => setTransferGroups(null)}
        groups={transferGroups ?? []}
        service={service}
      />
    </>
  )
}
