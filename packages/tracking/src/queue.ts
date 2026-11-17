import { getJSON, setJSON } from './storage';

export type EventName = 'start' | 'step' | 'complete' | 'ask_first';

/** One row in the staff sheet. Field names match the Apps Script doPost. */
export interface TrackEvent {
  pn: string;
  team: string;
  module: string;
  event: EventName;
  step: number;
  score: number | '';
  seconds: number;
  version: string;
}

const KEY = 'lumda.queue';
const MAX = 500;

export type Sender = (url: string, body: string) => Promise<void>;

/**
 * POST with Content-Type text/plain so the browser sends a "simple" request and skips the CORS preflight
 * Apps Script cannot answer. no-cors means the response is opaque: a resolved fetch counts as delivered,
 * a rejected one (offline, DNS) keeps the event queued.
 */
export const fetchSender: Sender = async (url, body) => {
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    // No keepalive: every event is persisted to the queue first, so a request cut off by navigation is
    // simply resent on the next visit.
  });
};

export function readQueue(): TrackEvent[] {
  return getJSON<TrackEvent[]>(KEY, []);
}

function writeQueue(q: TrackEvent[]) {
  setJSON(KEY, q.slice(-MAX));
}

export function enqueue(ev: TrackEvent): void {
  writeQueue([...readQueue(), ev]);
}

let flushing: Promise<number> | null = null;

/** Sends queued events in order; stops at the first failure. Resolves to the number sent. */
export function flush(url: string, send: Sender = fetchSender): Promise<number> {
  if (!url) return Promise.resolve(0);
  if (flushing) return flushing;
  // Events enqueued while this runs are picked up by the loop, which re-reads the queue each time.
  const run = (async () => {
    let sent = 0;
    for (;;) {
      const ev = readQueue()[0];
      if (!ev) break;
      try {
        await send(url, JSON.stringify(ev));
      } catch {
        break;
      }
      // Re-read: another tab may have changed the queue meanwhile.
      const now = readQueue();
      if (now.length && JSON.stringify(now[0]) === JSON.stringify(ev)) writeQueue(now.slice(1));
      sent++;
    }
    return sent;
  })();
  // Clear only after the assignment below has happened. With an empty queue the body above finishes
  // synchronously, and clearing inside it would leave a stale promise that blocks every later flush.
  flushing = run.finally(() => {
    if (flushing === guarded) flushing = null;
  });
  const guarded = flushing;
  return guarded;
}

export function createTracker(url: string, send: Sender = fetchSender) {
  const track = (ev: TrackEvent) => {
    enqueue(ev);
    return flush(url, send);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void flush(url, send));
  }
  void flush(url, send);
  return { track, flush: () => flush(url, send) };
}
