import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, expectWatermark, login, mockTracking, next } from './helpers';

test('L01 end to end with the sample prompts and products', async ({ page }) => {
  const events = await mockTracking(page);
  await login(page, '/l01/');
  await page.getByRole('button', { name: 'התחל' }).click();

  // Opening: messages arrive over time, the commander's last.
  await expectStep(page, 'פתיחה בזמן אמת');
  await expect(page.locator('.clock-box')).toBeVisible();
  await expect(page.locator('.chat .bubble', { hasText: 'שורה ראשונה' })).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('.chat .bubble')).toHaveCount(3);
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'מסמך הרקע');
  await expect(page.locator('.para')).toHaveCount(12);
  await page.locator('.para-body').nth(11).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.para').nth(11)).toHaveClass(/is-marked/);
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'כתיבת ההנחיה');
  await page.getByRole('button', { name: 'טען הנחיה חלשה: ״סכם לי״' }).click();
  await page.getByRole('button', { name: 'בדוק מה בהנחיה' }).click();
  await expect(page.locator('.result-sum')).toContainText('0 מתוך 6');
  await page.getByRole('button', { name: 'טען הנחיה מפורטת לדוגמה' }).click();
  await expect(page.locator('.result-sum')).toContainText('6 מתוך 6');
  await page.getByRole('button', { name: 'בקש מהכלי לשאול קודם' }).click();
  await expect(page.getByRole('button', { name: 'הכלי יתבקש לשאול קודם' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'העתק ופתח ב-Claude' })).toHaveAttribute('href', 'https://claude.ai/new');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'הכלי שואל: ענה מהכרטיסים');
  await page.getByRole('button', { name: /העדפת המ״פ/ }).click();
  await expect(page.getByText('המ״פ מעדיפה להזיז מקטעים ולא לבטל יציאה.')).toBeVisible();
  await expect(page.locator('.result-sum')).toContainText('1 מתוך 3');
  await next(page);

  await expectStep(page, 'התוצר מול דרישות המ״פ');
  await page.getByRole('button', { name: 'תוצר לדוגמה של ״סכם לי״' }).click();
  await expect(page.locator('.result-sum')).toContainText('0 מתוך 6');
  await page.getByRole('button', { name: 'בדוק מספרים מול המסמך' }).click();
  await expect(page.locator('.flag-warn mark.num-unknown')).toHaveText(['40']);
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'אימות על תוצר של קצין אחר');
  await expect(page.locator('.chat .bubble', { hasText: 'הכנתי גרסה עם AI' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'בדוק מספרים מול המסמך' }).click();
  await expect(page.locator('.flag-warn mark.num-unknown')).toHaveText(['40']);
  await page.getByLabel('ממצא 1').fill('סד״כ 88 ולא 85 (פסקה 12)');
  await next(page);

  await expectStep(page, 'גרסה סופית ומפתח');
  await page.getByRole('button', { name: 'הצג מפתח' }).click();
  const found = page.getByLabel('איתרתי או וידאתי מול המקור');
  await expect(found).toHaveCount(8);
  for (let i = 0; i < 8; i++) await found.nth(i).check();
  await expect(page.locator('.score-line')).toContainText('איתרת 8 מתוך 8. רמה: מצוין.');
  await next(page);

  await expectStep(page, 'בדיקת הגרסה הסופית');
  for (const box of await page.locator('.checks input[type=checkbox]').all()) await box.check();
  await next(page);

  await expectStep(page, 'בונוס לקצין מטה');
  await expectWatermark(page);
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();

  // 25·6/6 + 15·0/6 + 40·8/8 + 20·3/3 = 85
  await expect(page.locator('.score-big .clock')).toHaveText('85%');
  await expect(page.locator('.score-level')).toHaveText('מצוין');

  await expect.poll(() => events.map((e) => e.event).join(',')).toContain('complete');
  expect(events[0]).toMatchObject({ pn: '9324493', team: '18', module: 'L01', event: 'start', version: '1.0' });
  expect(events.filter((e) => e.event === 'ask_first')).toHaveLength(1);
  const complete = events.find((e) => e.event === 'complete')!;
  expect(complete.score).toBe(85);
  expect(complete.seconds).toBeGreaterThanOrEqual(0);
  expect(events.filter((e) => e.event === 'step').length).toBeGreaterThanOrEqual(9);
});

test('events survive being offline and are sent on the next visit', async ({ page }) => {
  await mockTracking(page, { offline: true });
  await login(page, '/l01/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'פתיחה בזמן אמת');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lumda.queue') ?? '[]').length))
    .toBeGreaterThanOrEqual(1);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const events = await mockTracking(page);
  await page.reload();
  await expect.poll(() => events.length).toBeGreaterThanOrEqual(1);
  expect(events[0]!.event).toBe('start');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lumda.queue') ?? '[]').length)).toBe(0);
});

test('progress is kept on reload ("continue where you stopped")', async ({ page }) => {
  await mockTracking(page);
  await login(page, '/l01/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await next(page);
  await expectStep(page, 'מסמך הרקע');
  await page.reload();
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // entry: continue as XXXX493
  await expectStep(page, 'מסמך הרקע');
  await expect(page.locator('.clock-box')).toBeVisible();
});
