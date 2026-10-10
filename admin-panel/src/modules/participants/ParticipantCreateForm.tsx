import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ShieldCheckIcon, Users2Icon, ArrowLeftIcon, FingerprintIcon, CalendarIcon,
  MapPinIcon, CheckCircle2Icon, UserPlusIcon, UserCheckIcon, SaveIcon, ContactIcon, SearchIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Field, TcknInput, DatePicker, PhoneInput, EmailInput, Button, Badge, Banner, CredentialDeliveryCard,
  AdminFormShell, FormSection, Avatar,
} from '@/design-system'
import { formatDate } from '@/lib/utils'
import participantService from '@/services/participant.service'
import type {
  NviLookupResult, CreateParticipantRequest, ParticipantDeliveryChannel, ParticipantDetail,
} from '@/types/participant.types'
import { GENDER_LABELS } from '@/types/participant.types'

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <Button variant="outline" size="sm" onClick={onClick}>
    <ArrowLeftIcon className="h-4 w-4" /> Geri
  </Button>
)

const PersonSection = ({ title, name, meta, badges, address, onBack }: {
  title: string
  name: string
  meta: string
  badges: ReactNode
  address?: string | null
  onBack: () => void
}) => (
  <FormSection variant="card" icon={FingerprintIcon} title={title} action={<BackButton onClick={onBack} />}>
    <div className="flex items-center gap-3">
      <Avatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-body-strong">{name}</p>
          {badges}
        </div>
        <p className="type-caption mt-0.5">{meta}</p>
        {address && (
          <p className="type-caption mt-0.5 flex items-start gap-1"><MapPinIcon className="mt-0.5 h-3 w-3 shrink-0" />{address}</p>
        )}
      </div>
    </div>
  </FormSection>
)

export const ParticipantCreateForm = ({ onDone }: { onDone: () => void }) => {
  const [tckn, setTckn] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [loading, setLoading] = useState(false)

  const [existing, setExisting] = useState<ParticipantDetail | null>(null)
  const [nvi, setNvi] = useState<NviLookupResult | null>(null)

  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [savingExisting, setSavingExisting] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const reset = () => { setExisting(null); setNvi(null) }

  const proceed = async () => {
    if (!queryValid) return
    setLoading(true)
    try {
      const look = await participantService.lookupByTckn(tckn)
      if (look.exists && look.participant) {
        const p = look.participant
        setExisting(p)
        setPhone(p.phone ?? '')
        setEmail(p.email ?? '')
        setGuardianPhone(p.guardianPhone ?? '')
        setGuardianEmail(p.guardianEmail ?? '')
        return
      }
      if (!birthDate) {
        toast.error('Kayıtlı olmayan kişi için doğum tarihi gereklidir.')
        return
      }
      setNvi(await participantService.nviLookup(tckn, birthDate))
    } finally {
      setLoading(false)
    }
  }

  const queryValid = tckn.length === 11 && /^[0-9]+$/.test(tckn)

  if (existing) {
    const minor = existing.isMinor
    const saveContact = async () => {
      setSavingExisting(true)
      try {
        await participantService.update(existing.id, {
          phone: phone || undefined,
          email: email || undefined,
          guardianPhone: minor ? guardianPhone || undefined : undefined,
          guardianEmail: minor ? guardianEmail || undefined : undefined,
        })
        toast.success('İletişim bilgileri güncellendi.')
      } finally {
        setSavingExisting(false)
      }
    }
    const resetPassword = async (channel: ParticipantDeliveryChannel) => {
      await participantService.sendPasswordReset(existing.id, channel)
      toast.success(`Yeni geçici şifre ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi. İlk girişte değiştirilmesi zorunludur.`)
    }

    return (
      <AdminFormShell icon={UserCheckIcon} title="Bu kişi zaten kayıtlı" subtitle="Yeni kayıt gerekmez; bilgilerini güncelleyebilir veya şifre gönderebilirsiniz." tone="green">
          <PersonSection
            title="Kayıtlı Kişi"
            name={existing.fullName}
            meta={`${formatDate(existing.birthDate)} · TC ${existing.tckn}`}
            badges={<><Badge tone="success">{GENDER_LABELS[existing.gender]}</Badge>{minor && <Badge tone="warning">18 yaş altı</Badge>}</>}
            onBack={reset}
          />

          {existing.children.length > 0 && (
            <FormSection variant="card" icon={Users2Icon} title="Kayıtlı Çocukları" action={<Badge tone="primary">{existing.children.length}</Badge>}>
              <div className="space-y-1.5">
                {existing.children.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-field bg-surface-1 px-3 py-2">
                    <span className="type-body-strong truncate">{c.fullName}</span>
                    <Badge tone="neutral">{GENDER_LABELS[c.gender]}</Badge>
                    {c.age != null && <span className="type-caption">{c.age} yaş</span>}
                  </div>
                ))}
              </div>
            </FormSection>
          )}

          <FormSection variant="card" icon={ContactIcon} title="İletişim Bilgileri" subtitle="Telefon ve e-posta giriş bilgilerini etkiler">
            {minor ? (
              <>
                <Field label="Veli Telefonu"><PhoneInput value={guardianPhone} onChange={setGuardianPhone} /></Field>
                <Field label="Veli E-postası (opsiyonel)"><EmailInput value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
                <Field label="Çocuğun Telefonu (opsiyonel)"><PhoneInput value={phone} onChange={setPhone} /></Field>
                <Field label="Çocuğun E-postası (opsiyonel)"><EmailInput value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              </>
            ) : (
              <>
                <Field label="Telefon"><PhoneInput value={phone} onChange={setPhone} /></Field>
                <Field label="E-posta (opsiyonel)"><EmailInput value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              </>
            )}
            <Button variant="primary" className="w-full" isLoading={savingExisting} onClick={saveContact}>
              <SaveIcon className="h-4 w-4" /> Bilgileri Güncelle
            </Button>
          </FormSection>

          <CredentialDeliveryCard
            title="Şifre Sıfırla"
            description="Yeni bir geçici şifre üretilir ve seçilen kanaldan iletilir; kullanıcı ilk girişte değiştirmek zorundadır."
            onSend={resetPassword}
          />

          <Button variant="outline" className="w-full" onClick={onDone}>Kapat</Button>
      </AdminFormShell>
    )
  }

  if (nvi) {
    const minor = nvi.isMinor
    const contactReady = minor ? guardianPhone.length >= 10 : phone.length >= 10
    const send = async (channel: ParticipantDeliveryChannel) => {
      const req: CreateParticipantRequest = {
        tckn,
        birthDate,
        email: email || undefined,
        phone: phone || undefined,
        guardianPhone: minor ? guardianPhone : undefined,
        guardianEmail: minor ? guardianEmail || undefined : undefined,
        deliveryChannel: channel,
      }
      await participantService.create(req)
      toast.success(`Katılımcı oluşturuldu. Geçici şifre ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi.`)
      onDone()
    }

    return (
      <AdminFormShell icon={CheckCircle2Icon} title="Kimlik Doğrulandı" subtitle="İletişim bilgilerini ekleyin ve geçici şifre gönderin." tone="green">
          <PersonSection
            title="NVI Kimlik Bilgileri"
            name={nvi.fullName}
            meta={`${nvi.birthDate ? formatDate(nvi.birthDate) : '—'} · TC ${nvi.tckn}`}
            badges={<><Badge tone="success">{GENDER_LABELS[nvi.gender]}</Badge>{minor && <Badge tone="warning">18 yaş altı</Badge>}</>}
            address={nvi.address}
            onBack={reset}
          />

          {nvi.children.length > 0 && (
            <FormSection variant="card" icon={Users2Icon} title="18 Yaş Altı Çocuklar" subtitle="NVI'den otomatik bağlanır" action={<Badge tone="primary">{nvi.children.length}</Badge>}>
              <div className="space-y-1.5">
                {nvi.children.map((c) => (
                  <div key={c.tckn} className="flex flex-wrap items-center gap-2 rounded-field bg-surface-1 px-3 py-2">
                    <span className="type-body-strong">{c.fullName}</span>
                    <Badge tone="neutral">{GENDER_LABELS[c.gender]}</Badge>
                    <span className="type-caption flex items-center gap-1"><FingerprintIcon className="h-3 w-3" />{c.tckn}</span>
                    <span className="type-caption flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{formatDate(c.birthDate)}</span>
                  </div>
                ))}
              </div>
            </FormSection>
          )}

          <FormSection variant="card" icon={minor ? Users2Icon : ContactIcon} title={minor ? 'Veli ve Çocuk İletişimi' : 'İletişim Bilgileri'} subtitle="Geçici şifre bu kanallardan gönderilir">
            {minor ? (
              <>
                <Field label="Veli Telefonu" required><PhoneInput value={guardianPhone} onChange={setGuardianPhone} /></Field>
                <Field label="Veli E-postası (opsiyonel)"><EmailInput value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} /></Field>
                <Field label="Çocuğun Telefonu (opsiyonel)" hint="Yoksa veli numarasıyla giriş yapabilir."><PhoneInput value={phone} onChange={setPhone} /></Field>
                <Field label="Çocuğun E-postası (opsiyonel)"><EmailInput value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              </>
            ) : (
              <>
                <Field label="Telefon" required><PhoneInput value={phone} onChange={setPhone} /></Field>
                <Field label="E-posta (opsiyonel)"><EmailInput value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              </>
            )}
          </FormSection>

          <CredentialDeliveryCard
            title="Geçici Şifre Gönderimi"
            description={`Backend güçlü, rastgele bir geçici şifre üretir; katılımcı ilk girişte değiştirmek zorundadır.${minor ? ' İletişim çocukta yoksa veli kanalına gönderilir.' : ''}`}
            onSend={send}
            disabled={!contactReady}
            disabledHint={`Göndermeden önce ${minor ? 'veli ' : ''}telefon alanını doldurun.`}
          />
      </AdminFormShell>
    )
  }

  return (
    <AdminFormShell icon={UserPlusIcon} title="Yeni Katılımcı Ekle" subtitle="Önce sistemde kayıtlı mı kontrol edilir; değilse NVI ile doğrulanır." tone="blue">
      <Banner tone="info" variant="soft">
        T.C. kimlik numarasını girin. Kişi sistemde kayıtlıysa bilgileri gösterilir; değilse doğum tarihiyle NVI'den doğrulanır.
      </Banner>

      <FormSection variant="card" icon={SearchIcon} title="Kimlik Sorgulama" subtitle="T.C. kimlik no zorunlu, doğum tarihi yeni kayıtlar için gerekli">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="T.C. Kimlik No" required>
            <TcknInput value={tckn} onChange={setTckn} />
          </Field>
          <Field label="Doğum Tarihi" hint="Kayıtlı değilse NVI için gereklidir.">
            <DatePicker value={birthDate} max={today} onChange={setBirthDate} />
          </Field>
        </div>
        <Button variant="primary" className="w-full" isLoading={loading} disabled={!queryValid} onClick={proceed}>
          <ShieldCheckIcon className="h-4 w-4" /> Devam Et
        </Button>
      </FormSection>
    </AdminFormShell>
  )
}
