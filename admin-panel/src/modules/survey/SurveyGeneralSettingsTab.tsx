import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SettingsIcon, SaveIcon, ClockIcon, InfoIcon } from 'lucide-react'
import { SectionToolbar, Card, FormSection, Field, NumberInput, Button, SkeletonRows, Banner } from '@/design-system'
import surveyService from '@/services/survey.service'
import type { SurveyGlobalSettings } from '@/types/survey.types'

// Kullanıcı isteği (2026-09-20): "insanları çok yormadan katılım sağlayacağız" — vatandaş
// başına GÜNLÜK opsiyonel (zorunlu olmayan) anket yanıtı limiti ve iki yanıt arası bekleme
// süresi tek ekrandan yönetilir. Zorunlu anketler bu ayardan etkilenmez; onlar uygulamayı
// tamamlanana kadar bloke eder ve ayrı bir 60 dakikalık sunum temposuyla seyrekleştirilir.
export const SurveyGeneralSettingsTab = () => {
  const [form, setForm] = useState<SurveyGlobalSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    surveyService.getGlobalSettings().then(setForm).catch(() => setForm({ maxOptionalResponsesPerDay: 2, minMinutesBetweenOptionalResponses: 120 }))
  }, [])

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      const saved = await surveyService.updateGlobalSettings({
        maxOptionalResponsesPerDay: form.maxOptionalResponsesPerDay,
        minMinutesBetweenOptionalResponses: form.minMinutesBetweenOptionalResponses,
      })
      setForm(saved)
      toast.success('Anket genel ayarları kaydedildi.')
    } catch {
      toast.error('Ayarlar kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <SectionToolbar icon={SettingsIcon} title="Genel Ayarlar" subtitle="Katılım yorgunluğunu önleyen anket sıklık kuralları" />
        <Card padded><SkeletonRows rows={4} /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={SettingsIcon}
        title="Genel Ayarlar"
        subtitle="Vatandaşların çok fazla ankete zorlanmadan, düzenli katılım sağlaması için sıklık kuralları"
        actions={<Button variant="primary" size="sm" isLoading={saving} onClick={save}><SaveIcon className="h-4 w-4" /> Kaydet</Button>}
      />

      <Banner tone="info" variant="soft" icon={InfoIcon}>
        Bu ayarlar yalnızca <strong>opsiyonel</strong> (zorunlu olmayan) anketler içindir. Zorunlu
        anketler her zaman gösterilmeye devam eder — çünkü onlar zaten sayıca az olur ve uygulamanın
        kullanılabilmesi için tamamlanmaları gerekir.
      </Banner>

      <FormSection
        variant="card"
        icon={ClockIcon}
        title="Katılım Sıklığı"
        subtitle="Bir vatandaşın günde en fazla kaç opsiyonel anket yanıtlayabileceği ve ardışık yanıtlar arasındaki bekleme süresi"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Günlük Azami Opsiyonel Anket"
            hint="0 = sınırsız. Önerilen: 2 — vatandaşı yormadan düzenli katılım sağlar."
          >
            <NumberInput
              value={form.maxOptionalResponsesPerDay}
              onChange={(n) => setForm((p) => (p ? { ...p, maxOptionalResponsesPerDay: n } : p))}
              min={0}
              suffix="anket/gün"
            />
          </Field>
          <Field
            label="Anketler Arası Minimum Bekleme"
            hint="0 = bekleme yok. Önerilen: 120 dakika — art arda anket bombardımanını önler."
          >
            <NumberInput
              value={form.minMinutesBetweenOptionalResponses}
              onChange={(n) => setForm((p) => (p ? { ...p, minMinutesBetweenOptionalResponses: n } : p))}
              min={0}
              suffix="dakika"
            />
          </Field>
        </div>
      </FormSection>

      {form.updatedAt && (
        <p className="type-caption text-right">Son güncelleme: {new Date(form.updatedAt).toLocaleString('tr-TR')}</p>
      )}
    </div>
  )
}
