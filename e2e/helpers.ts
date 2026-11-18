import { expect, type Page } from '@playwright/test';
import { TRACKING_URL } from '../playwright.config';

export interface SentEvent {
  pn: string;
  team: string;
  module: string;
  event: string;
  step: number;
  score: number | '';
  seconds: number;
  version: string;
}

/** Fakes the Apps Script endpoint and records every event the page sends. */
export async function mockTracking(page: Page, opts: { offline?: boolean } = {}) {
  const events: SentEvent[] = [];
  await page.route(TRACKING_URL + '**', async (route) => {
    if (opts.offline) return route.abort('internetdisconnected');
    const body = route.request().postData();
    if (body) events.push(JSON.parse(body));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  return events;
}

export async function login(page: Page, path: string, pn = '9324493', team = '18') {
  await page.goto(path);
  await page.getByLabel('מספר אישי').fill(pn);
  await page.getByLabel('צוות', { exact: true }).selectOption(team);
  await page.getByRole('button', { name: 'כניסה' }).click();
}

export const next = (page: Page) => page.getByRole('button', { name: 'המשך', exact: true }).click();

export async function expectStep(page: Page, title: string) {
  await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
}

/** No horizontal page scroll at the current viewport (the spec's 360px minimum). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

export async function expectWatermark(page: Page) {
  const wm = page.locator('.watermark');
  await expect(wm).toHaveText('Developed by Itay Binyaminov');
  await expect(wm).toHaveCSS('pointer-events', 'none');
  await expect(wm).toHaveCSS('direction', 'ltr');
}
