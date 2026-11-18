import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

const FOCUSED = 'טען הנחיה ממוקדת לדוגמה';

async function round(page: Page, n: number, total: number) {
  await expectStep(page, `סבב ${n}: הנחיית המשך`);
  await expect(page.locator('.chat .bubble').last()).toBeVisible({ timeout: 10_000 });
  // The follow-up goes into the conversation that is already open: no link that starts a new chat.
  await expect(page.getByRole('link', { name: /העתק ופתח/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'טען הנחיה כללית' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('0 מתוך 2');
  await page.getByRole('button', { name: FOCUSED }).click();
  await expect(page.locator('.result-sum')).toContainText('2 מתוך 2');
  await next(page);

  await expectStep(page, `סבב ${n}: הגרסה החדשה`);
  await page.getByRole('button', { name: `תוצר לדוגמה: סבב ${n}` }).click();
  await page.locator('.check.is-manual input').check();
  await expect(page.locator('.result-sum')).toContainText(`${total} מתוך ${total}`);
  await expectNoHorizontalScroll(page);
}

async function toRounds(page: Page) {
  await login(page, '/l04/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'ההודעה מהמ״פ');
  await expect(page.locator('.chat .bubble', { hasText: 'הטיוטה של הסיכום השבועי' })).toBeVisible({ timeout: 10_000 });
  await next(page);
  await expectStep(page, 'פותחים שיחה עם הטיוטה');
  await expect(page.getByText('אבטחת מידע')).toBeVisible();
  await expect(page.locator('.snippet-text')).toContainText('גיל אורבך');
  await next(page);
}

test('L04 end to end: three follow-up rounds, progress table, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toRounds(page);
  await round(page, 1, 3);
  await next(page);
  await round(page, 2, 5);
  await next(page);
  await round(page, 3, 6);
  await next(page);

  await expectStep(page, 'מה נשמר בין הסבבים');
  await expect(page.locator('.matrix-row')).toHaveCount(5);
  await expect(page.locator('.matrix-row', { hasText: 'אחראי' }).locator('.status')).toHaveText([
    'לא נדרש',
    'נמצא סימן',
    'נמצא סימן',
  ]);
  await expect(page.locator('.result-sum')).toContainText('לא נמצא תיקון שנשבר');
  await expect(page.getByRole('button', { name: 'העתק', exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  // 70·6/6 + 3·(10·2/2) = 100
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L04' && e.score === 100)).toBe(true);
});

test('L04 progress marks a fix that a later round broke', async ({ page }) => {
  await mockTracking(page);
  await toRounds(page);
  await round(page, 1, 3);
  await next(page);
  await round(page, 2, 5);
  await next(page);
  // Round 3 comes back looking like round 1: the owner column and the tone fix are gone.
  await expectStep(page, 'סבב 3: הנחיית המשך');
  await next(page);
  await expectStep(page, 'סבב 3: הגרסה החדשה');
  await page.getByLabel('התוצר שקיבלת מהכלי').fill('סיכום. אנו מצטערים.\n| משימה | פירוט |\n|---|---|\n| א | ב |');
  await page.getByRole('button', { name: 'בדוק מול הדרישות' }).click();
  await next(page);

  await expectStep(page, 'מה נשמר בין הסבבים');
  const owner = page.locator('.matrix-row', { hasText: 'אחראי' });
  await expect(owner.locator('.status')).toHaveText(['לא נדרש', 'נמצא סימן', 'נשבר']);
  await expect(owner).toContainText('נעלם בסבב 3');
  await expect(page.locator('.result-sum')).toContainText('תיקונים שנשברו בין סבבים: 2');
});
