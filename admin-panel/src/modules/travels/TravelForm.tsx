import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  MapPinIcon, CalendarIcon, BusIcon, PlusIcon, UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Combobox, DatePicker, Field, ToggleRow, NumberInput, RemovableTag, Button, Select, Banner, type ComboOption } from '@/design-system'
import { ResponsiblePersonField, type ResponsiblePersonValue } from '@/components/specialized/ResponsiblePersonField'
import { getBusTemplate, generateBusSeatPositions, countBusSeatStatuses } from '@/components/specialized/seating'
import { todayIso } from '@/lib/utils'
import travelRouteService from '@/services/travelRoute.service'
import travelBusService from '@/services/travelBus.service'
import { TravelBusQuickCreateModal } from './TravelBusQuickCreateModal'
import type { TravelFormData, Travel, TravelBus, TravelCrewMember, TravelResponsible } from '@/types/travel.types'
import type { SelectOption } from '@/types/common'
import { PARTICIPATION_PERIOD_OPTIONS } from './travelFormDefaults'

interface Props {
  form: TravelFormData
  setForm: Dispatch<SetStateAction<TravelFormData>>
  mode?: 'create' | 'edit'
  editingRow?: Travel | null
  readOnly?: boolean
  /** Route seçimi sabitlenmişse (ör. bir Gezi'nin altından "Yeni Sefer" açılıyorsa) değiştirilemez. */
  lockedRouteId?: string
  lockedRouteName?: string
  /** Genel Ayarlar'daki "Önceden Rezervasyon" gün sayısı — yeni sefer oluştururken kayıt
   * başlangıcı tarihi bu kadar gün önceden otomatik önerilir (kullanıcı yine değiştirebilir). */
  advanceBookingDays?: number
}

/**
 * "Sefer" formu — bir Gezi'nin (Route) belirli tarihli somut kalkışı. İçerik
 * alanları burada yoktur (Route'tan miras alınır); yalnızca route seçimi, tarih,
 * kapasite, ekip ve otobüs ataması buradan tanımlanır.
 */
export const TravelForm = ({ form, setForm, mode, editingRow, readOnly, lockedRouteId, lockedRouteName, advanceBookingDays }: Props) => {
  const [routeOptions, setRouteOptions] = useState<SelectOption[]>([])
  const [routeLabel, setRouteLabel] = useState(lockedRouteName ?? '')
  const [availableBuses, setAvailableBuses] = useState<TravelBus[]>([])
  const [busQuickCreateOpen, setBusQuickCreateOpen] = useState(false)
  const travelId = editingRow?.id
  const published = mode === 'edit' && !!editingRow?.isActive
  // Yeni sefer oluştururken (edit değil) ve kullanıcı kayıt başlangıcını henüz elle
  // değiştirmemişken, gidiş tarihi girildiğinde Genel Ayarlar'daki "Önceden Rezervasyon"
  // gün sayısına göre kayıt başlangıcı otomatik önerilir — daha önce bu ayar hiç kullanılmıyordu.
  const registrationTouchedRef = useRef(mode === 'edit')
  useEffect(() => {
    if (mode === 'edit') registrationTouchedRef.current = true
  }, [mode])
  useEffect(() => {
    if (mode === 'edit' || registrationTouchedRef.current) return
    if (!form.startDate || !advanceBookingDays) return
    const d = new Date(`${form.startDate}T00:00:00`)
    d.setDate(d.getDate() - advanceBookingDays)
    const suggested = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setForm((f) => (f.registrationStartDate ? f : { ...f, registrationStartDate: suggested }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca gidiş tarihi değiştiğinde tetiklenmeli
  }, [form.startDate, advanceBookingDays, mode])

  const routeOptionsCombo: ComboOption[] = useMemo(
    () => routeOptions.map((r) => ({ value: r.value, label: r.label })),
    [routeOptions],
  )

  useEffect(() => {
    if (lockedRouteId) return
    travelRouteService.getOptions().then(setRouteOptions).catch(() => setRouteOptions([]))
  }, [lockedRouteId])

  useEffect(() => {
    if (!editingRow) return
    setRouteLabel(editingRow.name)
  }, [editingRow])

  useEffect(() => {
    if (mode !== 'edit' || !travelId) return
    let active = true
    travelBusService.getByTravel(travelId).then((buses) => {
      if (!active) return
      setForm((f) => (f.busIds.length === 0 ? { ...f, busIds: buses.map((b) => b.id) } : f))
    }).catch(() => {})
    return () => { active = false }
  }, [travelId, mode, setForm])

  useEffect(() => {
    let active = true
    travelBusService.getAvailable(travelId, form.startDate || undefined, form.endDate || undefined).then((buses) => {
      if (!active) return
      setAvailableBuses(buses)
    }).catch(() => { if (active) setAvailableBuses([]) })
    return () => { active = false }
  }, [travelId, form.startDate, form.endDate])

  const patch = (p: Partial<TravelFormData>) => setForm((f) => ({ ...f, ...p }))

  const busCeiling = useMemo(
    () =>
      availableBuses
        .filter((b) => form.busIds.includes(b.id))
        .reduce((sum, b) => {
          if (b.vehicleType === 'capacity') return sum + b.capacity
          const counts = countBusSeatStatuses(generateBusSeatPositions(getBusTemplate(b.templateId)), b.seatStates ?? {})
          return sum + (counts.total - counts.blocked - counts.hidden)
        }, 0),
    [availableBuses, form.busIds],
  )

  const followsBusRef = useRef(true)
  const syncedRef = useRef(false)
  useEffect(() => { syncedRef.current = false; followsBusRef.current = true }, [travelId, mode])
  useEffect(() => {
    if (busCeiling <= 0) return
    setForm((f) => {
      if (!syncedRef.current) {
        syncedRef.current = true
        followsBusRef.current = f.capacity === 0 || f.capacity >= busCeiling
        return followsBusRef.current ? { ...f, capacity: busCeiling } : f
      }
      if (followsBusRef.current) return f.capacity === busCeiling ? f : { ...f, capacity: busCeiling }
      if (f.capacity > busCeiling) return { ...f, capacity: busCeiling }
      return f
    })
  }, [busCeiling, setForm])

  // Kullanıcı bulgusu (2026-08-07): "Gezide seçilen otobüsün kontenjanı kaç ise ona göre
  // kontenjan otomatik gelsin" — düzenleme modunda kayıtlı bir sefere ikinci bir araç
  // eklendiğinde (veya bir araç kaldırıldığında) Kontenjan alanı senkronize OLMUYORDU: takip
  // modu (followsBusRef) yalnızca formun ilk yüklendiği anda bir kere hesaplanıyor, sonrasında
  // kullanıcı Kontenjan'ı elle busCeiling'in altına düşürmüşse (ya da kayıtlı sefer zaten
  // araçların toplamından düşük bir kontenjanla kayıtlıysa) bir daha otomatik moda dönmüyordu.
  // Canlı testte kanıtlandı: 43 kontenjanlı, 2 otobüslü (43+49=92) kayıtlı bir seferi düzenlerken
  // otobüs ekleyip çıkarmak Kontenjan'ı hiç değiştirmiyordu. Düzeltme: araç seçimi kullanıcı
  // tarafından her DEĞİŞTİRİLDİĞİNDE (ekleme/çıkarma) takip modu yeniden açılır — böylece
  // Kontenjan her zaman seçili araçların güncel toplam koltuk/kontenjan sayısına eşitlenir.
  // Kullanıcı Kontenjan alanına elle daha düşük bir sayı yazarsa (setCapacity), takip yine kapanır
  // ve bir sonraki araç değişikliğine kadar o manuel değer korunur.
  const toggleBus = (id: string, on: boolean) => {
    if (on && form.busIds.length > 0 && !form.busIds.includes(id)) {
      toast.error('Bir sefere yalnızca bir araç atanabilir. Önce mevcut aracı kaldırın.')
      return
    }
    followsBusRef.current = true
    setForm((f) => ({ ...f, busIds: on ? [...f.busIds, id] : f.busIds.filter((x) => x !== id) }))
  }

  const onBusCreated = (bus: TravelBus) => {
    setAvailableBuses((prev) => [...prev, bus])
    toggleBus(bus.id, true)
  }

  const setCapacity = (n: number) => {
    const v = busCeiling > 0 ? Math.min(Math.max(0, n), busCeiling) : Math.max(0, n)
    followsBusRef.current = busCeiling > 0 && v >= busCeiling
    patch({ capacity: v })
  }

  const selectedBuses = availableBuses.filter((b) => form.busIds.includes(b.id))
  const searchBuses = async (q: string) => {
    const term = q.trim().toLowerCase()
    return availableBuses
      .filter((b) => !form.busIds.includes(b.id) && (!term || `${b.name} ${b.plateNumber}`.toLowerCase().includes(term)))
      .map((b) => ({
        value: b.id,
        label: b.name,
        description: b.vehicleType === 'capacity' ? `${b.capacity} kişi (kontenjanlı)` : `${b.plateNumber} · ${b.capacity} koltuk`,
      }))
  }

  const toRPV = (m: TravelCrewMember): ResponsiblePersonValue => ({ managerId: m.id, manager: m.name, managerPhone: m.phone, tckn: m.tckn })
  const toRPVResp = (r: TravelResponsible): ResponsiblePersonValue => ({ managerId: r.id, manager: r.name, managerRoleKey: r.roleKey, managerRoleName: r.role, managerPhone: r.phone, managerEmail: r.email, emergencyPhone: r.emergencyPhone, grantAccess: r.grantAccess, tckn: r.tckn })
  const setDriver = (p: Partial<ResponsiblePersonValue>) =>
    setForm((f) => ({ ...f, crew: { ...f.crew, driver: {
      id: p.managerId !== undefined ? p.managerId : f.crew.driver.id,
      name: p.manager !== undefined ? p.manager : f.crew.driver.name,
      phone: p.managerPhone !== undefined ? p.managerPhone : f.crew.driver.phone,
      tckn: p.tckn !== undefined ? p.tckn : f.crew.driver.tckn,
    } } }))
  const setGuideResponsible = (p: Partial<ResponsiblePersonValue>) =>
    setForm((f) => ({ ...f, crew: { ...f.crew,
      guide: {
        id: p.managerId !== undefined ? p.managerId : f.crew.guide.id,
        name: p.manager !== undefined ? p.manager : f.crew.guide.name,
        phone: p.managerPhone !== undefined ? p.managerPhone : f.crew.guide.phone,
      },
      responsible: {
        id: p.managerId !== undefined ? p.managerId : f.crew.responsible.id,
        name: p.manager !== undefined ? p.manager : f.crew.responsible.name,
        role: p.managerRoleName !== undefined ? p.managerRoleName : f.crew.responsible.role,
        roleKey: p.managerRoleKey !== undefined ? p.managerRoleKey : f.crew.responsible.roleKey,
        phone: p.managerPhone !== undefined ? p.managerPhone : f.crew.responsible.phone,
        email: p.managerEmail !== undefined ? p.managerEmail : f.crew.responsible.email,
        emergencyPhone: p.emergencyPhone !== undefined ? p.emergencyPhone : f.crew.responsible.emergencyPhone,
        grantAccess: p.grantAccess !== undefined ? p.grantAccess : f.crew.responsible.grantAccess,
        tckn: p.tckn !== undefined ? p.tckn : f.crew.responsible.tckn,
      },
    } }))

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <MapPinIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Gezi</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {lockedRouteId ? (
            <Banner tone="info" variant="soft" icon={MapPinIcon}>
              Bu sefer <strong>{lockedRouteName}</strong> gezisi altında oluşturuluyor. İçerik bilgileri (isim, açıklama, kural, görsel) gezi kaydından gelir.
            </Banner>
          ) : (
            <Field label="Gezi (Rota)" required hint="Seferin bağlı olduğu gezi. İçerik bilgileri buradan miras alınır.">
              <Combobox
                value={form.routeId}
                displayValue={routeLabel}
                onChange={(v, opt) => { patch({ routeId: v }); setRouteLabel(opt?.label ?? '') }}
                options={routeOptionsCombo}
                searchInList
                searchPlaceholder="Gezi ara..."
                placeholder="Gezi seçin"
                emptyText="Eşleşen gezi bulunamadı"
                disabled={readOnly || mode === 'edit'}
              />
            </Field>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CalendarIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Tarihler</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Başlangıç Tarihi" required>
              <DatePicker value={form.startDate} onChange={(v) => patch({ startDate: v })} min={todayIso()} disabled={readOnly} />
            </Field>
            <Field label="Bitiş Tarihi" required>
              <DatePicker value={form.endDate} onChange={(v) => patch({ endDate: v })} min={form.startDate || todayIso()} disabled={readOnly} />
            </Field>
          </div>
          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Kayıt Başlangıcı" hint={mode === 'edit' || !advanceBookingDays ? 'Saat de seçebilirsiniz — belirtilmezse gün başı (00:00) esas alınır.' : `Saat de seçebilirsiniz — gidiş tarihinden ${advanceBookingDays} gün önce otomatik önerilir, isterseniz değiştirin.`}>
              <DatePicker showTime value={form.registrationStartDate} onChange={(v) => { registrationTouchedRef.current = true; patch({ registrationStartDate: v }) }} min={todayIso()} clearable disabled={readOnly} />
            </Field>
            <Field label="Kayıt Bitişi" hint="Saat de seçebilirsiniz — belirtilmezse gün sonu (23:59) esas alınır.">
              <DatePicker showTime value={form.registrationEndDate} onChange={(v) => patch({ registrationEndDate: v })} min={form.registrationStartDate || todayIso()} clearable disabled={readOnly} />
            </Field>
          </div>
          <Field label="Son İptal Süresi" hint="Vatandaş, kalkıştan en geç bu kadar saat öncesine kadar kaydını iptal edebilir. 0 girilirse kalkışa kadar iptal serbesttir.">
            <NumberInput value={form.cancellationDeadlineHours} onChange={(n) => patch({ cancellationDeadlineHours: n })} min={0} max={720} suffix="saat" placeholder="72" disabled={readOnly} />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Kontenjan</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Kontenjan" hint={form.busIds.length === 0 ? 'Araç seçilmediği için serbestçe girilebilir (araçsız/kontenjan bazlı katılım).' : `En fazla ${busCeiling} kişi (seçili araçların açık kontenjan toplamı).`}>
              <NumberInput value={form.capacity} onChange={setCapacity} min={0} max={busCeiling > 0 ? busCeiling : undefined} placeholder="0" disabled={readOnly} />
            </Field>
            <Field label="Yedek Kontenjan">
              <NumberInput value={form.reserveCapacity} onChange={(n) => patch({ reserveCapacity: n })} min={0} placeholder="0" disabled={readOnly} />
            </Field>
          </div>
          <Field label="Katılım Sınırı">
            <div className="grid gap-[15px] sm:grid-cols-2">
              <Select value={form.participationPeriod} onChange={(e) => {
                const period = e.target.value as TravelFormData['participationPeriod']
                patch({ participationPeriod: period, ...(period !== 'none' && form.participationLimit < 1 ? { participationLimit: 1 } : {}) })
              }} disabled={readOnly}>
                {PARTICIPATION_PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {form.participationPeriod !== 'none' && (
                <NumberInput value={form.participationLimit} onChange={(n) => patch({ participationLimit: n })} min={1} placeholder="Kaç kez" disabled={readOnly} />
              )}
            </div>
          </Field>
          <ToggleRow
            label="Genel katılım sınırından muaf"
            description="Açıksa, bu sefer hem genel (varsayılan) katılım sıklığı sınırından hem de kendi 'Katılım Sınırı' ayarından bağımsız sayılır — üye o dönemki hakkını doldurmuş olsa bile bu sefere ayrıca başvurabilir, ve bu sefere yapılan başvuru diğer gezilerin dönem sayımına dahil edilmez."
            checked={form.exemptFromParticipationLimit}
            onChange={(v) => patch({ exemptFromParticipationLimit: v })}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <BusIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Araçlar & Ekip</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <Field
            label="Araçlar"
            hint={published
              ? 'Yayınlanmış seferin aracı değiştirilemez. Değiştirmek için önce seferi pasife alın.'
              : 'Opsiyonel — her sefere en fazla bir araç atanabilir. Araç seçmezseniz sefer yalnızca kontenjan sınırıyla yürütülür. Aracı değiştirmek için önce mevcut aracı kaldırın.'}
          >
            {!published && !readOnly && form.busIds.length === 0 && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    value=""
                    displayValue=""
                    onSearch={searchBuses}
                    onChange={(id) => { if (id) toggleBus(id, true) }}
                    placeholder={availableBuses.length === 0 ? 'Kayıtlı aktif araç yok' : 'Araç ara ve ekle...'}
                    emptyText="Müsait araç bulunamadı"
                    iconLeft={<BusIcon className="h-4 w-4" />}
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => setBusQuickCreateOpen(true)}>
                  <PlusIcon className="h-4 w-4" /> Yeni Araç
                </Button>
              </div>
            )}
            {selectedBuses.length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="type-caption text-foreground-muted">Bu sefere bir araç atanmıştır. Başka araç seçmek için önce mevcut aracı kaldırın.</p>
                <div className="flex flex-wrap gap-2">
                {selectedBuses.map((b) => (
                  <RemovableTag
                    key={b.id}
                    label={b.vehicleType === 'capacity'
                      ? `${b.name} · ${b.capacity} kişi (kontenjanlı)`
                      : `${b.name} · ${b.plateNumber} · ${b.capacity} koltuk`}
                    onRemove={() => toggleBus(b.id, false)}
                    disabled={published || !!readOnly}
                  />
                ))}
                </div>
              </div>
            ) : (
              <p className="rounded-card border border-border bg-surface-1 p-3 type-muted">
                Araç seçilmedi — sefer araçsız, sadece kontenjan sınırıyla yürütülecek.
              </p>
            )}
          </Field>

          <div className="space-y-[15px]">
            <ResponsiblePersonField label="Rehber / Sorumlu Kişi" allowCreate allowAccessGrant roleTemplate={{ name: 'Gezi Sorumlusu', scopeHint: 'yalnız bu sefer' }} hint="Mevcut yöneticiden seçin ya da yeni bir kişi ekleyin (opsiyonel)." value={toRPVResp(form.crew.responsible)} onChange={setGuideResponsible} disabled={readOnly} />
            <ResponsiblePersonField label="Şoför" hint="Yöneticiden seçerseniz ad ve telefon otomatik gelir; bir yönetici seçmezseniz ad soyadı kutuya yazıp telefonu elle girin (opsiyonel)." value={toRPV(form.crew.driver)} onChange={setDriver} allowManual showTckn showEmail={false} showEmergency={false} disabled={readOnly} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UsersIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Durum</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <ToggleRow label="Aktif" description="Pasif seferler başvuruya kapalıdır" checked={form.isActive} onChange={(v) => patch({ isActive: v })} disabled={readOnly} />
        </div>
      </div>

      <TravelBusQuickCreateModal
        open={busQuickCreateOpen}
        onClose={() => setBusQuickCreateOpen(false)}
        onCreated={onBusCreated}
      />
    </>
  )
}
