import { useEffect, useState } from 'react'
import { Icon2D } from '@/components/Icon2D'
import { MessageSquarePlusIcon, SendIcon, LoaderIcon, CheckCircle2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Combobox, Input, Textarea } from '@/design-system'
import type { SubmissionFormOptions } from '@/services/submission.service'
import submissionService from '@/services/submission.service'
import fieldSurveyService, { FieldOfflineQueuedError, FieldOfflinePersistFailedError } from '@/services/fieldSurvey.service'
import { MicButton } from './MicButton'

// Kullanıcı isteği (2026-09-02): "TC kimlik girilirse doğum tarihi vs. NVI'dan otomatik
// gelsin; TC sisteme kayıtlı değilse ona göre farklı davranılsın (manuel giriş açılsın)".
// Burada tam NVI sorgusu yerine (KVKK: talep formu sahada TC ile ad-soyad "kesinleştirme"
// amaçlı değil) mevcut FieldRespondentLookup ucu (yerel Participant tablosu) kullanılır:
// kayıtlıysa ad-soyad/mahalle otomatik dolar ve salt-okunur gösterilir; kayıtlı değilse
// alanlar boş ve serbestçe elle doldurulabilir kalır.
const isTcknLike = (raw: string) => raw.replace(/\D/g, '').length === 11

// Kullanıcı isteği (2026-09-01): "talep istek öneri şikayet durumundan direkt o kişi için
// başvurabilirsin veya sistem içinde o kişinin telefon numarasına sms olarak katıldığı anket
// soruları gönderilebilir kendisinin de cevaplaması istenebilir" — saha görevlisi ekranına
// iki hızlı aksiyon: (1) görüşülen kişi adına Muhtarlık talep/öneri/şikayet kaydı, (2) SMS
// ile anket linki gönderme (yalnızca telefonla da gönderilebilir).

type Tab = 'submission' | 'sms'

type Props = {
  open: boolean
  onClose: () => void
  fieldTaskId: string
  neighborhood: string
  prefillTckn?: string | null
  prefillPhone?: string | null
  prefillName?: string | null
  // Kullanıcı isteği (2026-09-05): anket başında (T.C. kimlikli katılımda) doğum
  // tarihi zaten alındıysa buraya otomatik geçilir; anonim katılımdan sonra bu form
  // bağımsız açılırsa (prefillTckn yok) boş başlar ve anketör elle girebilir.
  prefillBirthDate?: string | null
}

const SUBMISSION_TYPES: { value: 'request' | 'suggestion' | 'complaint'; label: string; color: string }[] = [
  { value: 'request', label: 'Talep', color: '#22c55e' },
  { value: 'suggestion', label: 'Öneri', color: '#f97316' },
  { value: 'complaint', label: 'Şikayet', color: '#ef4444' },
]

export const FieldQuickActionsModal = ({
  open, onClose, fieldTaskId, neighborhood, prefillTckn, prefillPhone, prefillName, prefillBirthDate,
}: Props) => {
  const [tab, setTab] = useState<Tab>('submission')
  const [options, setOptions] = useState<SubmissionFormOptions | null>(null)

  // Talep/öneri/şikayet formu
  const [subType, setSubType] = useState<'request' | 'suggestion' | 'complaint'>('request')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [citizenName, setCitizenName] = useState('')
  const [citizenPhone, setCitizenPhone] = useState('')
  const [citizenTc, setCitizenTc] = useState('')
  // Kullanıcı isteği (2026-09-05): "TC kimlik doğum tarihi sorgulaması olacak, kişi talep
  // bıraktığında anonim ise burdan o bilgileri isteyecek, başlangıçta vermişse o
  // bilgilere göre doldurulacak" — anket başındaki NVI doğrulamasından gelen doğum
  // tarihi burada otomatik doldurulur; anonim katılımdan sonra bağımsız açılırsa
  // boş başlar ve isteğe bağlı elle girilebilir.
  const [citizenBirthDate, setCitizenBirthDate] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)
  // Kullanıcı isteği (2026-09-02): TC girilince sistemde kayıtlı mı diye otomatik sorgu.
  const [tcLookupState, setTcLookupState] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle')
  // Kullanıcı isteği (2026-09-02): "sokak cadde ic kapı no vs tüm secenekler incel bunlar
  // bizim sistemimizde anket şablonu haline getir" — ulakBELL'in "Sokak-Cadde / Dış Kapı No
  // / İç Kapı No" alanları isteğe bağlı olarak eklendi. Backend'de zaten var olan tek
  // Address alanına (migration gerektirmeden) birleştirilerek yazılır.
  const [streetAddress, setStreetAddress] = useState('')
  const [buildingNo, setBuildingNo] = useState('')
  const [doorNo, setDoorNo] = useState('')

  // SMS link formu
  const [smsPhone, setSmsPhone] = useState('')
  const [sendingSms, setSendingSms] = useState(false)

  useEffect(() => {
    if (!open) return
    setCitizenName(prefillName ?? '')
    setCitizenPhone(prefillPhone ?? '')
    setCitizenTc(prefillTckn ?? '')
    setCitizenBirthDate(prefillBirthDate ?? '')
    setSmsPhone(prefillPhone ?? '')
    setTitle('')
    setDescription('')
    setCategory('')
    setStreetAddress('')
    setBuildingNo('')
    setDoorNo('')
    setTcLookupState('idle')
    submissionService.options().then(setOptions).catch(() => setOptions(null))
  }, [open, prefillTckn, prefillPhone, prefillName, prefillBirthDate])

  // Kullanıcı isteği (2026-09-02): "TC kimlik girilirse ... otomatik gelsin; sisteme kayıtlı
  // değilse ona göre farklı davranılsın (manuel giriş açılsın)". 11 hane tamamlanınca yerel
  // kayıt sorgulanır: kayıtlıysa ad-soyad/mahalle otomatik dolar (salt-okunur gösterilir),
  // kayıtlı değilse alanlar serbest kalır ve anketör elle doldurur.
  useEffect(() => {
    if (!open || !isTcknLike(citizenTc)) { setTcLookupState('idle'); return }
    let alive = true
    setTcLookupState('loading')
    const handle = window.setTimeout(() => {
      fieldSurveyService.lookup(fieldTaskId, citizenTc)
        .then((res) => {
          if (!alive) return
          if (res.isRegistered) {
            setTcLookupState('found')
            if (res.fullName) setCitizenName(res.fullName)
          } else {
            setTcLookupState('not_found')
          }
        })
        .catch(() => { if (alive) setTcLookupState('not_found') })
    }, 400)
    return () => { alive = false; window.clearTimeout(handle) }
  }, [open, citizenTc, fieldTaskId])

  if (!open) return null

  const submitTicket = async () => {
    if (!category) { toast.error('Konu seçin.'); return }
    if (!title.trim()) { toast.error('Başlık girin.'); return }
    if (!description.trim()) { toast.error('Açıklama girin.'); return }
    setSubmittingTicket(true)
    try {
      // Kullanıcı isteği (2026-09-02): Sokak/Cadde, Dış Kapı No, İç Kapı No isteğe bağlıdır;
      // hiçbiri girilmezse Address boş kalır (backend zaten null/boşu kabul ediyor).
      const addressParts = [
        streetAddress.trim(),
        buildingNo.trim() && `No: ${buildingNo.trim()}`,
        doorNo.trim() && `Kapı: ${doorNo.trim()}`,
      ].filter(Boolean)
      const result = await fieldSurveyService.createSubmission({
        fieldTaskId,
        title: title.trim(),
        description: description.trim(),
        categoryId: category,
        submissionType: subType,
        neighborhood,
        citizenName: citizenName.trim() || null,
        citizenPhone: citizenPhone.trim() || null,
        citizenTc: citizenTc.trim() || null,
        citizenBirthDate: citizenBirthDate || null,
        address: addressParts.length > 0 ? addressParts.join(', ') : null,
      })
      toast.success(`Başvuru oluşturuldu${result.trackingNo ? ` (${result.trackingNo})` : ''}.`)
      setTitle('')
      setDescription('')
      onClose()
    } catch (e) {
      // Kullanıcı isteği (2026-09-02): internet yoksa kayıt cihazda cache'lenir, bağlantı
      // gelince otomatik gönderilir — bu durumda hata değil bilgi mesajı gösterilir.
      if (e instanceof FieldOfflineQueuedError) {
        toast.warning('İnternet yok: başvuru cihazınıza kaydedildi, bağlantı gelince otomatik gönderilecek.')
        setTitle('')
        setDescription('')
        onClose()
        return
      }
      // Düzeltme (2026-09-05, denetim bulgusu): cihaza yazma da başarısız oldu (depolama
      // dolu/private mod). Form KASITLI OLARAK kapatılmaz/temizlenmez — anketör tekrar
      // denesin diye başlık/açıklama vb. tüm alanlar korunur.
      if (e instanceof FieldOfflinePersistFailedError) {
        toast.error(e.message)
        return
      }
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Başvuru oluşturulamadı.')
    } finally {
      setSubmittingTicket(false)
    }
  }

  const sendSms = async () => {
    const digits = smsPhone.replace(/\D/g, '')
    if (digits.length < 10) { toast.error('Geçerli bir telefon numarası girin.'); return }
    setSendingSms(true)
    try {
      const result = await fieldSurveyService.sendSmsLink(fieldTaskId, {
        phone: digits,
        tckn: citizenTc.trim() || null,
        fullName: citizenName.trim() || null,
      })
      if (result.sent) {
        toast.success('Anket linki SMS ile gönderildi.')
        onClose()
      } else {
        toast.error(result.errorMessage || 'SMS gönderilemedi.')
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'SMS gönderilemedi.')
    } finally {
      setSendingSms(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-panel border border-border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="type-section">Hızlı İşlemler</h2>
          <button type="button" onClick={onClose} className="type-caption text-foreground-subtle hover:text-foreground-strong">Kapat</button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4">
          <button
            type="button"
            onClick={() => setTab('submission')}
            className={`flex items-center justify-center gap-2 rounded-field border-2 py-3 text-sm font-bold transition-colors ${
              tab === 'submission' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-border bg-surface-1 text-foreground-subtle'
            }`}
          >
            <MessageSquarePlusIcon className="h-4 w-4" /> Talep / Öneri / Şikayet
          </button>
          <button
            type="button"
            onClick={() => setTab('sms')}
            className={`flex items-center justify-center gap-2 rounded-field border-2 py-3 text-sm font-bold transition-colors ${
              tab === 'sms' ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-border bg-surface-1 text-foreground-subtle'
            }`}
          >
            <SendIcon className="h-4 w-4" /> Anketi SMS ile Gönder
          </button>
        </div>

        {tab === 'submission' && (
          <div className="space-y-4 px-5 pb-6">
            <div className="grid grid-cols-3 gap-2">
              {SUBMISSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setSubType(t.value)}
                  className={`rounded-field border-2 py-2.5 text-sm font-bold transition-colors ${
                    subType === t.value ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-border bg-surface-1 text-foreground-subtle'
                  }`}
                >
                  <Icon2D kind="dot" className="mr-1 inline-block h-3 w-3" style={{ color: t.color }} /> {t.label}
                </button>
              ))}
            </div>

            <div>
              <label className="type-body-strong mb-1.5 block">Konu</label>
              {/* Kullanıcı isteği (2026-09-02): "içinde arama olan bir konu seçici olsun."
                  Konu listesi mahalle kategorilerine göre uzun olabildiği için aranabilir
                  Combobox'a çevrildi (eski <Select> yerine). */}
              <Combobox
                value={category}
                onChange={(v) => setCategory(v)}
                options={(options?.categories ?? []).map((c) => ({ value: c.value, label: c.label }))}
                placeholder="Konu ara veya seçin..."
              />
            </div>

            <div>
              <label className="type-body-strong mb-1.5 block">Başlık</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kısa başlık" />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="type-body-strong">Açıklama</label>
                {/* Ek doğrulama (2026-09-03): tablet dokunmatik minimuma (44px) uyumlu
                    olması için size="md" verildi (öncesi 28px varsayılan boyuttaydı). */}
                <MicButton size="md" onText={(t) => setDescription((d) => (d.trim() ? `${d.trim()} ${t}` : t))} />
              </div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Vatandaşın talep/öneri/şikayetini yazın" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="type-caption mb-1 block text-foreground-subtle">
                  Ad Soyad (opsiyonel)
                  {/* Kayıtlı kişi bulunduğunda ad-soyad TC'den otomatik geldi; anketörün
                      yanlışlıkla değiştirmesini önlemek için salt-okunur gösterilir. */}
                  {tcLookupState === 'found' && <span className="ml-1 text-emerald-600">(sistemden geldi)</span>}
                </label>
                <Input
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  placeholder="Ad Soyad"
                  readOnly={tcLookupState === 'found'}
                  className={tcLookupState === 'found' ? 'bg-emerald-50/60' : undefined}
                />
              </div>
              <div>
                <label className="type-caption mb-1 block text-foreground-subtle">Telefon (opsiyonel)</label>
                <Input value={citizenPhone} onChange={(e) => setCitizenPhone(e.target.value)} placeholder="05XX XXX XX XX" />
              </div>
              <div>
                <label className="type-caption mb-1 block text-foreground-subtle">T.C. (opsiyonel)</label>
                <Input value={citizenTc} sanitize="digits" maxLength={11} onChange={(e) => { setCitizenTc(e.target.value); setTcLookupState('idle') }} placeholder="11 haneli" />
              </div>
              <div>
                {/* Kullanıcı isteği (2026-09-05): "TC kimlik doğum tarihi sorgulaması olacak" —
                    anket başında zaten verilmişse otomatik dolu gelir (prefillBirthDate);
                    anonim katılımdan sonra bağımsız açılan formda anketör isteğe bağlı
                    olarak elle girebilir. T.C. sistemde KAYITLI DEĞİLSE bu alan özellikle
                    önemlidir (kaydın kime ait olduğunun teyidi) — bu durumda vurgulanır. */}
                <label className="type-caption mb-1 block text-foreground-subtle">
                  Doğum Tarihi (opsiyonel)
                  {prefillBirthDate && citizenBirthDate === prefillBirthDate && (
                    <span className="ml-1 text-emerald-600">(sistemden geldi)</span>
                  )}
                </label>
                <Input
                  type="date"
                  value={citizenBirthDate}
                  onChange={(e) => setCitizenBirthDate(e.target.value)}
                  className={tcLookupState === 'not_found' ? 'border-amber-400' : undefined}
                />
              </div>
            </div>
            {/* Kullanıcı isteği (2026-09-02): "TC kimlik girilirse ... otomatik gelsin;
                sisteme kayıtlı değilse ona göre farklı davranılsın (manuel giriş açılsın)". */}
            {tcLookupState === 'loading' && (
              <Badge tone="neutral"><LoaderIcon className="mr-1 h-3 w-3 animate-spin" />Sistemde aranıyor...</Badge>
            )}
            {tcLookupState === 'found' && (
              <Badge tone="success"><CheckCircle2Icon className="mr-1 h-3 w-3" />Bu T.C. sistemde kayıtlı, ad-soyad otomatik dolduruldu.</Badge>
            )}
            {tcLookupState === 'not_found' && (
              <Badge tone="warning">Bu T.C. sistemde kayıtlı değil — ad-soyadı elle girin.</Badge>
            )}
            {tcLookupState === 'idle' && !citizenName && <Badge tone="neutral">Ad girilmezse "Sahada Görüşülen Vatandaş (Anonim)" olarak kaydedilir</Badge>}

            {/* Kullanıcı isteği (2026-09-02): "mahalle tış yapı ic kapı no vs tüm secenekler" —
                ulakBELL'in Sokak-Cadde / Dış Kapı No / İç Kapı No alanları isteğe bağlı
                olarak eklendi; hiçbiri girilmezse konum boş kalır (zorunlu değildir). */}
            <div>
              <label className="type-body-strong mb-1.5 block">Konum (opsiyonel)</label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="Sokak / Cadde" />
                <Input value={buildingNo} onChange={(e) => setBuildingNo(e.target.value)} placeholder="Dış Kapı No" />
                <Input value={doorNo} onChange={(e) => setDoorNo(e.target.value)} placeholder="İç Kapı No" />
              </div>
            </div>

            <Button className="w-full py-3.5" onClick={submitTicket} disabled={submittingTicket}>
              {submittingTicket ? <LoaderIcon className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquarePlusIcon className="mr-1.5 h-4 w-4" />}
              Başvuruyu Kaydet
            </Button>
          </div>
        )}

        {tab === 'sms' && (
          <div className="space-y-4 px-5 pb-6">
            <p className="type-muted">
              Vatandaş anketi kendisi doldurmak isterse, telefon numarasına anket linkini SMS ile gönderin.
              T.C./ad-soyad bilgisi vermek istemiyorsa yalnızca telefon numarasıyla da gönderebilirsiniz.
            </p>
            <div>
              <label className="type-body-strong mb-1.5 block">Telefon Numarası</label>
              <Input
                value={smsPhone}
                sanitize="digits"
                inputMode="numeric"
                maxLength={11}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
                className="text-xl tracking-wider"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="type-caption mb-1 block text-foreground-subtle">Ad Soyad (opsiyonel)</label>
                <Input value={citizenName} onChange={(e) => setCitizenName(e.target.value)} placeholder="Ad Soyad" />
              </div>
              <div>
                <label className="type-caption mb-1 block text-foreground-subtle">T.C. (opsiyonel)</label>
                <Input value={citizenTc} sanitize="digits" maxLength={11} onChange={(e) => setCitizenTc(e.target.value)} placeholder="11 haneli" />
              </div>
            </div>
            <Button className="w-full py-3.5" onClick={sendSms} disabled={sendingSms}>
              {sendingSms ? <LoaderIcon className="mr-1.5 h-4 w-4 animate-spin" /> : <SendIcon className="mr-1.5 h-4 w-4" />}
              SMS ile Anket Linki Gönder
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
