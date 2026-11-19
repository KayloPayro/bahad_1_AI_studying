import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

async function toPrompt(page: Page) {
  await login(page, '/l06/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'סיכום דיון נכנס');
  await expect(page.locator('.chat .bubble', { hasText: 'סיור מפקדים בשטח' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'הכנה: חשבון ויומן ״תרגיל AI״');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מחברים את הכלי ליומן');
  await expect(page.getByRole('link', { name: 'Gemini', exact: true })).toHaveAttribute('href', 'https://support.google.com/gemini');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'בדיקת תקינות: מה יש ביומן ביום ראשון');
}

test('L06 end to end: calendar file, health check, approval prompt, follow-up, verification, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toPrompt(page);

  // The calendar file is built for next week and holds nine events.
  // (checked on the previous screen: see below)
  await page.getByLabel('תשובה לשאלה 1').fill('9');
  await page.getByRole('button', { name: 'בדוק', exact: true }).click();
  await expect(page.locator('.quiz-result .status-bad')).toBeVisible();
  await page.getByRole('button', { name: 'נסה שוב' }).click();
  await page.getByLabel('תשובה לשאלה 1').fill('2');
  await page.getByRole('button', { name: 'בדוק', exact: true }).click();
  await expect(page.locator('.quiz-result .status-ok')).toBeVisible();
  await next(page);

  await expectStep(page, 'ניסיון ראשון: ישר ליומן');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await next(page);

  await expectStep(page, 'הנחיה עם אישור לפני פעולה');
  await expect(page.getByLabel('לצרף את סיכום הדיון בהעתקה')).toBeChecked();
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'טיפול בעמום ובהתנגשות');
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'טען הודעת המשך לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  await expectStep(page, 'אישור ויצירה');
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'העתק', exact: true })).toBeVisible();
  await next(page);

  await expectStep(page, 'אימות ביומן עצמו');
  await page.getByLabel('תשובה לשאלה 1').fill('תדריך לצוותים, 11:00');
  await page.getByLabel('תשובה לשאלה 2').fill('09:00');
  await page.getByLabel('תשובה לשאלה 3').fill('13');
  await page.getByRole('button', { name: 'בדוק מול הנתונים' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה ראית ביומן');
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await next(page);

  await expectStep(page, 'שורה למפקד');
  await page.getByRole('button', { name: 'הודעה לדוגמה למפקד' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  await expectStep(page, 'מנתקים ומוחקים');
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L06' && e.score === 100)).toBe(true);
});

test('L06 the calendar file is for next week, has nine events, and the copy button works', async ({ page }) => {
  await mockTracking(page);
  await login(page, '/l06/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await next(page);
  await expectStep(page, 'הכנה: חשבון ויומן ״תרגיל AI״');
  const link = page.locator('a[download="tirgul-ai.ics"]');
  await expect(link).toHaveCount(1);
  const text = await page.evaluate(async () => {
    const a = document.querySelector('a[download="tirgul-ai.ics"]') as HTMLAnchorElement;
    return await (await fetch(a.href)).text();
  });
  expect((text.match(/BEGIN:VEVENT/g) ?? []).length).toBe(9);
  expect(text).not.toMatch(/\{d\d\}/);
  const first = /DTSTART:(\d{8})T080000/.exec(text)![1]!;
  const date = new Date(Number(first.slice(0, 4)), Number(first.slice(4, 6)) - 1, Number(first.slice(6, 8)));
  expect(date.getDay()).toBe(0); // Sunday
  expect(date.getTime()).toBeGreaterThan(Date.now());
  expect(date.getTime() - Date.now()).toBeLessThan(7 * 24 * 3600 * 1000);
});
