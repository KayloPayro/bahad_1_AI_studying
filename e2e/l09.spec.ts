import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, expectStep, login, mockTracking, next } from './helpers';

const CASES: [string, string][] = [
  ['סיכום של נוהל לא מסווג', 'מבקש סיכום מ-AI וקורא את הנוהל כדי לוודא שלא נפל משהו מהותי'],
  ['חייל בצוות שלך נראה במצוקה', 'מנהל את השיחה בעצמי. אם אני רוצה להתכונן עם כלי AI, רק לפי נהלי היחידה, בלי שם החייל ובלי פרטים עליו'],
  ['ציטוט מדויק של סעיף מפקודה', 'פותח את הפקודה, מעתיק את הסעיף מילה במילה ובודק מול המקור'],
  ['קובץ נוכחות של 300 שורות', 'עם AI רק אם השימוש אושר, אחרי הסרת שמות ומספרים אישיים, ובודק את הדפוס עצמו מול הנתונים לפני שמעבירים למפקד'],
  ['טיוטה לנאום בטקס סיום', 'מבקש טיוטה מ-AI, ועורך אותה עד שהיא נשמעת כמוני'],
];
const LIST = [0, 0, 0, 0, 0, 1];

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
  await expect(long.getByText('7 הבדלים')).toHaveCount(0);
  await long.getByLabel('כמה הבדלים מצאת? (עם AI)').selectOption('6');
  await long.getByRole('button', { name: 'התחל שעון, עם AI' }).click();
  await long.getByRole('button', { name: 'עצור שעון, עם AI' }).click();
  await expect(long.getByText('נוהל הקשר (הריצה הידנית): 7 הבדלים.')).toBeVisible();
  await expect(long.getByText('נוהל השיירה (הריצה עם AI): 7 הבדלים.')).toBeVisible();
  await expect(long.locator('li')).toHaveCount(14);
  await expect(long.locator('.note').last()).toContainText('ידני: 3');
  await expect(page.locator('.result-sum').last()).toContainText('2 מתוך 2');
  await expectNoHorizontalScroll(page);

  // The AI run works on a different pair than the manual run, and the prompt carries that pair.
  await long.locator('details', { hasText: 'ההנחיה לריצה עם AI' }).locator('summary').click();
  await expect(long.locator('.snippet-text')).toContainText('נוהל תנועת שיירה בתרגיל, גרסה 2');
  await expect(long.locator('.snippet-text')).not.toContainText('נוהל הפעלת קשר');
  await next(page);

  // A list made by another tool: one invented line, two differences missing.
  await expectStep(page, 'בדיקת רשימה של כלי אחר');
  await expect(page.getByRole('button', { name: 'בדוק תשובות' })).toBeDisabled();
  const qs = page.locator('fieldset');
  for (let i = 0; i < LIST.length; i++) await qs.nth(i).getByRole('radio').nth(LIST[i]!).check();
  await qs.nth(6).getByRole('radio').first().check();
  await page.getByRole('button', { name: 'בדוק תשובות' }).click();
  await expect(page.locator('.result-sum')).toContainText('7 מתוך 7');
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

  await expectStep(page, 'חמש שאלות לפני שפותחים כלי');
  await expect(page.getByText('האם מותר להעביר את החומר לכלי חיצוני?')).toBeVisible();
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
  await next(page);
  await expectStep(page, 'חמישה מקרים');
  for (const [q] of CASES) {
    const fs = page.locator('fieldset', { hasText: q });
    await fs.getByRole('radio').first().check();
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
