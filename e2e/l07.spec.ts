import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

async function toFinal(page: Page) {
  await login(page, '/l07/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעות בוקר מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'שעה שקטה לכתיבה בלי הפרעות' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'רשימת המשימות והפגישות');
  await next(page);

  await expectStep(page, 'תוכנית ראשונה');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await expect(page.getByLabel('לצרף את רשימת המשימות והפגישות בהעתקה')).toBeChecked();
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה הכלי החזיר');
  await page.getByRole('button', { name: 'תוצר לדוגמה: תוכנית ראשונה' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  await expectStep(page, 'שיבוש ראשון: המג״ד מגיע');
  await expect(page.locator('.chat .bubble', { hasText: 'המג״ד מגיע היום ב-14:00' })).toBeVisible({ timeout: 10_000 });
  // The update goes into the conversation that is already open.
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'טען עדכון לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  await expectStep(page, 'שיבוש שני: ביטול ומשימת בטיחות');
  await expect(page.locator('.chat .bubble', { hasText: 'תקלה בבלמים' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'טען עדכון לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'התוכנית הסופית');
}

test('L07 end to end: priorities, two updates in one conversation, final plan, comparison, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toFinal(page);
  await page.getByRole('button', { name: 'תוצר לדוגמה: תוכנית סופית' }).click();
  await page.locator('.check.is-manual input').check();
  await expect(page.locator('.result-sum')).toContainText('7 מתוך 7');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'השוואה להצעה אחת אפשרית');
  await expect(page.locator('.matrix-row')).toHaveCount(15);
  await expect(page.locator('.result-sum')).toContainText('10 מתוך 10');
  await expect(page.locator('.result-sum')).toContainText('הוזזו: 0');
  await expect(page.locator('.matrix-row', { hasText: 'שיחה אישית עם גלעד' }).locator('.status')).toHaveText(['נשאר במקומו']);
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L07' && e.score === 100)).toBe(true);
});

test('L07 comparison marks a fixed item the plan moved', async ({ page }) => {
  await mockTracking(page);
  await toFinal(page);
  await page.getByLabel('התוכנית הסופית שקיבלת מהכלי').fill(
    '| 07:00 עד 08:00 | שעה שקטה |\n| 08:00 עד 08:30 | בדיקת הבלמים |\n| 10:00 עד 10:30 | שיחה אישית עם גלעד |',
  );
  await page.getByRole('button', { name: 'בדוק מול הדרישות' }).click();
  await next(page);
  await expectStep(page, 'השוואה להצעה אחת אפשרית');
  const row = page.locator('.matrix-row', { hasText: 'שיחה אישית עם גלעד' });
  await expect(row.locator('.status')).toHaveText(['הוזז ל-10:00']);
  await expect(page.locator('.matrix-row', { hasText: 'שעה שקטה' }).locator('.status')).toHaveText(['נשאר במקומו']);
  await expect(page.locator('.matrix-row', { hasText: 'תדריך בוקר' }).locator('.status')).toHaveText(['לא נמצא בתוכנית']);
  await expect(page.locator('.result-sum')).toContainText('הוזזו: 1');
});
