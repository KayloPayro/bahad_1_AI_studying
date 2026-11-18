import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

const CASES: [string, string][] = [
  ['הודעה של שתי שורות לסגל', 'בלי AI: כותבים ישר'],
  ['שיחה אישית עם חייל שנמצא במצוקה', 'בלי AI בשיחה עצמה. מותר להתכונן מראש עם שאלות מנחות'],
  ['ציטוט מדויק מפקודה', 'להעתיק מהמקור מילה במילה, ולבדוק מול המקור'],
  ['ניתוח של 300 שורות נוכחות', 'עם AI, ובדיקה מדגמית של כמה שורות מול החישוב'],
  ['טיוטה לנאום בטקס סיום', 'עם AI לטיוטה, והקול שלך בעריכה'],
];

async function toRace(page: Page) {
  await login(page, '/l09/');
  await page.getByRole('button', { name: 'התחל' }).click();
  await expectStep(page, 'שתי משימות לפני המסדר');
  await expect(page.locator('.chat .bubble', { hasText: 'אל תפספס שום שינוי' })).toBeVisible({ timeout: 25_000 });
  await next(page);
  await expectStep(page, 'מרוץ נגד השעון');
}

async function runBoth(page: Page, section: string) {
  const sec = page.locator('section.race-task', { hasText: section });
  for (const mode of ['ידני', 'עם AI']) {
    await sec.getByRole('button', { name: `התחל שעון, ${mode}` }).click();
    await sec.getByRole('button', { name: `עצור שעון, ${mode}` }).click();
  }
  return sec;
}

test('L09 end to end: two timed tasks, five cases with reasons, score', async ({ page }) => {
  const events = await mockTracking(page);
  await toRace(page);
  await expect(page.getByText('אבטחת מידע').first()).toBeVisible();

  const short = await runBoth(page, 'משימה קצרה');
  await expect(short.locator('.race-sum .result-sum')).toContainText('ידני:');
  const long = page.locator('section.race-task', { hasText: 'משימה ארוכה' });
  await long.getByLabel('כמה הבדלים מצאת? (ידני)').selectOption('3');
  await long.getByRole('button', { name: 'התחל שעון, ידני' }).click();
  await long.getByRole('button', { name: 'עצור שעון, ידני' }).click();
  // The key stays closed until both runs are done.
  await expect(long.getByText('יש 6 הבדלים')).toHaveCount(0);
  await long.getByLabel('כמה הבדלים מצאת? (עם AI)').selectOption('6');
  await long.getByRole('button', { name: 'התחל שעון, עם AI' }).click();
  await long.getByRole('button', { name: 'עצור שעון, עם AI' }).click();
  await expect(long.getByText('יש 6 הבדלים')).toBeVisible();
  await expect(long.locator('li')).toHaveCount(6);
  await expect(long.locator('.note').last()).toContainText('ידני: 3');
  await expect(page.locator('.result-sum').last()).toContainText('2 מתוך 2');
  await expectNoHorizontalScroll(page);

  // The AI prompt carries both documents.
  await long.locator('details', { hasText: 'ההנחיה לריצה עם AI' }).locator('summary').click();
  await expect(long.locator('.snippet-text')).toContainText('נוהל הפעלת קשר בתרגיל, גרסה 2');
  await next(page);

  await expectStep(page, 'חמישה מקרים');
  await expect(page.getByRole('button', { name: 'הצג תשובות מומלצות' })).toBeDisabled();
  for (const [q, opt] of CASES) {
    const fs = page.locator('fieldset', { hasText: q });
    await fs.getByLabel(opt, { exact: true }).check();
    await fs.getByLabel('נמק בשורה אחת').fill('כי כך נכון לפי מה שלמדתי');
  }
  await page.getByRole('button', { name: 'הצג תשובות מומלצות' }).click();
  await expect(page.locator('.result-sum')).toContainText('5 מתוך 5');
  await expectNoHorizontalScroll(page);
  await next(page);

  await expectStep(page, 'ארבע שאלות לפני שפותחים כלי');
  await next(page);
  await expectStep(page, 'בונוס לקצין מטה');
  await page.getByRole('button', { name: 'סיום הלומדה' }).click();
  await expect(page.locator('.score-big .clock')).toHaveText('100%');
  await expect.poll(() => events.some((e) => e.event === 'complete' && e.module === 'L09' && e.score === 100)).toBe(true);
});

test('L09 the answers need a reason, and a different choice is explained', async ({ page }) => {
  await mockTracking(page);
  await toRace(page);
  await next(page);
  await expectStep(page, 'חמישה מקרים');
  for (const [q] of CASES) {
    const fs = page.locator('fieldset', { hasText: q });
    await fs.getByLabel('עם AI: מבקשים נוסח ומעתיקים').or(fs.getByRole('radio').first()).first().check();
  }
  // A reason is missing everywhere, so nothing can be checked yet.
  await expect(page.getByRole('button', { name: 'הצג תשובות מומלצות' })).toBeDisabled();
  for (const [q] of CASES) await page.locator('fieldset', { hasText: q }).getByLabel('נמק בשורה אחת').fill('ניסיון');
  await page.getByRole('button', { name: 'הצג תשובות מומלצות' }).click();
  await expect(page.locator('.quiz-result .status-bad').first()).toBeVisible();
  await expect(page.locator('.quiz-result').first()).toContainText('התשובה המומלצת');
});

test('L09 the clock does not start two runs together', async ({ page }) => {
  await mockTracking(page);
  await toRace(page);
  const sec = page.locator('section.race-task', { hasText: 'משימה קצרה' });
  await sec.getByRole('button', { name: 'התחל שעון, ידני' }).click();
  await expect(sec.getByRole('button', { name: 'התחל שעון, עם AI' })).toBeDisabled();
  await expect(page.locator('section.race-task', { hasText: 'משימה ארוכה' }).getByRole('button', { name: 'התחל שעון, ידני' })).toBeDisabled();
});
