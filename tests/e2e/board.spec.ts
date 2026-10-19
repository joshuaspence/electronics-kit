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
  await page.goto('./?sandbox=breadboard');
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

test('carries a part under the pointer and shows where it will connect', async ({ page }) => {
  const start = await centre(page.locator('[data-tray="bulb"]'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  // Off the tray but not yet over the board, the part is already in hand.
  await page.mouse.move(start.x + 150, start.y + 40, { steps: 5 });
  await expect(page.locator('.held .part-bulb')).toHaveCount(1);
  await expect(page.locator('.hole-active')).toHaveCount(0);

  // Over the board, the columns it would join light up, and nothing is selected by the drag.
  const target = await between(page, 'e1', 'e3');
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await expect(page.locator('[data-hole="a1"]')).toHaveClass(/hole-active/);
  await expect(page.locator('[data-hole="a3"]')).toHaveClass(/hole-active/);
  await expect(page.locator('[data-hole="a2"]')).not.toHaveClass(/hole-active/);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');

  await page.mouse.up();
  await expect(page.locator('.held')).toHaveCount(0);
  await expect(page.locator('.part-bulb:not(.part-ghost)')).toHaveCount(1);
});

test('fades a placed part where it was while it is being moved', async ({ page }) => {
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e5', 'e7'));
  const bulb = await centre(page.locator('[data-part] .bulb-body'));
  await page.mouse.move(bulb.x, bulb.y);
  await page.mouse.down();
  await page.mouse.move(bulb.x + 40, bulb.y + 40, { steps: 5 });
  await expect(page.locator('.part-moving')).toHaveCount(1);
  await expect(page.locator('.held .part-bulb')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.part-moving')).toHaveCount(0);
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

/**
 * A resistor from the battery's + column 1 to column 4, an LED from 4 to 6 and a wire from 6 back
 * to the − column 3. A part from the tray lands with its first leg, the LED's anode, on the left.
 */
async function ledBehindResistor(page: Page) {
  await drag(page, page.locator('[data-tray="resistor"]'), await between(page, 'e1', 'e4'));
  await drag(page, page.locator('[data-tray="led"]'), await between(page, 'f4', 'f6'));
  await drag(
    page,
    page.locator('[data-hole="j6"]'),
    await centre(page.locator('[data-hole="j3"]')),
  );
}

test('lights an LED with its long leg towards the battery’s +', async ({ page }) => {
  await ledBehindResistor(page);
  await expect(page.locator('.part-led .led-glow')).not.toHaveAttribute('opacity', '0');
  await expect(page.locator('.part-led .flow')).toHaveCount(1);
});

test('pops an LED straight across the battery, and Undo brings it back', async ({ page }) => {
  await drag(page, page.locator('[data-tray="led"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.part-led.part-blown')).toHaveCount(1);
  await expect(page.locator('.part-led .flow')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Pop!');

  // The pop belongs to the placing, so one Undo takes both back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.part-led:not(.part-ghost)')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
});

test('does not puff a blown LED again when it is picked up', async ({ page }) => {
  await drag(page, page.locator('[data-tray="led"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.part-led.part-blown')).toHaveCount(1);

  const led = await centre(page.locator('.part-led.part-blown .led-body'));
  await page.mouse.move(led.x, led.y);
  await page.mouse.down();
  await page.mouse.move(led.x + 60, led.y + 60, { steps: 5 });
  await expect(page.locator('.held .part-led')).toHaveCount(1);
  const running = await page.evaluate(
    () =>
      [...document.querySelectorAll('.held .led-puff, .part-ghost .led-puff')].flatMap((puff) =>
        puff.getAnimations(),
      ).length,
  );
  expect(running).toBe(0);
  await page.mouse.up();
});

test('turns an LED round with two rotations, and it goes dark', async ({ page }) => {
  await ledBehindResistor(page);
  await expect(page.locator('.part-led .led-glow')).not.toHaveAttribute('opacity', '0');

  // Tapping the LED selects it; each Rotate turns it a quarter about its middle.
  await page.locator('.part-led .led-body').click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await expect(page.locator('.part-led .led-glow')).toHaveAttribute('opacity', '0');
  await expect(page.locator('.part-led .flow')).toHaveCount(0);
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

test.describe('snap board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./?sandbox=snap');
  });

  test('lights a bulb wired to the battery post to post', async ({ page }) => {
    // The battery sits between posts 1-1 and 1-2; the bulb goes on the row below.
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'p2-1', 'p2-2'));
    await expect(page.locator('.part-bulb:not(.part-ghost)')).toHaveCount(1);
    await expect(page.locator('.part-bulb .flow')).toHaveCount(0);

    // A post takes any number of parts, so wires can share the battery's and the bulb's posts.
    await drag(
      page,
      page.locator('[data-hole="p1-1"]'),
      await centre(page.locator('[data-hole="p2-1"]')),
    );
    await drag(
      page,
      page.locator('[data-hole="p1-2"]'),
      await centre(page.locator('[data-hole="p2-2"]')),
    );
    await expect(page.locator('.part-wire:not(.part-ghost)')).toHaveCount(2);
    await expect(page.locator('.part-bulb .flow')).toHaveCount(1);
  });
});

test.describe('half-size board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./?sandbox=half');
  });

  const wire = async (page: Page, from: string, to: string) =>
    drag(
      page,
      page.locator(`[data-hole="${from}"]`),
      await centre(page.locator(`[data-hole="${to}"]`)),
    );

  test('powers a bulb from the rails the battery is plugged into', async ({ page }) => {
    await expect(page.locator('.part-battery .lead')).toHaveCount(2);
    await wire(page, 'top+5', 'a5');
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b5', 'b7'));
    await wire(page, 'c7', 'top-7');
    await expect(page.locator('.part-bulb .flow')).toHaveCount(1);
  });

  test('keeps the two halves of a column apart across the centre gap', async ({ page }) => {
    await wire(page, 'top+5', 'f5');
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b5', 'b7'));
    await wire(page, 'c7', 'top-7');
    await expect(page.locator('.part-bulb:not(.part-ghost)')).toHaveCount(1);
    await expect(page.locator('.part-bulb .flow')).toHaveCount(0);
  });
});
