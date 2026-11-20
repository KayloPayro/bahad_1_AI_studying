import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

/** The correct option of each of the five questions, by position. */
const ANSWERS = [1, 2, 0, 1, 2];

async function toQuiz(page: import('@playwright/test').Page) {
  await login(page, '/l00/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'פותחים כלי ושולחים הודעה ראשונה');
  await expect(page.locator('.tool-guide')).toBeVisible();
  await expect(page.locator('.snippet-text')).toContainText('דף החלטה');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'שואלים על דבר שלא סיפרו לכלי');
  await expect(page.locator('.snippet-text')).toContainText('פלוגה ג׳');
  await expect(page.getByText('זה ניחוש ולא מידע')).toBeVisible();
  await next(page);

  await expectStep(page, 'מי הכלים ובמה הם שונים');
  for (const topic of ['מה זה כלי AI', 'ChatGPT, Claude, Gemini', 'NotebookLM', 'כלי מחובר לאפליקציות', 'מה הכלי עלול לעשות', 'מה בהמשך']) {
    await page.locator('.flip', { hasText: topic }).first().click();
  }
  await next(page);

  await expectStep(page, 'בודקים שהבנת');
}

test('L00 end to end: open a tool, ask, read the cards, answer five questions, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toQuiz(page);

  await expect(page.getByRole('button', { name: 'בדוק תשובות' })).toBeDisabled();
  const qs = page.locator('fieldset');
  await expect(qs).toHaveCount(5);
  for (let i = 0; i < ANSWERS.length; i++) await qs.nth(i).getByRole('radio').nth(ANSWERS[i]!).check();
  await page.getByRole('button', { name: 'בדוק תשובות' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await next(page);

  await expectStep(page, 'לפני שעוברים ללומדה 1');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L00' && e.score === 100)).toBe(true);
});

test('L00 four of five is the pass line, three of five is not', async ({ page }) => {
  await mockTracking(page);
  await toQuiz(page);
  const qs = page.locator('fieldset');
  // Wrong on the last two questions.
  for (let i = 0; i < 3; i++) await qs.nth(i).getByRole('radio').nth(ANSWERS[i]!).check();
  await qs.nth(3).getByRole('radio').first().check();
  await qs.nth(4).getByRole('radio').first().check();
  await page.getByRole('button', { name: 'בדוק תשובות' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 5');
  await expect(page.locator('.quiz-result .status-bad').first()).toBeVisible();
  await next(page);
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('60%');
  await expect(page.getByText('חוזרים על המבוא')).toBeVisible();
});
