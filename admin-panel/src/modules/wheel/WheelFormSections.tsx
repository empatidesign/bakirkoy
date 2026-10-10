import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { LayersIcon, PlusIcon, Trash2Icon, CheckCircle2Icon, AlertTriangleIcon, SparklesIcon } from 'lucide-react'
import {
  Field, FormSection, Input, Textarea, Select, Combobox, ColorSwatchPicker, Button, IconButton, Banner, Badge,
  ToggleRow,
} from '@/design-system'
import giftService from '@/services/gift.service'
import type { SelectOption } from '@/types/common'
import {
  WHEEL_SLICE_TYPE_META, wheelSliceTypeMeta, wheelWinRateTotal, emptyWheelSlice, SLICE_PRESET_COLORS,
  STANDARD_WHEEL_SLICES,
} from '@/types/wheel.types'
import { FULL_RESIDENCY_MODE_OPTIONS, type FullResidencyMode } from '@/lib/residency'
import type { WheelSliceType } from '@/types/wheel.types'
import type { WheelForm } from './wheelForm'

type SetForm = Dispatch<SetStateAction<WheelForm>>
type Slice = WheelForm['slices'][number]

interface Props {
  form: WheelForm
  setForm: SetForm
}

export const WheelFormSections = ({ form, setForm }: Props) => {
  const [giftOptions, setGiftOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    let active = true
    giftService.getOptions()
      .then((o) => { if (active) setGiftOptions(o) })
      .catch(() => { if (active) setGiftOptions([]) })
    return () => { active = false }
  }, [])

  const updateSlice = (i: number, fn: (s: Slice) => Slice) =>
    setForm((p) => ({ ...p, slices: p.slices.map((s, idx) => (idx === i ? fn(s) : s)) }))

  const addSlice = () =>
    setForm((p) => ({ ...p, slices: [...p.slices, { ...emptyWheelSlice(), color: SLICE_PRESET_COLORS[p.slices.length % SLICE_PRESET_COLORS.length] }] }))

  const removeSlice = (i: number) =>
    setForm((p) => ({ ...p, slices: p.slices.filter((_, idx) => idx !== i) }))

  const changeType = (i: number, t: WheelSliceType) => updateSlice(i, (s) => {
    const next: Slice = { ...s, type: t }
    const isDefault = !s.label.trim() || ['Pas', 'Boş'].includes(s.label.trim()) || /^\d+\s*puan$/i.test(s.label.trim()) || s.label === s.giftName
    if (t === 'pass') { next.value = 0; next.giftId = undefined; next.giftName = undefined; if (isDefault) next.label = 'Pas' }
    else if (t === 'empty') { next.value = 0; next.giftId = undefined; next.giftName = undefined; if (isDefault) next.label = 'Boş' }
    else if (t === 'points') { next.value = s.value || 100; next.giftId = undefined; next.giftName = undefined; if (isDefault) next.label = `${next.value} Puan` }
    else { next.value = 0; if (isDefault) next.label = '' }
    return next
  })

  const pickGift = (i: number, giftId: string, label?: string) =>
    updateSlice(i, (s) => ({ ...s, giftId: giftId || undefined, giftName: giftId ? label : undefined, label: s.label.trim() ? s.label : (label ?? '') }))

  const setWinRate = (i: number, raw: string) =>
    updateSlice(i, (s) => ({ ...s, winRate: Math.max(0, Math.min(100, Number(raw) || 0)) }))

  const setValue = (i: number, raw: string) =>
    updateSlice(i, (s) => ({ ...s, value: Math.max(0, Number(raw) || 0) }))

  const total = wheelWinRateTotal(form.slices)
  const ok = Math.round(total) === 100

  return (
    <div className="space-y-5">
      <Field label="Çark Başlığı" required>
        <Input
          placeholder="Örn. Haftalık Puan Çarkı"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
      </Field>

      <Field label="Açıklama">
        <Textarea
          rows={2}
          placeholder="Çark hakkında kısa açıklama"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </Field>

      <Field label="Günlük Çevirme Hakkı" hint="Bir kullanıcı bu çarkı günde kaç kez çevirebilir? 0 = sınırsız.">
        <Input
          sanitize="digits"
          inputMode="numeric"
          value={form.dailySpinLimit}
          onChange={(e) => setForm((p) => ({ ...p, dailySpinLimit: e.target.value }))}
        />
      </Field>

      <Field label="Katılım Bölgesi (İkamet / Uyruk)" hint="Bu çarkı kimlerin çevirebileceğini ikamet adresine (NVI/KPS) ve uyruğa (T.C./yabancı) göre belirler">
        <Select value={form.residencyMode} onChange={(e) => setForm((p) => ({ ...p, residencyMode: e.target.value as FullResidencyMode }))}>
          {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>

      <FormSection
        title="Puan Algoritması"
        subtitle="Gün içinde çevrilen sıraya göre puanı otomatik ayarlayın (örn. ilk çevirene daha fazla, sonrakilere azalan puan)."
        icon={SparklesIcon}
        variant="card"
      >
        <div className="space-y-3">
          <ToggleRow
            label="Puan algoritmasını etkinleştir"
            description="Açıksa, 'Puan' türündeki dilimlerin sabit değeri yerine bu algoritma kullanılır."
            checked={form.pointsAlgorithmEnabled}
            onChange={(v) => setForm((p) => ({ ...p, pointsAlgorithmEnabled: v }))}
          />

          {form.pointsAlgorithmEnabled && (
            <>
              <Banner tone="info" variant="soft" icon={SparklesIcon}>
                Bugünün 1. çevirmesinde <strong>Başlangıç Puanı</strong> verilir. Her sonraki çevirmede puan{' '}
                <strong>Artış/Azalış</strong> kadar değişir, ama hiçbir zaman <strong>Azami Puan</strong>'ı aşmaz.{' '}
                <strong>Azami Çevirme Sayısı</strong>'nı aşan çevirmelerde dilimin sabit puanına geri dönülür.
              </Banner>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Başlangıç Puanı" hint="Günün 1. çevirmesinde verilecek puan">
                  <Input
                    sanitize="digits"
                    inputMode="numeric"
                    value={form.pointsAlgorithmBase}
                    onChange={(e) => setForm((p) => ({ ...p, pointsAlgorithmBase: e.target.value }))}
                  />
                </Field>
                <Field label="Her Çevirmede Artış/Azalış" hint="Negatif girilirse puan azalır (örn. -10)">
                  <Input
                    inputMode="numeric"
                    value={form.pointsAlgorithmStep}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^-\d]/g, '')
                      setForm((p) => ({ ...p, pointsAlgorithmStep: v }))
                    }}
                  />
                </Field>
                <Field label="Azami Puan" hint="Tek çevirmede verilebilecek en yüksek puan. 0 = sınırsız.">
                  <Input
                    sanitize="digits"
                    inputMode="numeric"
                    value={form.pointsAlgorithmMax}
                    onChange={(e) => setForm((p) => ({ ...p, pointsAlgorithmMax: e.target.value }))}
                  />
                </Field>
                <Field label="Azami Çevirme Sayısı" hint="Bu sayıyı aşan çevirmelerde algoritma uygulanmaz. 0 = sınırsız.">
                  <Input
                    sanitize="digits"
                    inputMode="numeric"
                    value={form.pointsAlgorithmMaxSpins}
                    onChange={(e) => setForm((p) => ({ ...p, pointsAlgorithmMaxSpins: e.target.value }))}
                  />
                </Field>
              </div>
            </>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Çark Dilimleri"
        subtitle="Her dilimin kazanma oranını belirleyin; oranların toplamı %100 olmalıdır."
        icon={LayersIcon}
        variant="card"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setForm((p) => ({ ...p, slices: STANDARD_WHEEL_SLICES.map((s) => ({ ...s })) }))}
              title="Önerilen 11 dilimli standart dağıtımı uygular (5-10-20-25-30-35-50-100-250, Pas, Şansını Yeniden Dene)"
            >
              <SparklesIcon className="h-4 w-4 text-warning" /> Önerilen Dağıtımı Uygula
            </Button>
            <Button variant="outline" size="sm" onClick={addSlice}>
              <PlusIcon className="h-4 w-4" /> Dilim Ekle
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Banner tone={ok ? 'success' : 'warning'} variant="soft" icon={ok ? CheckCircle2Icon : AlertTriangleIcon}>
            Toplam kazanma oranı: %{total}{ok ? ' — geçerli' : ' (toplam %100 olmalı)'}
          </Banner>

          {form.slices.map((s, i) => {
            const meta = wheelSliceTypeMeta(s.type)
            return (
              <div key={i} className="space-y-3 rounded-card border border-border bg-surface-1 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge tone={meta.tone}><meta.icon className="h-3.5 w-3.5" /> {meta.label}</Badge>
                    <span className="type-caption">Dilim {i + 1}</span>
                  </span>
                  <IconButton tone="danger" title="Dilimi kaldır" disabled={form.slices.length <= 2} onClick={() => removeSlice(i)}>
                    <Trash2Icon className="h-4 w-4" />
                  </IconButton>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tür">
                    <Select value={s.type} onChange={(e) => changeType(i, e.target.value as WheelSliceType)}>
                      {WHEEL_SLICE_TYPE_META.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Kazanma Oranı (%)">
                    <Input sanitize="digits" inputMode="numeric" value={String(s.winRate)} onChange={(e) => setWinRate(i, e.target.value)} />
                  </Field>
                </div>

                <Field label="Etiket" hint="Çark üzerinde görünecek yazı">
                  <Input placeholder={meta.label} value={s.label} onChange={(e) => updateSlice(i, (x) => ({ ...x, label: e.target.value }))} />
                </Field>

                {s.type === 'points' && (
                  <Field label="Puan Değeri">
                    <Input sanitize="digits" inputMode="numeric" value={String(s.value)} onChange={(e) => setValue(i, e.target.value)} />
                  </Field>
                )}

                {s.type === 'gift' && (
                  <Field label="Hediye" hint={giftOptions.length ? undefined : 'Önce Hediye Yönetimi sekmesinden hediye ekleyin'}>
                    <Combobox
                      value={s.giftId ?? ''}
                      displayValue={s.giftName}
                      options={giftOptions}
                      onChange={(v, opt) => pickGift(i, v, opt?.label)}
                      clearable
                      placeholder="Hediye seçin..."
                      emptyText="Hediye bulunamadı"
                    />
                  </Field>
                )}

                <Field label="Dilim Rengi">
                  <ColorSwatchPicker value={s.color} presets={SLICE_PRESET_COLORS} onChange={(hex) => updateSlice(i, (x) => ({ ...x, color: hex }))} />
                </Field>
              </div>
            )
          })}
        </div>
      </FormSection>
    </div>
  )
}
