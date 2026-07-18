/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AI老友記',
        short_name: 'AI老友記',
        description: '老友記嘅 AI 生活學堂',
        theme_color: '#2f6f4f',
        background_color: '#faf8f4',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // useLessons.ts fetches ALL published lessons in one request -- caching this
            // single endpoint is enough to make every published lesson's content available
            // offline, without any per-lesson caching logic. stale-while-revalidate: serve
            // the cached copy immediately (works offline), refresh it in the background
            // whenever there IS a connection.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/elder_lessons'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'elder-lessons-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    globals: true,
  },
})
