import { useMemo, useState } from 'react'
import {
  SearchIcon,
  PhoneIcon,
  MapPinIcon,
  HospitalIcon,
  UserIcon,
  ClockIcon,
  TruckIcon,
  MessageSquareIcon,
  NavigationIcon,
  CopyIcon,
  CheckIcon,
  RouteIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input, Button, Badge, EmptyState, Field } from '@/design-system'
import { OperationTask, AmbulanceVehicle, AmbulanceCrew } from './types'
import { SmsComposeModal, type SmsRecipient } from '../saglik/SmsComposeModal'

interface Props {
  operations: OperationTask[]
  vehicles: AmbulanceVehicle[]
  crews: AmbulanceCrew[]
}

const PRE_ARRIVAL_SMS_TEMPLATES = [
  { key: 'arriving', label: 'Yaklaştık (Geliyoruz)', text: 'Sayın {AD}, Bakırköy Belediyesi hasta nakil ambulansımız yaklaşık 20 dakika içinde adresinizde olacaktır. Lütfen hazır olunuz.' },
  { key: 'onway', label: 'Yola Çıktık', text: 'Sayın {AD}, hasta nakil ambulansımız sizi almak için yola çıkmıştır.' },
  { key: 'arrived', label: 'Kapıdayız', text: 'Sayın {AD}, ambulans ekibimiz adresinize ulaşmıştır.' },
]

const fmtDay = (iso: string) => {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

const digitsOnly = (s: string) => s.replace(/\D/g, '')

export const PatientLookupPanel = ({ operations, vehicles, crews }: Props) => {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [smsTask, setSmsTask] = useState<OperationTask | null>(null)

  const q = digitsOnly(query)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const lowerQ = query.trim().toLocaleLowerCase('tr')
    return operations
      .filter(o => {
        const tcknMatch = q.length >= 4 && o.patientTckn?.includes(q)
        const phoneMatch = q.length >= 4 && digitsOnly(o.patientPhone).includes(q)
        const nameMatch = o.patientName.toLocaleLowerCase('tr').includes(lowerQ)
        const trackingMatch = o.trackingNo.toLocaleLowerCase('tr').includes(lowerQ)
        return tcknMatch || phoneMatch || nameMatch || trackingMatch
      })
      .sort((a, b) => `${a.scheduledDate}${a.scheduledPickupTime}`.localeCompare(`${b.scheduledDate}${b.scheduledPickupTime}`))
  }, [operations, query, q])

  const handleCopyAddress = (task: OperationTask) => {
    navigator.clipboard.writeText(`${task.pickupDistrict} ${task.pickupAddress}`)
    setCopied(true)
    toast.success('Adres kopyalandı.')
    setTimeout(() => setCopied(false), 2000)
  }

  const smsRecipients: SmsRecipient[] = smsTask
    ? [{ id: smsTask.id, name: smsTask.patientName.replace(/\s*\(.*\)$/, ''), phone: smsTask.patientPhone }]
    : []

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-0 p-4 shadow-xs">
        <Field label="Hasta Ara (T.C. Kimlik No, Telefon, Ad Soyad veya Takip No)" hint="Çağrı merkezi: Arayan vatandaşın kaydını bulmak için en az 4 hane / karakter girin.">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Örn: 12456789012, 0532 444 11 22, Ali Kemal veya AMB-2026-000125"
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
            autoFocus
          />
        </Field>
      </div>

      {!query.trim() && (
        <EmptyState
          icon={SearchIcon}
          title="Hasta sorgulamak için arama yapın"
          description="T.C. kimlik numarası veya telefon numarası ile arayan vatandaşın hangi gün, hangi hastaneye, kaçta ve hangi ambulansla nakil randevusu olduğunu anında görüntüleyin."
        />
      )}

      {query.trim() && matches.length === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="Kayıt bulunamadı"
          description="Girilen bilgiyle eşleşen bir hasta nakil kaydı bulunamadı. T.C. kimlik no veya telefon numarasını kontrol ediniz."
        />
      )}

      <div className="space-y-3">
        {matches.map(task => {
          const veh = vehicles.find(v => v.id === task.ambulanceId)
          const crew = crews.find(c => c.ambulanceId === task.ambulanceId)
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.pickupDistrict + ' ' + task.pickupAddress)}`

          return (
            <div key={task.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-1 px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{task.trackingNo}</span>
                  <Badge tone={task.step === 'OPERASYON_TAMAMLANDI' ? 'neutral' : 'primary'}>{task.step}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ClockIcon className="h-3.5 w-3.5 text-foreground-muted" />
                  {fmtDay(task.scheduledDate)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 type-caption font-semibold">
                    <UserIcon className="h-3.5 w-3.5" /> Hasta
                  </div>
                  <div className="text-sm font-bold text-foreground">{task.patientName}</div>
                  {task.patientTckn && <div className="font-mono text-xs text-foreground-muted">TC: {task.patientTckn}</div>}
                  <a href={`tel:${task.patientPhone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <PhoneIcon className="h-3.5 w-3.5" /> {task.patientPhone}
                  </a>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 type-caption font-semibold">
                    <ClockIcon className="h-3.5 w-3.5" /> Zamanlama &amp; Yön
                  </div>
                  <div className="text-xs">
                    <span className="text-foreground-muted">Evden Alış:</span>{' '}
                    <strong className="font-mono">{task.scheduledPickupTime}</strong>
                    {' · '}
                    <span className="text-foreground-muted">Hastane Randevusu:</span>{' '}
                    <strong className="font-mono">{task.appointmentTime}</strong>
                  </div>
                  <Badge tone={task.isRoundTrip ? 'info' : 'neutral'}>
                    {task.isRoundTrip
                      ? `Gidiş-Dönüş${task.returnTime ? ` (Dönüş: ${task.returnTime})` : ''}`
                      : 'Sadece Gidiş'}
                  </Badge>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center gap-1.5 type-caption font-semibold">
                    <MapPinIcon className="h-3.5 w-3.5" /> Alınacak Adres &amp; Güzergah
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-1 p-2.5">
                    <div className="text-xs">
                      <div className="font-semibold text-foreground">{task.pickupDistrict}</div>
                      <div className="text-foreground-muted">{task.pickupAddress}</div>
                      {task.pickupFloorNotes && <div className="text-foreground-muted">{task.pickupFloorNotes}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => handleCopyAddress(task)}>
                        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                          <RouteIcon className="h-3.5 w-3.5" /> Güzergah
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center gap-1.5 type-caption font-semibold">
                    <HospitalIcon className="h-3.5 w-3.5" /> Gidilecek Sağlık Kuruluşu
                  </div>
                  <div className="text-xs">
                    <strong className="text-foreground">{task.destinationHospital}</strong>
                    <span className="text-foreground-muted"> — {task.destinationDepartment}</span>
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 type-caption font-semibold">
                    <TruckIcon className="h-3.5 w-3.5" /> Araç &amp; Ekip
                  </div>
                  {veh ? (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <Badge tone="primary">Plaka: {veh.plate}</Badge>
                      {crew && (
                        <>
                          <a href={`tel:${crew.driver.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                            <PhoneIcon className="h-3.5 w-3.5" /> Şoför: {crew.driver.fullName} ({crew.driver.phone})
                          </a>
                          <a href={`tel:${crew.paramedic.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                            <PhoneIcon className="h-3.5 w-3.5" /> {crew.paramedic.title}: {crew.paramedic.fullName} ({crew.paramedic.phone})
                          </a>
                        </>
                      )}
                    </div>
                  ) : (
                    <Badge tone="warning">Henüz ambulans ataması yapılmadı</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-1 px-4 py-2.5">
                <Button variant="outline" size="sm" onClick={() => setSmsTask(task)}>
                  <MessageSquareIcon className="h-3.5 w-3.5" /> "Geliyoruz" SMS'i Hazırla
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <NavigationIcon className="h-3.5 w-3.5" /> Navigasyonu Aç
                  </a>
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <SmsComposeModal
        open={!!smsTask}
        onClose={() => setSmsTask(null)}
        recipients={smsRecipients}
        templates={PRE_ARRIVAL_SMS_TEMPLATES}
      />
    </div>
  )
}
