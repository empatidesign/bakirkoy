import { useState } from 'react'
import {
  SmartphoneIcon,
  NavigationIcon,
  PhoneIcon,
  MapPinIcon,
  HospitalIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  ShieldCheckIcon,
  MessageSquareIcon,
  RouteIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, Badge, Select, Field } from '@/design-system'
import { OperationTask, OperationStep } from './types'
import { SmsComposeModal, type SmsRecipient } from '../saglik/SmsComposeModal'

const PRE_ARRIVAL_SMS_TEMPLATES = [
  { key: 'arriving', label: 'Yaklaştık (20 dk)', text: 'Sayın {AD}, Bakırköy Belediyesi hasta nakil ambulansımız yaklaşık 20 dakika içinde adresinizde olacaktır. Lütfen hazır olunuz.' },
  { key: 'onway', label: 'Yola Çıktık', text: 'Sayın {AD}, hasta nakil ambulansımız sizi almak için yola çıkmıştır.' },
  { key: 'arrived', label: 'Kapıdayız', text: 'Sayın {AD}, ambulans ekibimiz adresinize ulaşmıştır.' },
]

interface Props {
  tasks: OperationTask[]
  onStepChange: (taskId: string, nextStep: OperationStep) => void
}

export const AmbulanceDriverSimulator = ({ tasks, onStepChange }: Props) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || '')
  const [smsOpen, setSmsOpen] = useState(false)

  const activeTask = tasks.find(t => t.id === selectedTaskId) || tasks[0]

  const OPERATION_STEPS_FLOW: { step: OperationStep; label: string; actionLabel: string }[] = [
    { step: 'YOLA_CIKMAYA_HAZIR', label: 'Yola Çıkmaya Hazır', actionLabel: 'Yola Çıkış Başlat' },
    { step: 'YOLA_CIKTI', label: 'Hastaya Yola Çıktı', actionLabel: 'Hastaya Gidiyorum' },
    { step: 'YAKLASIYOR_20DK', label: 'Yaklaşıyor (T-20dk Bildirimi Gönderildi)', actionLabel: 'Adrese Yaklaştım (20 Dk)' },
    { step: 'HASTAYA_ULASTI', label: 'Hasta Adresine Ulaşıldı', actionLabel: 'Hastaya Ulaştım' },
    { step: 'HASTA_ARACA_ALINDI', label: 'Hasta Araca Alındı (Sedye/Sandalye)', actionLabel: 'Hasta Araca Alındı' },
    { step: 'HASTANEYE_GIDILIYOR', label: 'Hastaneye Transfer Başladı', actionLabel: 'Hastaneye Hareket Et' },
    { step: 'HASTANEYE_ULASILDI', label: 'Hastaneye Ulaşıldı', actionLabel: 'Hastaneye Ulaştım' },
    { step: 'HASTA_TESLIM_EDILDI', label: 'Hasta Poliklinik / Servise Teslim Edildi', actionLabel: 'Hastayı Teslim Ettim' },
    { step: 'DONUS_BEKLENIYOR', label: 'Dönüş Bekleniyor', actionLabel: 'Dönüşü Bekle' },
    { step: 'EVE_DONUS_BASLADI', label: 'Eve Dönüş Transferi Başladı', actionLabel: 'Eve Dönüş Başladı' },
    { step: 'HASTA_EVE_TESLIM_EDILDI', label: 'Hasta Evine Teslim Edildi', actionLabel: 'Eve Teslim Ettim' },
    { step: 'OPERASYON_TAMAMLANDI', label: 'Görev Başarıyla Tamamlandı', actionLabel: 'Görevi Tamamla' }
  ]

  const currentStepIndex = OPERATION_STEPS_FLOW.findIndex(s => s.step === activeTask?.step)
  const nextStepObj = OPERATION_STEPS_FLOW[currentStepIndex + 1]

  const handleNextStep = () => {
    if (!activeTask || !nextStepObj) return
    onStepChange(activeTask.id, nextStepObj.step)
    toast.success(`Durum güncellendi: ${nextStepObj.label}`, {
      description: 'GPS ve zaman damgası kaydedildi, vatandaşa bildirim iletildi.',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary"><SmartphoneIcon className="h-3 w-3" /> PWA / Mobil Terminal</Badge>
          <span className="type-muted">
            Şoför &amp; saha ekibi: KVKK maskeli hasta kartı, tek tıkla navigasyon ve 12 adımlı durum butonları
          </span>
        </div>

        <Field label="Görev Seç" className="w-full md:w-[420px]">
          <Select
            value={selectedTaskId}
            onChange={e => setSelectedTaskId(e.target.value)}
            searchable
          >
            {tasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.trackingNo} - {t.patientName} ({t.scheduledPickupTime})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="max-w-md mx-auto bg-card rounded-3xl border-2 border-border shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <div className="text-xs font-mono text-[hsl(var(--primary))] font-bold">AMBULANS ŞOFÖR TERMİNALİ</div>
            <div className="text-sm font-bold text-foreground">Plaka: {activeTask?.ambulancePlate}</div>
          </div>
          <Badge tone="primary">{activeTask?.step}</Badge>
        </div>

        <div className="p-4 rounded-2xl bg-surface-1 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-foreground-muted">{activeTask?.trackingNo}</span>
            <Badge tone="success">
              <ShieldCheckIcon className="h-3 w-3" /> KVKK Maskeli
            </Badge>
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">{activeTask?.patientName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Button asChild size="sm">
                <a href={`tel:${activeTask?.patientPhone}`}>
                  <PhoneIcon className="h-4 w-4" /> Hastayı Ara
                </a>
              </Button>
              <span className="text-xs font-mono text-foreground-muted">{activeTask?.patientPhone}</span>
            </div>
          </div>

          <div className="space-y-1 pt-1 border-t border-border">
            <div className="text-xs font-bold text-foreground-muted uppercase">Alınacak Adres:</div>
            <div className="text-xs font-medium text-foreground flex items-start gap-1.5">
              <MapPinIcon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{activeTask?.pickupDistrict} - {activeTask?.pickupAddress}</span>
            </div>
            {activeTask?.pickupFloorNotes && (
              <div className="text-xs text-foreground-muted pl-5.5 ml-0.5">{activeTask.pickupFloorNotes}</div>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-foreground-muted uppercase">Gidilecek Hastane:</div>
            <div className="text-xs font-medium text-foreground flex items-start gap-1.5">
              <HospitalIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">{activeTask?.destinationHospital}</div>
                <div className="text-xs text-foreground-muted">{activeTask?.destinationDepartment} (Randevu: {activeTask?.appointmentTime})</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-2">
            <Badge tone="neutral">{activeTask?.mobility}</Badge>
            {activeTask?.needsOxygen && <Badge tone="danger">O2 Desteği Gerekli</Badge>}
            {activeTask && (
              <Badge tone={activeTask.isRoundTrip ? 'info' : 'neutral'}>
                {activeTask.isRoundTrip ? `Gidiş-Dönüş${activeTask.returnTime ? ` (Dönüş: ${activeTask.returnTime})` : ''}` : 'Sadece Gidiş'}
              </Badge>
            )}
          </div>

          {activeTask?.specialNotes && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs">
              {activeTask.specialNotes}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            asChild variant="primary"
            className="w-full"
          >
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((activeTask?.pickupDistrict || '') + ' ' + (activeTask?.pickupAddress || ''))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <RouteIcon className="w-4 h-4" />
              Güzergahı Aç
            </a>
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={!activeTask}
            onClick={() => setSmsOpen(true)}
          >
            <MessageSquareIcon className="w-4 h-4" />
            "Geliyoruz" SMS
          </Button>
        </div>
        <Button variant="outline"
          onClick={() => {
            toast.info('Navigasyon başlatıldı', {
              description: `Mevcut Konum ➜ ${activeTask?.pickupDistrict} (${activeTask?.pickupAddress})`,
            })
          }} className="w-full"
        >
          <NavigationIcon className="w-4 h-4" />
          Yol Tarifi Başlat (Navigasyon Uygulaması)
        </Button>

        <div className="space-y-2 pt-2 border-t border-border">
          <div className="type-caption font-semibold">
            Operasyon Durumunu İlerlet:
          </div>

          {nextStepObj ? (
            <Button variant="primary"
              onClick={() => handleNextStep()} className="w-full"
            >
              <span>{nextStepObj.actionLabel}</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Button>
          ) : (
            <div className="p-3 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-bold text-xs">
              Bu operasyon başarıyla tamamlanmıştır.
            </div>
          )}

          <div className="pt-2 space-y-1">
            <div className="text-xs text-foreground-muted font-bold">12 Aşamalı Operasyon Zinciri:</div>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
              {OPERATION_STEPS_FLOW.map((s, idx) => {
                const isPassed = idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex

                return (
                  <div
                    key={s.step}
                    className={`p-1.5 rounded-lg flex items-center justify-between ${
                      isCurrent
                        ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-bold border border-[hsl(var(--primary)/0.3)]'
                        : isPassed
                        ? 'text-foreground-muted line-through'
                        : 'text-foreground-muted/60'
                    }`}
                  >
                    <span>{idx + 1}. {s.label}</span>
                    {isPassed && <CheckCircle2Icon className="w-3 h-3 text-emerald-600 shrink-0" />}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <SmsComposeModal
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        recipients={activeTask ? [{ id: activeTask.id, name: activeTask.patientName.replace(/\s*\(.*\)$/, ''), phone: activeTask.patientPhone } satisfies SmsRecipient] : []}
        templates={PRE_ARRIVAL_SMS_TEMPLATES}
      />
    </div>
  )
}
