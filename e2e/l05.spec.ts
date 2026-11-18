import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

const OPTIONS = {
  nohal: 'נוהל התפעול',
  tech: 'המדריך הטכני',
  probe: 'סיכום התחקיר',
  conflict: 'שני מקורות או יותר, והם לא מסכימים',
  none: 'אף מקור לא עונה',
};

const ANSWERS: [string, string][] = [
  ['מה זמן החימום של החיישן התרמי?', OPTIONS.conflict],
  ['מה מהירות הרוח המרבית לפריסת התורן?', OPTIONS.tech],
  ['מי רשאי להפעיל את המערכת?', OPTIONS.nohal],
  ['מה הייתה התקלה בתרגיל הפלוגתי', OPTIONS.probe],
  ['האם חובה לכייל את החיישן לפני כל הפעלה?', OPTIONS.conflict],
  ['האם מותר להפעיל את המערכת בלילה', OPTIONS.none],
];

test('L05 end to end: no sources, notebook, six sourced answers, learning page, from memory, score', async ({ page }) => {
  const events = await mockTracking(page);
  await login(page, '/l05/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעה מהסמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'אם אין תשובה במסמכים' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'הניסיון הראשון: שואלים בלי מסמכים');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await page.getByRole('button', { name: 'תוצר לדוגמה: הכלי נקב במספר' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(1);
  await page.getByRole('button', { name: 'תוצר לדוגמה: הכלי לא מכיר' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(0);
  await next(page);

  await expectStep(page, 'מחברת עם ארבעת המסמכים');
  await expect(page.locator('a[download]')).toHaveCount(4);
  await expect(page.locator('details.race-doc')).toHaveCount(4);
  await page.locator('details.race-doc summary').first().click();
  await expect(page.getByText('מפעיל מוסמך הוא מי שסיים הדרכה').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'notebooklm.google.com' })).toHaveAttribute('href', 'https://notebooklm.google.com');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'שש שאלות, ומקור לכל תשובה');
  await expect(page.getByRole('button', { name: 'בדוק את המקורות' })).toBeDisabled();
  for (const [q, opt] of ANSWERS) {
    await page.locator('fieldset', { hasText: q }).getByLabel(opt, { exact: true }).check();
  }
  await page.getByRole('button', { name: 'בדוק את המקורות' }).click();
  await expect(page.locator('.result-sum')).toContainText('6 מתוך 6');
  await expect(page.locator('.quiz-result .status-bad')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'דף למידה');
  await page.getByRole('button', { name: 'דף למידה לדוגמה' }).click();
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await expect(page.locator('.result-sum')).toContainText('8 מתוך 8');
  await next(page);

  await expectStep(page, 'במילים שלך, בלי הכלי');
  await page.getByRole('button', { name: 'תשובות לדוגמה' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'מה צריך להיות בדף');
  await next(page);
  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L05' && e.score === 100)).toBe(true);
});

test('L05 a wrong source is explained and the answers lock', async ({ page }) => {
  await mockTracking(page);
  await login(page, '/l05/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await next(page);
  await next(page);
  await next(page);
  for (const [q] of ANSWERS) {
    await page.locator('fieldset', { hasText: q }).getByLabel(OPTIONS.nohal, { exact: true }).check();
  }
  await page.getByRole('button', { name: 'בדוק את המקורות' }).click();
  await expect(page.locator('.result-sum')).toContainText('1 מתוך 6');
  await expect(page.locator('.quiz-result').filter({ hasText: 'סתירה שלא נסגרה' })).toBeVisible();
  await expect(page.locator('.quiz-q input').first()).toBeDisabled();
});
