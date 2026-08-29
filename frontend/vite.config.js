import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // The pipeline WebSocket lives at /api/v1/pipeline/ws, so this single
      // rule needs ws:true — without it, Vite proxies the HTTP parts of /api
      // fine but silently drops the WebSocket upgrade, and the "live"
      // progress UI falls back to slow polling with no visible error.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
      '/thumbnails': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
