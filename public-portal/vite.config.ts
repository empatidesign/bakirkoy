import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Public portal, token'sız, sadece görüntüleme amaçlı ayrı bir servistir.
// API_PROXY_TARGET verilmezse yerel dev API'ye (5207) proxy'lenir.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5207'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.VITE_PORT) || 3200,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
