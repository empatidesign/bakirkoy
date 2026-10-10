// Kullanıcı isteği (2026-10-01): "spor salonu sayfasındaki tüm style ve yeni özellikleri
// diğer sayfalara uygula" — pilot tasarım (sultansehir-template görsel dili) önce tüm
// FacilityModule tabanlı Hizmetlerimiz sayfalarına, ardından panel genelindeki bağımsız
// sayfalara da uygulandı. Bu liste artık panel genelinde pilot modun açık olduğu TÜM
// route'ları kapsar; route-dışı (layout seviyesi: sidebar, sağ panel, mobil üst menü) pilot
// kontrolleri buradan okur. Kullanıcı isteği (2026-10-01, bu revizyon): "katılımcılar
// tablosunda aynı standartlar... tümünü aynı şekilde revize et" — /participants artık
// bilinçli dışlanan listeden çıkarılıp diğer tüm modüllerle aynı pilot standarda alındı
// (navy tablo başlığı, 44px filtre/select, breadcrumb başlık, tutarlı modal gradyanları).
// Kullanıcı isteği (2026-10-01, bu revizyon): "mesai yönetiminde de aynı diğer sayfalardaki
// style uygula, header kısmı da aynı burdaki renk gibi" — /library-mesai'nin kendine özel
// mavi gradyan header'ı (bg-gradient-library) kaldırılıp diğer tüm modüllerle aynı pilot
// PageHeader (beyaz zemin, navy ikon) standardına geçirildi.
export const PILOT_ROUTES = [
  // FacilityModule tabanlı Hizmetlerimiz modülleri (ilk pilot dalgası)
  '/sports', '/pool', '/youth-camp',
  '/scout-camp', '/science-center', '/accessible-life', '/women-family',
  // Bağımsız (standalone) sayfalar — 2026-10-01 tam panel yayılımı
  '/service-facilities', '/halls', '/emergency-areas', '/popups', '/quiz', '/wheel',
  '/muhtarlik', '/companies', '/travels', '/events', '/loyalty', '/settings',
  '/admin', '/logs', '/survey', '/duty-pharmacies', '/mobile-config', '/library',
  '/device-monitor', '/reports', '/dashboard', '/participants',
  // Bakırköy Belediyesi Özel Modülleri
  '/saglik', '/e-belediye', '/nikah', '/veterinerlik', '/imar', '/bakkart',
] as const

// Not: '/library' gibi kısa route'lar '/library-mesai' gibi ilgisiz bir route'u yanlışlıkla
// eşleştirmesin diye sınır kontrolü yapılır (tam eşleşme veya '/' ile devam eden alt yol).
export const isPilotPath = (pathname: string): boolean =>
  PILOT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
