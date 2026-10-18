import { expect, type Locator, type Page, test } from '@playwright/test';

async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element is not visible');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  const start = await centre(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

const post = (page: Page, name: string) => page.locator(`[data-hole="${name}"]`);

async function wire(page: Page, from: string, to: string) {
  await drag(page, post(page, from), await centre(post(page, to)));
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('lists chapter 1’s levels', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Chapter 1: Make a loop' })).toBeVisible();
  await expect(page.locator('[data-level]')).toHaveCount(5);
});

test('finishes a level, earns stars and moves on', async ({ page }) => {
  await page.locator('[data-level="loop-3"]').click();
  await expect(page.getByRole('heading', { name: 'Mind the gap' })).toBeVisible();
  await expect(page.getByText('You did it!')).toHaveCount(0);

  // The missing wire joins the battery's free post to the bulb's.
  await wire(page, 'p1-1', 'p2-4');
  await expect(page.getByText('You did it!')).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();

  await page.getByRole('button', { name: 'Next level' }).click();
  await expect(page.getByRole('heading', { name: 'Double bright' })).toBeVisible();

  await page.getByRole('button', { name: 'Levels' }).click();
  await expect(page.locator('[data-level="loop-3"]').getByLabel('3 of 3 stars')).toBeVisible();
  await expect(page.locator('[data-level="loop-4"]').getByLabel('0 of 3 stars')).toBeVisible();
});

test('does not count a short circuit as a win', async ({ page }) => {
  await page.locator('[data-level="loop-5"]').click();
  await expect(page.locator('.part-battery.part-hot')).toHaveCount(1);

  // Wiring the bulb in while the shortcut is still there lights nothing: the short takes it all.
  await wire(page, 'p2-1', 'p3-3');
  await wire(page, 'p1-2', 'p3-4');
  await expect(page.getByText('You did it!')).toHaveCount(0);
});
