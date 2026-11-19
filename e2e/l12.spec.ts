import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

async function startShift(page: Page) {
  await login(page, '/l12/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'המשמרת בחמ״ל');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await expect(page.locator('.chat .bubble', { hasText: 'מחר ב-06:00 הפלוגה יוצאת' })).toBeVisible({ timeout: 15_000 });
}

test('L12 end to end: shift, interim update, final brief with checks, review, score', async ({ page }) => {
  const events = await mockTracking(page);
  await startShift(page);
  await expectNoHorizontalScroll(page);

  // Interim update: the check shows two lines and a state; then it is handed in.
  await page.getByRole('button', { name: 'עדכון ביניים לדוגמה' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(2);
  await page.getByRole('button', { name: 'הגש עדכון ביניים' }).click();
  await expect(page.getByText('בתוך הזמן.').first()).toBeVisible();
  await expect(page.getByLabel('העדכון שלך')).toHaveAttribute('readonly', '');

  // Final brief: five automatic checks pass, three need the cadet's own reading.
  await expect(page.getByRole('button', { name: 'העתק את כל ההודעות עד כה' })).toBeVisible();
  await page.getByRole('button', { name: 'תדריך סופי לדוגמה' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(5); // interim box hides after submit: only the final list counts
  await page.getByRole('button', { name: 'בדוק מספרים מול ההודעות' }).click();
  await expect(page.locator('.flag-ok, .flag-derived, .flag-warn').first()).toBeVisible();
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await expect(page.locator('.result-sum').filter({ hasText: 'סומנו' })).toContainText('8 מתוך 8');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'הגש תדריך סופי' }).click();
  await expect(page.getByText('התדריך הוגש אחרי')).toBeVisible();
  await expect(page.getByLabel('התדריך שלך')).toHaveAttribute('readonly', '');
  await next(page);

  await expectStep(page, 'מה היה בתדריך');
  await expect(page.locator('.matrix-row')).toHaveCount(6);
  // The time row is information only, so it is not marked as met or missed.
  await expect(page.locator('.matrix-row .status-ok')).toHaveCount(5);
  await expect(page.locator('.matrix-row', { hasText: 'זמן כולל' }).locator('.status')).toContainText('דקות');
  await expect(page.locator('.matrix-row', { hasText: 'זמן כולל' })).toContainText('לא נכנס לציון');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'תחקיר');
  await next(page);
  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L12' && e.score === 100)).toBe(true);
});

test('L12 a brief that keeps the old number and misses the pattern, and one that is never handed in', async ({ page }) => {
  const events = await mockTracking(page);
  await startShift(page);
  await page.getByLabel('העדכון שלך').fill('שורה ראשונה\nשורה שנייה\nשורה שלישית');
  await page.getByRole('button', { name: 'בדוק עדכון' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(1);
  await page.getByRole('button', { name: 'הגש עדכון ביניים' }).click();

  await page.getByLabel('התדריך שלך').fill('המלצה: יוצאים. 36 לוחמים כשירים. לוודא את הקשר, אחראי: קצין הקשר.');
  await page.getByRole('button', { name: 'בדוק מול הדרישות' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(3); // the three conditions, the pattern and the 34
  // Not handed in: nothing of the brief counts.
  await next(page);
  await expectStep(page, 'מה היה בתדריך');
  await expect(page.locator('.matrix-row .status-na').first()).toBeVisible();
  await next(page);
  await next(page);
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  // Only the interim update counts: one of its two checks, which is half of 15 (7.5, shown as 8).
  await expect(page.locator('.score-big .clock')).toHaveText('8%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L12' && e.score === 8)).toBe(true);
});

test('L12 instructor can show all messages: the correction replaces the 36', async ({ page }) => {
  await mockTracking(page);
  await startShift(page);
  const sw = page.getByRole('switch', { name: 'מצב מדריך' });
  await sw.click();
  await page.getByLabel('קוד מדריך').fill('bahad1');
  await page.getByRole('button', { name: 'פתח' }).click();
  await page.getByRole('button', { name: 'כל ההודעות עכשיו' }).click();
  await expect(page.locator('.chat .bubble')).toHaveCount(12);
  await expect(page.locator('.chat .bubble.is-replaced')).toContainText('36 לוחמים כשירים');
  await expect(page.locator('.chat .bubble.is-correction')).toContainText('34 ולא 36');
  await expect(page.locator('.chat .bubble', { hasText: 'צוער ר׳' })).toHaveCount(4);
});
