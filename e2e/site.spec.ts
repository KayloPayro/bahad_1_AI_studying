import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectWatermark, login, mockTracking } from './helpers';

test.describe('home and entry', () => {
  test('home lists ready and draft modules, RTL, watermark, no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'לומדות AI לצוערים' })).toBeVisible();
    await expect(page.locator('#h-ready + .mod-list > li')).toHaveCount(2);
    await expect(page.locator('#h-drafts ~ .mod-list > li')).toHaveCount(10);
    await expectWatermark(page);
    await expectNoHorizontalScroll(page);
  });

  test('personal number: validation, remembered device, "לא אני"', async ({ page }) => {
    await mockTracking(page);
    await page.goto('/l01/');
    const pn = page.getByLabel('מספר אישי');
    await expect(pn).toHaveAttribute('inputmode', 'numeric');
    await pn.fill('93244a3');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByText('מספר אישי הוא 7 ספרות, בלי אותיות ורווחים')).toBeVisible();
    await expect(pn).toHaveAttribute('aria-invalid', 'true');

    await pn.fill('9324493');
    await page.getByLabel('צוות').selectOption('18');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'דף החלטה למ״פ' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('XXXX493')).toBeVisible();
    await page.getByRole('button', { name: 'לא אני' }).click();
    await expect(page.getByLabel('מספר אישי')).toHaveValue('');
  });

  test('draft module shows its planned structure without tracking', async ({ page }) => {
    const events = await mockTracking(page);
    await login(page, '/l05/');
    await expect(page.getByText('הלומדה בבנייה')).toBeVisible();
    await page.getByRole('button', { name: 'הצג את המבנה' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'בלי מקורות' })).toBeVisible();
    await expectWatermark(page);
    expect(events).toHaveLength(0);
  });

  test('instructor mode needs the code and reveals notes and controls', async ({ page }) => {
    await mockTracking(page);
    await login(page, '/l01/');
    const sw = page.getByRole('switch', { name: 'מצב מדריך' });
    await sw.click();
    await page.getByLabel('קוד מדריך').fill('wrong');
    await page.getByRole('button', { name: 'פתח' }).click();
    await expect(page.getByText('הקוד שגוי')).toBeVisible();
    await page.getByLabel('קוד מדריך').fill('bahad1');
    await page.getByRole('button', { name: 'פתח' }).click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('הערת מדריך')).toBeVisible();
    await page.getByRole('button', { name: 'התחל' }).click();
    await expect(page.getByRole('button', { name: 'השהה הודעות' })).toBeVisible();
    await page.getByRole('button', { name: 'כל ההודעות עכשיו' }).click();
    await expect(page.locator('.chat .bubble')).toHaveCount(3);
  });

  test('dark mode uses the dark tokens', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(15, 21, 26)');
    await ctx.close();
  });
});

test('staff page explains when tracking is not connected or asks for the code', async ({ page }) => {
  await page.goto('/staff/');
  await expect(page.getByRole('heading', { level: 1, name: 'מעקב סגל' })).toBeVisible();
  // e2e builds with a tracking URL, so the code form is shown.
  await expect(page.getByLabel('קוד סגל')).toBeVisible();
  await expectWatermark(page);
});
