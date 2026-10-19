import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

/** The commit being built, shown beside the version so a bug report says what was running. */
function commit(): string {
  if (process.env['GITHUB_SHA']) {
    return process.env['GITHUB_SHA'].slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // Served from https://joshuaspence.github.io/electronics-kit/ (docs/design.md §1).
  base: '/electronics-kit/',
  plugins: [
    react(),
    // An installable app that works offline once loaded. A new version waits for the child to tap
    // "update" rather than reloading under them (docs/design.md §1, §10).
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Electronics Kit',
        short_name: 'Circuits',
        description: 'Build circuits on a virtual breadboard and learn how electricity works.',
        lang: 'en-AU',
        start_url: '/electronics-kit/',
        scope: '/electronics-kit/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#f4efe6',
        theme_color: '#f28c28',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit()),
  },
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
