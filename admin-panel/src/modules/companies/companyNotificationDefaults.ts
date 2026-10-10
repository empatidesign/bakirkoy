import type { CompanyNotificationEvent, CompanyNotificationTemplate } from '@/types/company.types'

export const COMPANY_NOTIFICATION_META: Record<CompanyNotificationEvent, { label: string; desc: string; vars: string[] }> = {
  temporary_password: {
    label: 'Geçici Şifre (Firma Oluşturma)',
    desc: 'Yeni firma oluşturulduğunda ve gönderim kanalı SMS seçildiğinde',
    vars: ['{{firma}}', '{{sifre}}'],
  },
  approved: {
    label: 'Firma Onaylandı',
    desc: 'Firma başvurusu yönetici tarafından onaylandığında',
    vars: ['{{firma}}'],
  },
  password_reset: {
    label: 'Şifre Sıfırlama',
    desc: 'Admin firma için yeni geçici şifre oluşturduğunda ve gönderim kanalı SMS seçildiğinde',
    vars: ['{{firma}}', '{{sifre}}'],
  },
  manual: {
    label: 'Manuel Bilgilendirme',
    desc: 'Seçili firmalara şablonlu toplu SMS veya bildirim gönderildiğinde',
    vars: ['{{firma}}'],
  },
}

// Varsayılan metinler CompanyService.cs'deki (ve backend CompanySettingsService.DefaultNotificationTemplates'teki)
// orijinal sabit kodlu metinlerle birebir aynı - admin hiç şablon kaydetmese davranış değişmez.
export const DEFAULT_COMPANY_NOTIFICATION_TEMPLATES: CompanyNotificationTemplate[] = [
  { event: 'temporary_password', smsEnabled: true, smsBody: 'Sayın {{firma}}, firma giriş şifreniz: {{sifre}}. İlk girişte değiştirmeniz zorunludur.' },
  { event: 'approved', smsEnabled: true, smsBody: 'Sayın {{firma}}, firmanız onaylandı. Kampanya oluşturabilirsiniz.' },
  { event: 'password_reset', smsEnabled: true, smsBody: 'Sayın {{firma}}, yeni giriş şifreniz: {{sifre}}. İlk girişte değiştirmeniz zorunludur.' },
  { event: 'manual', smsEnabled: true, smsBody: 'Sayın {{firma}}, bilgilendirme: ' },
]

export const mergeCompanyNotificationTemplates = (
  templates?: CompanyNotificationTemplate[] | null,
): CompanyNotificationTemplate[] => {
  const byEvent = new Map((templates ?? []).map((t) => [t.event, t]))
  return DEFAULT_COMPANY_NOTIFICATION_TEMPLATES.map((d) => byEvent.get(d.event) ?? d)
}
