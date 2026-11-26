import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const htmlEntries = [
  'index.html',
  'hitung-tarif.html',
  'layanan.html',
  'galeri.html',
  'area-layanan.html',
  'faq.html',
]

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        htmlEntries.map((file) => [
          file.replace(/\.html$/, ''),
          fileURLToPath(new URL(file, import.meta.url)),
        ]),
      ),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
