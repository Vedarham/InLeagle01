import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * During development the API is proxied to FastAPI so the browser only ever
 * talks to one origin. Point INLEAGLE_API_URL elsewhere if the backend runs
 * on a different port.
 */
const apiTarget = process.env.INLEAGLE_API_URL || 'http://localhost:7860'

// https://vite.dev/config/
export default defineConfig({
  // Relative base keeps the build usable at / as well as when the backend
  // serves it from /app/.
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/query': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
      '/evaluation': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
