import { expect, test } from '@playwright/test';

test('highlights the strip of a touched hole', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Electronics Kit' })).toBeVisible();

  await page.locator('[data-hole="a3"]').dispatchEvent('pointerdown');

  // A mini board has no centre gap, so the whole of column 3 lights up and nothing else does.
  await expect(page.locator('.hole-active')).toHaveCount(10);
  await expect(page.locator('[data-hole="j3"]')).toHaveClass(/hole-active/);
  await expect(page.locator('[data-hole="a4"]')).not.toHaveClass(/hole-active/);
});
