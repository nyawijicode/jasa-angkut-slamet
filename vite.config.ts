import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const htmlEntries = [
  'index.html',
  'hitung-tarif.html',
  'layanan.html',
  'galeri.html',
  'area-layanan.html',
  'faq.html',
]

const cleanPaths = new Set([
  ...htmlEntries
    .filter((file) => file !== 'index.html')
    .map((file) => `/${file.replace(/\.html$/, '')}`),
  '/privasi',
])

// Dev dan preview perlu mensimulasikan cleanUrls milik Vercel supaya URL tanpa
// ekstensi dapat diuji sebelum deploy.
function serveCleanUrls(): Plugin {
  const rewrite = (
    req: IncomingMessage,
    _res: ServerResponse,
    next: () => void,
  ) => {
    const [pathname, query = ''] = (req.url ?? '').split('?')
    const normalized = pathname.replace(/\/+$/, '') || '/'
    if (cleanPaths.has(normalized)) {
      const target = `${normalized}.html`
      req.url = `${target}${query ? `?${query}` : ''}`
    }
    next()
  }

  return {
    name: 'serve-clean-urls',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serveCleanUrls()],
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
