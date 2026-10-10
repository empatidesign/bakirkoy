import { ClipboardListIcon, ShieldAlertIcon } from 'lucide-react'
import { Field, FormSection, MultiSelect, ToggleRow } from '@/design-system'
import { useNeighborhoodOptions } from '@/hooks/useNeighborhoodOptions'

// Kullanıcı isteği (2026-09-01): bir yöneticiye admin panelin tamamı yerine yalnızca
// anket sistemine özel, dar kapsamlı bir yetki verilebilsin — tüm mahalleler/belirli
// mahalleler, tüm anketler/yalnızca kendi oluşturdukları, katılımcı bilgilerini görme,
// geçmiş anketleri görme ve yalnızca-oluşturma seçenekleri.
export interface AdminSurveyAccessValue {
  isSurveyUser: boolean
  surveyAllNeighborhoods: boolean
  surveyOwnSurveysOnly: boolean
  surveyCanViewParticipants: boolean
  surveyCanViewPastSurveys: boolean
  surveyCreateOnly: boolean
  surveyNeighborhoods: string[]
}

interface Props {
  value: AdminSurveyAccessValue
  onChange: (patch: Partial<AdminSurveyAccessValue>) => void
}

export const AdminSurveyAccessSection = ({ value, onChange }: Props) => {
  const neighborhoodOptions = useNeighborhoodOptions()

  return (
    <FormSection title="Anket Sistemi Yetkileri" variant="card" icon={ClipboardListIcon}>
      <ToggleRow
        label="Anket Kullanıcısı"
        description="Bu yönetici yalnızca Anketler modülüne erişebilir; diğer admin panel modüllerini göremez."
        checked={value.isSurveyUser}
        onChange={(v) => onChange({ isSurveyUser: v })}
      />

      {value.isSurveyUser && (
        <div className="space-y-4 border-t border-border pt-4">
          <ToggleRow
            label="Sadece Anket Oluşturabilir"
            description="Açıkken saha görevi, kota, soru bankası gibi yönetim ekranlarına erişemez — yalnızca anket oluşturma/düzenleme yapabilir."
            checked={value.surveyCreateOnly}
            onChange={(v) => onChange({ surveyCreateOnly: v })}
          />
          <ToggleRow
            label="Yalnızca Kendi Anketlerini Görür"
            description="Kapalıyken sistemdeki tüm anketleri görür ve yönetir; açıkken yalnızca kendisinin oluşturduğu anketleri."
            checked={value.surveyOwnSurveysOnly}
            onChange={(v) => onChange({ surveyOwnSurveysOnly: v })}
          />
          <ToggleRow
            label="Geçmiş Anketleri Görsün mü"
            description="Kapalıyken yalnızca aktif/güncel anketleri görür; açıkken tamamlanmış/arşiv anketleri de görebilir."
            checked={value.surveyCanViewPastSurveys}
            onChange={(v) => onChange({ surveyCanViewPastSurveys: v })}
          />
          <ToggleRow
            label="Katılımcı Bilgilerini Görebilir"
            description="Açıkken ankete katılan vatandaşların ad, TC ve telefon gibi kimlik bilgilerini görebilir."
            checked={value.surveyCanViewParticipants}
            onChange={(v) => onChange({ surveyCanViewParticipants: v })}
          />
          <ToggleRow
            label="Tüm Mahalleler"
            description="Açıkken ilçe genelindeki tüm anket/saha verisini görür; kapalıyken yalnızca aşağıda seçilen mahalleleri."
            checked={value.surveyAllNeighborhoods}
            onChange={(v) => onChange({ surveyAllNeighborhoods: v, surveyNeighborhoods: v ? [] : value.surveyNeighborhoods })}
          />
          {!value.surveyAllNeighborhoods && (
            <Field label="Erişebileceği Mahalleler" required>
              <MultiSelect
                values={value.surveyNeighborhoods}
                onChange={(v) => onChange({ surveyNeighborhoods: v })}
                options={neighborhoodOptions}
                placeholder="Mahalle seçin"
              />
            </Field>
          )}

          {/* Kullanıcı isteği (2026-09-01): "silmek süper yönetici yapabilir" — anket silme
              yetkisi rol izinleriyle verilemez; bu kural yöneticiye burada açıkça bildirilir
              ki "survey.delete iznini verdim ama silemiyor" karışıklığı yaşanmasın. */}
          <div className="flex items-start gap-3 rounded-field border border-warning/30 bg-warning-soft/40 p-3">
            <ShieldAlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <p className="type-caption">
              <b>Anket silme yetkisi verilemez.</b> Anket silmek, ankete verilmiş tüm yanıtları da
              kalıcı olarak yok ettiği için yalnızca <b>süper yönetici</b> tarafından ve
              “silmek istiyorum” onayı yazılarak yapılabilir. Bu kullanıcı anketleri
              <b> pasife alabilir</b> ama silemez.
            </p>
          </div>
        </div>
      )}
    </FormSection>
  )
}
