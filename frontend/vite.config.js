import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Build ke website/dist (disajikan server.py). Saat dev, /api dan file data JSON
// diteruskan ke server.py di port 8765.
const BACKEND = 'http://127.0.0.1:8765'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: { outDir: '../website/dist', emptyOutDir: true },
  server: { proxy: { '/api': BACKEND, '^/[\\w-]+\\.json$': BACKEND } },
})
