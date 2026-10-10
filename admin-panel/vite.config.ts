/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // .env.local dahil tüm env dosyaları burada okunur (process.env.VITE_* config
  // dosyasında normalde boştur, yalnızca client'a import.meta.env ile geçer).
  const env = loadEnv(mode, process.cwd(), '')

  // Test koşumları API_PROXY_TARGET env değişkeniyle izole test API'sine (ör. :5299)
  // yönlendirilebilir; verilmezse VITE_API_URL (yoksa yerel prod dev API :5207) kullanılır.
  // Not: uygulama kodu axios baseURL'i (VITE_API_URL) mutlak olarak kullanır, bu proxy
  // yalnızca göreli /api yolu bırakan bir istek olursa (ör. eski tarayıcı sekmesinde
  // önbelleğe alınmış bundle) sessizce ECONNREFUSED yerine doğru backend'e gitsin diye
  // aynı hedefle senkron tutulur.
  const apiTarget = env.API_PROXY_TARGET || env.VITE_API_URL || 'http://localhost:5207'

  return {
    plugins: [react()],
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // F21 (denetim 2026-09-16): route bazlı lazy loading (App.tsx) modül sayfalarını ayrı
    // chunk'lara ayırdı, ama react/react-dom/react-router-dom gibi ortak bağımlılıklar hâlâ
    // her sayfa chunk'ına kopyalanıyordu (Rollup varsayılanı). manualChunks ile ortak/ağır
    // kütüphaneler (vendor-react, vendor-charts, vendor-radix) tek seferlik, paylaşılan,
    // agresif tarayıcı önbellekleme alabilen ayrı dosyalara çıkarılır — route değiştiğinde
    // tekrar indirilmezler.
    build: {
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
            // F21 (denetim 2026-09-16): recharts BİLEREK manualChunks'a eklenmedi. Rollup'ın
            // manualChunks (obje/static map) formu, bir modülü bir gruba atadığında o chunk'ı
            // "vendor" olarak işaretleyip HER giriş noktasından (ilgisiz sayfalar dahil)
            // modulepreload ekliyor — recharts'ı kullanmayan Login/AccessiblePage/AdminPage gibi
            // sayfalarda bile 412KB'lık chart kütüphanesi preload ediliyordu (canlı test edildi,
            // aşağıdaki not). recharts'ı bu listeden çıkarmak, Vite'ın kendi otomatik/lazy
            // chunk bölmesine bırakır: yalnızca gerçekten '@/design-system/charts' import eden
            // route'lar (Dashboard, Reports, Survey vb.) kendi chunk'ını indirir, chart
            // kullanmayan sayfalar hiç dokunmaz.
          },
        },
      },
    },
    server: {
      port: Number(process.env.VITE_PORT) || 3000,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/hubs': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
  }
})
