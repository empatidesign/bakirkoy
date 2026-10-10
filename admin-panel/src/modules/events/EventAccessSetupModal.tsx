import { useEffect, useState } from 'react'
import {
  CalendarIcon, ArmchairIcon, ClipboardCheckIcon, XCircleIcon, LogInIcon, LogOutIcon,
  QrCodeIcon, MonitorIcon, ShieldIcon, LinkIcon, ArrowRightIcon,
} from 'lucide-react'
import { Modal, Button, SelectableCard } from '@/design-system'
import { cn } from '@/lib/utils'
import { emptyEventForm } from './eventFormDefaults'
import type { EventAccessConfig, EventFormData } from '@/types/event.types'
import type { EventSettings } from '@/types/eventSettings.types'

interface Props {
  open: boolean
  onContinue: (seed: Partial<EventFormData>) => void
  onCancel: () => void
  settings?: EventSettings
}

const Group = ({ title, cols = 2, children }: { title: string; cols?: 2 | 3; children: React.ReactNode }) => (
  <div className="space-y-2">
    <p className="type-section-sub uppercase tracking-wide">{title}</p>
    <div className={cn('grid gap-3', cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>{children}</div>
  </div>
)

export const EventAccessSetupModal = ({ open, onContinue, onCancel, settings }: Props) => {
  const [access, setAccess] = useState<EventAccessConfig>(() => emptyEventForm(settings).access)

  useEffect(() => {
    if (open) setAccess(emptyEventForm(settings).access)
  }, [open, settings])

  const patch = (p: Partial<EventAccessConfig>) => setAccess((a) => ({ ...a, ...p }))

  return (
    <Modal
      open={open}
      onClose={onCancel}
      width={880}
      className="max-w-[96vw]"
      header={
        <div className="border-b border-border px-6 py-4">
          <p className="type-caption uppercase tracking-wide text-primary">Yeni Etkinlik · 1. Adım</p>
          <h2 className="type-heading-sm mt-0.5">Yoklama ve Erişim Kurulumu</h2>
          <p className="type-desc mt-1">
            Bu etkinlik için ne tür bir giriş kontrolü kullanılacağını seçin. Seçimler etkinliğin QR, kiosk ve turnike
            davranışlarını belirler. Sistem ayarlarındaki varsayılanlar yüklüdür.
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="type-caption">Bu seçimler etkinlik formunda değiştirilebilir.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Vazgeç</Button>
            <Button variant="primary" onClick={() => onContinue({ access })}>
              Devam Et <ArrowRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
      bodyClassName="px-6 py-5 space-y-5"
    >
      <Group title="Yapı">
        <SelectableCard
          selected={access.hasSessions}
          onClick={() => patch({ hasSessions: !access.hasSessions })}
          icon={CalendarIcon}
          title="Seans olacak"
          description="Etkinlik birden fazla seansa bölünecek; seans yönetimi açıktır."
        />
        <SelectableCard
          selected={access.hasSeating}
          onClick={() => patch({ hasSeating: !access.hasSeating, reservationType: !access.hasSeating ? 'none' : access.reservationType })}
          icon={ArmchairIcon}
          title="Salon ve koltuk düzeni"
          description="Salon seçimi ve koltuk planı ile katılımcılara koltuk atanır."
        />
      </Group>

      {access.hasSeating && (
        <Group title="Rezervasyon Türü" cols={3}>
          <SelectableCard
            selected={access.reservationType === 'none'}
            onClick={() => patch({ reservationType: 'none' })}
            icon={ArmchairIcon}
            title="Rezervasyon yok"
            description="Açık katılım. Koltuk veya sıra ataması yapılmaz."
          />
          <SelectableCard
            selected={access.reservationType === 'row'}
            onClick={() => patch({ reservationType: 'row' })}
            icon={ArmchairIcon}
            title="Sıra rezervasyonu"
            description="Sıra seçilir, içindeki koltuk serbest."
          />
          <SelectableCard
            selected={access.reservationType === 'seat'}
            onClick={() => patch({ reservationType: 'seat' })}
            icon={ArmchairIcon}
            title="Koltuk rezervasyonu"
            description="Koltuk planından tek tek koltuk seçilir."
          />
        </Group>
      )}

      <Group title="Yoklama">
        <SelectableCard
          selected={access.attendanceEnabled}
          onClick={() => patch({ attendanceEnabled: true })}
          icon={ClipboardCheckIcon}
          title="Yoklama alınacak"
          description="Katılımcılar QR, manuel giriş veya turnike üzerinden kayıt edilir."
        />
        <SelectableCard
          selected={!access.attendanceEnabled}
          onClick={() => patch({ attendanceEnabled: false })}
          icon={XCircleIcon}
          title="Yoklama yok"
          description="Açık etkinlik. Kayıt veya QR alınmaz; sadece tarih/saat ile yayında olur."
        />
      </Group>

      {access.attendanceEnabled && (
        <>
          <Group title="Giriş Yöntemi">
            <SelectableCard
              selected={access.entryMethod === 'checkin'}
              onClick={() => patch({ entryMethod: 'checkin' })}
              icon={LogInIcon}
              title="Sadece giriş"
              description="Yalnızca giriş zamanı kaydedilir. Çıkış kontrolü yapılmaz."
            />
            <SelectableCard
              selected={access.entryMethod === 'checkin-checkout'}
              onClick={() => patch({ entryMethod: 'checkin-checkout' })}
              icon={LogOutIcon}
              title="Giriş + çıkış"
              description="Hem giriş hem de çıkış zamanı kayıt altına alınır."
            />
          </Group>

          <Group title="QR Linki">
            <SelectableCard
              selected={access.qrEnabled}
              onClick={() => patch({ qrEnabled: true })}
              icon={QrCodeIcon}
              title="QR linki olacak"
              description="Katılımcılar etkinliğe QR ile dahil olur. QR türü formda seçilir."
            />
            <SelectableCard
              selected={!access.qrEnabled}
              onClick={() => patch({ qrEnabled: false })}
              icon={XCircleIcon}
              title="QR yok"
              description="Sadece manuel giriş veya turnike kullanılır."
            />
          </Group>

          <Group title="Donanım ve Ekran">
            <SelectableCard
              selected={access.kioskEnabled}
              onClick={() => patch({ kioskEnabled: !access.kioskEnabled })}
              icon={MonitorIcon}
              title="Kiosk / Ekran var"
              description="Salonda QR'ı gösteren ekran veya görevli bilgisayarı kullanılacak."
            />
            <SelectableCard
              selected={access.turnstileEnabled}
              onClick={() => patch({ turnstileEnabled: !access.turnstileEnabled })}
              icon={ShieldIcon}
              title="Turnike sistemi"
              description="Turnike entegrasyonu ile fiziksel giriş kontrolü yapılır."
            />
          </Group>

          <Group title="Görevli Paylaşım Linki">
            <SelectableCard
              selected={access.publicLinkEnabled}
              onClick={() => patch({ publicLinkEnabled: true })}
              icon={LinkIcon}
              title="Açık link verilecek"
              description="Görevli, etkinliği şifresiz bir link ile dışarıdan açabilir."
            />
            <SelectableCard
              selected={!access.publicLinkEnabled}
              onClick={() => patch({ publicLinkEnabled: false })}
              icon={XCircleIcon}
              title="Link verilmesin"
              description="Sadece sisteme giriş yapan yöneticiler erişebilir."
            />
          </Group>
        </>
      )}
    </Modal>
  )
}
