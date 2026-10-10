export type QrMode = 'rotating' | 'static'
export type LimitPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface ImageSpec {
  width: number
  height: number
  maxSizeKb: number
}

export interface ImageVariants {
  cover: ImageSpec
  card: ImageSpec
  thumb: ImageSpec
}

export interface EventSettings {
  general: {
    minAge: number
    maxAge: number
    waitingListRatio: number
    cancellationDeadlineHours: number
    requireApproval: boolean
    allowWaitingList: boolean
    autoApproveWaitingList: boolean
  }
  participation: {
    defaultLimitPeriod: LimitPeriod
    defaultLimitCount: number
    enforceTcUnique: boolean
    blockDuplicateApplications: boolean
    requireGenderMatch: boolean
  }
  notifications: {
    email: boolean
    sms: boolean
    push: boolean
    applicationConfirm: boolean
    reminder24h: boolean
    reminder1h: boolean
    cancellationNotice: boolean
  }
  attendance: {
    qrCheckIn: boolean
    manualCheckIn: boolean
    bulkCheckIn: boolean
    lateThresholdMinutes: number
    closeAfterMinutes: number
    allowWalkIn: boolean
    recordCheckOut: boolean
    openBeforeMinutes: number
    checkOutCloseAfterMinutes: number
  }
  qr: {
    mode: QrMode
    rotationSeconds: number
    kioskEnabled: boolean
    kioskAutoFullscreen: boolean
    kioskShowName: boolean
    publicLinkEnabled: boolean
    publicLinkRequiresPin: boolean
  }
  images: {
    cropEnabled: boolean
    autoCompress: boolean
    enforceWebSpecs: boolean
    enforceMobileSpecs: boolean
    web: ImageVariants
    mobile: ImageVariants
  }
  notificationTemplates: EventNotificationTemplate[]
}

export interface EventNotificationTemplate {
  event: string
  smsEnabled: boolean
  smsBody: string
  // Kullanıcı isteği (2026-10-06): önceden tüm olaylar için TEK global push anahtarı
  // (notifications.push) vardı - artık Travel/Facility/SEDA ile aynı desen, her olayın kendi
  // push aç/kapa ve kendi push metni var.
  notifyEnabled: boolean
  notifyBody: string
}

export const EVENT_NOTIFICATION_META: { event: string; label: string; hint: string }[] = [
  { event: 'application_received', label: 'Başvuru Alındı', hint: 'Vatandaş başvuru yaptığında (onay gerekli)' },
  { event: 'application_reviewing', label: 'Değerlendiriliyor', hint: 'Başvuru değerlendirmeye alındığında' },
  { event: 'application_approved', label: 'Onaylandı', hint: 'Başvuru admin tarafından onaylandığında' },
  { event: 'application_registered', label: 'Kaydınız Yapıldı', hint: 'Onaysız katılımda doğrudan kayıt olunduğunda' },
  { event: 'application_rejected', label: 'Reddedildi', hint: 'Başvuru reddedildiğinde' },
  { event: 'application_waitlisted', label: 'Yedek Listesine Alındı', hint: 'Kontenjan dolu, yedeğe alındığında' },
  { event: 'registration_cancelled', label: 'Kayıt İptal Edildi', hint: 'Vatandaş kendi kaydını iptal ettiğinde' },
  { event: 'postponed', label: 'Etkinlik Ertelendi', hint: 'Etkinlik tarihi değiştiğinde admin manuel gönderir' },
  { event: 'emergency', label: 'Acil Durum Duyurusu', hint: 'Acil bir durumda admin manuel gönderir' },
]

export const EVENT_NOTIFICATION_PLACEHOLDERS = ['{{ad}}', '{{soyad}}', '{{etkinlik}}', '{{tarih}}', '{{seans}}', '{{sira}}', '{{red_nedeni}}']

export const LIMIT_PERIOD_OPTIONS: { value: LimitPeriod; label: string }[] = [
  { value: 'daily', label: 'Günde' },
  { value: 'weekly', label: 'Haftada' },
  { value: 'monthly', label: 'Ayda' },
  { value: 'yearly', label: 'Yılda' },
]

export const QR_MODE_OPTIONS: { value: QrMode; label: string }[] = [
  { value: 'rotating', label: 'Değişken QR' },
  { value: 'static', label: 'Sabit QR' },
]

export const defaultEventSettings = (): EventSettings => ({
  general: {
    minAge: 0,
    maxAge: 99,
    waitingListRatio: 20,
    cancellationDeadlineHours: 24,
    requireApproval: true,
    allowWaitingList: true,
    autoApproveWaitingList: false,
  },
  participation: {
    defaultLimitPeriod: 'weekly',
    defaultLimitCount: 1,
    enforceTcUnique: true,
    blockDuplicateApplications: true,
    requireGenderMatch: false,
  },
  notifications: {
    email: true,
    sms: false,
    push: true,
    applicationConfirm: true,
    reminder24h: true,
    reminder1h: false,
    cancellationNotice: true,
  },
  attendance: {
    qrCheckIn: true,
    manualCheckIn: true,
    bulkCheckIn: true,
    lateThresholdMinutes: 15,
    closeAfterMinutes: 60,
    allowWalkIn: true,
    recordCheckOut: true,
    openBeforeMinutes: 60,
    checkOutCloseAfterMinutes: 180,
  },
  qr: {
    mode: 'rotating',
    rotationSeconds: 60,
    kioskEnabled: true,
    kioskAutoFullscreen: true,
    kioskShowName: true,
    publicLinkEnabled: true,
    publicLinkRequiresPin: false,
  },
  images: {
    cropEnabled: true,
    autoCompress: true,
    enforceWebSpecs: true,
    enforceMobileSpecs: true,
    web: {
      cover: { width: 1920, height: 720, maxSizeKb: 800 },
      card: { width: 600, height: 400, maxSizeKb: 200 },
      thumb: { width: 240, height: 240, maxSizeKb: 80 },
    },
    mobile: {
      cover: { width: 1080, height: 1350, maxSizeKb: 600 },
      card: { width: 750, height: 750, maxSizeKb: 250 },
      thumb: { width: 320, height: 320, maxSizeKb: 100 },
    },
  },
  notificationTemplates: [
    { event: 'application_received', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz alındı.', notifyEnabled: true, notifyBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz alındı.' },
    { event: 'application_reviewing', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz değerlendiriliyor.', notifyEnabled: true, notifyBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz değerlendiriliyor.' },
    { event: 'application_approved', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine başvurunuz onaylandı.', notifyEnabled: true, notifyBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine başvurunuz onaylandı.' },
    { event: 'application_registered', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine kaydınız yapıldı.', notifyEnabled: true, notifyBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} ({{tarih}}) etkinliğine kaydınız yapıldı.' },
    { event: 'application_rejected', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz reddedildi. {{red_nedeni}}', notifyEnabled: true, notifyBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliğine başvurunuz reddedildi. {{red_nedeni}}' },
    { event: 'application_waitlisted', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliği kontenjanı dolu olduğu için yedek listesine {{sira}}. sırada alındınız.', notifyEnabled: true, notifyBody: 'Sayın {{ad}} {{soyad}}, {{etkinlik}} etkinliği kontenjanı dolu olduğu için yedek listesine {{sira}}. sırada alındınız.' },
  ],
})

export interface EventImageRatioSpec {
  ratio: string
  width: number
  height: number
  maxSizeKb: number
  label: string
}

export interface EventImageRatioCatalog {
  active: EventImageRatioSpec[]
  legacy: EventImageRatioSpec[]
}
