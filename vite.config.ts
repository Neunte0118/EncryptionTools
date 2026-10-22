import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.VITE_BASE_PATH || '/EncryptionTools/';

export default defineConfig(() => {
  return {
    base: BASE_URL,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: BASE_URL,
          name: 'Local Crypto Vault & Signature Studio',
          short_name: 'CryptoVault',
          description: 'ブラウザの標準Web Crypto APIのみを用いた、完全ローカルの署名検証・ハッシュ計算・RSA/ECC暗号化および単一ファイル鍵管理ツール',
          theme_color: '#0f172a',
          background_color: '#020617',
          display: 'standalone',
          orientation: 'any',
          start_url: BASE_URL,
          scope: BASE_URL,
          icons: [
            {
              src: `${BASE_URL}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${BASE_URL}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${BASE_URL}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@noble/post-quantum/ml-kem.js': path.resolve(__dirname, 'node_modules/@noble/post-quantum/ml-kem.js'),
        '@noble/post-quantum/ml-dsa.js': path.resolve(__dirname, 'node_modules/@noble/post-quantum/ml-dsa.js'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
