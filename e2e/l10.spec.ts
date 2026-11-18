import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

/** [start of the sentence, error type] for the eight seeded errors. */
const ERRORS: [string, string][] = [
  ['בשבוע משתתפים 48 לוחמים', 'מספר שלא קיים במקור'],
  ['יום רביעי, 13.3', 'תאריך ויום לא תואמים'],
  ['בסך הכול יחולקו 4,500 כדורים', 'חישוב שגוי'],
  ['אין לקיים אימון ירי כשהרוח עולה על 25 קמ״ש', 'ציטוט שלא קיים'],
  ['מפקד אימון הירי, סגן אורי כהן', 'תפקיד שגוי'],
  ['ביום שלישי הפלוגה נשארת כולה בבסיס', 'סתירה בין סעיפים'],
  ['הוכחו כיעילים בכל הפלוגות', 'הכללה בלי ביסוס'],
  ['נוהל ירי לילה פלוגתי', 'הפניה לא קיימת'],
];

async function toMark(page: Page) {
  await login(page, '/l10/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'תוכנית שמחכה לבדיקה');
  await expect(page.locator('.chat .bubble', { hasText: 'אל תתקן' })).toBeVisible({ timeout: 25_000 });
  await next(page);
  await expectStep(page, 'סמן משפטים חשודים');
}

async function markSentence(page: Page, part: string, type: string) {
  await page.locator('button.sentence', { hasText: part }).click();
  await page.getByRole('group', { name: 'סוג הטעות במשפט שסימנת' }).getByRole('button', { name: type, exact: true }).click();
}

test('L10 end to end: eight errors found and typed, key, return for correction, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toMark(page);
  await expectNoHorizontalScroll(page);

  // The key stays closed until the cadet finishes.
  await expect(page.getByText('למה זו טעות')).toHaveCount(0);
  await page.locator('details.race-doc summary').click();
  await expect(page.getByText('קצין הבטיחות של הפלוגה: סגן אורי כהן')).toBeVisible();

  for (const [part, type] of ERRORS) await markSentence(page, part, type);
  await expect(page.locator('.result-sum').first()).toContainText('סימנת 8 משפטים');
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'סיימתי, הצג מפתח' }).click();

  await expect(page.locator('.result-sum').last()).toContainText('נתפסו 8 מתוך 8');
  await expect(page.locator('.result-sum').last()).toContainText('סימונים שגויים: 0');
  await expect(page.locator('.key-item')).toHaveCount(8);
  await expect(page.locator('.key-item .status-ok')).toHaveCount(8);
  // Marks lock after the key opens.
  await page.locator('button.sentence', { hasText: 'התוכנית נשלחת לאישור' }).click();
  await expect(page.locator('.result-sum').first()).toContainText('סימנת 8 משפטים');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה עושים עם מה שמצאת');
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'העתק', exact: true })).toBeVisible();
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L10' && e.score === 100)).toBe(true);
});

test('L10 either half of the contradiction counts, a clean sentence marked is a false mark, a missed error is shown', async ({ page }) => {
  await mockTracking(page);
  await toMark(page);
  // The first half of the contradiction, with a different type than the key.
  await markSentence(page, 'אימון ניווט לילה בשטח', 'סתירה בין סעיפים');
  // A clean sentence, then unmark it again: it must not count.
  await markSentence(page, 'חובש הפלוגה, סמל נועם ברק', 'תפקיד שגוי');
  await page.locator('button.sentence', { hasText: 'חובש הפלוגה, סמל נועם ברק' }).click();
  await page.getByRole('button', { name: 'בטל סימון' }).click();
  await expect(page.locator('.result-sum').first()).toContainText('סימנת 1 משפטים');
  // A clean sentence that stays marked.
  await markSentence(page, 'קצין הלוגיסטיקה של הפלוגה', 'תפקיד שגוי');
  await page.getByRole('button', { name: 'סיימתי, הצג מפתח' }).click();

  await expect(page.locator('.result-sum').last()).toContainText('נתפסו 1 מתוך 8');
  await expect(page.locator('.result-sum').last()).toContainText('סימונים שגויים: 1');
  await expect(page.locator('.key-item .status-ok')).toHaveCount(1);
  await expect(page.locator('.key-item .status-bad')).toHaveCount(7);
  await expect(page.locator('button.sentence', { hasText: 'קצין הלוגיסטיקה של הפלוגה' }).locator('xpath=..')).toContainText('סומן בטעות');
  await expect(page.locator('button.sentence', { hasText: 'ביום שלישי הפלוגה נשארת' }).locator('xpath=..')).toContainText('נספר כנתפס דרך המשפט האחר');
  await expect(page.locator('button.sentence', { hasText: 'בשבוע משתתפים 48' }).locator('xpath=..')).toContainText('פוספס');
});

test('L10 six right with at most one false mark passes at 75', async ({ page }) => {
  const events = await mockTracking(page);
  await toMark(page);
  for (const [part, type] of ERRORS.slice(0, 6)) await markSentence(page, part, type);
  await markSentence(page, 'התוכנית נשלחת לאישור', 'חישוב שגוי');
  await page.getByRole('button', { name: 'סיימתי, הצג מפתח' }).click();
  await next(page);
  await next(page);
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  // 60·6/8 + 20·6/8 + 20·6/8 = 75
  await expect(page.locator('.score-big .clock')).toHaveText('75%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L10' && e.score === 75)).toBe(true);
});
