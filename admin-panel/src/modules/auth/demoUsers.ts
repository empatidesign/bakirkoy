export interface DemoUser {
  label: string
  email: string
  password?: string
}

export const DEMO_PASSWORD = 'Demo2026!'
export const DEMO_OTP_CODE = '111111'

export const DEMO_USERS: DemoUser[] = [
  // Kullanıcı isteği (2026-10-07): Bakırköy artık Sultangazi ile paylaşılan "nexora" veritabanından
  // tamamen izole, kendine ait "bakirkoy" veritabanına bağlı. O paylaşılan DB'deki
  // superadmin@nexora.local hesabı burada artık mevcut değil — gerçek süper yönetici hesabı
  // admin@bakirkoy.bel.tr.
  { label: 'Süper Admin', email: 'admin@bakirkoy.bel.tr', password: 'Bakirkoy2026!Admin' },
  { label: 'Etkinlik Yöneticisi', email: 'demo.etkinlik@nexora.local' },
  { label: 'Spor Salonu Yöneticisi', email: 'demo.spor@nexora.local' },
  { label: 'Yüzme Havuzu Yöneticisi', email: 'demo.havuz@nexora.local' },
  { label: 'Gençlik Kampı Yöneticisi', email: 'demo.genclik-kampi@nexora.local' },
  { label: 'İzcilik Kampı Yöneticisi', email: 'demo.izcilik@nexora.local' },
  { label: 'Bilim Merkezi Yöneticisi', email: 'demo.bilim-merkezi@nexora.local' },
  { label: 'Kaşif Çocuk Yöneticisi', email: 'demo.kasif@nexora.local' },
  { label: 'Engelsiz Yaşam Yöneticisi', email: 'demo.engelsiz@nexora.local' },
  { label: 'Kütüphane Görevlisi', email: 'demo.kutuphane@nexora.local' },
  { label: 'Gezi Yöneticisi', email: 'demo.gezi@nexora.local' },
  { label: 'SEDA Eğitim Yöneticisi', email: 'demo.seda@nexora.local' },
  { label: 'Bilgi Yarışması Yöneticisi', email: 'demo.quiz@nexora.local' },
  { label: 'Anket Yöneticisi', email: 'demo.anket@nexora.local' },
  { label: 'Hediye Çarkı Yöneticisi', email: 'demo.cark@nexora.local' },
  { label: 'Kampanya ve Firma Yöneticisi', email: 'demo.kampanya@nexora.local' },
  { label: 'Acil Toplanma Alanı Yöneticisi', email: 'demo.acil-alan@nexora.local' },
  { label: 'Muhtarlık Yöneticisi', email: 'demo.muhtarlik@nexora.local' },
  { label: 'Salonlar Yöneticisi', email: 'demo.salonlar@nexora.local' },
]
