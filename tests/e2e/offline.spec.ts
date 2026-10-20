import { expect, test } from '@playwright/test';

test('has a web app manifest for installing', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest).toMatchObject({
    name: 'Electronics Kit',
    short_name: 'Circuits',
    display: 'standalone',
    id: '/electronics-kit/',
  });
});

test('offers to install when the browser allows it, then says where to find it', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Chapter 1: Make a loop' })).toBeVisible();
  // Nothing until the browser offers to install.
  await expect(page.getByRole('button', { name: 'Install' })).toHaveCount(0);

  await page.evaluate(() => {
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: () => {
        (window as unknown as { prompted: boolean }).prompted = true;
        return Promise.resolve();
      },
    });
    window.dispatchEvent(offer);
  });
  await page.getByRole('button', { name: 'Install' }).click();
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(
    true,
  );
  await expect(page.getByRole('button', { name: 'Install' })).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(page.getByRole('status')).toHaveText(/Look for “Circuits” in your apps/);
});

test('works offline once loaded', async ({ page, context }) => {
  await page.goto('./');
  // Once the service worker is active it has cached the game; the next load is served by it, even
  // though it doesn't take over the page that installed it.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chapter 1: Make a loop' })).toBeVisible();
  // The font is precached too, rather than silently falling back to the system one.
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((font) => font.family.includes('Atkinson Hyperlegible'))
      .map((font) => font.status);
  });
  expect(fonts).toContain('loaded');
  expect(fonts).not.toContain('error');
  await page.locator('[data-level="loop-1"]').click();
  await expect(page.getByRole('heading', { name: 'Light it up' })).toBeVisible();
});
