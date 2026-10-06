import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'favicon.ico', 'robots.txt'],
      manifest: {
        name: 'DIGISPIRE',
        short_name: 'DIGISPIRE',
        description: 'Official Student & Admin Academic Hub for DIGISPIRE Academy',
        theme_color: '#255A84',
        background_color: '#0F172A',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['education', 'productivity'],
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Check-In & Attendance',
            short_name: 'Attendance',
            description: 'Scan class QR codes and view attendance calendar',
            url: '/student/attendance',
            icons: [{ src: 'logo.png', sizes: '192x192' }]
          },
          {
            name: 'Study Materials',
            short_name: 'Materials',
            description: 'Browse curriculum notes, slides, and video lectures',
            url: '/student/content',
            icons: [{ src: 'logo.png', sizes: '192x192' }]
          },
          {
            name: 'Digital Student ID',
            short_name: 'ID Card',
            description: 'View authenticated academy credential & QR badge',
            url: '/student/profile',
            icons: [{ src: 'logo.png', sizes: '192x192' }]
          },
          {
            name: 'Assignments & Projects',
            short_name: 'Submissions',
            description: 'Submit coursework and track reviews',
            url: '/student/submissions',
            icons: [{ src: 'logo.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-storage-assets',
              cacheableResponse: {
                statuses: [0, 200]
              },
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    })
  ]
})
