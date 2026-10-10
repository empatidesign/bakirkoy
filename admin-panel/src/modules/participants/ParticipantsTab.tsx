import { useState, useEffect, useCallback, useRef } from 'react'
import {
  UsersIcon, UserCheckIcon, UserXIcon, ShieldOffIcon, ShieldCheckIcon, BanIcon, Trash2Icon,
  CalendarDaysIcon, EyeIcon, Users2Icon, PowerIcon, InfoIcon,
  FingerprintIcon, ContactIcon, ShieldAlertIcon, KeyRoundIcon, MessageSquareIcon, ActivityIcon,
  RefreshCwIcon, LockIcon, LockOpenIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  Button, Field, Select, FilterField, DatePicker, TcknInput, PhoneInput, EmailInput,
  DrilldownCount, IconButton, ConfirmModal, Badge, CheckboxRow, Textarea, Banner, LockedField, FormSection,
  AdminFormShell,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { BroadcastModal } from '@/components/specialized/BroadcastModal'
import { AddressBlock } from '@/components/specialized/AddressBlock'
import participantService from '@/services/participant.service'
import { api } from '@/services/api'
import type { Participant, ParticipantSummary, ParticipantStatus } from '@/types/participant.types'
import { GENDER_OPTIONS, PARTICIPANT_STATUS_OPTIONS, PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONE } from '@/types/participant.types'
import { buildParticipantColumns } from './participantColumns'
import { ParticipantEventsView } from './ParticipantEventsView'
import { ParticipantDetailModal } from './ParticipantDetailModal'
import { ParticipantCreateForm } from './ParticipantCreateForm'
import { ParticipantBlockModal } from './ParticipantBlockModal'
import { ParticipantPasswordSection } from './ParticipantPasswordSection'
import { ParticipantNviBulkModal } from './ParticipantNviBulkModal'

interface ParticipantForm {
  tckn: string
  birthDate: string
  email: string
  phone: string
  guardianPhone: string
  guardianEmail: string
  passive: boolean
  blocked: boolean
  blockReason: string
  password: string
  mustChange: boolean
}
const emptyForm: ParticipantForm = { tckn: '', birthDate: '', email: '', phone: '', guardianPhone: '', guardianEmail: '', passive: false, blocked: false, blockReason: '', password: '', mustChange: false }
const formatRecordCount = (value: number) => value.toLocaleString('tr-TR')

// SORUN (2026-09-23, kullanıcı bulgusu): KVKK maskeleme açıkken (varsayılan
// MaskIdentity=true) liste/NVİ-yenileme uçları telefon/e-posta gibi alanları
// maskelenmiş döndürür (ör. "532****33"). Bu değer doğrudan forma konursa
// PhoneInput yalnızca rakamları koruduğu için "*" karakterleri silinip geriye
// eksik/bozuk bir numara kalıyordu (kullanıcı "telefon eksik" görüyordu) ve
// admin formu kaydettiğinde bu bozuk değer GERÇEK numaranın üzerine yazılıyordu.
// Maskelenmiş bir değer tespit edilirse form alanı BOŞ bırakılır (backend artık
// boş gönderilen alanları "değişmemiş" sayıp mevcut kaydı koruyor).
const unmaskOrEmpty = (value: string | null | undefined): string =>
  value && !value.includes('*') ? value : ''

const calcAge = (iso: string): number | null => {
  if (!iso) return null
  const b = new Date(iso)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export interface ParticipantsScope {
  guardianId?: string
  guardianName?: string
}

export const ParticipantsTab = ({ scope, embedded, initialSearch, initialDetailId }: { scope?: ParticipantsScope; embedded?: boolean; initialSearch?: string; initialDetailId?: string } = {}) => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Kullanıcı isteği (2026-10-05): telefonu veya T.C. kimlik numarası eksik kayıtları
  // tek bir filtrede/aramada bulabilmek için: "any" (telefon VEYA tc yok), "phone" (telefon yok),
  // "tckn" (tc yok), "both" (ikisi de yok).
  const [missingInfoFilter, setMissingInfoFilter] = useState('')
  const [summary, setSummary] = useState<ParticipantSummary | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(initialDetailId ?? null)
  const [detailInitialTab, setDetailInitialTab] = useState<string | undefined>(undefined)

  const fetchSummary = useCallback(async () => {
    if (embedded) return
    const params: Record<string, string> = {}
    if (genderFilter) params.gender = genderFilter
    if (verifiedFilter) params.verified = verifiedFilter
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (missingInfoFilter) params.missingInfo = missingInfoFilter
    if (scope?.guardianId) params.guardianId = scope.guardianId
    try { setSummary(await participantService.getSummary(params)) } catch { setSummary(null) }
  }, [embedded, genderFilter, verifiedFilter, startDate, endDate, missingInfoFilter, scope?.guardianId])
  useEffect(() => { fetchSummary() }, [fetchSummary, refresh])

  const bump = () => setRefresh((n) => n + 1)

  const [statusAction, setStatusAction] = useState<{ row: Participant; to: ParticipantStatus } | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [broadcastIds, setBroadcastIds] = useState<string[] | null>(null)
  const [nviBulk, setNviBulk] = useState<{ kind: 'selected'; ids: string[] } | { kind: 'unsynced' } | null>(null)
  const [nviSyncedFilter, setNviSyncedFilter] = useState('')

  const statusMeta = (a: { row: Participant; to: ParticipantStatus }) => {
    const name = a.row.fullName
    if (a.to === 'Passive') return { title: 'Pasife Al', description: `"${name}" pasife alınacak; girişi kısıtlanır.`, tone: 'primary' as const, confirm: 'Onayla' }
    if (a.row.status === 'Blocked') return { title: 'Engeli Kaldır', description: `"${name}" engeli kaldırılacak ve aktif edilecek.`, tone: 'primary' as const, confirm: 'Onayla' }
    return { title: 'Aktif Et', description: `"${name}" aktif edilecek.`, tone: 'primary' as const, confirm: 'Onayla' }
  }

  const runStatus = async () => {
    if (!statusAction) return
    setStatusSaving(true)
    try {
      await participantService.setStatus(statusAction.row.id, statusAction.to)
      toast.success('Durum güncellendi.')
      setStatusAction(null); bump()
    } finally { setStatusSaving(false) }
  }

  const [blockTarget, setBlockTarget] = useState<Participant | null>(null)
  const [blockSaving, setBlockSaving] = useState(false)
  const editingRef = useRef<Participant | null>(null)
  const [refreshingNviId, setRefreshingNviId] = useState<string | null>(null)
  // Kullanıcı raporu (2026-08-05): "Kişi bilgisini güncelleme" ekranında adres bilgisi
  // hiç görünmüyordu. Kök neden: form/edit ekranı adresi hiç göstermiyordu (Participant
  // tipinde address/city/district/neighborhood alanları vardı ama form state'inde yoktu).
  // NVİ'den Yenile de editingRef'i (bir ref, re-render tetiklemez) güncelliyordu; ekranda
  // hiçbir zaman yansımıyordu. Bu state, güncel adresi düzenleme formunda canlı göstermek için.
  const [editingAddress, setEditingAddress] = useState<Participant | null>(null)
  const refreshParticipantFromNvi = async (id: string, apply: (participant: Participant) => void) => {
    if (refreshingNviId) return
    setRefreshingNviId(id)
    try {
      const res = await api.post<{ data: Participant }>(`/participants/${id}/nvi-refresh`)
      apply(res.data.data)
      toast.success('Katılımcı bilgileri NVİ’den yenilendi.')
      bump()
    } finally {
      setRefreshingNviId(null)
    }
  }
  // Kullanıcı isteği (2026-08-05): 5 hatalı giriş denemesi sonrası kilitlenen bir katılımcı
  // hesabının kilidi (15 dakika sonra kendiliğinden açılır) listeden tek tıkla kaldırılabilsin.
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const unlockParticipant = async (id: string, name: string) => {
    if (unlockingId) return
    setUnlockingId(id)
    try {
      await participantService.unlock(id)
      toast.success(`"${name}" hesabının kilidi kaldırıldı.`)
      bump()
    } finally {
      setUnlockingId(null)
    }
  }
  const runBlock = async (reason: string) => {
    if (!blockTarget) return
    setBlockSaving(true)
    try {
      await participantService.setStatus(blockTarget.id, 'Blocked', reason)
      toast.success('Katılımcı engellendi.')
      setBlockTarget(null); bump()
    } finally { setBlockSaving(false) }
  }

  const columns = buildParticipantColumns({
    renderChildren: (p) => (
      <DrilldownCount count={p.childrenCount} icon={Users2Icon} title={`${p.fullName} · Çocukları`} subtitle={`${p.childrenCount} çocuk bu kullanıcıya bağlı`}>
        <ParticipantsTab scope={{ guardianId: p.id, guardianName: p.fullName }} embedded />
      </DrilldownCount>
    ),
    renderEvents: (p) => (
      <DrilldownCount count={p.eventCount} icon={CalendarDaysIcon} title={`${p.fullName} · Etkinlik Geçmişi`} subtitle="Kendisi ve çocuklarının katılım geçmişi" width={1080}>
        <ParticipantEventsView participant={p} />
      </DrilldownCount>
    ),
    renderActivity: (p) => (
      p.activityCount > 0 ? (
        <button
          type="button"
          onClick={() => { setDetailInitialTab('reports'); setDetailId(p.id) }}
          title="Tüm modüllerdeki zaman çizelgesini görüntüle"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#eef3f8] px-2.5 py-1 text-[12px] font-bold text-[#0f4c81] transition-colors hover:bg-[#d7e3ef]"
        >
          <ActivityIcon className="h-3.5 w-3.5" />
          {formatRecordCount(p.activityCount)}
        </button>
      ) : (
        <span className="text-foreground-muted">0</span>
      )
    ),
  })

  return (
    <>
      <CrudListTemplate<Participant, ParticipantForm>
        icon={UsersIcon}
        title="Katılımcılar"
        subtitle="Sisteme kayıtlı vatandaşları görüntüleyin, ekleyin ve yönetin"
        resourceName="Katılımcı"
        service={{
          getList: (p) => participantService.getList(p),
          remove: can('participants.delete') ? (id) => participantService.delete(id) : undefined,
          toggleStatus: can('participants.edit') ? (id) => participantService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        columns={columns}
        defaultSort={{ key: 'registeredAt', dir: 'desc' }}
        searchPlaceholder="Ad, T.C. kimlik, telefon veya e-posta ara..."
        initialSearch={initialSearch}
        selectable
        extraHeaderActions={can('participants.edit') ? (
          <Button variant="outline" size="sm" iconLeft={<RefreshCwIcon className="h-4 w-4" />} onClick={() => setNviBulk({ kind: 'unsynced' })}>
            NVİ Toplu Sorgula
          </Button>
        ) : undefined}
        bulkActions={(rows) => (
          <>
          <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setBroadcastIds(rows.map((r) => r.id))}>
            SMS / Bildirim Gönder
          </Button>
          {can('participants.edit') && (
            <Button variant="outline" size="sm" iconLeft={<RefreshCwIcon className="h-4 w-4" />} onClick={() => setNviBulk({ kind: 'selected', ids: rows.map((r) => r.id) })}>
              NVİ'den Sorgula
            </Button>
          )}
          </>
        )}
        embedded={embedded}
        refreshSignal={refresh}
        onMutated={fetchSummary}
        filterColumns={4}
        extraParams={{
          status: statusFilter,
          gender: genderFilter,
          verified: verifiedFilter,
          nviSynced: nviSyncedFilter,
          startDate,
          endDate,
          ...(missingInfoFilter ? { missingInfo: missingInfoFilter } : {}),
          ...(scope?.guardianId ? { guardianId: scope.guardianId } : {}),
        }}
        hasActiveFilters={!!statusFilter || !!genderFilter || !!verifiedFilter || !!nviSyncedFilter || !!startDate || !!endDate || !!missingInfoFilter}
        onClearFilters={() => { setStatusFilter(''); setGenderFilter(''); setVerifiedFilter(''); setNviSyncedFilter(''); setStartDate(''); setEndDate(''); setMissingInfoFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {PARTICIPANT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Cinsiyet">
              <Select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="">Tümü</option>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Doğrulama">
              <Select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="true">Doğrulandı</option>
                <option value="false">Bekliyor</option>
              </Select>
            </FilterField>
            <FilterField label="NVİ Sorgusu">
              <Select value={nviSyncedFilter} onChange={(e) => setNviSyncedFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="false">Hiç Sorgulanmamış</option>
                <option value="true">Sorgulanmış</option>
              </Select>
            </FilterField>
            <FilterField label="Eksik Bilgi">
              <Select value={missingInfoFilter} onChange={(e) => setMissingInfoFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="any">Telefonu veya T.C.'si Olmayan</option>
                <option value="phone">Telefonu Olmayan</option>
                <option value="tckn">T.C.'si Olmayan</option>
                <option value="both">İkisi de Olmayan</option>
              </Select>
            </FilterField>
            <FilterField label="Kayıt Başlangıç"><DatePicker value={startDate} onChange={setStartDate} max={endDate || undefined} /></FilterField>
            <FilterField label="Kayıt Bitiş"><DatePicker value={endDate} onChange={setEndDate} min={startDate || undefined} /></FilterField>
          </>
        )}
        stats={() => [
          { label: 'Toplam', value: formatRecordCount(summary?.total ?? 0), icon: UsersIcon, accent: 'blue' },
          { label: 'Aktif', value: formatRecordCount(summary?.active ?? 0), icon: UserCheckIcon, accent: 'green' },
          { label: 'Pasif', value: formatRecordCount(summary?.passive ?? 0), icon: UserXIcon, accent: 'orange' },
          { label: 'Engellenen', value: formatRecordCount(summary?.blocked ?? 0), icon: ShieldOffIcon, accent: 'violet' },
          { label: 'Silinmiş', value: formatRecordCount(summary?.deleted ?? 0), icon: Trash2Icon, accent: 'primary' },
        ]}
        emptyForm={emptyForm}
        toForm={(r) => ({ tckn: r.tckn, birthDate: r.birthDate, email: unmaskOrEmpty(r.email), phone: unmaskOrEmpty(r.phone), guardianPhone: unmaskOrEmpty(r.guardianPhone), guardianEmail: unmaskOrEmpty(r.guardianEmail), passive: r.status === 'Passive', blocked: r.status === 'Blocked', blockReason: r.blockReason ?? '', password: '', mustChange: false })}
        creatable={can('participants.create')}
        canEdit={(r) => can('participants.edit') && r.status !== 'Deleted'}
        canDelete={(r) => can('participants.delete') && r.status !== 'Deleted'}
        canToggle={(r) => can('participants.edit') && r.status !== 'Deleted' && r.status !== 'Blocked'}
        isActive={(r) => r.status === 'Active'}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Katılımcıyı Aktif Et', description: `"${row.fullName}" yeniden aktif edilecek.` }
          : { title: 'Katılımcıyı Pasife Al', description: `"${row.fullName}" pasife alınacak ve sisteme girişi engellenecek. Devam edilsin mi?` }}
        deleteConfirm={{ title: 'Katılımcıyı Sil', description: 'Bu katılımcı silinmiş olarak işaretlenecek. Devam edilsin mi?' }}
        drawerWidth={760}
        extraRowActions={(row) => {
          return (
            <>
              <IconButton tone="default" title="Görüntüle" onClick={() => { setDetailInitialTab(undefined); setDetailId(row.id) }}>
                <EyeIcon className="h-4 w-4" />
              </IconButton>
              {row.status !== 'Deleted' && can('participants.edit') && (
                <IconButton
                  tone="default"
                  title="NVİ'den Yenile"
                  disabled={refreshingNviId === row.id}
                  onClick={() => void refreshParticipantFromNvi(row.id, () => { bump() })}
                >
                  <RefreshCwIcon className={`h-4 w-4 ${refreshingNviId === row.id ? 'animate-spin' : ''}`} />
                </IconButton>
              )}
              {row.status !== 'Deleted' && can('participants.edit') && (
                <IconButton
                  tone={row.isLocked ? 'danger' : 'default'}
                  title={row.isLocked
                    ? `Hesap kilitli${row.lockedUntil ? ` (${new Date(row.lockedUntil).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla otomatik açılır)` : ''} — kaldırmak için tıklayın`
                    : 'Hesap kilidini ve hatalı giriş sayacını sıfırla'}
                  disabled={unlockingId === row.id}
                  onClick={() => void unlockParticipant(row.id, row.fullName)}
                >
                  {unlockingId === row.id
                    ? <LockOpenIcon className="h-4 w-4 animate-pulse" />
                    : row.isLocked ? <LockIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
                </IconButton>
              )}
              {row.status !== 'Deleted' && (
                <IconButton
                  tone={row.status === 'Blocked' ? 'success' : 'danger'}
                  title={row.status === 'Blocked' ? 'Engeli Kaldır' : 'Engelle'}
                  onClick={() => (row.status === 'Blocked' ? setStatusAction({ row, to: 'Active' }) : setBlockTarget(row))}
                >
                  {row.status === 'Blocked' ? <ShieldCheckIcon className="h-4 w-4" /> : <BanIcon className="h-4 w-4" />}
                </IconButton>
              )}
            </>
          )
        }}
        onUpdate={can('participants.edit') ? async (id, f) => {
          await participantService.update(id, {
            phone: f.phone || undefined,
            email: f.email || undefined,
            guardianPhone: f.guardianPhone || undefined,
            guardianEmail: f.guardianEmail || undefined,
          })
          if (f.password) {
            await participantService.setManualPassword(id, f.password, f.mustChange)
          }
          const was = editingRef.current?.status
          const desired: ParticipantStatus = f.blocked ? 'Blocked' : f.passive ? 'Passive' : 'Active'
          const reasonChanged = f.blocked && f.blockReason !== (editingRef.current?.blockReason ?? '')
          if (desired !== was || reasonChanged)
            await participantService.setStatus(id, desired, desired === 'Blocked' ? f.blockReason : undefined)
          toast.success('Değişiklikler kaydedildi.')
        } : undefined}
        renderFormFooter={({ mode, saving, submit, close, form }) =>
          mode === 'edit' ? (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={close}>İptal</Button>
              <Button variant="primary" className="flex-1" isLoading={saving} disabled={saving || (form.blocked && !form.blockReason.trim())} onClick={submit}>Güncelle</Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={close}>İptal</Button>
          )
        }
        formShell
        renderForm={({ form, setForm, mode, close, editingRow }) => {
          if (mode === 'create') return <ParticipantCreateForm onDone={() => { close(); bump() }} />
          const minor = (calcAge(form.birthDate) ?? 99) < 18
          editingRef.current = editingRow
          // editingAddress yalnızca NVİ'den Yenile ile güncellenen en taze veriyi tutar;
          // form ilk açıldığında veya farklı bir kayda geçildiğinde editingRow'a (mevcut
          // kayıtlı adrese) geri düşer.
          const addressSource = editingAddress?.id === editingRow?.id ? editingAddress : editingRow
          const childCount = editingRow?.childrenCount ?? 0
          const phoneWarn = minor
            ? 'Çocuğun telefonunu değiştirip kaydederseniz çocuğun açık oturumu kapanır; yeni numarasına gelecek doğrulama kodu (OTP) ve şifresiyle yeniden giriş yapması gerekir.'
            : `Telefonu değiştirip kaydederseniz kullanıcının açık oturumu kapanır; yeni numarasına gelecek doğrulama kodu (OTP) ve şifresiyle yeniden giriş yapması gerekir.${childCount > 0 ? ' Bu numara bağlı çocuk hesaplarının girişinde de kullanılıyorsa o çocuklar da yeniden giriş yapmalıdır.' : ''}`
          return (
            <AdminFormShell
              icon={UsersIcon}
              title="Katılımcı Düzenle"
              subtitle="Kimlik, iletişim, erişim ve şifre işlemlerini güncelleyin"
              badge={editingRow ? PARTICIPANT_STATUS_LABELS[editingRow.status] : 'Katılımcı'}
              tone="blue"
            >
              <FormSection
                variant="card"
                icon={FingerprintIcon}
                title="Kimlik Bilgileri"
                subtitle="NVI doğrulamasından gelen alanlar düzenlenemez"
                action={editingRow ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={refreshingNviId === editingRow.id}
                      disabled={refreshingNviId === editingRow.id}
                      onClick={() => void refreshParticipantFromNvi(editingRow.id, (participant) => {
                        setForm((p) => ({
                          ...p,
                          tckn: participant.tckn,
                          birthDate: participant.birthDate,
                          email: unmaskOrEmpty(participant.email),
                          phone: unmaskOrEmpty(participant.phone),
                          guardianPhone: unmaskOrEmpty(participant.guardianPhone),
                          guardianEmail: unmaskOrEmpty(participant.guardianEmail),
                        }))
                        editingRef.current = participant
                        setEditingAddress(participant)
                      })}
                    >
                      NVİ'den Yenile
                    </Button>
                    <Badge tone={PARTICIPANT_STATUS_TONE[editingRow.status]}>{PARTICIPANT_STATUS_LABELS[editingRow.status]}</Badge>
                  </div>
                ) : undefined}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="T.C. Kimlik No">
                    <TcknInput value={form.tckn} onChange={() => {}} disabled />
                  </Field>
                  <Field label="Doğum Tarihi">
                    <DatePicker value={form.birthDate} onChange={() => {}} disabled clearable={false} />
                  </Field>
                </div>
                <AddressBlock
                  address={{
                    fullAddress: addressSource?.address,
                    city: addressSource?.city,
                    district: addressSource?.district,
                    neighborhood: addressSource?.neighborhood,
                    districtCode: addressSource?.districtCode,
                  }}
                  emptyText="Adres bilgisi bulunmuyor — sağ üstteki NVİ'den Yenile ile alınabilir."
                />
              </FormSection>

              <FormSection
                variant="card"
                icon={minor ? Users2Icon : ContactIcon}
                title={minor ? 'Veli ve Çocuk İletişimi' : 'İletişim Bilgileri'}
                subtitle={minor ? 'Veli bilgileri kilitlidir; yalnız çocuk iletişimi güncellenebilir' : 'Telefon ve e-posta giriş bilgilerini etkiler'}
              >
                {minor ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Veli Telefonu" hint="Yalnız velinin kendi hesabından değiştirilir.">
                      <LockedField value={form.guardianPhone} placeholder="Tanımlı değil" />
                    </Field>
                    <Field label="Veli E-postası">
                      <LockedField value={form.guardianEmail} placeholder="Tanımlı değil" />
                    </Field>
                    <Field label="Çocuğun Telefonu">
                      <PhoneInput
                        value={form.phone}
                        onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                        placeholder={!form.phone && editingRow?.phone ? 'Gizli — değiştirmek için giriniz' : undefined}
                      />
                    </Field>
                    <Field label="Çocuğun E-postası">
                      <EmailInput value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    </Field>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Telefon">
                      <PhoneInput
                        value={form.phone}
                        onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                        placeholder={!form.phone && editingRow?.phone ? 'Gizli — değiştirmek için giriniz' : undefined}
                      />
                    </Field>
                    <Field label="E-posta">
                      <EmailInput value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                    </Field>
                  </div>
                )}
                <Banner tone="warning" variant="soft" icon={InfoIcon} className="items-start px-4 py-3">
                  {phoneWarn}
                </Banner>
              </FormSection>

              <FormSection
                variant="card"
                icon={ShieldAlertIcon}
                title="Durum ve Erişim"
                subtitle="Pasif veya engelli kullanıcıların sisteme erişim kuralları"
              >
                <CheckboxRow
                  variant="card"
                  label="Kullanıcıyı Pasife Al"
                  description="Pasif kullanıcı giriş yapamaz; istendiğinde tekrar aktif edilebilir."
                  checked={form.passive}
                  disabled={form.blocked}
                  onChange={(v) => setForm((p) => ({ ...p, passive: v }))}
                />
                <div className="space-y-3 rounded-card border border-danger/30 bg-danger-soft/40 p-3">
                  <CheckboxRow
                    variant="inline"
                    className="items-start"
                    label={<span className="type-body-strong text-danger">Kullanıcıyı Engelle</span>}
                    description="Engelli kullanıcının sisteme erişimi tamamen durdurulur."
                    checked={form.blocked}
                    onChange={(v) => setForm((p) => ({ ...p, blocked: v }))}
                  />
                  {form.blocked && (
                    <Field label="Engel Sebebi" required>
                      <Textarea value={form.blockReason} onChange={(e) => setForm((p) => ({ ...p, blockReason: e.target.value }))} rows={3} placeholder="Engel sebebini yazın..." />
                    </Field>
                  )}
                </div>
              </FormSection>

              <FormSection
                variant="card"
                icon={KeyRoundIcon}
                title="Şifre İşlemleri"
                subtitle="Geçici şifre gönder veya elle şifre belirle"
              >
                <ParticipantPasswordSection
                  participantId={editingRow?.id}
                  password={form.password}
                  onPasswordChange={(v) => setForm((p) => ({ ...p, password: v }))}
                  mustChange={form.mustChange}
                  onMustChangeChange={(v) => setForm((p) => ({ ...p, mustChange: v }))}
                />
              </FormSection>
            </AdminFormShell>
          )
        }}
      />

      {detailId && (
        <ParticipantDetailModal
          id={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          onMutated={bump}
          initialTab={detailInitialTab}
        />
      )}

      {statusAction && (
        <ConfirmModal
          open={!!statusAction}
          onClose={() => setStatusAction(null)}
          onConfirm={runStatus}
          icon={statusAction.to === 'Blocked' ? ShieldOffIcon : PowerIcon}
          tone={statusMeta(statusAction).tone}
          title={statusMeta(statusAction).title}
          description={statusMeta(statusAction).description}
          confirmLabel={statusMeta(statusAction).confirm}
          loading={statusSaving}
        />
      )}

      {blockTarget && (
        <ParticipantBlockModal
          open={!!blockTarget}
          participantName={blockTarget.fullName}
          loading={blockSaving}
          onClose={() => setBlockTarget(null)}
          onConfirm={runBlock}
        />
      )}

      <ParticipantNviBulkModal mode={nviBulk} onClose={() => setNviBulk(null)} onDone={() => { bump(); fetchSummary() }} />
      <BroadcastModal open={!!broadcastIds} target="participant" ids={broadcastIds ?? []} count={broadcastIds?.length ?? 0} onClose={() => setBroadcastIds(null)} />
    </>
  )
}
