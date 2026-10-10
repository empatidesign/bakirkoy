import { type Dispatch, type SetStateAction } from 'react'
import { ImageIcon, HashIcon, AlignLeftIcon } from 'lucide-react'
import { Field, FormSection, Input, Textarea, NumberListInput, Select } from '@/design-system'
import { EventImageUploader } from '@/components/specialized/EventImageUploader'
import giftService from '@/services/gift.service'
import { GIFT_IMAGE_SPEC } from '@/types/gift.types'
import { FULL_RESIDENCY_MODE_OPTIONS, type FullResidencyMode } from '@/lib/residency'
import type { GiftForm } from './giftForm'

type SetForm = Dispatch<SetStateAction<GiftForm>>

interface Props {
  form: GiftForm
  setForm: SetForm
}

export const GiftFormSections = ({ form, setForm }: Props) => (
  <div className="p-5 space-y-5">
    <FormSection variant="card" title="Görsel" icon={ImageIcon}>
      <EventImageUploader
        label="Hediye Görseli"
        value={{ ...GIFT_IMAGE_SPEC, url: form.imageUrl || undefined }}
        onChange={(v) => setForm((p) => ({ ...p, imageUrl: v.url ?? '' }))}
        onUpload={(file) => giftService.uploadImage(file)}
      />
    </FormSection>

    <FormSection variant="card" title="Hediye Bilgileri" icon={HashIcon}>
      <Field label="Hediye Adı" required>
        <Input
          placeholder="Örn. Bakırköy Termos"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Puan Değeri" hint="Hediyenin puan karşılığı">
          <Input
            sanitize="digits"
            inputMode="numeric"
            placeholder="Örn. 500"
            value={form.points}
            onChange={(e) => setForm((p) => ({ ...p, points: e.target.value }))}
          />
        </Field>
        <Field label="Stok / Limit" required hint="Toplam kaç adet verilecek">
          <Input
            sanitize="digits"
            inputMode="numeric"
            placeholder="Örn. 50"
            value={form.stockLimit}
            onChange={(e) => setForm((p) => ({ ...p, stockLimit: e.target.value }))}
          />
        </Field>
      </div>

      <Field label="Kazanan Sırası" hint="Bu sıradaki talep sahipleri kazanır (örn. 1, 5, 9). Boş bırakılırsa kazanan elle belirlenir.">
        <NumberListInput value={form.winnerPattern} onChange={(next) => setForm((p) => ({ ...p, winnerPattern: next }))} />
      </Field>

      <Field label="Katılım Bölgesi (İkamet / Uyruk)" hint="Bu hediyeye kimlerin başvurabileceğini ikamet adresine (NVI/KPS) ve uyruğa (T.C./yabancı) göre belirler">
        <Select value={form.residencyMode} onChange={(e) => setForm((p) => ({ ...p, residencyMode: e.target.value as FullResidencyMode }))}>
          {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
    </FormSection>

    <FormSection variant="card" title="Açıklama" icon={AlignLeftIcon}>
      <Field label="Açıklama">
        <Textarea
          rows={3}
          placeholder="Hediye hakkında not"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </Field>
    </FormSection>
  </div>
)
