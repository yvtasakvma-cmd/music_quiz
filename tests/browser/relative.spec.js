import { test, expect } from '@playwright/test';

async function openRelative(page, id = 0) {
  await page.addInitScript((value) => { Math.random = () => value; }, (id + 0.1) / 24);
  await page.goto('/');
  await page.locator('[data-mode="relative"]').tap();
}

for (const [id, source, sourceType, targetType, note, answer, octaves] of [
  [0, 'C', 'メジャー', '短調', 'A', 'Aマイナー', [57, 69]],
  [21, 'A', 'マイナー', '長調', 'C', 'Cメジャー', [48, 60]],
  [1, 'D♭', 'メジャー', '短調', 'B♭', 'B♭マイナー', [58, 70]],
  [20, 'G♯', 'マイナー', '長調', 'B', 'Bメジャー', [59, 71]],
]) {
  test(`${source} ${sourceType} relative ${targetType} accepts ${note} in either octave`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openRelative(page, id);
    await expect(page.locator('#key-name')).toHaveText(source);
    await expect(page.locator('.major-label')).toHaveText(`${sourceType}の`);
    await expect(page.locator('#relative-title')).toHaveText(`平行${targetType}は？`);
    await expect(page.locator('.lesson-number')).toHaveText('1 / 24');
    await expect(page.locator('#confirm')).toBeHidden();
    await expect(page.locator('.steps')).toBeHidden();
    await expect(page.locator('#grade')).toBeDisabled();
    expect(await page.locator('.piano-key').allTextContents()).toEqual(Array(24).fill(''));
    for (const midi of octaves) {
      await page.locator(`[data-midi="${midi}"]`).tap();
      await expect(page.locator('.piano-key.selected')).toHaveCount(1);
      await expect(page.locator('#note-count')).toHaveText('1 / 1 音');
      await page.locator('#grade').tap();
      await expect(page.locator('#results')).toContainText('正解！');
      await expect(page.locator('.result-chord-title')).toHaveText(answer);
      await expect(page.locator('.expected-notes')).toHaveText(`正解：${note}`);
      await page.locator('#retry').tap();
      await expect(page.locator('#key-name')).toHaveText(source);
      await expect(page.locator('#relative-title')).toHaveText(`平行${targetType}は？`);
      await expect(page.locator('.lesson-number')).toHaveText('1 / 24');
      await expect(page.locator('#grade')).toBeDisabled();
    }
    expect(errors).toEqual([]);
  });
}

test('single note toggle, replacement, audio, wrong feedback, menu state and non-repeating saved questions', async ({ page }) => {
  await page.addInitScript(() => {
    window.startedNotes = [];
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const oscillator = create.apply(this, args);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (time) => { window.startedNotes.push({ frequency: oscillator.frequency.value, time }); start(time); };
      return oscillator;
    };
  });
  await openRelative(page);
  await page.locator('[data-midi="57"]').tap();
  await page.locator('[data-midi="57"]').tap();
  await expect(page.locator('.piano-key.selected')).toHaveCount(0);
  await expect(page.locator('#grade')).toBeDisabled();
  await page.locator('[data-midi="48"]').tap();
  await page.locator('#play').tap();
  await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(1);
  await page.locator('#grade').tap();
  await expect(page.locator('.is-incorrect .expected-notes')).toHaveText('正解：A');
  await expect(page.locator('.your-notes')).toHaveText('回答：C');
  await page.locator('[data-listen="0"]').tap();
  await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(2);
  expect(await page.evaluate(() => window.startedNotes[1].frequency)).toBeCloseTo(220, 2);
  await page.locator('[data-midi="57"]').tap();
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('[data-midi="48"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.piano-key.selected')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/cadence-relative.png', fullPage: true });
  await page.locator('#back-menu').tap();
  await page.locator('[data-mode="diatonic"]').tap();
  await expect(page.locator('#note-count')).toHaveText('0 / 4 音');
  await page.locator('#back-menu').tap();
  await page.locator('[data-mode="relative"]').tap();
  await expect(page.locator('#note-count')).toHaveText('1 / 1 音');
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('正解！');
  await page.locator('#next').tap();
  await expect(page.locator('.lesson-number')).toHaveText('2 / 24');
  await expect(page.locator('#key-name')).toHaveText('D♭');
  await expect(page.locator('#note-count')).toHaveText('0 / 1 音');
  await page.reload();
  await page.locator('[data-mode="relative"]').tap();
  await expect(page.locator('.lesson-number')).toHaveText('3 / 24');
  await expect(page.locator('#key-name')).toHaveText('D');
});

test('24th question works offline on a 320px display and starts a new round', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    Math.random = () => 0;
    localStorage.setItem('relative-key-progress-v1', JSON.stringify({ previous: 0, remaining: [23] }));
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-mode="relative"]').tap();
  await expect(page.locator('#key-name')).toHaveText('B');
  await expect(page.locator('#relative-title')).toHaveText('平行長調は？');
  await expect(page.locator('.lesson-number')).toHaveText('24 / 24');
  await page.locator('[data-midi="50"]').tap();
  await page.locator('#grade').tap();
  await expect(page.locator('.result-chord-title')).toHaveText('Dメジャー');
  await expect(page.locator('#next')).toContainText('次の24問へ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#next').tap();
  await expect(page.locator('.lesson-number')).toHaveText('1 / 24');
  await expect(page.locator('#key-name')).toHaveText('C');
  await expect(page.locator('#relative-title')).toHaveText('平行短調は？');
  await context.setOffline(false);
});
