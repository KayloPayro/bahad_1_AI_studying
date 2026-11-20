import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectWatermark, login, mockTracking } from './helpers';

/** Counts come from the content files, so finishing a lesson does not break this test. */
const statuses = readdirSync('modules').map(
  (d) => (JSON.parse(readFileSync(`modules/${d}/content.json`, 'utf8')) as { status: string }).status,
);
const READY = statuses.filter((x) => x === 'ready').length;
const DRAFTS = statuses.filter((x) => x === 'draft').length;
/** The first lesson still in draft, if any: its slug and the title of its second screen. */
const draft = readdirSync('modules')
  .map((d) => JSON.parse(readFileSync(`modules/${d}/content.json`, 'utf8')) as { status: string; slug: string; steps: { title: string }[] })
  .find((c) => c.status === 'draft');

test.describe('home and entry', () => {
  test('home lists ready and draft modules, RTL, watermark, no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'לומדות AI לצוערים' })).toBeVisible();
    await expect(page.locator('#h-ready + .mod-list > li')).toHaveCount(READY);
    await expect(page.locator('#h-drafts ~ .mod-list > li')).toHaveCount(DRAFTS);
    await expectWatermark(page);
    await expectNoHorizontalScroll(page);
  });

  test('principles: each one expands and links to the lessons that teach it', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('#h-principles ~ details.why').first();
    await expect(first).not.toHaveAttribute('open', '');
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.getByRole('link').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('dropdown arrow points left when closed and turns 90 degrees to point down when open', async ({ page }) => {
    await page.goto('/');
    const d = page.locator('#h-principles ~ details.why').first();
    const rot = () =>
      d.locator('summary').evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el, '::before').transform);
        return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
      });
    expect(await rot()).toBe(135);
    await d.locator('summary').click();
    await expect.poll(rot).toBe(45);
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
    test.skip(!draft, 'every lesson is ready: there is no draft to open');
    const events = await mockTracking(page);
    await login(page, `/${draft!.slug}/`);
    await expect(page.getByText('הלומדה בבנייה')).toBeVisible();
    await page.getByRole('button', { name: 'הצג את המבנה' }).click();
    await expect(page.getByRole('heading', { level: 2, name: draft!.steps[1]!.title })).toBeVisible();
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
    expect(bg).toBe('rgb(19, 17, 14)'); // --bg dark, DESIGN.md
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
