import { test, expect } from '@playwright/test';

async function selectNotes(page, notes) {
  for (const midi of notes) await page.locator(`[data-midi="${midi}"]`).tap();
}
async function openDiatonic(page, degree = 1) {
  await page.addInitScript((value) => { Math.random = () => value; }, (degree + 0.1) / 84);
  await page.goto('/');
  await page.locator('[data-mode="diatonic"]').tap();
}

for (const [degree, numeral, notes, symbol] of [
  [0, 'Ⅰ', [48, 52, 55, 59], 'Cmaj7'],
  [1, 'Ⅱ', [48, 50, 53, 57], 'Dm7'],
  [2, 'Ⅲ', [50, 52, 55, 59], 'Em7'],
  [3, 'Ⅳ', [48, 52, 53, 57], 'Fmaj7'],
  [4, 'Ⅴ', [50, 53, 55, 59], 'G7'],
  [5, 'Ⅵ', [48, 52, 55, 57], 'Am7'],
  [6, 'Ⅶ', [50, 53, 57, 59], 'Bm7♭5（Bø7）'],
]) {
  test(`C major degree ${numeral} accepts the seventh chord ${symbol}`, async ({ page }) => {
    await openDiatonic(page, degree);
    await expect(page.locator('#key-name')).toHaveText('C');
    await expect(page.locator('#degree-name')).toHaveText(numeral);
    await expect(page.locator('#diatonic-title')).toContainText('は？');
    await expect(page.locator('.lesson-number')).toHaveText('1 / 84');
    await expect(page.locator('.steps')).toBeHidden();
    await expect(page.locator('#confirm')).toBeHidden();
    await expect(page.locator('#quiz')).not.toContainText(symbol);
    await expect(page.locator('#grade')).toBeDisabled();
    await selectNotes(page, notes.slice(0, 3));
    await expect(page.locator('#grade')).toBeDisabled();
    await selectNotes(page, notes.slice(3));
    await expect(page.locator('#note-count')).toHaveText('4 / 4 音');
    await page.locator('#grade').tap();
    await expect(page.locator('#results')).toContainText('正解！');
    await expect(page.locator('.result-chord-title')).toContainText(symbol);
    await expect(page.locator('#results')).toContainText('4つの音を選べました');
  });
}

test('diatonic chord playback, wrong answer feedback, correction, retry and menu preservation', async ({ page }) => {
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
  await openDiatonic(page);
  await selectNotes(page, [48, 52, 55, 59]);
  await page.locator('#play').tap();
  await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(4);
  expect(await page.evaluate(() => new Set(window.startedNotes.map((note) => note.time)).size)).toBe(1);
  await page.locator('#grade').tap();
  await expect(page.locator('.is-incorrect .expected-notes')).toHaveText('正解：D · F · A · C');
  await page.locator('[data-listen="0"]').tap();
  await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(8);
  const voices = await page.evaluate(() => window.startedNotes.slice(4));
  expect(new Set(voices.map((note) => note.time)).size).toBe(1);
  expect(voices[0].frequency).toBeCloseTo(146.832, 2); // D3
  await page.locator('#clear').tap();
  await expect(page.locator('#results')).toBeHidden();
  await selectNotes(page, [48, 50, 53, 57]);
  await page.screenshot({ path: '/tmp/cadence-diatonic.png', fullPage: true });
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('正解！');
  await page.locator('#retry').tap();
  await expect(page.locator('#degree-name')).toHaveText('Ⅱ');
  await expect(page.locator('.lesson-number')).toHaveText('1 / 84');
  await expect(page.locator('#note-count')).toHaveText('0 / 4 音');
  await selectNotes(page, [48, 50, 53, 57]);
  await page.locator('#back-menu').tap();
  await page.locator('[data-mode="major"]').tap();
  await expect(page.locator('#note-count')).toHaveText('0 / 7 音');
  await page.locator('#back-menu').tap();
  await page.locator('[data-mode="diatonic"]').tap();
  await expect(page.locator('#note-count')).toHaveText('4 / 4 音');
  await expect(page.locator('#degree-name')).toHaveText('Ⅱ');
  await page.locator('#grade').tap();
  await page.locator('#next').tap();
  await expect(page.locator('.lesson-number')).toHaveText('2 / 84');
  await expect(page.locator('#degree-name')).toHaveText('Ⅲ');
  await expect(page.locator('#note-count')).toHaveText('0 / 4 音');
  await page.reload();
  await page.locator('[data-mode="diatonic"]').tap();
  await expect(page.locator('.lesson-number')).toHaveText('3 / 84');
  await expect(page.locator('#degree-name')).not.toHaveText('Ⅱ');
  await expect(page.locator('#degree-name')).not.toHaveText('Ⅲ');
});

test('84th question, enharmonic spelling, round restart and 320px layout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    Math.random = () => 0;
    localStorage.setItem('major-diatonic-progress-v1', JSON.stringify({ previous: 0, remaining: [83] }));
  });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-mode="diatonic"]').tap();
  await expect(page.locator('#key-name')).toHaveText('B');
  await expect(page.locator('#degree-name')).toHaveText('Ⅶ');
  await expect(page.locator('.lesson-number')).toHaveText('84 / 84');
  await selectNotes(page, [49, 52, 56, 58]);
  await page.locator('#grade').tap();
  await expect(page.locator('#round-results')).toBeVisible();
  await expect(page.locator('#round-correct-count')).toHaveText('1');
  await expect(page.locator('#round-unanswered-count')).toHaveText('83');
  await page.locator('.round-question[data-id="83"] > summary').tap();
  await expect(page.locator('.round-question[data-id="83"] .round-expected')).toHaveText('正解：A♯ · C♯ · E · G♯');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#round-restart').tap();
  await expect(page.locator('#key-name')).toHaveText('C');
  await expect(page.locator('#degree-name')).toHaveText('Ⅰ');
  await expect(page.locator('.lesson-number')).toHaveText('1 / 84');
});

test('diatonic quiz works offline and rejects duplicate or fifth notes', async ({ page, context }) => {
  await page.addInitScript(() => { Math.random = () => 1.1 / 84; });
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-mode="diatonic"]').tap();
  await selectNotes(page, [48, 50, 53, 60]);
  await expect(page.locator('#grade')).toBeDisabled();
  await expect(page.locator('#input-help')).toContainText('重複');
  await selectNotes(page, [57]);
  await expect(page.locator('#toast')).toContainText('4音まで');
  await expect(page.locator('.piano-key.selected')).toHaveCount(4);
  await selectNotes(page, [60, 57]);
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('正解！');
  await context.setOffline(false);
});
