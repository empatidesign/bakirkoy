import { emptyImageSet, normalizeImages } from '@/modules/events/eventFormDefaults'
import { residencyModeFromFlags } from '@/lib/residency'
import type {
  Travel, TravelFormData, TravelAudienceFee, TravelCrew,
  TravelRoute, TravelRouteFormData,
  TravelCategory, TravelCategoryFormData,
  TravelApplication, TravelApplicationFormData,
  TravelSettings, TravelNotificationTemplate, TravelNotificationEvent,
  ApplicationStatus, DocumentStatus, PaymentStatus,
} from '@/types/travel.types'

/**
 * Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sistemi — meta bilgi (etiket,
 * açıklama, kullanılabilir değişkenler) ve varsayılan şablon metinleri. Backend'deki
 * TravelSettingsService.DefaultNotificationTemplates ile birebir aynı metinler (tek doğruluk
 * kaynağı backend'dir, burası sadece admin ilk kez ayar sayfasını açtığında ve/veya yeni bir
 * olay eklendiğinde formu doldurmak için kullanılır).
 */
export const TRAVEL_NOTIFICATION_META: Record<TravelNotificationEvent, { label: string; desc: string; vars: string[] }> = {
  application_received: {
    label: 'Başvuru Alındı',
    desc: 'Vatandaş bir gezi için başvuru yaptığında (onay bekliyor veya doğrudan kayıt)',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}'],
  },
  approved: {
    label: 'Başvuru Onaylandı',
    desc: 'Başvuru admin tarafından ya da otomatik onaylandığında',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}', '{{guzergah}}', '{{kalkis_noktasi}}'],
  },
  rejected: {
    label: 'Başvuru Reddedildi',
    desc: 'Başvuru admin tarafından reddedildiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}'],
  },
  waitlist: {
    label: 'Yedek Listeye Alındı',
    desc: 'Kontenjan dolu olduğu için başvuru yedek listesine alındığında',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{sira}}'],
  },
  promoted: {
    label: 'Yedekten Çıktı (Koltuk Seçimi Gerekli)',
    desc: 'Yedek listedeyken kontenjan açıldığında, koltuk seçimi bekleniyor',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}'],
  },
  promoted_approved: {
    label: 'Yedekten Onaya Geçti',
    desc: 'Yedek listedeyken kontenjan açıldığında ve otomatik onay aktifse',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}'],
  },
  cancelled: {
    label: 'Kayıt İptal Edildi',
    desc: 'Vatandaş kendi başvurusunu iptal ettiğinde',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}', '{{guzergah}}', '{{kalkis_noktasi}}'],
  },
  postponed: {
    label: 'Gezi Ertelendi',
    desc: 'Gezi tarihi değiştiğinde/ertelendiğinde admin manuel gönderir',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}'],
  },
  emergency: {
    label: 'Acil Durum Duyurusu',
    desc: 'Hava durumu, arıza vb. acil bir durumda admin manuel gönderir',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}'],
  },
  departure_reminder: {
    label: 'Yaklaşan Gezi Hatırlatması',
    desc: `Kalkıştan belirlenen saat önce (Genel Ayarlar'daki "hatırlatma saati") otomatik gönderilir`,
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}', '{{guzergah}}', '{{kalkis_noktasi}}'],
  },
  manual: {
    label: 'Manuel / Toplu Mesaj',
    desc: 'Mesaj gönderme ekranında admin bu şablonu öneri metni olarak kullanabilir veya değiştirebilir',
    vars: ['{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}', '{{guzergah}}', '{{kalkis_noktasi}}'],
  },
}

export const DEFAULT_TRAVEL_NOTIFICATION_TEMPLATES: TravelNotificationTemplate[] = [
  { event: 'application_received', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisine başvurunuz alındı.', notifyEnabled: true, notifyBody: '{{sefer}} gezisine başvurunuz alındı.' },
  { event: 'approved', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} ({{tarih}} {{saat}}) gezisine kaydınız onaylandı.', notifyEnabled: true, notifyBody: '{{sefer}} gezisine kaydınız onaylandı.' },
  { event: 'rejected', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisine başvurunuz maalesef reddedildi.', notifyEnabled: true, notifyBody: '{{sefer}} gezisine başvurunuz maalesef reddedildi.' },
  { event: 'waitlist', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisi için yedek listeye alındınız.', notifyEnabled: true, notifyBody: '{{sefer}} gezisi için yedek listeye alındınız.' },
  { event: 'promoted', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisinde kontenjan açıldı; koltuk seçip başvurunuzu tamamlayabilirsiniz.', notifyEnabled: true, notifyBody: '{{sefer}} gezisinde kontenjan açıldı; koltuk seçip başvurunuzu tamamlayabilirsiniz.' },
  { event: 'promoted_approved', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisinde yer açıldığı için yedek listesinden kaydınız onaylandı; koltuğunuz atandı.', notifyEnabled: true, notifyBody: '{{sefer}} gezisinde yer açıldığı için yedek listesinden kaydınız onaylandı; koltuğunuz atandı.' },
  { event: 'cancelled', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisinin {{tarih}} {{saat}} tarihli seferi iptal edilmiştir. Güzergâh: {{guzergah}}. Ayrıntılı bilgi için belediyemizle iletişime geçebilirsiniz.', notifyEnabled: true, notifyBody: '{{sefer}} gezisinin {{tarih}} {{saat}} tarihli seferi iptal edilmiştir. Güzergâh: {{guzergah}}.' },
  { event: 'postponed', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisi ertelenmiştir. Güncel tarih ve saat: {{tarih}} {{saat}}. Güzergâh: {{guzergah}}. Kalkış noktası: {{kalkis_noktasi}}.', notifyEnabled: true, notifyBody: '{{sefer}} gezisi ertelenmiştir. Güncel tarih: {{tarih}} {{saat}}. Kalkış: {{kalkis_noktasi}}.' },
  { event: 'emergency', smsEnabled: true, smsBody: 'ACİL: Sayın {{ad}} {{soyad}}, {{sefer}} gezisiyle ilgili önemli bir duyuru var. Lütfen belediyeyi arayın.', notifyEnabled: true, notifyBody: 'ACİL DURUM: {{sefer}} gezisiyle ilgili önemli bir duyuru var.' },
  { event: 'departure_reminder', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisi {{tarih}} {{saat}} tarihinde {{kalkis_noktasi}} noktasından kalkacak. Lütfen zamanında hazır olun.', notifyEnabled: true, notifyBody: '{{sefer}} gezisi {{tarih}} {{saat}} tarihinde kalkacak. Lütfen zamanında hazır olun.' },
  { event: 'manual', smsEnabled: true, smsBody: 'Sayın {{ad}} {{soyad}}, {{sefer}} gezisi hakkında bilgilendirme: ', notifyEnabled: true, notifyBody: '{{sefer}} gezisi hakkında bilgilendirme: ' },
]

/** Backend'den gelen liste eksik olay içeriyorsa (yeni olay eklendiğinde) varsayılanla tamamlar. */
export const mergeTravelNotificationTemplates = (templates: TravelNotificationTemplate[] | undefined | null): TravelNotificationTemplate[] =>
  DEFAULT_TRAVEL_NOTIFICATION_TEMPLATES.map((def) => templates?.find((t) => t.event === def.event) ?? def)

export const emptyCrew = (): TravelCrew => ({
  driver: { id: '', name: '', phone: '', tckn: '' },
  guide: { id: '', name: '', phone: '' },
  responsible: { id: '', name: '', role: '', roleKey: '', phone: '', email: '', emergencyPhone: '', grantAccess: false, tckn: '' },
})

export const normalizeCrew = (c?: Partial<TravelCrew> | null): TravelCrew => {
  const e = emptyCrew()
  return {
    driver: { ...e.driver, ...c?.driver },
    guide: { ...e.guide, ...c?.guide },
    responsible: { ...e.responsible, ...c?.responsible },
  }
}

export const GENDER_OPTIONS: { value: 'mixed' | 'male' | 'female'; label: string; tone: 'blue' | 'pink' | 'violet' }[] = [
  { value: 'mixed', label: 'Karma', tone: 'violet' },
  { value: 'male', label: 'Erkek', tone: 'blue' },
  { value: 'female', label: 'Kadın', tone: 'pink' },
]

export const PARTICIPATION_PERIOD_OPTIONS = [
  { value: 'none', label: 'Sınırsız' },
  { value: 'daily', label: 'Günde' },
  { value: 'weekly', label: 'Haftada' },
  { value: 'monthly', label: 'Ayda' },
  { value: 'yearly', label: 'Yılda' },
]

export const APPLICATION_STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'pending', label: 'Gönderildi' },
  { value: 'reviewing', label: 'İnceleniyor' },
  { value: 'approved', label: 'Onaylandı' },
  { value: 'rejected', label: 'Reddedildi' },
  { value: 'waitlist', label: 'Yedek Liste' },
]

export const DOCUMENT_STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'pending', label: 'Bekliyor' },
  { value: 'complete', label: 'Tamamlandı' },
  { value: 'missing', label: 'Eksik' },
]

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Bekliyor' },
  { value: 'paid', label: 'Tamamlandı' },
  { value: 'refunded', label: 'İade' },
  { value: 'waived', label: 'Muaf' },
]

export const REFUND_POLICY_OPTIONS = [
  { value: 'full', label: 'Tam İade' },
  { value: 'partial', label: 'Kısmi İade (%50)' },
  { value: 'none', label: 'İade Yok' },
]

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' | 'info' }> = {
  pending: { label: 'Gönderildi', tone: 'neutral' },
  reviewing: { label: 'İnceleniyor', tone: 'warning' },
  approved: { label: 'Onaylandı', tone: 'success' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  waitlist: { label: 'Yedek Liste', tone: 'info' },
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: 'warning' | 'success' | 'danger' | 'neutral' }> = {
  pending: { label: 'Bekliyor', tone: 'warning' },
  paid: { label: 'Tamamlandı', tone: 'success' },
  refunded: { label: 'İade', tone: 'danger' },
  waived: { label: 'Muaf', tone: 'neutral' },
}

export const DOCUMENT_STATUS_META: Record<DocumentStatus, { label: string; tone: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'Bekliyor', tone: 'warning' },
  complete: { label: 'Tamamlandı', tone: 'success' },
  missing: { label: 'Eksik', tone: 'danger' },
}

type BadgeMeta = { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'primary' }
const FALLBACK_META: BadgeMeta = { label: 'Belirsiz', tone: 'neutral' }

export const applicationStatusMeta = (status: string): BadgeMeta =>
  APPLICATION_STATUS_META[status as ApplicationStatus] ?? FALLBACK_META

const PAYMENT_EXTRA_META: Record<string, BadgeMeta> = {
  free: { label: 'Ücretsiz', tone: 'neutral' },
}
export const paymentStatusMeta = (status: string): BadgeMeta =>
  PAYMENT_STATUS_META[status as PaymentStatus] ?? PAYMENT_EXTRA_META[status] ?? FALLBACK_META

const DOCUMENT_EXTRA_META: Record<string, BadgeMeta> = {
  approved: { label: 'Onaylandı', tone: 'success' },
  none: { label: 'Gerekli değil', tone: 'neutral' },
}
export const documentStatusMeta = (status: string): BadgeMeta =>
  DOCUMENT_STATUS_META[status as DocumentStatus] ?? DOCUMENT_EXTRA_META[status] ?? FALLBACK_META

export const DEFAULT_TRAVEL_AUDIENCES: TravelAudienceFee[] = [
  { key: 'adult', label: 'Yetişkin', enabled: true, price: 0 },
  { key: 'student', label: 'Öğrenci', enabled: true, price: 0 },
  { key: 'child', label: 'Çocuk', enabled: false, price: 0 },
  { key: 'senior', label: '65+ Yaş', enabled: false, price: 0 },
]

export const emptyRouteForm = (): TravelRouteFormData => ({
  name: '',
  categoryId: '',
  destination: '',
  departurePoint: '',
  latitude: undefined,
  longitude: undefined,
  description: '',
  conditions: '',
  internalNote: '',
  gender: 'mixed',
  minAge: 0,
  maxAge: 99,
  restrictions: {
    residencyMode: 'sultangazi_only',
    sultangaziResidentOnly: true,
    allowOutsideSultangazi: false,
    requiresGuardianConsent: false,
    maxCompanions: 0,
    documentRequired: false,
    // Kullanıcı bulgusu (2026-08-09): backend artık alan hiç kaydedilmemişse
    // allowChildren=true kabul ediyor (aksi halde 117 aktif gezinin 113'ünde
    // yetişkin çocuğunu ekleyemiyordu) — form varsayılanı da tutarlı olsun diye
    // true yapıldı, admin isterse kapatabilir.
    allowChildren: true,
    maxChildren: 1,
    childMinAge: 0,
    childMaxAge: 17,
    childGenderMode: 'mixed',
  },
  images: emptyImageSet(),
  pricing: {
    isPaid: false,
    currency: 'TRY',
    audiences: DEFAULT_TRAVEL_AUDIENCES.map((a) => ({ ...a })),
    depositEnabled: false,
    depositAmount: 0,
    refundPolicy: 'partial',
  },
  points: {
    enabled: false,
    basePoints: 0,
  },
  isActive: true,
  sultangaziResidentOnly: true,
})

export const routeToForm = (r: TravelRoute): TravelRouteFormData => ({
  name: r.name,
  categoryId: r.categoryId,
  destination: r.destination,
  departurePoint: r.departurePoint ?? '',
  latitude: r.latitude,
  longitude: r.longitude,
  description: r.description,
  conditions: r.conditions,
  internalNote: r.internalNote,
  gender: r.gender,
  minAge: r.minAge,
  maxAge: r.maxAge,
  restrictions: {
    ...emptyRouteForm().restrictions,
    ...r.restrictions,
    residencyMode: r.restrictions?.residencyMode ?? residencyModeFromFlags(r.restrictions?.sultangaziResidentOnly, r.restrictions?.allowOutsideSultangazi),
  },
  images: normalizeImages(r.images),
  pricing: {
    ...emptyRouteForm().pricing,
    ...r.pricing,
    audiences: r.pricing?.audiences?.length ? r.pricing.audiences : emptyRouteForm().pricing.audiences,
  },
  points: { ...emptyRouteForm().points, ...r.points },
  isActive: r.isActive,
  sultangaziResidentOnly: r.sultangaziResidentOnly,
})

export const emptyTravelForm = (routeId = ''): TravelFormData => ({
  routeId,
  startDate: '',
  endDate: '',
  registrationStartDate: '',
  registrationEndDate: '',
  capacity: 0,
  reserveCapacity: 0,
  participationPeriod: 'none',
  participationLimit: 0,
  exemptFromParticipationLimit: false,
  cancellationDeadlineHours: 72,
  crew: emptyCrew(),
  busIds: [],
  isActive: true,
})

export const travelToForm = (t: Travel): TravelFormData => ({
  routeId: t.routeId,
  startDate: t.startDate,
  endDate: t.endDate,
  registrationStartDate: t.registrationStartDate,
  registrationEndDate: t.registrationEndDate,
  capacity: t.capacity,
  reserveCapacity: t.reserveCapacity,
  participationPeriod: t.participationPeriod,
  // Kullanıcı bulgusu (2026-08-07): kayıtlı bir seferde participationPeriod 'none' değilken
  // participationLimit 0 gibi tutarsız bir değerle gelmişse (ör. eski veri), formu sadece
  // araç atamak için açan admin, hiç dokunmadığı bu alan yüzünden "Katılım limiti en az 1
  // olmalıdır" hatasıyla engelleniyordu. Yüklenirken kendiliğinden 1'e sabitlenir.
  participationLimit: t.participationPeriod !== 'none' && t.participationLimit < 1 ? 1 : t.participationLimit,
  exemptFromParticipationLimit: t.exemptFromParticipationLimit ?? false,
  cancellationDeadlineHours: t.cancellationDeadlineHours ?? 72,
  crew: normalizeCrew(t.crew),
  busIds: [],
  isActive: t.isActive,
})

export const emptyCategoryForm = (): TravelCategoryFormData => ({
  name: '',
  description: '',
  color: '#3699ff',
  isActive: true,
})

export const categoryToForm = (c: TravelCategory): TravelCategoryFormData => ({
  name: c.name,
  description: c.description,
  color: c.color,
  isActive: c.isActive,
})

export const emptyApplicationForm = (): TravelApplicationFormData => ({
  travelId: '',
  participantId: '',
  status: 'pending',
  documentStatus: 'pending',
  paymentStatus: 'pending',
  busId: '',
  seatNumber: '',
  notes: '',
  overrideEligibility: false,
})

export const applicationToForm = (a: TravelApplication): TravelApplicationFormData => ({
  travelId: a.travelId,
  participantId: a.participantId,
  status: a.status,
  documentStatus: a.documentStatus,
  paymentStatus: a.paymentStatus,
  busId: a.busId ?? '',
  seatNumber: a.seatNumber ?? '',
  notes: a.notes,
  emergencyContactName: a.emergencyContactName ?? '',
  emergencyContactPhone: a.emergencyContactPhone ?? '',
  overrideEligibility: false,
})

export const defaultTravelSettings = (): TravelSettings => ({
  general: {
    maxParticipants: 50,
    minAge: 18,
    maxAge: 65,
    advanceBookingDays: 7,
    cancellationDeadlineDays: 3,
    requireApproval: true,
    reserveListEnabled: true,
    noShowBlocksNextTravel: false,
    attendanceReminderHoursBeforeDeparture: 25,
    autoInviteSmsEnabled: true,
    inviteSmsDelayMinutes: 5,
  },
  participation: {
    defaultPeriod: 'none',
    defaultLimitCount: 1,
    applyToVehicleFreeTravels: true,
  },
  restrictions: [],
  rules: [],
  notificationTemplates: DEFAULT_TRAVEL_NOTIFICATION_TEMPLATES.map((t) => ({ ...t })),
})
