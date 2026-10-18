import { expect, type Locator, type Page, test } from '@playwright/test';

async function centre(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element is not visible');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses on `from`, drags in steps to the middle of `to` and releases there. */
async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  const start = await centre(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** The point midway between two holes, where a part held by its middle sits. */
async function between(page: Page, a: string, b: string) {
  const p = await centre(page.locator(`[data-hole="${a}"]`));
  const q = await centre(page.locator(`[data-hole="${b}"]`));
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Electronics Kit' })).toBeVisible();
});

test('highlights the strip of a touched hole', async ({ page }) => {
  await page.locator('[data-hole="a5"]').dispatchEvent('pointerdown');

  // A mini board has no centre gap, so the whole of column 5 lights up and nothing else does.
  await expect(page.locator('.hole-active')).toHaveCount(10);
  await expect(page.locator('[data-hole="j5"]')).toHaveClass(/hole-active/);
  await expect(page.locator('[data-hole="a6"]')).not.toHaveClass(/hole-active/);
});

test('places a bulb from the tray, and undo takes it away', async ({ page }) => {
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));

  await expect(page.locator('.part-bulb:not(.part-ghost)')).toHaveCount(1);
  await expect(page.locator('[data-tray="bulb"]')).toContainText('×1');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.part-bulb')).toHaveCount(0);
  await expect(page.locator('[data-tray="bulb"]')).toContainText('×2');
});

test('lights a bulb placed across the battery', async ({ page }) => {
  // The battery's legs are in columns 1 and 3, so a bulb from column 1 to column 3 completes the
  // loop through the strips.
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.part-bulb .bulb-glow')).toHaveAttribute('opacity', '0.8');
});

test('draws a wire from hole to hole', async ({ page }) => {
  await drag(
    page,
    page.locator('[data-hole="c5"]'),
    await centre(page.locator('[data-hole="c8"]')),
  );

  await expect(page.locator('.part-wire:not(.part-ghost)')).toHaveCount(1);
  await expect(page.locator('[data-tray="wire"]')).toContainText('×5');
});

test('flips a switch with a tap', async ({ page }) => {
  await drag(page, page.locator('[data-tray="switch"]'), await between(page, 'g4', 'g6'));
  const knob = page.locator('.part-switch:not(.part-ghost) .switch-knob');
  const before = await knob.getAttribute('cx');

  await page.locator('.part-switch:not(.part-ghost) .switch-body').click();
  await expect(knob).not.toHaveAttribute('cx', before ?? '');
});

test('drops where the pointer is released, even before the last move re-renders', async ({
  page,
}) => {
  const start = await centre(page.locator('[data-tray="bulb"]'));
  const target = await between(page, 'e1', 'e3');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 5, start.y + 5);
  // The final move and the release in one task, so React can't re-render between them; WebKit
  // can deliver a fast drag like this.
  await page.evaluate(({ x, y }) => {
    const init = { clientX: x, clientY: y, bubbles: true, pointerId: 1, isPrimary: true };
    window.dispatchEvent(new PointerEvent('pointermove', init));
    window.dispatchEvent(new PointerEvent('pointerup', init));
  }, target);
  await page.mouse.up();

  await expect(page.locator('.part-bulb:not(.part-ghost)')).toHaveCount(1);
});

test('shows current flowing through a lit bulb, and none through a loose one', async ({ page }) => {
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e5', 'e7'));
  await expect(page.locator('.part-bulb:not(.part-ghost)')).toHaveCount(1);
  await expect(page.locator('.part-bulb .flow')).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo' }).click();
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.part-bulb .flow')).toHaveCount(1);
  await expect(page.locator('.part-battery .flow')).toHaveCount(1);
});

test('warns about a short circuit across the battery', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveText('');
  // A wire from column 1 to column 3 joins the battery's two terminals with nothing in between.
  await drag(
    page,
    page.locator('[data-hole="c1"]'),
    await centre(page.locator('[data-hole="c3"]')),
  );

  await expect(page.locator('.part-battery.part-hot')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('short circuit');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.part-hot')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
});
