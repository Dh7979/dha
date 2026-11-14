import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) =>
  mode === 'web'
    ? // Installable app (PWA) for hosting: normal multi-file build + service worker.
      {
        plugins: [
          react(),
          {
            name: 'dha-web-head',
            transformIndexHtml: (html: string) =>
              html.replace(
                '</head>',
                '  <meta name="theme-color" content="#EEF2F5" media="(prefers-color-scheme: light)" />\n' +
                  '    <meta name="theme-color" content="#1C2530" media="(prefers-color-scheme: dark)" />\n' +
                  '    <meta name="apple-mobile-web-app-capable" content="yes" />\n' +
                  '    <meta name="apple-mobile-web-app-title" content="DHA" />\n' +
                  '    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />\n' +
                  '  </head>',
              ),
          },
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/apple-touch-icon.png'],
            manifest: {
              name: 'DHA',
              short_name: 'DHA',
              description: '일정, 할 일, 루틴, 기록, 지출을 한 화면에',
              lang: 'ko',
              start_url: '/',
              display: 'standalone',
              background_color: '#EEF2F5',
              theme_color: '#EEF2F5',
              icons: [
                {src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png'},
                {src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png'},
                {src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
              ],
            },
            workbox: {
              navigateFallback: '/index.html',
              globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
              maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            },
          }),
        ],
        build: {outDir: 'dist-web', target: 'es2022'},
      }
    : // claude.ai Artifact: one self-contained HTML file (the Artifact CSP only allows inline code).
      {
        plugins: [react(), viteSingleFile()],
        build: {target: 'es2022', cssCodeSplit: false, assetsInlineLimit: 100000000},
      },
);
