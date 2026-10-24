import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 1.1 / 12; });
});

async function selectNotes(page, notes) {
  for (const midi of notes) await page.locator(`[data-midi="${midi}"]`).tap();
}

async function submitChord(page, notes) {
  await selectNotes(page, notes);
  await page.getByRole('button', { name: 'OK', exact: true }).tap();
}

test('portrait layout, toggle, simultaneous playback and answer confirmation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.startedNotes = [];
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const oscillator = original.apply(this, args);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (time) => {
        window.startedNotes.push({ frequency: oscillator.frequency.value, time, state: this.state });
        start(time);
      };
      return oscillator;
    };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('D♭');
  await expect(page.locator('.piano-key')).toHaveCount(24);
  await expect(page.locator('#grade')).toBeDisabled();
  await expect(page.locator('#play')).toBeDisabled();
  const first = page.locator('[data-midi="51"]');
  await first.tap();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await first.tap();
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await selectNotes(page, [51, 54, 58, 61]);
  await page.locator('#play').tap();
  await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(4);
  const voices = await page.evaluate(() => window.startedNotes);
  expect(new Set(voices.map((voice) => voice.time)).size).toBe(1);
  expect(voices.every((voice) => voice.state === 'running')).toBe(true);
  expect(voices[0].frequency).toBeCloseTo(155.563, 2);
  await page.screenshot({ path: '/tmp/cadence-iphone.png', fullPage: true });
  await page.locator('#confirm').tap();
  await expect(page.locator('[data-step="0"]')).toHaveClass(/answered/);
  await expect(page.locator('[data-step="1"]')).toHaveClass(/active/);
  await expect(page.locator('#note-count')).toHaveText('0 / 4 音');
  await page.locator('[data-step="0"]').tap();
  await expect(page.locator('.piano-key.selected')).toHaveCount(4);
  await first.tap();
  await expect(page.locator('[data-step="0"]')).not.toHaveClass(/answered/);
  await expect(page.locator('#confirm')).toBeDisabled();
  await first.tap();
  await page.locator('#confirm').tap();
  await expect(page.locator('[data-step="1"]')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test('three chords are graded, answer audio works, retry and next question reset state', async ({ page }) => {
  await page.goto('/');
  await submitChord(page, [51, 54, 58, 61]);
  await submitChord(page, [48, 51, 54, 56]);
  await expect(page.locator('#grade')).toBeDisabled();
  await submitChord(page, [48, 49, 53, 56]);
  await expect(page.locator('.step.answered')).toHaveCount(3);
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('すべて正解！');
  await expect(page.locator('.result-chord.is-correct')).toHaveCount(3);
  await expect(page.locator('#results')).toContainText('E♭m7');
  await page.locator('[data-listen="0"]').tap();
  await expect(page.locator('#toast')).not.toHaveText(/再生できません/);
  await page.locator('#retry').tap();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('.step.answered')).toHaveCount(0);
  await expect(page.locator('#key-name')).toHaveText('D♭');
  await submitChord(page, [51, 54, 58, 61]);
  await submitChord(page, [48, 51, 54, 56]);
  await submitChord(page, [48, 49, 53, 56]);
  await page.locator('#grade').tap();
  await page.locator('#next').tap();
  await expect(page.locator('#key-name')).not.toHaveText('D♭');
  await expect(page.locator('#grade')).toBeDisabled();
  await expect(page.locator('.piano-key.selected')).toHaveCount(0);
});

test('incorrect chords show expected notes and editing invalidates the grade', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await submitChord(page, [48, 52, 55, 59]); // Incorrect ii: Cmaj7 instead of Dm7
  await submitChord(page, [50, 53, 55, 59]); // Correct V: G7, inverted
  await submitChord(page, [48, 52, 55, 59]); // Correct I: Cmaj7
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('2 / 3 コード正解');
  await expect(page.locator('.is-incorrect .expected-notes')).toHaveText('正解：D · F · A · C');
  await expect(page.locator('.is-incorrect .your-notes')).toHaveText('回答：C · E · G · B');
  await page.locator('[data-step="0"]').tap();
  await page.locator('#clear').tap();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#grade')).toBeDisabled();
  await submitChord(page, [48, 50, 53, 57]);
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('すべて正解！');
});

test('duplicate pitch classes cannot be confirmed, and fifth notes are rejected', async ({ page }) => {
  await page.goto('/');
  await selectNotes(page, [48, 52, 55, 60]);
  await expect(page.locator('#input-help')).toContainText('重複');
  await expect(page.locator('#confirm')).toBeDisabled();
  await page.locator('[data-midi="59"]').tap();
  await expect(page.locator('.piano-key.selected')).toHaveCount(4);
  await expect(page.locator('#toast')).toContainText('4音まで');
  await page.locator('[data-midi="60"]').tap();
  await page.locator('[data-midi="59"]').tap();
  await expect(page.locator('#confirm')).toBeEnabled();
});

test('320px iPhone layout has no horizontal overflow and all controls are reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const keyboard = await page.locator('#keyboard').boundingBox();
  expect(keyboard.x).toBeGreaterThanOrEqual(0);
  expect(keyboard.x + keyboard.width).toBeLessThanOrEqual(320);
  await selectNotes(page, [51, 54, 58, 61]);
  await expect(page.locator('#confirm')).toBeEnabled();
  await page.locator('#confirm').tap();
  await expect(page.locator('.step.answered')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('PWA precaches and runs a complete quiz after an offline reload', async ({ page, context, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await page.evaluate(() => localStorage.clear());
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('D♭');
  await submitChord(page, [51, 54, 58, 61]);
  await submitChord(page, [48, 51, 54, 56]);
  await submitChord(page, [48, 49, 53, 56]);
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('すべて正解！');
  await context.setOffline(false);
});

test('quiz has no key picker and never repeats a key before completing the round, including after reload', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('select')).toHaveCount(0);
  const seen = new Set([await page.locator('#key-name').textContent()]);
  await page.reload();
  for (let question = 2; question <= 12; question++) {
    const name = await page.locator('#key-name').textContent();
    expect(seen.has(name)).toBe(false);
    seen.add(name);
    await expect(page.locator('.lesson-number')).toHaveText(`${question} / 12`);
    for (let chord = 0; chord < 3; chord++) await submitChord(page, [48, 52, 55, 59]);
    await page.locator('#grade').tap();
    if (question === 12) await expect(page.locator('#next')).toContainText('次の12問へ');
    await page.locator('#next').tap();
    if (question === 12) {
      await expect(page.locator('.lesson-number')).toHaveText('1 / 12');
      await expect(page.locator('#key-name')).not.toHaveText(name);
    }
  }
  expect(seen.size).toBe(12);
});
