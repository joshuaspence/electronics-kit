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

test('fits the board and its tools on the screen', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Undo' })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
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

  await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
  await expect(page.locator('[data-tray="bulb"]')).toContainText('×1');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.board .part-bulb')).toHaveCount(0);
  await expect(page.locator('[data-tray="bulb"]')).toContainText('×2');
});

test('lights a bulb placed across the battery', async ({ page }) => {
  // The battery's legs are in columns 1 and 3, so a bulb from column 1 to column 3 completes the
  // loop through the strips.
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.board .part-bulb .bulb-glow')).toHaveAttribute('opacity', '0.8');
});

test('draws a wire from hole to hole', async ({ page }) => {
  await drag(
    page,
    page.locator('[data-hole="c5"]'),
    await centre(page.locator('[data-hole="c8"]')),
  );

  await expect(page.locator('.board .part-wire:not(.part-ghost)')).toHaveCount(1);
  await expect(page.locator('[data-tray="wire"]')).toContainText('×5');
});

test('flips a switch with a tap', async ({ page }) => {
  await drag(page, page.locator('[data-tray="switch"]'), await between(page, 'g4', 'g6'));
  const knob = page.locator('.board .part-switch:not(.part-ghost) .switch-knob');
  const before = await knob.getAttribute('cx');

  await page.locator('.board .part-switch:not(.part-ghost) .switch-body').click();
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
  await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
});

test('fades a placed part where it was while it is being moved', async ({ page }) => {
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e5', 'e7'));
  const bulb = await centre(page.locator('[data-part] .bulb-body'));
  await page.mouse.move(bulb.x, bulb.y);
  await page.mouse.down();
  await page.mouse.move(bulb.x + 40, bulb.y + 40, { steps: 5 });
  await expect(page.locator('.board .part-moving')).toHaveCount(1);
  await expect(page.locator('.held .part-bulb')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.board .part-moving')).toHaveCount(0);
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

  await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
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

test('measures a part with the multimeter', async ({ page }) => {
  await page.getByRole('button', { name: 'Meter' }).click();
  const meter = page.getByRole('status', { name: 'Multimeter' });
  await expect(meter).toContainText('Tap a part to measure it.');

  // A part just placed is selected, so the meter reads it at once. A 10 Ω bulb across 3 V behind
  // the pack's 0.5 Ω: 2.86 V across it and 286 mA through it.
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));
  await expect(meter).toContainText('Bulb:');
  await expect(meter).toContainText('2.86 V');
  await expect(meter).toContainText('286 mA');

  // The level's own battery can be measured too, though it can't be moved or turned.
  await page.locator('.board .part-battery .battery-body').click();
  await expect(meter).toContainText('Battery:');
  await expect(meter).toContainText('286 mA');
  await expect(page.getByRole('button', { name: 'Rotate' })).toBeDisabled();

  // Switching the meter off lets go of the battery, so Rotate is back for the tray's parts.
  await page.getByRole('button', { name: 'Meter' }).click();
  await expect(page.locator('.board .part-selected')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rotate' })).toBeEnabled();
});

test('shows a resistor’s value in its colour bands', async ({ page }) => {
  await drag(page, page.locator('[data-tray="resistor"]'), await between(page, 'e5', 'e8'));
  // The kit's 100 Ω: brown, black, brown, then a gold tolerance band.
  const bands = page.locator('.board .part-resistor:not(.part-ghost) .resistor-band');
  await expect(bands).toHaveCount(4);
  expect(await bands.evaluateAll((els) => els.map((el) => el.getAttribute('fill')))).toEqual([
    '#7a4a24',
    '#1b1b1b',
    '#7a4a24',
    '#c9a227',
  ]);
});

test('lights an LED with its long leg towards the battery’s +', async ({ page }) => {
  await ledBehindResistor(page);
  await expect(page.locator('.board .part-led .led-glow')).not.toHaveAttribute('opacity', '0');
  await expect(page.locator('.board .part-led .flow')).toHaveCount(1);
});

test('pops an LED straight across the battery, and Undo brings it back', async ({ page }) => {
  await drag(page, page.locator('[data-tray="led"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.board .part-led.part-blown')).toHaveCount(1);
  await expect(page.locator('.board .part-led .flow')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Pop!');

  // The pop belongs to the placing, so one Undo takes both back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.board .part-led:not(.part-ghost)')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
});

test('does not puff a blown LED again when it is picked up', async ({ page }) => {
  await drag(page, page.locator('[data-tray="led"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.board .part-led.part-blown')).toHaveCount(1);

  const led = await centre(page.locator('.board .part-led.part-blown .led-body'));
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
  await expect(page.locator('.board .part-led .led-glow')).not.toHaveAttribute('opacity', '0');

  // Tapping the LED selects it; each Rotate turns it a quarter about its middle.
  await page.locator('.board .part-led .led-body').click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await expect(page.locator('.board .part-led .led-glow')).toHaveAttribute('opacity', '0');
  await expect(page.locator('.board .part-led .flow')).toHaveCount(0);
});

test('shows current flowing through a lit bulb, and none through a loose one', async ({ page }) => {
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e5', 'e7'));
  await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
  await expect(page.locator('.board .part-bulb .flow')).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo' }).click();
  await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e1', 'e3'));
  await expect(page.locator('.board .part-bulb .flow')).toHaveCount(1);
  await expect(page.locator('.board .part-battery .flow')).toHaveCount(1);
});

test('warns about a short circuit across the battery', async ({ page }) => {
  await expect(page.getByRole('status')).toHaveText('');
  // A wire from column 1 to column 3 joins the battery's two terminals with nothing in between.
  await drag(
    page,
    page.locator('[data-hole="c1"]'),
    await centre(page.locator('[data-hole="c3"]')),
  );

  await expect(page.locator('.board .part-battery.part-hot')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('short circuit');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.board .part-hot')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
});

test.describe('snap board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./?sandbox=snap');
  });

  test('lights a bulb wired to the battery post to post', async ({ page }) => {
    // The battery sits between posts 1-1 and 1-2; the bulb goes on the row below.
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'p2-1', 'p2-2'));
    await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
    await expect(page.locator('.board .part-bulb .flow')).toHaveCount(0);

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
    await expect(page.locator('.board .part-wire:not(.part-ghost)')).toHaveCount(2);
    await expect(page.locator('.board .part-bulb .flow')).toHaveCount(1);
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
    await expect(page.locator('.board .part-battery .lead')).toHaveCount(2);
    await wire(page, 'top+5', 'a5');
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b5', 'b7'));
    await wire(page, 'c7', 'top-7');
    await expect(page.locator('.board .part-bulb .flow')).toHaveCount(1);
  });

  test('keeps the two halves of a column apart across the centre gap', async ({ page }) => {
    await wire(page, 'top+5', 'f5');
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'b5', 'b7'));
    await wire(page, 'c7', 'top-7');
    await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
    await expect(page.locator('.board .part-bulb .flow')).toHaveCount(0);
  });
});

test.describe('full-size board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./?sandbox=full');
  });

  const viewBox = async (page: Page) =>
    (await page.locator('svg.board').getAttribute('viewBox'))!.split(' ').map(Number);

  /** The board point under a screen point, mapped through the board's transform. */
  const boardPoint = (page: Page, x: number, y: number) =>
    page.locator('svg.board').evaluate(
      (svg: SVGSVGElement, [x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!.inverse());
        return { x: p.x, y: p.y };
      },
      [x, y],
    );

  /**
   * Drags the bare board `dx` pixels sideways, from its middle between rows e and f, and checks
   * the board point it was pressed on ends up under the pointer, until an edge stops it.
   */
  async function pan(page: Page, dx: number) {
    const board = (await page.locator('svg.board').boundingBox())!;
    const x = board.x + board.width / 2;
    const y = (await centre(page.locator('[data-hole="e1"]'))).y + 20;
    const pressed = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.getAttribute('class'),
      [x, y],
    );
    expect(pressed).toBe('board-body');
    const start = await boardPoint(page, x, y);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y, { steps: 5 });
    await page.mouse.up();
    return { start, end: await boardPoint(page, x + dx, y) };
  }

  test('zooms in and out, but not out past its full height', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    const [, , width] = await viewBox(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect((await viewBox(page))[2]).toBeLessThan(width!);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    expect((await viewBox(page))[2]).toBeCloseTo(width!, 5);
  });

  test('pans by dragging the board, and places parts where the pointer is after', async ({
    page,
  }) => {
    expect((await viewBox(page))[0]).toBe(0);

    // Drag the bare board leftwards, between rows, to bring columns further right into view.
    const board = (await page.locator('svg.board').boundingBox())!;
    const y = (await centre(page.locator('[data-hole="e10"]'))).y + 20;
    await page.mouse.move(board.x + board.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * 0.2, y, { steps: 10 });
    await page.mouse.up();
    const [left, , width] = await viewBox(page);
    expect(left).toBeGreaterThan(0);

    // A column that has panned into view still takes a part dropped on it. Holes start 120
    // board units in (margin and battery room) and are 40 apart.
    const column = Math.round((left! + width! / 2 - 120) / 40) + 1;
    await drag(
      page,
      page.locator('[data-tray="bulb"]'),
      await between(page, `e${column}`, `e${column + 2}`),
    );
    await expect(page.locator('.board .part-bulb:not(.part-ghost)')).toHaveCount(1);
  });

  test('pans with the first small drag, and back at once after overshooting an edge', async ({
    page,
  }) => {
    const first = await pan(page, -100);
    expect(first.end.x).toBeCloseTo(first.start.x, 0);
    expect((await viewBox(page))[0]).toBeGreaterThan(0);

    // Past the left edge, the board stops; the next drag the other way moves it straight away.
    await pan(page, 400);
    expect((await viewBox(page))[0]).toBe(0);
    const back = await pan(page, -100);
    expect(back.end.x).toBeCloseTo(back.start.x, 0);
  });

  test('keeps to the pointer where the screen is too short for its width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 });
    const box = (await page.locator('svg.board').boundingBox())!;
    const [, , width, height] = await viewBox(page);
    expect(box.width / box.height).toBeCloseTo(width! / height!, 2);

    const { start, end } = await pan(page, -100);
    expect(end.x).toBeCloseTo(start.x, 0);
  });

  test('zooms out with the wheel without scrolling the page, but not with a sideways swipe', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 560 });
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(scrollable).toBe(true);
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    await zoomIn.click();
    const [, , oneStep] = await viewBox(page);
    await zoomIn.click();
    const board = await centre(page.locator('svg.board'));
    await page.mouse.move(board.x, board.y);
    const scrollY = await page.evaluate(() => window.scrollY);

    // Scrolling down would scroll the page too, if the board didn't stop it.
    await page.mouse.wheel(100, 0);
    await page.mouse.wheel(0, 100);
    await expect.poll(async () => (await viewBox(page))[2]).toBeCloseTo(oneStep!, 5);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  /**
   * One finger pans the board from its middle, between rows e and f. `touch` sends that finger
   * (or another) a press on the bare board, or a move or lift on the window, `dx` pixels across;
   * `press` presses another finger on an element. `left` reads where the window has panned to.
   */
  async function fingers(page: Page) {
    const board = (await page.locator('svg.board').boundingBox())!;
    const x = board.x + board.width / 2;
    const y = (await centre(page.locator('[data-hole="e1"]'))).y + 20;
    const perPixel = await page
      .locator('svg.board')
      .evaluate((svg: SVGSVGElement) => 1 / svg.getScreenCTM()!.a);
    const send = (
      type: string,
      pointerId: number,
      selector: string | null,
      at: { x: number; y: number },
    ) =>
      page.evaluate(
        ({ type, pointerId, selector, at }) => {
          const target = selector ? document.querySelector(selector)! : window;
          const init = { bubbles: true, pointerId, pointerType: 'touch', isPrimary: false };
          target.dispatchEvent(new PointerEvent(type, { ...init, clientX: at.x, clientY: at.y }));
        },
        { type, pointerId, selector, at },
      );
    return {
      perPixel,
      touch: (type: string, pointerId: number, dx: number) =>
        send(type, pointerId, type === 'pointerdown' ? '.board-body' : null, { x: x + dx, y }),
      press: async (pointerId: number, selector: string) =>
        send('pointerdown', pointerId, selector, await centre(page.locator(selector))),
      left: async () => (await viewBox(page))[0]!,
      /** Lets React render what the events so far did. */
      rendered: () =>
        page.evaluate(
          () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
        ),
    };
  }

  test('follows only the finger that started a pan', async ({ page }) => {
    const { perPixel, touch, left, rendered } = await fingers(page);
    await touch('pointerdown', 11, 0);
    await touch('pointermove', 11, -100);
    await expect.poll(left).toBeCloseTo(100 * perPixel, 0);

    // A second finger pressing, moving and lifting neither drags the board nor ends the pan.
    await touch('pointerdown', 12, 50);
    await touch('pointermove', 12, 150);
    await rendered();
    expect(await left()).toBeCloseTo(100 * perPixel, 0);
    await touch('pointermove', 11, -150);
    await expect.poll(left).toBeCloseTo(150 * perPixel, 0);
    await touch('pointerup', 12, 150);
    await touch('pointermove', 11, -200);
    await expect.poll(left).toBeCloseTo(200 * perPixel, 0);
    await touch('pointerup', 11, -200);
  });

  test('keeps panning when a second finger presses a hole, a part or the tray', async ({
    page,
  }) => {
    await drag(page, page.locator('[data-tray="bulb"]'), await between(page, 'e5', 'e7'));
    const bulb = page.locator('.board .part-bulb:not(.part-ghost)');
    await expect(bulb).toHaveCount(1);
    const { perPixel, touch, press, left, rendered } = await fingers(page);
    await touch('pointerdown', 11, 0);
    await touch('pointermove', 11, -100);
    await expect.poll(left).toBeCloseTo(100 * perPixel, 0);

    for (const selector of [
      '[data-hole="e20"]',
      '[data-part]:has(.part-bulb)',
      '[data-tray="bulb"]',
    ]) {
      await press(12, selector);
      await rendered();
      expect(await left(), selector).toBeCloseTo(100 * perPixel, 0);
      await touch('pointerup', 12, 0);
    }
    await touch('pointermove', 11, -200);
    await expect.poll(left).toBeCloseTo(200 * perPixel, 0);
    await touch('pointerup', 11, -200);

    // Nothing was drawn, dropped or moved by the second finger.
    await expect(page.locator('.board .part-wire')).toHaveCount(0);
    await expect(bulb).toHaveCount(1);
    await expect(page.locator('[data-tray="bulb"]')).toContainText('×1');
  });

  test('holds the zoom while a pan is under way', async ({ page }) => {
    const { perPixel, touch, left, rendered } = await fingers(page);
    const [, , width] = await viewBox(page);
    await touch('pointerdown', 11, 0);
    await touch('pointermove', 11, -100);
    await expect.poll(left).toBeCloseTo(100 * perPixel, 0);

    await page.locator('svg.board').dispatchEvent('wheel', { deltaY: -100, cancelable: true });
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await rendered();
    expect((await viewBox(page))[2]).toBe(width);
    await touch('pointermove', 11, -200);
    await expect.poll(left).toBeCloseTo(200 * perPixel, 0);
    await touch('pointerup', 11, -200);
  });
});
