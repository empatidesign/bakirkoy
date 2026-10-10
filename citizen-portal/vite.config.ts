import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Bulgu (2026-09-22): proxy hedefi önceden yalnızca process.env.API_PROXY_TARGET'tan
  // okunuyordu; .env.local'deki VITE_API_URL hiç görülmüyordu (admin-panel'in
  // vite.config.ts'i loadEnv kullanırken bu dosya kullanmıyordu). Sonuç: .env.local
  // VITE_API_URL=http://localhost:5207 (artık boşta, gerçek API Docker'da :34000'de)
  // olarak kalmıştı, proxy sessizce o boş porta bağlanıp TÜM /api isteklerinde (OTP
  // doğrulama dahil) 500 döndürüyordu — kullanıcıya "kod süresi doldu" gibi yanlış bir
  // hata olarak yansıyordu, aslında OTP'nin süresi dolmamıştı, istek hiç sunucuya
  // ulaşmıyordu. loadEnv ile .env.local dahil tüm env dosyaları okunur, admin-panel
  // ile aynı önceliğe (API_PROXY_TARGET > VITE_API_URL > 5207) kavuşur.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.API_PROXY_TARGET || env.VITE_API_URL || 'http://localhost:5207'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Kullanıcı bildirimi (2026-09-02): "tablette beyaz ekran açılıyor android tablette".
    // Vite 6'nın varsayılan build hedefi ('baseline-widely-available') yalnızca son ~2.5 yılın
    // tarayıcılarını (Chrome 107+, Safari 16+) hedefler. Sahadaki Android tabletlerin WebView/
    // Chrome sürümü çoğu zaman bundan eskidir; bu durumda modern JS söz dizimi parse EDİLEMEZ ve
    // TÜM bundle bir sözdizimi hatasıyla çöker — sonuç: React hiç mount olamaz, ekran BEYAZ kalır
    // (ErrorBoundary bile devreye giremez, çünkü hata JS yüklenirken oluşur). Build hedefi daha
    // geniş bir tabana (Chrome 87 / Safari 14, ~2020 sonu) indirilerek eski saha tabletlerinde de
    // uygulamanın açılması sağlanır. Bu tarayıcılar zaten optional chaining / nullish coalescing
    // gibi kullanılan tüm özellikleri destekler; yalnızca çok yeni söz dizimi transpile edilir.
    build: {
      target: ['chrome87', 'safari14', 'firefox78', 'edge88'],
      // F21 (denetim 2026-09-16): route bazlı lazy loading (App.tsx) modül sayfalarını ayrı
      // chunk'lara ayırdı; react/react-dom/react-router-dom ve @radix-ui paketleri manualChunks
      // ile paylaşılan chunk'lara çıkarıldı. html5-qrcode/qrcode.react BİLEREK manualChunks'a
      // eklenmedi: Rollup'ın manualChunks (obje/static map) formu, bir modülü bir gruba
      // atadığında o chunk'ı "vendor" olarak işaretleyip HER giriş noktasından (QR taramayan
      // sayfalar dahil) modulepreload ekliyor — canlı testte doğrulandı, Login sayfasında bile
      // 351KB'lık QR kütüphanesi preload ediliyordu (admin-panel'de aynı sorun recharts için
      // bulundu, aynı düzeltme uygulanır). Bu iki paket listeden çıkarılıp Vite'ın kendi
      // otomatik/lazy chunk bölmesine bırakılır: yalnızca gerçekten QR tarayan/üreten route'lar
      // kendi chunk'ını indirir.
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-radix': [
              '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu', '@radix-ui/react-label', '@radix-ui/react-popover',
              '@radix-ui/react-progress', '@radix-ui/react-select', '@radix-ui/react-separator',
              '@radix-ui/react-slot', '@radix-ui/react-switch', '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
            ],
          },
        },
      },
    },
    // Saha tabletleri genelde geliştirme/staging sunucusuna doğrudan IP ile bağlanır
    // (host: '0.0.0.0'). Dev sunucusu esbuild ile anlık dönüştürme yaptığından build.target'tan
    // ETKİLENMEZ; bu yüzden dev dönüştürme hedefi de ayrıca düşürülür ki tablette hem dev hem
    // prod aynı geniş tabanı kullansın.
    esbuild: {
      target: 'chrome87',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'chrome87',
      },
    },
    server: {
      port: Number(process.env.VITE_PORT) || 3100,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/hubs': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    // Vitest kapsamı src altındaki birim testlerle sınırlı. Aksi halde tests/e2e altındaki
    // Playwright dosyaları toplanıp "71 dosya başarısız / hiç test yok" hatası veriyordu
    // (2026-09-23'te gözlendi); Playwright kendi koşucusuyla çalışır.
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
