import { test, expect } from '@playwright/test';
import { QUIZ_MODES, questionFor } from '../../src/quiz.js';
import { KEYS, majorScale } from '../../src/music.js';

const answersFor = (mode, id) => questionFor(mode, id).items.map((item) => item.pitches.map((pitch) => 48 + pitch));
async function answer(page, mode, answers) {
  for (const notes of answers) {
    for (const midi of notes) await page.locator(`[data-midi="${midi}"]`).tap();
    if (mode === 'cadence') await page.locator('#confirm').tap();
  }
  await page.locator('#grade').tap();
}
function seedRound(mode, unanswered = false) {
  const config = QUIZ_MODES[mode];
  const total = config.total || 12;
  const outcomes = Array.from({ length: total - 1 }, (_, id) => ({ id, answers: answersFor(mode, id) }));
  const first = questionFor(mode, 0).items[0];
  outcomes[0].answers[0][0] = 48 + Array.from({ length: 12 }, (_, pitch) => pitch).find((pitch) => !first.pitches.includes(pitch));
  if (unanswered) outcomes.splice(1, 1);
  return { storage: config.storage, progress: { previous: 0, remaining: [total - 1], outcomes }, total };
}

for (const mode of Object.keys(QUIZ_MODES)) {
  test(`${mode}: round groups, answer review, saved results, menu and explicit restart`, async ({ page, context }) => {
    test.setTimeout(60000);
    const seed = seedRound(mode);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(({ storage, progress }) => {
      Math.random = () => 0;
      if (!sessionStorage.getItem('round-seeded')) {
        localStorage.setItem(storage, JSON.stringify(progress));
        sessionStorage.setItem('round-seeded', '1');
      }
    }, seed);
    await page.goto('/');
    if (mode === 'relative') {
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      });
      await context.setOffline(true);
    }
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('.lesson-number')).toHaveText(`${seed.total} / ${seed.total}`);
    await answer(page, mode, answersFor(mode, seed.total - 1));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('一周おつかれさま！');
    await expect(page.locator('#quiz')).toBeHidden();
    await expect(page.locator('#round-correct-count')).toHaveText(String(seed.total - 1));
    await expect(page.locator('#round-incorrect-count')).toHaveText('1');
    await expect(page.locator('#round-unanswered-count')).toHaveText('0');
    await expect(page.locator('.round-question[data-status="correct"]')).toHaveCount(seed.total - 1);
    await expect(page.locator('.round-question[data-status="incorrect"]')).toHaveCount(1);
    const wrong = page.locator('.round-question[data-id="0"]');
    await wrong.locator('summary').tap();
    await expect(wrong.locator('.round-submitted').first()).toContainText('初回の回答：');
    await expect(wrong.locator('.round-expected').first()).toHaveText(`正解：${questionFor(mode, 0).items[0].notes.join(' · ')}`);
    if (mode === 'cadence') {
      await expect(wrong.locator('.round-score')).toHaveText('2/3');
      await expect(wrong.locator('.round-item-status')).toHaveText(['不正解', '正解', '正解']);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (mode === 'major') await page.screenshot({ path: '/tmp/cadence-round-results.png', fullPage: true });
    await page.locator('#round-menu').tap();
    await expect(page.locator('#menu')).toBeVisible();
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('#round-results')).toBeVisible();
    await page.reload();
    await page.locator(`[data-mode="${mode}"]`).tap();
    await expect(page.locator('#round-results')).toBeVisible();
    await expect(page.locator('#round-correct-count')).toHaveText(String(seed.total - 1));
    await expect(page.locator('#round-incorrect-count')).toHaveText('1');
    await page.locator('#round-restart').tap();
    await expect(page.locator('#round-results')).toBeHidden();
    await expect(page.locator('#quiz')).toBeVisible();
    await expect(page.locator('.lesson-number')).toHaveText(`1 / ${seed.total}`);
    await expect(page.locator('.piano-key.selected')).toHaveCount(0);
    const progress = await page.evaluate((storage) => JSON.parse(localStorage.getItem(storage)), seed.storage);
    expect(progress.outcomes).toEqual([]);
    expect(progress.completed).toBe(false);
    expect(progress.remaining.length).toBe(seed.total - 1);
    await context.setOffline(false);
  });
}

test('an actual full round retains the first wrong answer even after a correct retry', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await page.locator('[data-mode="major"]').tap();
  await answer(page, 'major', [[48, 50, 51, 53, 55, 57, 59]]);
  await expect(page.locator('.is-incorrect')).toBeVisible();
  await page.locator('#retry').tap();
  await answer(page, 'major', answersFor('major', 0));
  await expect(page.locator('#results')).toContainText('正解！');
  await page.locator('#next').tap();
  for (let index = 1; index < 12; index++) {
    const name = await page.locator('#key-name').textContent();
    const key = KEYS.find((key) => key.name === name);
    await answer(page, 'major', [majorScale(key).map((note) => 48 + note.pitch)]);
    if (index < 11) await page.locator('#next').tap();
  }
  await expect(page.locator('#round-correct-count')).toHaveText('11');
  await expect(page.locator('#round-incorrect-count')).toHaveText('1');
  await expect(page.locator('#round-unanswered-count')).toHaveText('0');
  const first = page.locator('.round-question[data-id="0"]');
  await expect(first).toHaveAttribute('data-status', 'incorrect');
  await first.locator('summary').tap();
  await expect(first.locator('.round-submitted')).toContainText('D♯');
  await expect(first.locator('.round-expected')).toHaveText('正解：C · D · E · F · G · A · B');
  const outcomes = await page.evaluate(() => JSON.parse(localStorage.getItem('scale-major-key-progress-v1')).outcomes);
  expect(outcomes.length).toBe(12);
  expect(outcomes[0].answers).toEqual([[48, 50, 51, 53, 55, 57, 59]]);
});

test('reopening the unanswered last question resumes it rather than erasing the round', async ({ page }) => {
  const outcomes = Array.from({ length: 11 }, (_, id) => ({ id, answers: answersFor('major', id) }));
  await page.addInitScript((outcomes) => {
    Math.random = () => 0;
    if (!sessionStorage.getItem('round-seeded')) {
      localStorage.setItem('scale-major-key-progress-v1', JSON.stringify({ previous: 11, remaining: [], outcomes, completed: false }));
      sessionStorage.setItem('round-seeded', '1');
    }
  }, outcomes);
  await page.goto('/');
  await page.locator('[data-mode="major"]').tap();
  await expect(page.locator('#key-name')).toHaveText('B');
  await expect(page.locator('.lesson-number')).toHaveText('12 / 12');
  await page.reload();
  await page.locator('[data-mode="major"]').tap();
  await expect(page.locator('#key-name')).toHaveText('B');
  await expect(page.locator('#round-results')).toBeHidden();
  await answer(page, 'major', answersFor('major', 11));
  await expect(page.locator('#round-correct-count')).toHaveText('12');
  await expect(page.locator('#round-incorrect-count')).toHaveText('0');
  await expect(page.locator('#round-unanswered-count')).toHaveText('0');
});
