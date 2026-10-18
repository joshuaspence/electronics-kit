import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
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
  plugins: [react()],
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
