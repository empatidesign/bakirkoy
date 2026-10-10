import {
  QrCodeIcon, UsersIcon, BellRingIcon, ClipboardCheckIcon,
} from 'lucide-react'
import { ToggleRow, Field, NumberInput, FormSection } from '@/design-system'
import { RequiredDocumentsSection } from './RequiredDocumentsSection'
import { FacilityDevicesSection } from './FacilityDevicesSection'
import { getDocumentPresets } from './documentSets'
import { NotificationTemplatesSection } from './NotificationTemplatesSection'
import { AttendanceLimitSection } from './AttendanceLimitSection'
import { CrossFacilityLimitSection } from './CrossFacilityLimitSection'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { FacilityRecord, GeneralSettings, AttendanceLimitType } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
  facilities: FacilityRecord[]
  value: GeneralSettings
  onChange: (next: GeneralSettings) => void
}

export const GeneralSettingsForm = ({ config, service, facilities, value, onChange }: Props) => {
  const set = <K extends keyof GeneralSettings>(k: K, v: GeneralSettings[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="space-y-[15px]">
      <FormSection variant="card" icon={QrCodeIcon} tone="blue" title="Yoklama & Giriş Sistemi" subtitle="Yoklama SMS bildirimleri, turnike erişimi ve otomatik çıkış davranışı">
        <ToggleRow
          label="Yoklama SMS Bildirimleri"
          description="Açıkken yoklama alındığında katılımcılara ve velilere SMS gönderilir. Kapalıyken (pasif) yoklamada SMS gönderilmez."
          checked={value.attendanceSmsEnabled ?? false}
          onChange={(v) => set('attendanceSmsEnabled', v)}
        />
        <ToggleRow label="QR Turnike entegrasyonu aktif" description="Üye telefonundaki QR kodu okutarak otomatik geçiş yapar" checked={value.qrTurnstileEnabled} onChange={(v) => set('qrTurnstileEnabled', v)} />
        <Field label="Otomatik Çıkış" hint="0 = pasif. Üye bu süreden fazla kalırsa otomatik çıkış kaydı oluşur."><NumberInput suffix="dk" value={value.autoCheckoutMinutes} onChange={(n) => set('autoCheckoutMinutes', n)} /></Field>
      </FormSection>

      <FacilityDevicesSection config={config} service={service} facilities={facilities} />

      <FormSection variant="card" icon={UsersIcon} tone="green" title="Kontenjan & Yedek Liste" subtitle="Asıl kontenjan dolduğunda yedek listeden otomatik çağrı sistemi">
        <ToggleRow label="Yedek liste aktif" description="Asıl kontenjan dolduğunda başvurular yedek listeye eklenir; kapalıysa kontenjan dolan gruplara doğrudan başvuru reddedilir" checked={value.waitlistEnabled} onChange={(v) => set('waitlistEnabled', v)} />
        {value.waitlistEnabled && (
          <>
            <ToggleRow label="Otomatik yükselt" description="Asıl listeden iptal/çıkarma olunca yedek sıradaki üye otomatik terfi eder; kapalıysa yer boş kalır, admin manuel terfi ettirmelidir" checked={value.waitlistAutoPromote} onChange={(v) => set('waitlistAutoPromote', v)} />
            <Field label="Onay süresi"><NumberInput suffix="saat" min={1} value={value.waitlistConfirmHours} onChange={(n) => set('waitlistConfirmHours', n)} /></Field>
          </>
        )}
      </FormSection>

      <RequiredDocumentsSection
        documents={value.requiredDocuments}
        presets={getDocumentPresets(config.id)}
        onDocumentsChange={(docs) => set('requiredDocuments', docs)}
      />

      <AttendanceLimitSection
        limitType={value.attendanceLimitType ?? 'unlimited'}
        limitCount={value.attendanceLimitCount ?? 0}
        resetDay={value.attendanceLimitResetDay ?? 1}
        onLimitTypeChange={(v) => set('attendanceLimitType', v as AttendanceLimitType)}
        onLimitCountChange={(v) => set('attendanceLimitCount', v)}
        onResetDayChange={(v) => set('attendanceLimitResetDay', v)}
      />

      <CrossFacilityLimitSection
        sameBranchBlocked={value.crossFacilitySameBranchBlocked ?? false}
        sameCategoryBlocked={value.crossFacilitySameCategoryBlocked ?? true}
        yearlyMaxApplications={value.crossFacilityYearlyMaxApplications ?? 0}
        onSameBranchBlockedChange={(v) => set('crossFacilitySameBranchBlocked', v)}
        onSameCategoryBlockedChange={(v) => set('crossFacilitySameCategoryBlocked', v)}
        onYearlyMaxApplicationsChange={(v) => set('crossFacilityYearlyMaxApplications', v)}
      />

      <FormSection
        variant="card"
        icon={ClipboardCheckIcon}
        tone="danger"
        title="Devamsızlık & Ayrılma Hakları (Genel Ayarlar)"
        subtitle="Gruplar oluşturulurken geçerli olacak varsayılan devamsızlık hakları. Bu değerler grup açılırken otomatik uygulanır ve grup bazında özelleştirilebilir."
      >
        <div className="grid grid-cols-2 gap-[15px]">
          <Field
            label="Varsayılan Toplam Devamsızlık Hakkı"
            hint="Örn: 5 hak (0 = sınırsız)"
          >
            <NumberInput
              min={0}
              value={value.defaultAbsenceLimit ?? 5}
              onChange={(n) => set('defaultAbsenceLimit', n)}
            />
          </Field>
          <Field
            label="Varsayılan Üst Üste Devamsızlık Hakkı"
            hint="Örn: 3 seans (üst üste devamsızlık sınırı)"
          >
            <NumberInput
              min={0}
              value={value.defaultConsecutiveAbsenceLimit ?? 3}
              onChange={(n) => set('defaultConsecutiveAbsenceLimit', n)}
            />
          </Field>
        </div>
        <p className="text-[12px] text-foreground-subtle leading-relaxed">
          Grup yoklamalarında belirlenen hakkı dolduran veya üst üste sınırını aşan kursiyer sistem tarafından devamsızlıktan kaydı silinir/çıkarılır ve yerine yedek listedeki ilk katılımcı otomatik terfi ettirilir.
        </p>
      </FormSection>

      <FormSection variant="card" icon={BellRingIcon} tone="pink" title="Seans Hatırlatması" subtitle="Katılımcıya seans başlamadan önce otomatik bildirim + SMS gönderilir (mock modda gerçek SMS gitmez)">
        <ToggleRow label="Seans hatırlatması aktif" description="Kapalıysa hiç hatırlatma gönderilmez" checked={value.sessionReminderEnabled} onChange={(v) => set('sessionReminderEnabled', v)} />
        {value.sessionReminderEnabled && (
          <>
            <Field label="Hatırlatma Süresi" hint="Seans başlangıcından kaç saat önce gönderilsin">
              <NumberInput suffix="saat önce" min={1} value={value.sessionReminderHoursBefore} onChange={(n) => set('sessionReminderHoursBefore', n)} />
            </Field>
            <ToggleRow label="E-posta ile de gönder" description="Katılımcının e-posta adresi varsa hatırlatma SMS'e ek olarak e-posta ile de gönderilir" checked={value.sessionReminderEmailEnabled ?? false} onChange={(v) => set('sessionReminderEmailEnabled', v)} />
          </>
        )}
      </FormSection>

      <NotificationTemplatesSection
        templates={value.notificationTemplates ?? []}
        onChange={(t) => set('notificationTemplates', t)}
      />
    </div>
  )
}
