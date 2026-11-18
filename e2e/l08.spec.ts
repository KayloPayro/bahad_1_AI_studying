import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

async function toBoard(page: Page) {
  await login(page, '/l08/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעה מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'כשתהיה מוכן' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'הניסיון הראשון: בלי מחבר');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await page.getByRole('button', { name: 'תוצר לדוגמה: בלי מחבר' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(0);
  await next(page);

  await expectStep(page, 'מחברים את Canva');
  await expect(page.getByRole('link', { name: 'העזרה הרשמית של Claude' })).toHaveAttribute('href', 'https://support.claude.com');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'קוראים את מסך ההרשאות');
  const answers: [string, string][] = [
    ['מה Claude יוכל לעשות בחשבון Canva', 'לצפות, ליצור ולערוך עיצובים, ולא למחוק או לשתף'],
    ['מי אחראי לכך שההרשאה ניתנה', 'אתה, כי אתה אישרת את ההרשאה'],
    ['מה נכון לעשות לפני שמאשרים הרשאה', 'לקרוא מה מתבקש, ולבדוק שזה מתאים למשימה'],
  ];
  for (const [q, opt] of answers) await page.locator('fieldset', { hasText: q }).getByLabel(opt, { exact: true }).check();
  await page.getByRole('button', { name: 'בדוק תשובות' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'הזמנה ב-Canva');
  await expect(page.locator('.chat .bubble', { hasText: 'שער 2' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('6 מתוך 6');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'בדיקת העיצוב ב-Canva');
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await expect(page.locator('.result-sum')).toContainText('6 מתוך 6');
  await next(page);

  await expectStep(page, 'קישור לעיצוב ושינוי ידני');
  await page.getByLabel('תשובה לשאלה 1').fill('https://www.canva.com/design/DAF123/view');
  await page.getByLabel('תשובה לשאלה 2').fill('צבע הכותרת');
  await page.getByRole('button', { name: 'בדוק', exact: true }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 2');
  await next(page);

  await expectStep(page, 'לוח הכנה ב-monday: הקובץ');
}

test('L08 end to end: no connector, permissions, invitation, board, real-time change, disconnect, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toBoard(page);
  await expectNoHorizontalScroll(page);

  await expect(page.locator('a[download="yom-mishpachot.csv"]')).toHaveCount(1);
  const csv = await page.evaluate(async () => {
    const a = document.querySelector('a[download="yom-mishpachot.csv"]') as HTMLAnchorElement;
    return await (await fetch(a.href)).text();
  });
  expect(csv).not.toMatch(/\{t[+-]\d+\}/);
  expect(csv.trim().split('\n')).toHaveLength(13);
  await next(page);

  await expectStep(page, 'בונים לוח ודאשבורד');
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await next(page);

  await expectStep(page, 'בדיקת הלוח ב-monday');
  await page.getByLabel('תשובה לשאלה 1').fill('3');
  await page.getByLabel('תשובה לשאלה 2').fill('3');
  await page.getByLabel('תשובה לשאלה 3').fill('2');
  await page.getByRole('button', { name: 'בדוק מול הנתונים' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'שינוי בזמן אמת');
  await expect(page.locator('.chat .bubble', { hasText: 'סמל מחלקה 2' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'טען עדכון לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'בדיקה אחרי השינוי');
  await page.getByLabel('תשובה לשאלה 1').fill('סמל מחלקה 2');
  await page.getByLabel('תשובה לשאלה 2').fill('1');
  await page.getByRole('button', { name: 'בדוק מול הנתונים' }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 2');
  await next(page);

  await expectStep(page, 'מנתקים הרשאות');
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L08' && e.score === 100)).toBe(true);
});

test('L08 a wrong board count is explained, with the right answer', async ({ page }) => {
  await mockTracking(page);
  await login(page, '/l08/');
  await page.getByRole('button', { name: 'התחל' }).click();
  for (let i = 0; i < 9; i++) await next(page);
  await expectStep(page, 'בדיקת הלוח ב-monday');
  await page.getByLabel('תשובה לשאלה 1').fill('6');
  await page.getByLabel('תשובה לשאלה 2').fill('3');
  await page.getByLabel('תשובה לשאלה 3').fill('2');
  await page.getByRole('button', { name: 'בדוק מול הנתונים' }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 3');
  await expect(page.locator('.quiz-result').filter({ hasText: 'משימות בסטטוס ״בוצע״ עם מועד שעבר אינן באיחור' })).toBeVisible();
});
