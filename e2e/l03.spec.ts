import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

test('L03 end to end: one-sentence attempt, six-component prompt, comparison, template, score', async ({ page }) => {
  const events = await mockTracking(page);
  await login(page, '/l03/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעה קולית מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'אנחנו לא עושים מזה עניין' })).toBeVisible({ timeout: 15_000 });
  await next(page);

  await expectStep(page, 'הניסיון הראשון: הנחיה במשפט אחד');
  await expect(page.getByText('אבטחת מידע')).toBeVisible();
  await page.getByRole('button', { name: 'תוצר לדוגמה: הנחיה במשפט אחד' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(6);
  await expect(page.locator('.result-sum')).toContainText('0 מתוך 8');
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
  await page.getByRole('button', { name: 'תוצר לדוגמה: הנחיה מקצועית' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(0);
  for (const box of await page.locator('.check.is-manual input').all()) await box.check();
  await expect(page.locator('.result-sum')).toContainText('8 מתוך 8');
  await next(page);

  await expectStep(page, 'השוואה: מה הגיע להודעה');
  await expect(page.locator('.matrix-row')).toHaveCount(8);
  await expect(page.locator('.matrix-row').first().locator('.status')).toHaveText(['לא סימנת', 'סימנת']);
  await expect(page.locator('.result-sum')).toContainText('0 מתוך 8');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'הופכים את ההנחיה לתבנית');
  await expect(page.getByLabel('התבנית שלך')).toHaveValue(/אתה עוזר לכתיבת הודעות/);
  await page.getByRole('button', { name: 'שמור בספריית ההנחיות' }).click();
  await expect(page.getByRole('button', { name: 'נשמר. שמור שוב' })).toBeVisible();
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  // 80·8/8 + 20·6/6 = 100
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L03' && e.score === 100)).toBe(true);
});
