import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'tr.gov.sultangazi.portal',
  appName: 'Sultangazi Belediyesi',
  webDir: 'dist',
  plugins: {
    // Kullanıcı isteği (2026-10-07): uygulama içinde ekran görüntüsü/ekran kaydı
    // (QR giriş kodları, kimlik/katılım bilgileri gibi hassas ekranlar) başka bir
    // program veya arayüz yazılımıyla alınmaya çalışılırsa engellensin.
    // Android: FLAG_SECURE ile pencere, uygulama açılır açılmaz (native tarafta,
    // JS'den önce) korumaya alınır — hem screenshot hem screen recording hem de
    // "Recents" (uygulama geçmişi) önizlemesi engellenir.
    // iOS: Apple resmi bir "screenshot engelle" API'si sunmuyor; preventScreenshots
    // gayriresmi bir teknikle (secure text field) ekran görüntüsünü siyah/boş
    // yakalatır, ayrıca uygulama arka plana geçtiğinde Recents önizlemesi gri ekranla
    // gizlenir. Ekran kaydı (screen recording) iOS'ta started/stopped event'leriyle
    // tespit edilip lib/screenCapture.ts üzerinden uyarı gösterilir (engelleme değil).
    PrivacyScreen: {
      enable: true,
      preventScreenshots: true,
    },
  },
  server: {
    // Kullanıcı isteği (2026-09-03): tablet yerel ağdaki http API'ye erişmeli.
    // Cihazda ölçülen hata: "Mixed Content: The page at 'https://localhost/login'
    // was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint
    // 'http://192.168.1.14:5207/...'. This request has been blocked."
    // Sayfa https şemasıyla yüklendiğinde tarayıcı http isteklerini engeller;
    // cleartext izni tek başına yetmez. Geliştirme paketinde şema http'ye
    // düşürülür, canlıda https kalır (API de https sunmalıdır).
    androidScheme: process.env.CAP_ALLOW_CLEARTEXT === 'true' ? 'http' : 'https',
    // Kullanıcı isteği (2026-09-03): tablet aynı ağdaki API'ye erişemiyordu.
    // Android 9+ şifresiz (http://) trafiği varsayılan olarak engeller; yerel
    // ağdaki geliştirme sunucusu https sunmadığı için istekler daha bağlantı
    // kurulmadan düşer. Bu izin YALNIZCA geliştirme paketlerinde açılmalı;
    // canlı yayında API https üzerinden sunulmalı ve bu bayrak kapatılmalıdır.
    cleartext: process.env.CAP_ALLOW_CLEARTEXT === 'true',
  },
}

export default config
