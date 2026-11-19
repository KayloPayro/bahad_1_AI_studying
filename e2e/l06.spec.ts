import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

async function toFinal(page: Page) {
  await login(page, '/l06/');
  await page.getByRole('button', { name: 'התחל' }).click();

  await expectStep(page, 'הודעות בוקר מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'שעה שקטה לכתיבה בלי הפרעות' })).toBeVisible({ timeout: 25_000 });
  await next(page);

  await expectStep(page, 'רשימת המשימות והפגישות');
  await next(page);

  await expectStep(page, 'תוכנית ראשונה');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await expect(page.getByLabel('לצרף את רשימת המשימות והפגישות בהעתקה')).toBeChecked();
  await page.getByRole('button', { name: 'טען הנחיה לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'קוראים את התוכנית מול ההודעות');
  await page.getByLabel('מה המ״פ ביקשה ואינו מופיע בתוכנית').fill('הכול מופיע');
  await next(page);

  await expectStep(page, 'מה הכלי החזיר');
  await page.getByRole('button', { name: 'תוצר לדוגמה: תוכנית ראשונה' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  await expectStep(page, 'שיבוש ראשון: המג״ד מגיע');
  await expect(page.locator('.chat .bubble', { hasText: 'המג״ד מגיע היום ב-14:00' })).toBeVisible({ timeout: 10_000 });
  // The update goes into the conversation that is already open.
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'טען עדכון לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  await expectStep(page, 'שיבוש שני: ביטול ומשימת בטיחות');
  await expect(page.locator('.chat .bubble', { hasText: 'תקלה בבלמים' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'טען עדכון לדוגמה' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('3 מתוך 3');
  await next(page);

  await expectStep(page, 'התוכנית הסופית');
}

test('L06 end to end: priorities, two updates in one conversation, final plan, a plan from another tool, message upward, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toFinal(page);
  await page.getByRole('button', { name: 'תוצר לדוגמה: תוכנית סופית' }).click();
  await page.locator('.check.is-manual input').check();
  await expect(page.locator('.result-sum')).toContainText('8 מתוך 8');
  await expectNoHorizontalScroll(page);
  await next(page);

  // A plan from another tool, with four planted problems.
  await expectStep(page, 'תוכנית שהוכנה בכלי אחר');
  await expect(page.getByRole('button', { name: 'בדוק תשובות' })).toBeDisabled();
  const pick = async (q: string, opt: string) => page.locator('fieldset', { hasText: q }).getByLabel(opt, { exact: true }).check();
  await pick('איזה פריט בתוכנית כבר בוטל', 'פגישה עם הרס״פ על לוגיסטיקה');
  await pick('איזה פריט בתוכנית אינו מופיע', 'פגישה עם סגן המג״ד');
  await pick('איזו שיחה אישית עם חייל חסרה', 'גלעד');
  await pick('איזו התנגשות בתוכנית לא סומנה', 'ישיבת מפקדי המחלקות מול הדרכת הבטיחות, 11:00 עד 11:30');
  await page.getByRole('button', { name: 'בדוק תשובות' }).click();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await next(page);

  // A message upward, with a decision to make.
  await expectStep(page, 'הודעה למ״פ על ההתנגשות');
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();
  await page.getByRole('button', { name: 'הודעה לדוגמה' }).click();
  await page.locator('.check.is-manual input').check();
  await expect(page.locator('.result-sum')).toContainText('4 מתוך 4');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מה לקחת מכאן');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L06' && e.score === 100)).toBe(true);
});

test('L06 the final check catches a moved soldier conversation, a late braking task and a kept cancelled meeting', async ({ page }) => {
  await mockTracking(page);
  await toFinal(page);
  await page.getByLabel('התוכנית הסופית שקיבלת מהכלי').fill(
    '| 07:00 עד 08:00 | שעה שקטה |\n| 11:00 עד 11:30 | בדיקת הבלמים |\n| 10:00 עד 10:30 | שיחה אישית עם גלעד |\n| 12:30 עד 13:15 | פגישה עם הרס״פ על לוגיסטיקה |',
  );
  await page.getByRole('button', { name: 'בדוק מול הדרישות' }).click();
  await expect(page.locator('.check', { hasText: 'שיחות החיילים' })).toHaveClass(/is-fail/);
  await expect(page.locator('.check', { hasText: 'משימת הבלמים בבוקר' })).toHaveClass(/is-fail/);
  await expect(page.locator('.check', { hasText: 'הפגישה שבוטלה' })).toHaveClass(/is-fail/);
  await expect(page.locator('.check', { hasText: 'שעה שקטה' })).toHaveClass(/is-pass/);
});
