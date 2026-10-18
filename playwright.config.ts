import { defineConfig, devices } from '@playwright/test';

// CI installs Playwright's own browsers. Elsewhere, PLAYWRIGHT_CHROMIUM_PATH points at a
// preinstalled Chromium (for example /opt/pw-browsers/chromium) and only that project runs.
const chromiumPath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

// The primary target is a tablet in landscape (docs/design.md §9).
const tablet = { viewport: { width: 1180, height: 820 }, hasTouch: true };

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/electronics-kit/',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...tablet,
        ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
      },
    },
    ...(chromiumPath ? [] : [{ name: 'webkit', use: { ...devices['Desktop Safari'], ...tablet } }]),
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173/electronics-kit/',
    reuseExistingServer: !process.env['CI'],
  },
});
