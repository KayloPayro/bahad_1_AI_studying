const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/** Next week's dates, Sunday first (the Israeli week), as YYYYMMDD. "Next week" starts on the coming Sunday. */
export function nextWeekDates(from = new Date()): string[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  start.setDate(start.getDate() + (7 - start.getDay()));
  return Array.from({ length: 7 }, (_, i) => ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

/** A date `days` away from `from`, as YYYY-MM-DD (the format spreadsheets and boards import). */
export function isoDayOffset(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Fills date tokens in a generated file, so it is always about "now":
 * `{d0}` to `{d6}` = Sunday to Saturday of next week (YYYYMMDD); `{t-3}`, `{t+2}` = today minus 3 days, plus 2 days (YYYY-MM-DD).
 */
export function fillDates(text: string, from = new Date()): string {
  const days = nextWeekDates(from);
  return text
    .replace(/\{d([0-6])\}/g, (_m, i: string) => days[Number(i)]!)
    .replace(/\{t([+-]\d+)\}/g, (_m, n: string) => isoDayOffset(Number(n), from));
}
