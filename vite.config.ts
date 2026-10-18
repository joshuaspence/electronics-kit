import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://joshuaspence.github.io/electronics-kit/ (docs/design.md §1).
  base: '/electronics-kit/',
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
