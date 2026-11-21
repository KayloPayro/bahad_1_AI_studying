import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

async function toBoard(page: Page) {
  await login(page, '/l08/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעה מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'כשתהיה מוכן' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'הניסיון הראשון: תמונת הזמנה מ-Gemini');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  // Only the tool this screen needs is offered: Gemini, and nothing else.
  await expect(page.locator('.snippet .btn-tool')).toHaveCount(1);
  await expect(page.locator('.snippet .btn-tool')).toContainText('Gemini');
  await expect(page.locator('.tool-guide .note')).toContainText('הכלי לשלב הזה: Gemini');
  await page.getByRole('button', { name: 'ממצאים לדוגמה: נמצאו שגיאות' }).click();
  await expect(page.locator('.check.is-pass')).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה ראית, ומה עושים אחרת');
  await next(page);

  await expectStep(page, 'קוראים הרשאה לפני שמחברים');
  const answers: [string, string][] = [
    ['מה Claude יוכל לעשות בחשבון Canva', 'לצפות, ליצור ולערוך עיצובים, ולא למחוק או לשתף'],
    [
      'Claude ערך עיצוב קיים שלך',
      'נתתי את ההרשאה, ולכן אני אחראי לבדוק את התוצאה ולתקן, גם אם הטעות נוצרה בכלי',
    ],
    ['מה נכון לעשות לפני שמאשרים הרשאה', 'לקרוא מה מתבקש, ולבדוק שזה מתאים למשימה ולחשבון'],
  ];
  for (const [q, opt] of answers)
    await page.locator('fieldset', { hasText: q }).getByLabel(opt, { exact: true }).check();
  await page.getByRole('button', { name: 'בדוק תשובות' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'מחברים את Canva');
  await expect(page.locator('.tool-guide .btn-tool')).toHaveCount(1);
  await expect(page.locator('.tool-guide .btn-tool')).toContainText('פתח את Claude');
  await expect(page.getByRole('link', { name: 'העזרה הרשמית של Claude' })).toHaveAttribute(
    'href',
    'https://support.claude.com',
  );
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה כתוב במסך ההרשאות שלך');
  await page
    .getByLabel('מה Claude מבקש לעשות בחשבון Canva שלך')
    .fill('לצפות וליצור ולערוך עיצובים, בלי מחיקה');
  await next(page);

  await expectStep(page, 'הזמנה ב-Canva');
  await expect(page.locator('.chat .bubble', { hasText: 'שער 2' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('6 מתוך 6');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'בדיקת העיצוב ב-Canva');
  await page.getByLabel('תשובה לשאלה 1').fill('יום חמישי, 18:00');
  await page.getByLabel('תשובה לשאלה 2').fill('אולם הפלוגה, חניה בשער 2');
  await page.getByLabel('תשובה לשאלה 3').fill('הרס״פ, 050-000-0000');
  await page.getByRole('button', { name: 'בדוק', exact: true }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'קישור לעיצוב ושינוי ידני');
  await page.getByLabel('תשובה לשאלה 1').fill('https://www.canva.com/design/DAF123/view');
  await page.getByLabel('תשובה לשאלה 2').fill('צבע הכותרת');
  await page.getByRole('button', { name: 'אשר', exact: true }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 2');
  await next(page);

  await expectStep(page, 'לוח הכנה ב-monday: הקובץ');
}

test('L08 end to end: no connector, permissions, invitation, board, real-time change, score', async ({
  page,
}) => {
  const events = await mockTracking(page);
  await toBoard(page);
  await expectNoHorizontalScroll(page);

  await expect(page.locator('a[download="yom-mishpachot.csv"]')).toHaveCount(1);
  const csv = await page.evaluate(async () => {
    const a = document.querySelector('a[download="yom-mishpachot.csv"]') as HTMLAnchorElement;
    return await (await fetch(a.href)).text();
  });
  expect(csv).not.toMatch(/\{t[+-]\d+\}/);
  expect(csv.trim().split('\n')).toHaveLength(14);
  await next(page);

  await expectStep(page, 'בונים לוח ודאשבורד');
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await next(page);

  await expectStep(page, 'בדיקת הלוח ב-monday');
  await page.getByLabel('תשובה לשאלה 1').fill('13');
  await page.getByLabel('תשובה לשאלה 2').fill('3');
  await page.getByLabel('תשובה לשאלה 3').fill('2');
  await page.getByLabel('תשובה לשאלה 4').fill('1');
  await page.getByLabel('תשובה לשאלה 5').fill('23%');
  await page.getByRole('button', { name: 'בדוק מול הקובץ' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
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
  await page.getByRole('button', { name: 'בדוק', exact: true }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 2');
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect
    .poll(() => events.some((e) => e.event === 'complete' && e.module === 'L08' && e.score === 100))
    .toBe(true);
});

test('L08 a wrong board count is explained, with the right answer', async ({ page }) => {
  await mockTracking(page);
  await login(page, '/l08/');
  await page.getByRole('button', { name: 'התחל' }).click();
  for (let i = 0; i < 11; i++) await next(page);
  await expectStep(page, 'בדיקת הלוח ב-monday');
  await page.getByLabel('תשובה לשאלה 1').fill('12');
  await page.getByLabel('תשובה לשאלה 2').fill('6');
  await page.getByLabel('תשובה לשאלה 3').fill('2');
  await page.getByLabel('תשובה לשאלה 4').fill('1');
  await page.getByLabel('תשובה לשאלה 5').fill('23%');
  await page.getByRole('button', { name: 'בדוק מול הקובץ' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 5');
  await expect(
    page.locator('.quiz-result').filter({ hasText: 'משימות בסטטוס ״בוצע״ עם מועד שעבר' }),
  ).toBeVisible();
  await expect(page.locator('.quiz-result').filter({ hasText: 'בקובץ 13 משימות' })).toBeVisible();
});
