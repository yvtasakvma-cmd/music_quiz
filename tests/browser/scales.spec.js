import { test, expect } from '@playwright/test';
import { KEYS, MINOR_KEYS, majorScale, naturalMinorScale } from '../../src/music.js';

async function selectNotes(page, notes) {
  for (const midi of notes) await page.locator(`[data-midi="${midi}"]`).tap();
}
async function monitorAudio(page) {
  await page.addInitScript(() => {
    window.startedNotes = [];
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const oscillator = create.apply(this, args);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (time) => {
        window.startedNotes.push({ frequency: oscillator.frequency.value, time, state: this.state });
        start(time);
      };
      return oscillator;
    };
  });
}

test('opening shows the menu; quiz inputs and histories stay separate when switching', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('今日は');
  await expect(page.locator('#quiz')).toBeHidden();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.screenshot({ path: '/tmp/cadence-menu.png', fullPage: true });
  for (const [mode, notes] of [['cadence', [50, 53]], ['major', [48]], ['minor', [51]]]) {
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('.lesson-number')).toHaveText('1 / 12');
    await selectNotes(page, notes);
    await page.locator('#back-menu').tap();
  }
  for (const [mode, count] of [['cadence', 2], ['major', 1], ['minor', 1]]) {
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('.piano-key.selected')).toHaveCount(count);
    await expect(page.locator('.lesson-number')).toHaveText('1 / 12');
    await page.locator('#back-menu').tap();
  }
  await page.reload();
  await expect(page.locator('#menu')).toBeVisible();
  for (const mode of ['cadence', 'major', 'minor']) {
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('.lesson-number')).toHaveText('2 / 12');
    await expect(page.locator('#key-name')).not.toHaveText('C');
    await expect(page.locator('.piano-key.selected')).toHaveCount(0);
    await page.locator('#back-menu').tap();
  }
});

for (const [mode, random, notes, root, expectedText] of [
  ['major', 0, [48, 50, 52, 53, 55, 57, 59], 'C', 'C · D · E · F · G · A · B'],
  ['minor', 9.1 / 12, [57, 59, 60, 62, 64, 65, 67], 'A', 'A · B · C · D · E · F · G'],
]) {
  test(`${mode} scale: select seven notes, sequential audio, grade, edit, retry and next`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((value) => { Math.random = () => value; }, random);
    await monitorAudio(page);
    await page.goto('/');
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('#key-name')).toHaveText(root);
    await expect(page.locator('#scale-title')).toContainText(mode === 'major' ? 'メジャー' : 'マイナー');
    await expect(page.locator('.steps')).toBeHidden();
    await expect(page.locator('#confirm')).toBeHidden();
    await expect(page.locator('select')).toHaveCount(0);
    await expect(page.locator('#grade')).toBeDisabled();
    expect(await page.locator('.piano-key').allTextContents()).toEqual(Array(24).fill(''));
    await selectNotes(page, notes.slice(0, 6));
    await expect(page.locator('#grade')).toBeDisabled();
    await selectNotes(page, notes.slice(6));
    await expect(page.locator('#note-count')).toHaveText('7 / 7 音');
    await expect(page.locator('#grade')).toBeEnabled();
    await page.locator('#play').tap();
    await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(7);
    const voices = await page.evaluate(() => window.startedNotes);
    for (let index = 1; index < voices.length; index++) {
      expect(voices[index].frequency).toBeGreaterThan(voices[index - 1].frequency);
      expect(voices[index].time - voices[index - 1].time).toBeCloseTo(0.3, 5);
    }
    expect(voices.every((voice) => voice.state === 'running')).toBe(true);
    await page.screenshot({ path: `/tmp/cadence-scale-${mode}.png`, fullPage: true });
    await page.locator('#grade').tap();
    await expect(page.locator('#results')).toContainText('正解！');
    await expect(page.locator('.expected-notes')).toHaveText(`正解：${expectedText}`);
    await page.locator('[data-listen="0"]').tap();
    await expect.poll(() => page.evaluate(() => window.startedNotes.length)).toBe(15); // seven tones + ending tonic
    await page.locator(`[data-midi="${notes[6]}"]`).tap();
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#grade')).toBeDisabled();
    await selectNotes(page, [notes[6] - 1]);
    await page.locator('#grade').tap();
    await expect(page.locator('.is-incorrect')).toBeVisible();
    await expect(page.locator('.your-notes')).toBeVisible();
    await page.locator('#retry').tap();
    await expect(page.locator('#key-name')).toHaveText(root);
    await expect(page.locator('.lesson-number')).toHaveText('1 / 12');
    await expect(page.locator('#note-count')).toHaveText('0 / 7 音');
    await selectNotes(page, notes);
    await page.locator('#grade').tap();
    await page.locator('#next').tap();
    await expect(page.locator('#key-name')).not.toHaveText(root);
    await expect(page.locator('.lesson-number')).toHaveText('2 / 12');
    expect(errors).toEqual([]);
  });
}

test('scale on 320px has no overflow; octave duplicates and eighth notes cannot be submitted', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => { Math.random = () => 1.1 / 12; });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-mode="minor"]').tap();
  await expect(page.locator('#key-name')).toHaveText('C♯');
  await selectNotes(page, [49, 51, 52, 54, 56, 57, 61]); // two C-sharps
  await expect(page.locator('#input-help')).toContainText('重複');
  await expect(page.locator('#grade')).toBeDisabled();
  await selectNotes(page, [59]);
  await expect(page.locator('#toast')).toContainText('7音まで');
  await expect(page.locator('.piano-key.selected')).toHaveCount(7);
  await selectNotes(page, [61, 59]);
  await expect(page.locator('#grade')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#grade').tap();
  await expect(page.locator('#results')).toContainText('正解！');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('offline reload opens menu and both scale quizzes remain fully usable', async ({ page, context }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#menu')).toBeVisible();
  for (const [mode, keys, scale] of [['major', KEYS, majorScale], ['minor', MINOR_KEYS, naturalMinorScale]]) {
    await page.locator(`[data-mode="${mode}"]`).tap();
    const notes = scale(keys[0]).map((note) => 48 + note.pitch);
    await selectNotes(page, notes);
    await page.locator('#grade').tap();
    await expect(page.locator('#results')).toContainText('正解！');
    await page.locator('#back-menu').tap();
  }
  await context.setOffline(false);
});
