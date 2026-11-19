import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

const ACCEPT = 'מקבל את הטענה';
const REJECT = 'דוחה: סותרת את התוכנית או מניחה עובדה שאינה בה';
const PARTLY = 'מקבל בחלקו: החלק העובדתי נכון, והשאר צריך בדיקה';
const CLAIMS: [string, string][] = [
  ['טענה 1', PARTLY],
  ['טענה 2', ACCEPT],
  ['טענה 3', REJECT],
  ['טענה 4', ACCEPT],
  ['טענה 5', PARTLY],
];

async function toRoundA(page: Page) {
  await login(page, '/l11/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'התוכנית שלך מחכה לחתימה');
  await expect(page.locator('.chat .bubble', { hasText: 'איפה זה יכול להישבר' })).toBeVisible({ timeout: 25_000 });
  await next(page);
  await expectStep(page, 'תוכנית התרגיל');
  await next(page);
  await expectStep(page, 'מה אתה רואה בתוכנית');
  await page.getByLabel('כתוב חולשה אחת או שתיים שאתה רואה בתוכנית שלך').fill('אין');
  await next(page);
  await expectStep(page, 'סבב א׳: ״מה דעתך על התוכנית?״');
}

async function toClaims(page: Page) {
  await toRoundA(page);
  for (let i = 0; i < 5; i++) await next(page);
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
  // Round A is written in the cadet's own words; the six weaknesses are not shown yet.
  await expect(page.getByText('מכשיר אחד לכל מחלקה')).toHaveCount(0);
  await page.getByLabel('כתוב במילים שלך אילו חולשות הכלי העלה').fill('בטיחות בלילה וגשם, בכלליות');
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
  await expect(page.getByText('מכשיר אחד לכל מחלקה')).toBeVisible();
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
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

test('L11 accepting every claim is explained from the plan, and three right decisions do not pass', async ({ page }) => {
  await mockTracking(page);
  await toClaims(page);
  for (const [q] of CLAIMS) {
    const fs = page.locator('fieldset', { hasText: q + ':' });
    await fs.getByLabel(ACCEPT, { exact: true }).check();
    await fs.getByLabel('נמק בשורה אחת').fill('נשמע נכון');
  }
  await page.getByRole('button', { name: 'הצג תשובות מומלצות' }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 5');
  const bad = page.locator('.quiz-result').filter({ has: page.locator('.status-bad') });
  await expect(bad).toHaveCount(3);
  await expect(bad.first()).toContainText('כלל שאינו מופיע בשום מסמך');
  await expect(bad.nth(1)).toContainText('כל לוחם נושא פנס ראש');
  await expect(bad.last()).toContainText('כמה לוחמים משאית מכילה לא כתוב');
});
