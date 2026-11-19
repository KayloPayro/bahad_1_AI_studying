import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

test('L03 end to end: short-prompt attempt, structured prompt, comparison, score', async ({ page }) => {
  const events = await mockTracking(page);
  await login(page, '/l03/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעה קולית מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'אנחנו לא עושים מזה עניין' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'הניסיון הראשון: הנחיה במשפט אחד');
  await expect(page.getByText('אבטחת מידע')).toBeVisible();
  await page.getByRole('button', { name: 'תוצר לדוגמה: הנחיה קצרה' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(3);
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 8');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'כתיבת הנחיה מששה מרכיבים');
  await expect(page.getByLabel('לצרף את התמלול של המ״פ בהעתקה')).toBeChecked();
  await page.getByRole('button', { name: 'טען הנחיה מקצועית לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('6 מתוך 6');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'התוצר של ההנחיה המקצועית');
  await page.getByRole('button', { name: 'תוצר לדוגמה: הנחיה מסודרת' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(0);
  await expect(page.locator('.result-sum')).toContainText('8 מתוך 8');
  await expect(page.getByText('ההודעה עדיין לא יצאה').first()).toBeVisible();
  await next(page);

  await expectStep(page, 'השוואה: מה הגיע להודעה');
  await expect(page.locator('.matrix-row')).toHaveCount(8);
  await expect(page.locator('.matrix-row', { hasText: 'שולח' }).locator('.status')).toHaveText(['לא נמצא סימן', 'נמצא סימן']);
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 8');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  // 70·8/8 + 30·6/6 = 100
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L03' && e.score === 100)).toBe(true);
});
