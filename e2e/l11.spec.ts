import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

const CLAIMS: [string, string][] = [
  ['טענה 1', 'מקבל את הטענה'],
  ['טענה 2', 'מקבל את הטענה'],
  ['טענה 3', 'דוחה את הטענה'],
  ['טענה 4', 'מקבל את הטענה'],
  ['טענה 5', 'דוחה את הטענה'],
];

async function toRoundA(page: Page) {
  await login(page, '/l11/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'התוכנית שלך מחכה לחתימה');
  await expect(page.locator('.chat .bubble', { hasText: 'איפה זה יכול להישבר' })).toBeVisible({ timeout: 25_000 });
  await next(page);
  await expectStep(page, 'תוכנית התרגיל');
  await next(page);
  await expectStep(page, 'סבב א׳: ״מה דעתך על התוכנית?״');
}

async function toClaims(page: Page) {
  await toRoundA(page);
  await next(page);
  await next(page);
  await next(page);
  await next(page);
  await next(page);
  await next(page);
  await expectStep(page, 'סבב ג׳: ביקורת של קצין אחר');
}

test('L11 end to end: general question, red team, debrief, comparison, claims, changes, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toRoundA(page);
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await expect(page.getByLabel('לצרף את התוכנית בהעתקה')).toBeChecked();
  await page.getByRole('button', { name: 'טען את הבקשה' }).click();
  await next(page);

  await expectStep(page, 'מה עלה בסבב א׳');
  // Round A: the tool raised two of the six weaknesses.
  await page.getByLabel('בטיחות: לא מוקצה קצין בטיחות לשטח.').check();
  await page.getByLabel('זמנים: אין רזרבה, וההסעה מתחילה בדיוק ב-01:00.').check();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 6');
  await next(page);

  await expectStep(page, 'סבב ב׳: צוות אדום בכמה עדשות');
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'סבב ב׳: התחקיר המוקדם');
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'טען בקשה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 2');
  await next(page);

  await expectStep(page, 'מה עלה בסבב ב׳');
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await next(page);

  await expectStep(page, 'מה הוסיפה הבקשה המכוונת');
  await expect(page.locator('.matrix-row')).toHaveCount(6);
  await expect(page.locator('.matrix-row', { hasText: 'קשר' }).locator('.status')).toHaveText(['לא עלתה', 'עלתה']);
  await expect(page.locator('.matrix-row', { hasText: 'בטיחות' }).locator('.status')).toHaveText(['עלתה', 'עלתה']);
  await expect(page.locator('.result-sum')).toContainText('בסבב א׳ עלו 2 מתוך 6');
  await expect(page.locator('.result-sum')).toContainText('בסבב ב׳ עלו 6 מתוך 6');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'סבב ג׳: ביקורת של קצין אחר');
  await expect(page.getByRole('button', { name: 'הצג תשובות מומלצות' })).toBeDisabled();
  for (const [q, opt] of CLAIMS) {
    const fs = page.locator('fieldset', { hasText: q + ':' });
    await fs.getByLabel(opt, { exact: true }).check();
    await fs.getByLabel('נמק בשורה אחת').fill('נבדק מול התוכנית');
  }
  await page.getByRole('button', { name: 'הצג תשובות מומלצות' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'שלושה שינויים בתוכנית');
  await page.getByRole('button', { name: 'שלושה שינויים לדוגמה' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(3);
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L11' && e.score === 100)).toBe(true);
});

test('L11 accepting the two claims that rest on a false premise is explained from the plan', async ({ page }) => {
  await mockTracking(page);
  await toClaims(page);
  for (const [q] of CLAIMS) {
    const fs = page.locator('fieldset', { hasText: q + ':' });
    await fs.getByLabel('מקבל את הטענה', { exact: true }).check();
    await fs.getByLabel('נמק בשורה אחת').fill('נשמע נכון');
  }
  await page.getByRole('button', { name: 'הצג תשובות מומלצות' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 5');
  const bad = page.locator('.quiz-result').filter({ has: page.locator('.status-bad') });
  await expect(bad).toHaveCount(2);
  await expect(bad.first()).toContainText('כל לוחם נושא פנס ראש');
  await expect(bad.last()).toContainText('ביום חמישי הקרוב');
});
