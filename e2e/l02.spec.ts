import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

test('L02 end to end: quick round, questions, what the tool did not ask, final check, summary', async ({ page }) => {
  const events = await mockTracking(page);
  await login(page, '/l02/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'המשימה');
  await expect(page.locator('.chat .bubble', { hasText: 'מפקד האוגדה' })).toBeVisible({ timeout: 10_000 });
  await next(page);

  await expectStep(page, 'סבב מהיר: לו״ז במשפט אחד');
  await page.getByRole('button', { name: 'טען הנחיה במשפט אחד' }).click();
  await next(page);

  await expectStep(page, 'הלו״ז מהסבב המהיר');
  await page.getByLabel('הדבק כאן את הלו״ז שקיבלת').fill('08:30 קבלת פנים\n09:00 מצגת');
  await next(page);

  await expectStep(page, 'הקלפים נחשפים');
  await page.getByText('**זמנים:**').count(); // markup must be rendered, not shown raw
  await expect(page.getByText('**', { exact: false })).toHaveCount(0);
  await page.locator('.checks input').first().check();
  await expect(page.locator('.result-sum')).toContainText('1 מתוך 8');
  await next(page);

  await expectStep(page, 'סבב שאלות');
  await expect(page.getByRole('link', { name: 'העתק ופתח ב-Gemini' })).toBeVisible();
  for (const topic of ['זמנים', 'מטרה', 'אוכל', 'מפקדים', 'לוגיסטיקה']) {
    await page.locator('.flip', { hasText: topic }).first().click();
  }
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 8');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה הכלי לא שאל');
  await expect(page.locator('.unasked')).toHaveCount(3);
  for (const box of await page.getByLabel('הוספתי בעצמי').all()) await box.check();
  await next(page);

  await expectStep(page, 'תדריך חוזר');
  await page.getByLabel('שורה שלא תואמת את הכוונה שלך (אם יש)').fill('הכול תואם');
  await next(page);

  await expectStep(page, 'בדיקה מול שמונת האילוצים');
  await page.getByRole('button', { name: 'לו״ז לדוגמה מהסבב המהיר' }).click();
  await expect(page.locator('.check.is-fail')).not.toHaveCount(0);
  await expect(page.locator('.check', { hasText: 'אין ירי במטווח' })).toHaveClass(/is-fail/);
  await page.getByRole('button', { name: 'לו״ז לדוגמה אחרי סבב השאלות' }).click();
  await expect(page.locator('.check.is-fail')).toHaveCount(0);
  await page.locator('.check.is-manual input').check();
  await expect(page.locator('.result-sum')).toContainText('8 מתוך 8');
  await next(page);

  await expectStep(page, 'ההנחיה ההפוכה');
  await page.getByLabel('ההנחיה שהכלי כתב').fill('הנחיה מלאה לביקור מפקד אוגדה: זמנים, אוכל, שער צפוני…');
  await page.getByRole('button', { name: 'שמור בספריית ההנחיות' }).click();
  await expect(page.getByRole('button', { name: 'נשמר. שמור שוב' })).toBeVisible();
  await next(page);

  await expectStep(page, 'סיכום');
  await expect(page.locator('.bar-val')).toHaveText(['1 מתוך 8', '5 מתוך 8', '8 מתוך 8']);
  await expect(page.locator('.split-n')).toHaveText(['5', '3', '0']);
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  // 60·8/8 + 25·8/8 + 15·5/8 = 94.375 → 94
  await expect(page.locator('.score-big .clock')).toHaveText('94%');

  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L02' && e.score === 94)).toBe(true);

  // The saved prompt appears in the library on the home page.
  await page.getByRole('link', { name: 'לכל הלומדות' }).first().click();
  await expect(page.getByRole('heading', { name: 'ספריית ההנחיות שלי' })).toBeVisible();
  await expect(page.locator('.mod', { hasText: 'שאל אותי לפני שאתה עובד' })).toContainText('הושלם · 94%');
});
