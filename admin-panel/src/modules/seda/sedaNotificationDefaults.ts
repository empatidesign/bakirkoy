import type { SedaNotificationEvent, SedaNotificationTemplate } from '@/types/seda.types'

export const SEDA_NOTIFICATION_META: Record<SedaNotificationEvent, { label: string; desc: string; vars: string[] }> = {
  application_received: {
    label: 'Başvuru Alındı',
    desc: 'SEDA eğitim başvurusu oluşturulduğunda',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}', '{{sinav_merkezi}}'],
  },
  approved: {
    label: 'Başvuru Onaylandı',
    desc: 'Başvuru yönetici tarafından onaylandığında',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}', '{{sinav_merkezi}}'],
  },
  rejected: {
    label: 'Başvuru Reddedildi',
    desc: 'Başvuru yönetici tarafından reddedildiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}', '{{sinav_merkezi}}', '{{red_nedeni}}'],
  },
  cancelled: {
    label: 'Başvuru İptal Edildi',
    desc: 'Vatandaş başvurusunu iptal ettiğinde veya kayıt iptal edildiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}'],
  },
  postponed: {
    label: 'Sınav / Eğitim Ertelendi',
    desc: 'Sınav veya eğitim takvimi ertelendiğinde admin manuel gönderir',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}', '{{sinav_merkezi}}'],
  },
  emergency: {
    label: 'Acil Durum Duyurusu',
    desc: 'Acil SEDA duyuruları için admin manuel gönderir',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}', '{{sinav_merkezi}}'],
  },
  manual: {
    label: 'Manuel / Toplu Mesaj',
    desc: 'Mesaj gönderme ekranında öneri metni olarak kullanılır',
    vars: ['{{ad}}', '{{soyad}}', '{{ogrenci_adi}}', '{{okul}}', '{{sinav_merkezi}}', '{{red_nedeni}}'],
  },
}

export const DEFAULT_SEDA_NOTIFICATION_TEMPLATES: SedaNotificationTemplate[] = [
  { event: 'application_received', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz alınmıştır.', notifyEnabled: true, notifyBody: '{{ogrenci_adi}} için SEDA eğitim başvurunuz alınmıştır.' },
  { event: 'approved', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz onaylandı. Sınav merkezi: {{sinav_merkezi}}.', notifyEnabled: true, notifyBody: '{{ogrenci_adi}} için SEDA eğitim başvurunuz onaylandı.' },
  { event: 'rejected', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz reddedildi. {{red_nedeni}}', notifyEnabled: true, notifyBody: '{{ogrenci_adi}} için SEDA eğitim başvurunuz reddedildi. {{red_nedeni}}' },
  { event: 'cancelled', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim başvurunuz iptal edildi.', notifyEnabled: true, notifyBody: '{{ogrenci_adi}} için SEDA eğitim başvurunuz iptal edildi.' },
  { event: 'postponed', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için planlanan SEDA sınav/eğitim süreci ertelenmiştir. Yeni bilgilendirme ayrıca yapılacaktır.', notifyEnabled: true, notifyBody: '{{ogrenci_adi}} için SEDA sınav/eğitim süreci ertelenmiştir.' },
  { event: 'emergency', smsEnabled: true, smsBody: 'ACİL: Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA süreciyle ilgili önemli bir duyuru vardır. Lütfen belediye ile iletişime geçiniz.', notifyEnabled: true, notifyBody: 'ACİL DURUM: {{ogrenci_adi}} için SEDA süreciyle ilgili önemli duyuru vardır.' },
  { event: 'manual', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{ogrenci_adi}} için SEDA eğitim süreci hakkında bilgilendirme: ', notifyEnabled: true, notifyBody: '{{ogrenci_adi}} için SEDA eğitim süreci hakkında bilgilendirme: ' },
]

export const mergeSedaNotificationTemplates = (templates?: SedaNotificationTemplate[] | null): SedaNotificationTemplate[] => {
  const byEvent = new Map((templates ?? []).map((t) => [t.event, t]))
  return DEFAULT_SEDA_NOTIFICATION_TEMPLATES.map((d) => byEvent.get(d.event) ?? d)
}
