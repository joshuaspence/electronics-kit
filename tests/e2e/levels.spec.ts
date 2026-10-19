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

/** What the game has saved in IndexedDB, or null if nothing yet. */
function saved(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('electronics-kit');
        // Creating the database here would leave the game's own open no upgrade to make its store.
        open.onupgradeneeded = () => open.transaction?.abort();
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
  );
}

/** Finishes *Mind the gap*, with three stars, by adding its one missing wire. */
async function finishMindTheGap(page: Page) {
  await page.locator('[data-level="loop-3"]').click();
  await wire(page, 'p1-1', 'p2-4');
  await expect(page.getByText('You did it!')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('lists the levels by chapter', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Chapter 1: Make a loop' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chapter 2: On and off' })).toBeVisible();
  await expect(page.locator('[data-level]')).toHaveCount(levels.length);
});

test('shares a sandbox circuit in a link that opens it again', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Sandbox' }).click();
  // A bulb from the + rail's column 3 strip to column 5, with its wire from the + rail.
  await wire(page, 'top+3', 'a3');
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b3', 'b5'));
  await page.getByRole('button', { name: 'Share' }).click();

  const link = await page.getByRole('textbox', { name: 'Share' }).inputValue();
  expect(link).toContain('#c=1_');

  // The link opens the sandbox with the same circuit on the board.
  const opened = await context.newPage();
  await opened.goto(link);
  await expect(opened.getByRole('heading', { name: 'Sandbox' })).toBeVisible();
  await expect(opened.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
  await expect(opened.locator('.board .part-wire:not(.part-ghost)')).toHaveCount(1);
});

test('opens a share link with the parts unlocked so far', async ({ page, context }) => {
  // Saved progress that has finished *switch-1*, which unlocks the switch.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('electronics-kit', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('progress');
        open.onsuccess = () => {
          const db = open.result;
          const put = db
            .transaction('progress', 'readwrite')
            .objectStore('progress')
            .put({ version: 1, stars: { 'switch-1': 3 } }, 'progress');
          put.onsuccess = () => (db.close(), resolve());
          put.onerror = () => reject(put.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );

  // A fresh page reads the link before saved progress arrives, and waits for it.
  const opened = await context.newPage();
  await opened.goto('./#c=1_b.b3.b5');
  await expect(opened.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
  await expect(opened.locator('[data-tray="switch"]')).toBeVisible();
});

test('says when a share link can’t be read, and opens an empty sandbox', async ({ page }) => {
  // The game is already open, so this changes only the fragment, like a link pasted into its tab.
  await page.goto('./#c=1_x.a1.a3');
  await expect(page.getByRole('heading', { name: 'Sandbox' })).toBeVisible();
  await expect(page.getByText('That share link didn’t work')).toBeVisible();
  await expect(page.locator('.board .part-bulb')).toHaveCount(0);
});

test('opens the sandbox with the parts unlocked so far', async ({ page }) => {
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox' })).toBeVisible();

  // Nothing finished yet: bulbs and wires, chapter 1's parts, and a board that zooms.
  await expect(page.locator('[data-tray]')).toHaveCount(2);
  await expect(page.locator('[data-tray="bulb"]')).toBeVisible();
  await expect(page.locator('[data-tray="led"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();

  // At this height the full-size board is limited by the screen's height rather than its width.
  await page.setViewportSize({ width: 1180, height: 600 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(600);

  await page.getByRole('button', { name: 'Levels' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 1: Make a loop' })).toBeVisible();
});

test('keeps a sandbox build when saved progress arrives late', async ({ page }) => {
  // Hold storage back until `releaseStorage()`, which resolves once the load has closed it.
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let closed!: () => void;
    const loaded = new Promise<void>((resolve) => (closed = resolve));
    const close = IDBDatabase.prototype.close;
    IDBDatabase.prototype.close = function () {
      close.call(this);
      closed();
    };
    Object.assign(window, { releaseStorage: () => (release(), loaded) });
    IDBFactory.prototype.open = function (name: string, version?: number) {
      let real: IDBOpenDBRequest;
      const held = {
        get result() {
          return real.result;
        },
        get error() {
          return real.error;
        },
      } as IDBOpenDBRequest;
      void released.then(() => {
        real = open.call(this, name, version);
        real.onupgradeneeded = (event) => held.onupgradeneeded?.call(real, event);
        real.onsuccess = (event) => held.onsuccess?.call(real, event);
        real.onerror = (event) => held.onerror?.call(real, event);
      });
      return held;
    };
  });
  await page.goto('./');

  await page.getByRole('button', { name: 'Sandbox' }).click();
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);

  // Let the load land and re-render the app, then give React two frames to show it.
  await page.evaluate(() =>
    (window as unknown as { releaseStorage: () => Promise<void> }).releaseStorage(),
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
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

test('leaves a fixed part unselected while there is no meter to read it', async ({ page }) => {
  await page.locator('[data-level="loop-1"]').click();
  await page.locator('.board .part-battery .battery-body').click();
  await expect(page.locator('.board .part-selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rotate' })).toBeEnabled();
});

/** Finishes *Side by side*, the first chapter 3 level, which unlocks the multimeter. */
async function finishPair1(page: Page) {
  await page.locator('[data-level="pair-1"]').click();
  await expect(page.getByRole('button', { name: 'Meter' })).toHaveCount(0);

  await wire(page, 'top+3', 'a3');
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b3', 'b5'));
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'd3', 'd5'));
  await wire(page, 'e5', 'top-5');
  await expect(page.getByText('You did it!')).toBeVisible();
}

test('unlocks the multimeter once a chapter 3 level is finished', async ({ page }) => {
  await finishPair1(page);
  await page.getByRole('button', { name: 'Next level' }).click();
  await expect(page.getByRole('button', { name: 'Meter' })).toBeVisible();
});

// The meter adds a row to the column beside the board, under the tools and above Volty.
test('fits a level with the meter on, on a 1180×600 screen', async ({ page }) => {
  await finishPair1(page);
  await page.getByRole('button', { name: 'Next level' }).click();
  await page.setViewportSize({ width: 1180, height: 600 });
  await page.getByRole('button', { name: 'Meter' }).click();
  await page.locator('.board .part-battery .battery-body').click();
  await expect(page.getByRole('status', { name: 'Multimeter' })).toContainText('Battery:');
  await expect(page.getByRole('button', { name: 'Ask Volty for a hint' })).toBeInViewport({
    ratio: 1,
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(600);
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
  await finishMindTheGap(page);

  // Saving is asynchronous: wait until the stars are in IndexedDB before reloading.
  await expect
    .poll(() => saved(page))
    .toMatchObject({ version: 2, profiles: [{ stars: { 'loop-3': 3 } }] });

  await page.reload();
  await expect(page.locator('[data-level="loop-3"]').getByLabel('3 of 3 stars')).toBeVisible();
});

test('keeps the stars a version 1 save had, as the first player', async ({ page }) => {
  // Once the page has made its store (empty: `undefined`, not `null`), put one child's progress
  // there as version 1 saved it.
  await expect.poll(() => saved(page)).not.toBeNull();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('electronics-kit');
        open.onsuccess = () => {
          const db = open.result;
          const put = db
            .transaction('progress', 'readwrite')
            .objectStore('progress')
            .put({ version: 1, stars: { 'loop-3': 3 } }, 'progress');
          put.onsuccess = () => {
            db.close();
            resolve();
          };
        };
      }),
  );

  await page.reload();
  await expect(page.getByText('Playing as Player 1')).toBeVisible();
  await expect(page.locator('[data-level="loop-3"]').getByLabel('3 of 3 stars')).toBeVisible();
});

test('adds a player with their own progress, and switches back', async ({ page }) => {
  await finishMindTheGap(page);
  await page.getByRole('button', { name: 'Levels' }).click();

  await page.getByRole('button', { name: 'Change player' }).click();
  await page.getByLabel('Name').fill('Mia');
  await page.getByRole('button', { name: 'Picture 🚀' }).click();
  await page.getByRole('button', { name: 'Add player' }).click();
  await expect(page.getByText('Playing as Mia')).toBeVisible();
  await expect(page.locator('[data-level="loop-3"]').getByLabel('0 of 3 stars')).toBeVisible();

  await page.getByRole('button', { name: 'Change player' }).click();
  await page.getByRole('button', { name: /Player 1/ }).click();
  await expect(page.getByText('Playing as Player 1')).toBeVisible();
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
