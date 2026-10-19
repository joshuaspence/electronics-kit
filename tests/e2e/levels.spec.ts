import { expect, type Locator, type Page, test } from '@playwright/test';
import { levels } from '../../src/levels';
import { chapter1 } from '../../src/levels/chapter1';
import { chapter2 } from '../../src/levels/chapter2';
import { chapter3 } from '../../src/levels/chapter3';
import { chapter4 } from '../../src/levels/chapter4';

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

/** Halfway between two holes or posts, where a two-legged part dropped from the tray lands. */
async function between(page: Page, a: string, b: string) {
  const p = await centre(post(page, a));
  const q = await centre(post(page, b));
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

async function wire(page: Page, from: string, to: string) {
  await drag(page, post(page, from), await centre(post(page, to)));
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('lists the levels by chapter', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Chapter 1: Make a loop' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chapter 2: On and off' })).toBeVisible();
  await expect(page.locator('[data-level]')).toHaveCount(levels.length);
});

test('finishes a level, earns stars and moves on', async ({ page }) => {
  await page.locator('[data-level="loop-3"]').click();
  await expect(page.getByRole('heading', { name: 'Mind the gap' })).toBeVisible();
  await expect(page.getByText('You did it!')).toHaveCount(0);

  // The missing wire joins the battery's free post to the bulb's.
  await wire(page, 'p1-1', 'p2-4');
  await expect(page.getByText('You did it!')).toBeVisible();
  await expect(page.getByLabel('3 of 3 stars')).toBeVisible();

  const more = page.getByText('A loop with a gap is called an open circuit.', { exact: false });
  await expect(more).toBeHidden();
  await page.getByText('Tell me more').click();
  await expect(more).toBeVisible();

  await page.getByRole('button', { name: 'Next level' }).click();
  await expect(page.getByRole('heading', { name: 'Double bright' })).toBeVisible();

  await page.getByRole('button', { name: 'Levels' }).click();
  await expect(page.locator('[data-level="loop-3"]').getByLabel('3 of 3 stars')).toBeVisible();
  await expect(page.locator('[data-level="loop-4"]').getByLabel('0 of 3 stars')).toBeVisible();
});

test.describe('finishing', () => {
  // Record every tone played, so the test can hear the chime without any speakers.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const tones: number[] = [];
      Object.assign(window, { tones });
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (when?: number) {
        tones.push(this.frequency.value);
        start.call(this, when);
      };
    });
    await page.reload();
    await page.locator('[data-level="loop-3"]').click();
  });

  const chime = [523, 659, 784];
  const tones = (page: Page) =>
    page.evaluate(() => (window as unknown as { tones: number[] }).tones);

  test('bursts confetti and chimes', async ({ page }) => {
    await wire(page, 'p1-1', 'p2-4');
    await expect(page.locator('.confetti')).toBeAttached();
    await expect.poll(() => tones(page)).toEqual(expect.arrayContaining(chime));
  });

  test('stays quiet when muted', async ({ page }) => {
    await page.getByRole('button', { name: 'Sound on' }).click();
    await wire(page, 'p1-1', 'p2-4');
    await expect(page.getByText('You did it!')).toBeVisible();
    // Give the chime the time it takes when unmuted, so its absence means something.
    await page.waitForTimeout(500);
    expect(await tones(page)).toEqual([]);
  });
});

test('does not count a short circuit as a win', async ({ page }) => {
  await page.locator('[data-level="loop-5"]').click();
  await expect(page.locator('.board .part-battery.part-hot')).toHaveCount(1);

  // Wiring the bulb in while the shortcut is still there lights nothing: the short takes it all.
  await wire(page, 'p2-1', 'p3-3');
  await wire(page, 'p1-2', 'p3-4');
  await expect(page.getByText('You did it!')).toHaveCount(0);
});

test('controls a bulb with a switch on the breadboard', async ({ page }) => {
  await page.locator('[data-level="switch-1"]').click();

  // Switch from the battery's column 3 to column 5, bulb from 5 to 7, wire from 7 back to 1.
  await drag(page, page.locator('[data-tray="switch"]'), await between(page, 'e3', 'e5'));
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'f5', 'f7'));
  await wire(page, 'j7', 'j1');
  await expect(page.locator('.board .part-bulb .flow')).toHaveCount(0);
  // The circuit is right, but the level finishes only when the child switches the bulb on.
  await expect(page.getByText('You did it!')).toHaveCount(0);
  await page.locator('.board .part-switch:not(.part-ghost) .switch-body').click();
  await expect(page.locator('.board .part-bulb .flow')).toHaveCount(1);
  await expect(page.getByText('You did it!')).toBeVisible();
});

test('saves an LED with a resistor', async ({ page }) => {
  await page.locator('[data-level="res-1"]').click();

  // The resistor from column 3 to 6, then the LED from 6 to 8, where the wire back to − waits.
  await drag(page, page.locator('[data-tray="resistor"]'), await between(page, 'b3', 'b6'));
  await drag(page, page.locator('[data-tray="led"]'), await between(page, 'c6', 'c8'));
  await expect(page.locator('.board .part-led.part-blown')).toHaveCount(0);
  await expect(page.locator('.board .part-led .led-glow')).not.toHaveAttribute('opacity', '0');
  await expect(page.getByText('You did it!')).toBeVisible();
});

test('turns a backwards LED round to finish the level', async ({ page }) => {
  await page.locator('[data-level="led-2"]').click();
  await expect(page.locator('.board .part-led .led-glow')).toHaveAttribute('opacity', '0');

  // Volty's first hint says what is wrong: the LED is the wrong way round.
  await page.getByRole('button', { name: 'Ask Volty for a hint' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'only lets electricity through one way' }),
  ).toBeVisible();

  await page.locator('.board .part-led .led-body').click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await expect(page.locator('.board .part-led .led-glow')).not.toHaveAttribute('opacity', '0');
  await expect(page.getByText('You did it!')).toBeVisible();
});

test('lights two bulbs brightly side by side from the rails', async ({ page }) => {
  await page.locator('[data-level="pair-1"]').click();

  // A wire from the + rail into column 3, two bulbs from 3 to 5, and a wire from 5 to the − rail.
  await wire(page, 'top+3', 'a3');
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b3', 'b5'));
  await expect(page.getByText('You did it!')).toHaveCount(0);
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'd3', 'd5'));
  await wire(page, 'e5', 'top-5');
  await expect(page.locator('.board .part-bulb .bulb-glow[opacity="0.8"]')).toHaveCount(2);
  await expect(page.getByText('You did it!')).toBeVisible();
});

test('needs both switches on, one click at a time', async ({ page }) => {
  await page.locator('[data-level="switch-4"]').click();

  // Two switches in a row from the battery's column 3, then the bulb, then a wire back to 1.
  await drag(page, page.locator('[data-tray="switch"]'), await between(page, 'e3', 'e5'));
  await drag(page, page.locator('[data-tray="switch"]'), await between(page, 'f5', 'f7'));
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'g7', 'g9'));
  await wire(page, 'j9', 'j1');

  const switches = page.locator('.board .part-switch:not(.part-ghost) .switch-body');
  await switches.nth(0).click();
  await expect(page.locator('.board .part-bulb .flow')).toHaveCount(0);
  await switches.nth(1).click();
  await expect(page.locator('.board .part-bulb .flow')).toHaveCount(1);
  await expect(page.getByText('You did it!')).toBeVisible();
});

test('keeps stars after a reload', async ({ page }) => {
  await page.locator('[data-level="loop-3"]').click();
  await wire(page, 'p1-1', 'p2-4');
  await expect(page.getByText('You did it!')).toBeVisible();

  // Saving is asynchronous: wait until the stars are in IndexedDB before reloading.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<unknown>((resolve) => {
            const open = indexedDB.open('electronics-kit');
            open.onerror = () => resolve(null);
            open.onsuccess = () => {
              const db = open.result;
              if (!db.objectStoreNames.contains('progress')) {
                db.close();
                resolve(null);
                return;
              }
              const get = db.transaction('progress').objectStore('progress').get('progress');
              get.onsuccess = () => {
                db.close();
                resolve(get.result);
              };
              get.onerror = () => resolve(null);
            };
          }),
      ),
    )
    .toMatchObject({ stars: { 'loop-3': 3 } });

  await page.reload();
  await expect(page.locator('[data-level="loop-3"]').getByLabel('3 of 3 stars')).toBeVisible();
});

test('shows the version', async ({ page }) => {
  await expect(page.getByText(/^Version \d+\.\d+\.\d+ \(\w+\)$/)).toBeVisible();
});

test.describe('Volty', () => {
  const askVolty = (page: Page) =>
    page.getByRole('button', { name: 'Ask Volty for a hint' }).click();

  // On a short landscape screen the column beside the board is nearly full, and Volty used to be
  // fixed to the corner on top of its lowest tools. A three-part tray makes the column tallest.
  for (const [width, height] of [
    [844, 390],
    [1180, 600],
  ] as const) {
    test(`never covers the tools, on a ${width}×${height} screen`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.locator('[data-level="switch-1"]').click();
      const volty = (await page
        .getByRole('button', { name: 'Ask Volty for a hint' })
        .boundingBox())!;
      const tools = await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button').all();
      for (const tool of tools) {
        const box = (await tool.boundingBox())!;
        const overlaps =
          box.x < volty.x + volty.width &&
          volty.x < box.x + box.width &&
          box.y < volty.y + volty.height &&
          volty.y < box.y + box.height;
        expect(overlaps, await tool.innerText()).toBe(false);
      }
    });
  }

  test('nudges first, then shows a part, and a hint costs a star', async ({ page }) => {
    await page.locator('[data-level="loop-3"]').click();

    await askVolty(page);
    await expect(page.getByRole('status').filter({ hasText: 'complete loop' })).toBeVisible();
    await expect(page.locator('.board .part-ghost.part-hinted')).toHaveCount(0);

    await askVolty(page);
    await expect(page.getByText('Try putting a wire where I’ve shown it.')).toBeVisible();
    await expect(page.locator('.board .part-wire.part-ghost.part-hinted')).toHaveCount(1);

    await wire(page, 'p1-1', 'p2-4');
    await expect(page.locator('.board .part-ghost.part-hinted')).toHaveCount(0);
    await expect(page.getByLabel('2 of 3 stars')).toBeVisible();
  });

  test('points at a part to remove', async ({ page }) => {
    await page.locator('[data-level="loop-5"]').click();
    await askVolty(page);
    await expect(page.getByText('Uh oh, a shortcut!', { exact: false })).toBeVisible();
    await askVolty(page);
    await expect(page.locator('[data-part="short-2"] .part-hinted')).toHaveCount(1);
  });

  test('offers help after 30 seconds without progress', async ({ page }) => {
    await page.clock.install();
    await page.goto('./');
    await page.locator('[data-level="loop-1"]').click();
    await expect(page.getByText('Stuck? Tap me for a hint!')).toHaveCount(0);
    await page.clock.fastForward(31_000);
    await expect(page.getByText('Stuck? Tap me for a hint!')).toBeVisible();
  });
});

// The board shrinks to leave room for the tray and tools, so nothing on a level is off the screen.
for (const chapter of [chapter1, chapter2, chapter3, chapter4]) {
  const level = chapter[0]!;
  test(`fits ${level.id} on the screen`, async ({ page }) => {
    await page.locator(`[data-level="${level.id}"]`).click();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
  });
}
