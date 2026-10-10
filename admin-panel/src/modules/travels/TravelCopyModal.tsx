import { useEffect, useState } from 'react'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, DatePicker, ToggleRow, Banner } from '@/design-system'
import { todayIso } from '@/lib/utils'
import travelService from '@/services/travel.service'
import type { Travel, TravelCopyRequest } from '@/types/travel.types'

interface Props {
  travel: Travel | null
  onClose: () => void
  onCopied: () => void
}

/**
 * Sefer kopyalama modalı. Route'a bağlı tüm içerik (isim, açıklama, kural, görsel,
 * fiyat, kısıtlar) kaynak seferden aynen miras alınır — burada yalnızca gidiş/dönüş
 * ve kayıt tarihi düzenlenir. "Otobüsleri de çoğalt" açıksa seçili araçların
 * bağımsız kopyaları oluşturulup yeni sefere atanır; kapalıysa aynı havuz aracı paylaşılır.
 */
export const TravelCopyModal = ({ travel, onClose, onCopied }: Props) => {
  const [form, setForm] = useState<TravelCopyRequest>({
    startDate: '', endDate: '', registrationStartDate: '', registrationEndDate: '', cloneBuses: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!travel) return
    // Kaynak seferle aynı süre uzunluğunu ve kayıt-aralığı farkını koru, bugüne göre öner.
    const diffDays = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
    const tripLen = diffDays(travel.startDate, travel.endDate)
    const regLead = travel.registrationStartDate ? diffDays(travel.registrationStartDate, travel.startDate) : 14
    const regSpan = travel.registrationEndDate ? diffDays(travel.registrationStartDate || travel.startDate, travel.registrationEndDate) : 20

    const start = todayIso()
    const addDays = (iso: string, n: number) => {
      const d = new Date(iso)
      d.setDate(d.getDate() + n)
      return d.toISOString().slice(0, 10)
    }

    setForm({
      startDate: start,
      endDate: addDays(start, Math.max(0, tripLen)),
      registrationStartDate: start,
      registrationEndDate: addDays(start, Math.max(1, regSpan - regLead)),
      cloneBuses: false,
    })
  }, [travel])

  if (!travel) return null

  const patch = (p: Partial<TravelCopyRequest>) => setForm((f) => ({ ...f, ...p }))
  const valid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate
    && !!form.registrationStartDate && !!form.registrationEndDate && form.registrationEndDate >= form.registrationStartDate

  const save = async () => {
    if (!valid) { toast.error('Tarihleri kontrol edin.'); return }
    setSaving(true)
    try {
      await travelService.copy(travel.id, form)
      onCopied()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Seferi Kopyala"
      subtitle={`"${travel.name}" gezisi için yeni bir sefer oluşturulacak`}
      width={520}
      className="max-w-[96vw]"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button variant="primary" iconLeft={<CopyIcon className="h-4 w-4" />} isLoading={saving} disabled={!valid} onClick={save}>
            Kopyala
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <Banner tone="info" variant="soft">
          İsim, açıklama, kural, görsel, fiyat ve yaş/cinsiyet kısıtları gezi kaydından aynen gelir. Sadece tarihleri ve araç ayarını burada belirleyin.
        </Banner>

        <div className="grid gap-[15px] sm:grid-cols-2">
          <Field label="Gidiş Tarihi" required>
            <DatePicker value={form.startDate} onChange={(v) => patch({ startDate: v })} min={todayIso()} />
          </Field>
          <Field label="Dönüş Tarihi" required>
            <DatePicker value={form.endDate} onChange={(v) => patch({ endDate: v })} min={form.startDate || todayIso()} />
          </Field>
        </div>
        <div className="grid gap-[15px] sm:grid-cols-2">
          <Field label="Kayıt Başlangıcı" required>
            <DatePicker value={form.registrationStartDate} onChange={(v) => patch({ registrationStartDate: v })} min={todayIso()} />
          </Field>
          <Field label="Kayıt Bitişi" required>
            <DatePicker value={form.registrationEndDate} onChange={(v) => patch({ registrationEndDate: v })} min={form.registrationStartDate || todayIso()} />
          </Field>
        </div>

        <ToggleRow
          label="Otobüsleri de çoğalt"
          description="Kapalıysa yeni sefer aynı havuz aracını (plaka) paylaşır — bu araç başka seferlere de atanabilmeye devam eder. Açıksa her araç bu sefere özel bağımsız bir kopya olarak oluşturulur."
          checked={form.cloneBuses}
          onChange={(v) => patch({ cloneBuses: v })}
        />
      </div>
    </Modal>
  )
}
